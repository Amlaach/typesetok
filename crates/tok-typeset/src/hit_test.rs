//! Spatial Hit-Testing Engine for WYSIWYG Page Editing (Section 9.2 & Section 10).
//!
//! Provides sub-pixel accurate coordinate-to-text mapping:
//! - Maps physical points (pt) on a page to exact TextFrameBox, LineBox, GlyphBox, and cluster offset.
//! - Accurately differentiates leading vs trailing edge of glyphs for caret positioning.
//! - RTL-aware: accounts for right-to-left Hebrew layout and mixed Bidirectional runs.
//! - Computes multi-line selection bounding rectangles for mouse-drag visual selection.

use crate::geometry::{LineBox, PageLayoutBox, PhysicalPoint, PhysicalRect, TextFrameBox};
use serde::{Deserialize, Serialize};
use tok_core::id::NodeId;

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct HitTestResult {
    pub page_index: usize,
    pub frame_id: String,
    pub flow_id: String,
    pub paragraph_id: Option<NodeId>,
    pub line_index: usize,
    pub glyph_index: Option<usize>,
    pub cluster: u32,
    pub character: Option<char>,
    pub visual_x_pt: f32,
    pub visual_y_pt: f32,
    pub caret_height: f32,
    pub is_rtl: bool,
    pub is_leading_edge: bool,
}

pub struct HitTester;

impl HitTester {
    /// Hit-tests a physical coordinate (x_pt, y_pt) within a PageLayoutBox.
    /// Returns the exact text target and visual caret placement.
    pub fn hit_test(page: &PageLayoutBox, x_pt: f32, y_pt: f32) -> Option<HitTestResult> {
        if page.frames.is_empty() {
            return None;
        }

        // 1. Find target frame: prioritize frames containing the point, or closest frame
        let target_frame = Self::find_best_frame(&page.frames, x_pt, y_pt)?;

        // If the frame has no lines, place caret at the start of the frame
        if target_frame.lines.is_empty() {
            return Some(HitTestResult {
                page_index: page.page_index,
                frame_id: target_frame.frame_id.clone(),
                flow_id: target_frame.flow_id.clone(),
                paragraph_id: None,
                line_index: 0,
                glyph_index: None,
                cluster: 0,
                character: None,
                visual_x_pt: target_frame.rect.x,
                visual_y_pt: target_frame.rect.y,
                caret_height: 12.0,
                is_rtl: true,
                is_leading_edge: true,
            });
        }

        // Relative coordinates inside the frame
        let frame_rel_y = y_pt - target_frame.rect.y;
        let frame_rel_x = x_pt - target_frame.rect.x;

        // 2. Find best matching line
        let (line_idx, line) = Self::find_best_line(&target_frame.lines, frame_rel_y);

        // 3. Resolve glyph and caret within the line
        let (glyph_idx, cluster, ch, glyph_rel_x, is_leading) =
            Self::hit_test_line_glyphs(line, frame_rel_x);

        let visual_x_pt = target_frame.rect.x + glyph_rel_x;
        let visual_y_pt = target_frame.rect.y + (line.baseline_y - line.height);

        Some(HitTestResult {
            page_index: page.page_index,
            frame_id: target_frame.frame_id.clone(),
            flow_id: target_frame.flow_id.clone(),
            paragraph_id: line.paragraph_id,
            line_index: line_idx,
            glyph_index: glyph_idx,
            cluster,
            character: ch,
            visual_x_pt,
            visual_y_pt,
            caret_height: line.height,
            is_rtl: line.is_rtl,
            is_leading_edge: is_leading,
        })
    }

