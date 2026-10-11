//! Dynamic Footnote Apparatus Paginator & Multi-Page Carry-Over.
//!
//! Solves coordinated bottom apparatus band sizing and multi-page carry-over:
//! - Calculates page-specific footnote vertical demand from active/remaining lines.
//! - Enforces apparatus safety bounds (min band height up to max proportion of page height, e.g. 40%).
//! - Slices lines to fit within the solver-allocated footnote band.
//! - Carries over excess footnotes cleanly to subsequent pages without overflow defects.

use crate::geometry::LineBox;

/// Configuration for footnote apparatus sizing and multi-page pagination.
#[derive(Debug, Clone, PartialEq)]
pub struct FootnotePaginatorConfig {
    /// Maximum proportion of content area height that footnotes may occupy (typically 0.40 = 40%).
    pub max_height_ratio: f32,
    /// Minimum height (pt) for a footnote band if any footnotes exist.
    pub min_band_height_pt: f32,
    /// Separation gap (pt) above footnote apparatus.
    pub separator_gap_pt: f32,
    /// Minimum lines for footnote orphan/widow control.
    pub orphan_control: u8,
    pub widow_control: u8,
}

impl Default for FootnotePaginatorConfig {
    fn default() -> Self {
        Self {
            max_height_ratio: 0.40,
            min_band_height_pt: 20.0,
            separator_gap_pt: 6.0,
            orphan_control: 2,
            widow_control: 2,
        }
    }
}

/// Sliced footnote lines for placement on a single page apparatus band.
#[derive(Debug, Clone, PartialEq)]
pub struct FootnotePageSlice {
    pub placed_lines: Vec<LineBox>,
    pub lines_consumed: usize,
    pub actual_height_pt: f32,
    pub has_carry_over: bool,
}

pub struct DynamicFootnotePaginator;

impl DynamicFootnotePaginator {
    /// Calculates the target footnote band height (pt) to request from `GeometricConstraintSolver`
    /// for a page with the given remaining footnote lines.
    /// Returns `None` if there are no remaining footnote lines.
    pub fn calculate_target_height(
        remaining_lines: &[LineBox],
        content_height: f32,
        config: &FootnotePaginatorConfig,
    ) -> Option<f32> {
        if remaining_lines.is_empty() || content_height <= 0.0 {
            return None;
        }

        let max_permitted_h = content_height * config.max_height_ratio;
        let mut demand: f32 = 0.0;

        for line in remaining_lines {
            if demand + line.height > max_permitted_h && demand > 0.0 {
                break;
            }
            demand += line.height;
        }

        if demand <= 0.0 {
            return None;
        }

        let target_h = demand.max(config.min_band_height_pt).min(max_permitted_h);
        Some(target_h)
    }

