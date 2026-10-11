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
        _config: &FootnotePaginatorConfig,
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
}