    /// Computes visual highlight bounding rectangles for a selection spanning
    /// between two hit-test points on the same page.
    pub fn hit_test_range(
        page: &PageLayoutBox,
        start_pt: PhysicalPoint,
        end_pt: PhysicalPoint,
    ) -> Vec<PhysicalRect> {
        let hit_a = match Self::hit_test(page, start_pt.x, start_pt.y) {
            Some(h) => h,
            None => return Vec::new(),
        };
        let hit_b = match Self::hit_test(page, end_pt.x, end_pt.y) {
            Some(h) => h,
            None => return Vec::new(),
        };

        let mut rects = Vec::new();
        let target_frame = match page.frames.iter().find(|f| f.frame_id == hit_a.frame_id) {
            Some(f) => f,
            None => return Vec::new(),
        };

        let (min_hit, max_hit) = if hit_a.line_index < hit_b.line_index {
            (&hit_a, &hit_b)
        } else if hit_a.line_index > hit_b.line_index {
            (&hit_b, &hit_a)
        } else {
            (&hit_a, &hit_b)
        };

        if min_hit.line_index == max_hit.line_index {
            // Single-line selection
            let line = match target_frame.lines.get(min_hit.line_index) {
                Some(l) => l,
                None => return Vec::new(),
            };
            let left_x = hit_a.visual_x_pt.min(hit_b.visual_x_pt);
            let right_x = hit_a.visual_x_pt.max(hit_b.visual_x_pt);
            let width = (right_x - left_x).max(2.0);
            let y = target_frame.rect.y + line.baseline_y - line.height;
            rects.push(PhysicalRect::new(left_x, y, width, line.height));
        } else {
            // Multi-line selection
            for l_idx in min_hit.line_index..=max_hit.line_index {
                let line = match target_frame.lines.get(l_idx) {
                    Some(l) => l,
                    None => continue,
                };
                let y = target_frame.rect.y + line.baseline_y - line.height;

                if l_idx == min_hit.line_index {
                    // Top line
                    let (x, w) = if line.is_rtl {
                        let left = target_frame.rect.x;
                        let right = min_hit.visual_x_pt;
                        (left, (right - left).max(2.0))
                    } else {
                        let left = min_hit.visual_x_pt;
                        let right = target_frame.rect.x + line.width;
                        (left, (right - left).max(2.0))
                    };
                    rects.push(PhysicalRect::new(x, y, w, line.height));
                } else if l_idx == max_hit.line_index {
                    // Bottom line
                    let (x, w) = if line.is_rtl {
                        let left = max_hit.visual_x_pt;
                        let right = target_frame.rect.x + line.width;
                        (left, (right - left).max(2.0))
                    } else {
                        let left = target_frame.rect.x;
                        let right = max_hit.visual_x_pt;
                        (left, (right - left).max(2.0))
                    };
                    rects.push(PhysicalRect::new(x, y, w, line.height));
                } else {
                    // Full intermediate line
                    rects.push(PhysicalRect::new(
                        target_frame.rect.x,
                        y,
                        line.width.max(target_frame.rect.width),
                        line.height,
                    ));
                }
            }
        }

        rects
    }

    fn find_best_frame(frames: &[TextFrameBox], x: f32, y: f32) -> Option<&TextFrameBox> {
        let pt = PhysicalPoint { x, y };
        for frame in frames {
            if frame.rect.contains_point(pt) {
                return Some(frame);
            }
        }

        frames.iter().min_by(|a, b| {
            let dist_a = Self::dist_sq_to_rect(x, y, &a.rect);
            let dist_b = Self::dist_sq_to_rect(x, y, &b.rect);
            dist_a
                .partial_cmp(&dist_b)
                .unwrap_or(std::cmp::Ordering::Equal)
        })
    }

    fn dist_sq_to_rect(x: f32, y: f32, rect: &PhysicalRect) -> f32 {
        let cx = rect.x + rect.width / 2.0;
        let cy = rect.y + rect.height / 2.0;
        (x - cx).powi(2) + (y - cy).powi(2)
    }

    fn find_best_line(lines: &[LineBox], frame_rel_y: f32) -> (usize, &LineBox) {
        if lines.is_empty() {
            panic!("lines cannot be empty");
        }

        let first_top = lines[0].baseline_y - lines[0].height;
        if frame_rel_y <= first_top {
            return (0, &lines[0]);
        }

        let last_idx = lines.len() - 1;
        let last_bottom = lines[last_idx].baseline_y;
        if frame_rel_y >= last_bottom {
            return (last_idx, &lines[last_idx]);
        }

        for (i, line) in lines.iter().enumerate() {
            let top = line.baseline_y - line.height;
            let bottom = line.baseline_y;
            if frame_rel_y >= top && frame_rel_y <= bottom {
                return (i, line);
            }
        }

        let best_idx = lines
            .iter()
            .enumerate()
            .min_by(|(_, a), (_, b)| {
                let da = (a.baseline_y - frame_rel_y).abs();
                let db = (b.baseline_y - frame_rel_y).abs();
                da.partial_cmp(&db).unwrap_or(std::cmp::Ordering::Equal)
            })
            .map(|(i, _)| i)
            .unwrap_or(0);

        (best_idx, &lines[best_idx])
    }

