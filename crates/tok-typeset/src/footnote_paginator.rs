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