    /// Slices lines to fit within the actual allocated height granted by `GeometricConstraintSolver`.
    /// Positions lines vertically within the apparatus band and indicates whether remaining lines
    /// must carry over to the next page.
    pub fn slice_for_allocated_band(
        remaining_lines: &[LineBox],
        allocated_height: f32,
        config: &FootnotePaginatorConfig,
    ) -> FootnotePageSlice {
        if remaining_lines.is_empty() || allocated_height <= 0.0 {
            return FootnotePageSlice {
                placed_lines: Vec::new(),
                lines_consumed: 0,
                actual_height_pt: 0.0,
                has_carry_over: false,
            };
        }

        let mut placed = Vec::new();
        let mut curr_y = 0.0;
        let mut idx = 0;

        while idx < remaining_lines.len() {
            let line = &remaining_lines[idx];
            if curr_y + line.height > allocated_height && !placed.is_empty() {
                break;
            }

            let mut positioned_line = line.clone();
            positioned_line.baseline_y = curr_y + positioned_line.height;
            positioned_line.line_index = placed.len();
            curr_y += positioned_line.height;
            placed.push(positioned_line);
            idx += 1;
        }

        // If a split occurred across a paragraph boundary, enforce orphan and widow control
        if idx < remaining_lines.len() && !placed.is_empty() {
            if let Some(split_pid) = remaining_lines[idx - 1].paragraph_id {
                let p_placed_count = placed
                    .iter()
                    .filter(|l| l.paragraph_id == Some(split_pid))
                    .count();
                let p_rem_count = remaining_lines[idx..]
                    .iter()
                    .take_while(|l| l.paragraph_id == Some(split_pid))
                    .count();

                if p_rem_count > 0 {
                    let orphan_min = (config.orphan_control as usize).max(1);
                    let widow_min = (config.widow_control as usize).max(1);

                    // 1. Check orphan control (fewer than orphan_control lines placed)
                    if p_placed_count < orphan_min {
                        let rollback = p_placed_count;
                        if placed.len() > rollback {
                            placed.truncate(placed.len() - rollback);
                            idx -= rollback;
                            curr_y = placed.iter().map(|l| l.height).sum();
                        }
                    }
                    // 2. Check widow control (fewer than widow_control lines remaining)
                    else if p_rem_count < widow_min {
                        let needed_for_widow = widow_min - p_rem_count;
                        if p_placed_count >= orphan_min + needed_for_widow {
                            placed.truncate(placed.len() - needed_for_widow);
                            idx -= needed_for_widow;
                            curr_y = placed.iter().map(|l| l.height).sum();
                        } else {
                            let rollback = p_placed_count;
                            if placed.len() > rollback {
                                placed.truncate(placed.len() - rollback);
                                idx -= rollback;
                                curr_y = placed.iter().map(|l| l.height).sum();
                            }
                        }
                    }
                }
            }
        }

        let has_carry_over = idx < remaining_lines.len();

        FootnotePageSlice {
            placed_lines: placed,
            lines_consumed: idx,
            actual_height_pt: curr_y,
            has_carry_over,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn make_fn_line(idx: usize, height: f32) -> LineBox {
        LineBox {
            line_index: idx,
            paragraph_id: None,
            baseline_y: height,
            height,
            width: 400.0,
            glyphs: Vec::new(),
            text: format!("הערה {}", idx),
            is_rtl: true,
            fonts: Vec::new(),
        }
    }

    #[test]
    fn test_calculate_target_height_empty_returns_none() {
        let lines = Vec::new();
        let config = FootnotePaginatorConfig::default();
        assert_eq!(DynamicFootnotePaginator::calculate_target_height(&lines, 500.0, &config), None);
    }

    #[test]
    fn test_calculate_target_height_capped_at_max_ratio() {
        let lines: Vec<_> = (0..20).map(|i| make_fn_line(i, 20.0)).collect(); // 400pt total
        let config = FootnotePaginatorConfig {
            max_height_ratio: 0.30, // 30% of 600 = 180pt max
            min_band_height_pt: 20.0,
            ..Default::default()
        };
        let target = DynamicFootnotePaginator::calculate_target_height(&lines, 600.0, &config);
        assert_eq!(target, Some(180.0));
    }

    #[test]
    fn test_calculate_target_height_small_demand_bounded_by_min() {
        let lines = vec![make_fn_line(0, 10.0)];
        let config = FootnotePaginatorConfig {
            max_height_ratio: 0.40,
            min_band_height_pt: 30.0,
            ..Default::default()
        };
        let target = DynamicFootnotePaginator::calculate_target_height(&lines, 500.0, &config);
        assert_eq!(target, Some(30.0));
    }

    #[test]
    fn test_slice_for_allocated_band_partial_and_carry_over() {
        let lines: Vec<_> = (0..10).map(|i| make_fn_line(i, 15.0)).collect(); // 150pt
        let config = FootnotePaginatorConfig::default();

        let slice = DynamicFootnotePaginator::slice_for_allocated_band(&lines, 50.0, &config);
        // 50pt / 15pt = 3 lines (45pt)
        assert_eq!(slice.placed_lines.len(), 3);
        assert_eq!(slice.lines_consumed, 3);
        assert_eq!(slice.actual_height_pt, 45.0);
        assert!(slice.has_carry_over);
    }

    #[test]
    fn test_slice_for_allocated_band_all_fit() {
        let lines: Vec<_> = (0..3).map(|i| make_fn_line(i, 15.0)).collect(); // 45pt
        let config = FootnotePaginatorConfig::default();

        let slice = DynamicFootnotePaginator::slice_for_allocated_band(&lines, 60.0, &config);
        assert_eq!(slice.placed_lines.len(), 3);
        assert_eq!(slice.lines_consumed, 3);
        assert_eq!(slice.actual_height_pt, 45.0);
        assert!(!slice.has_carry_over);
    }

    #[test]
    fn test_footnote_orphan_control_prevents_single_line() {
        use tok_core::NodeId;
        let fn_id1 = NodeId::new();
        let fn_id2 = NodeId::new();

        let mut lines = Vec::new();
        // Footnote 1 has 2 lines (30pt)
        for i in 0..2 {
            let mut l = make_fn_line(i, 15.0);
            l.paragraph_id = Some(fn_id1);
            lines.push(l);
        }
        // Footnote 2 has 3 lines (45pt)
        for i in 0..3 {
            let mut l = make_fn_line(2 + i, 15.0);
            l.paragraph_id = Some(fn_id2);
            lines.push(l);
        }

        let config = FootnotePaginatorConfig {
            orphan_control: 2,
            widow_control: 2,
            ..Default::default()
        };

        // Budget of 50pt:
        // Line 0, 1 of fn1 take 30pt.
        // Remaining budget is 20pt. 1 line of fn2 (15pt) could fit, but that would leave a 1-line orphan!
        // Orphan control must roll back line 0 of fn2, leaving only fn1 (2 lines).
        let slice = DynamicFootnotePaginator::slice_for_allocated_band(&lines, 50.0, &config);
        assert_eq!(slice.lines_consumed, 2, "Must not place a single orphan line of fn2");
        assert_eq!(slice.placed_lines.len(), 2);
        assert_eq!(slice.placed_lines[0].paragraph_id, Some(fn_id1));
        assert_eq!(slice.placed_lines[1].paragraph_id, Some(fn_id1));
        assert!(slice.has_carry_over);
    }

    #[test]
    fn test_footnote_widow_control_pushes_balanced_lines() {
        use tok_core::NodeId;
        let fn_id1 = NodeId::new();

        // Single footnote with 4 lines (60pt)
        let mut lines = Vec::new();
        for i in 0..4 {
            let mut l = make_fn_line(i, 15.0);
            l.paragraph_id = Some(fn_id1);
            lines.push(l);
        }

        let config = FootnotePaginatorConfig {
            orphan_control: 2,
            widow_control: 2,
            ..Default::default()
        };

        // Budget of 50pt fits 3 lines (45pt), which would leave 1 line (a widow) on the next page!
        // Widow control must push back line 2, so that 2 lines are on page 1 and 2 lines on page 2.
        let slice = DynamicFootnotePaginator::slice_for_allocated_band(&lines, 50.0, &config);
        assert_eq!(slice.lines_consumed, 2, "Must balance lines to avoid 1-line widow on next page");
        assert_eq!(slice.placed_lines.len(), 2);
        assert_eq!(slice.actual_height_pt, 30.0);
        assert!(slice.has_carry_over);
    }
}