    fn hit_test_line_glyphs(
        line: &LineBox,
        frame_rel_x: f32,
    ) -> (Option<usize>, u32, Option<char>, f32, bool) {
        if line.glyphs.is_empty() {
            return (None, 0, None, 0.0, true);
        }

        let first_g = &line.glyphs[0];
        if frame_rel_x <= first_g.x {
            return (Some(0), first_g.cluster, first_g.character, first_g.x, true);
        }

        let last_idx = line.glyphs.len() - 1;
        let last_g = &line.glyphs[last_idx];
        if frame_rel_x >= last_g.x + last_g.width {
            return (
                Some(last_idx),
                last_g.cluster,
                last_g.character,
                last_g.x + last_g.width,
                false,
            );
        }

        for (idx, g) in line.glyphs.iter().enumerate() {
            let start = g.x;
            let end = g.x + g.width;
            if frame_rel_x >= start && frame_rel_x <= end {
                let mid = start + g.width / 2.0;
                let is_leading = if line.is_rtl {
                    frame_rel_x >= mid
                } else {
                    frame_rel_x <= mid
                };

                let caret_x = if frame_rel_x < mid { start } else { end };

                return (Some(idx), g.cluster, g.character, caret_x, is_leading);
            }
        }

        let (idx, g) = line
            .glyphs
            .iter()
            .enumerate()
            .min_by(|(_, a), (_, b)| {
                let ca = a.x + a.width / 2.0;
                let cb = b.x + b.width / 2.0;
                (ca - frame_rel_x)
                    .abs()
                    .partial_cmp(&(cb - frame_rel_x).abs())
                    .unwrap_or(std::cmp::Ordering::Equal)
            })
            .unwrap_or((0, &line.glyphs[0]));

        let mid = g.x + g.width / 2.0;
        let caret_x = if frame_rel_x < mid {
            g.x
        } else {
            g.x + g.width
        };
        let is_leading = if line.is_rtl {
            frame_rel_x >= mid
        } else {
            frame_rel_x <= mid
        };

        (Some(idx), g.cluster, g.character, caret_x, is_leading)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::geometry::GlyphBox;

    fn create_test_page() -> PageLayoutBox {
        let glyphs_line0 = vec![
            GlyphBox {
                glyph_id: 1,
                cluster: 0,
                x: 0.0,
                y: 0.0,
                width: 10.0,
                height: 12.0,
                character: Some('א'),
            },
            GlyphBox {
                glyph_id: 2,
                cluster: 1,
                x: 10.0,
                y: 0.0,
                width: 10.0,
                height: 12.0,
                character: Some('ב'),
            },
            GlyphBox {
                glyph_id: 3,
                cluster: 2,
                x: 20.0,
                y: 0.0,
                width: 10.0,
                height: 12.0,
                character: Some('ג'),
            },
        ];

        let line0 = LineBox {
            line_index: 0,
            paragraph_id: Some(NodeId::new()),
            baseline_y: 14.0,
            height: 14.0,
            width: 30.0,
            glyphs: glyphs_line0,
            text: "אבג".to_string(),
            is_rtl: true,
        };

        let line1 = LineBox {
            line_index: 1,
            paragraph_id: Some(NodeId::new()),
            baseline_y: 28.0,
            height: 14.0,
            width: 30.0,
            glyphs: vec![
                GlyphBox {
                    glyph_id: 4,
                    cluster: 0,
                    x: 0.0,
                    y: 0.0,
                    width: 15.0,
                    height: 12.0,
                    character: Some('ד'),
                },
                GlyphBox {
                    glyph_id: 5,
                    cluster: 1,
                    x: 15.0,
                    y: 0.0,
                    width: 15.0,
                    height: 12.0,
                    character: Some('ה'),
                },
            ],
            text: "דה".to_string(),
            is_rtl: true,
        };

        let frame = TextFrameBox {
            frame_id: "frame_1".to_string(),
            flow_id: "main".to_string(),
            rect: PhysicalRect::new(50.0, 50.0, 200.0, 400.0),
            lines: vec![line0, line1],
        };

        PageLayoutBox {
            page_index: 0,
            page_number_gematria: "א׳".to_string(),
            dimensions: PhysicalRect::a4_portrait(),
            frames: vec![frame],
            break_token: None,
        }
    }

    #[test]
    fn test_hit_test_precise_glyph_detection() {
        let page = create_test_page();

        // Hit near first glyph of line 0 (x: 50.0 + 3.0 = 53.0, y: 50.0 + 7.0 = 57.0)
        let hit = HitTester::hit_test(&page, 53.0, 57.0).expect("Should hit glyph");
        assert_eq!(hit.line_index, 0);
        assert_eq!(hit.glyph_index, Some(0));
        assert_eq!(hit.character, Some('א'));
        assert_eq!(hit.visual_x_pt, 50.0); // snapped to left edge of glyph (frame_x + g.x)
        assert_eq!(hit.visual_y_pt, 50.0); // frame_y + baseline(14) - height(14) = 50.0

        // Hit second glyph on trailing edge
        let hit2 = HitTester::hit_test(&page, 50.0 + 18.0, 57.0).expect("Should hit glyph");
        assert_eq!(hit2.glyph_index, Some(1));
        assert_eq!(hit2.character, Some('ב'));
        assert_eq!(hit2.visual_x_pt, 70.0); // snapped to right edge of glyph (50 + 20)
    }

    #[test]
    fn test_hit_test_line_selection_range() {
        let page = create_test_page();
        let start = PhysicalPoint { x: 55.0, y: 55.0 };
        let end = PhysicalPoint { x: 75.0, y: 55.0 };

        let rects = HitTester::hit_test_range(&page, start, end);
        assert_eq!(rects.len(), 1);
        assert!(rects[0].width >= 20.0);
        assert_eq!(rects[0].height, 14.0);
    }
}
