//! Shared Column Height Balancing across Parallel Flows (איזון גובה תחתון משותף).
//!
//! Provides mathematical vertical justification and bottom baseline alignment
//! across parallel columns (Gemara, Rashi, Tosafot / Torah, Targum, Ramban):
//! 1. Bottom Baseline Envelope: Computes the target bottom baseline $Y_{\text{target}}$ across columns.
//! 2. Elastic Spring Distribution: Spreads vertical expansion across inter-line and inter-paragraph
//!    gaps in shorter columns so their bottom lines align with $Y_{\text{target}}$.
//! 3. Proportional Balance: Clamps max vertical spring expansion to prevent typographic defects.
//! 4. Section-End Equalization: Equalizes column heights when text finishes mid-page.

use crate::geometry::TextFrameBox;

/// Configuration for vertical column height balancing.
#[derive(Debug, Clone, PartialEq)]
pub struct HeightBalanceConfig {
    /// Maximum vertical expansion per line gap in points (default: 3.0 pt).
    pub max_line_expansion_pt: f32,
    /// Maximum vertical expansion per paragraph boundary in points (default: 15.0 pt).
    pub max_paragraph_expansion_pt: f32,
    /// Minimum line count in a column to participate in balancing (default: 3).
    pub min_lines_for_balance: usize,
    /// Target mode for vertical alignment.
    pub target_mode: BalanceTargetMode,
}

impl Default for HeightBalanceConfig {
    fn default() -> Self {
        Self {
            max_line_expansion_pt: 3.5,
            max_paragraph_expansion_pt: 16.0,
            min_lines_for_balance: 3,
            target_mode: BalanceTargetMode::TallestColumn,
        }
    }
}

/// Target baseline selection mode for vertical column balancing.
#[derive(Debug, Clone, Copy, PartialEq)]
pub enum BalanceTargetMode {
    /// Align all columns to the bottom baseline of the tallest column on the page.
    TallestColumn,
    /// Align all columns to a fixed bottom baseline coordinate (in points).
    FixedPageBottom(f32),
    /// Align all columns to the average bottom baseline of all participating columns.
    AverageHeight,
}

/// Audit report detailing vertical balancing adjustments applied to a column.
#[derive(Debug, Clone, PartialEq)]
pub struct ColumnBalanceReport {
    pub flow_id: String,
    pub original_bottom_y: f32,
    pub balanced_bottom_y: f32,
    pub spring_injected_pt: f32,
    pub gaps_expanded: usize,
}

pub struct SharedColumnHeightBalancer;

impl SharedColumnHeightBalancer {
    /// Balances text lines across parallel text frames on a page using distributed elastic springs,
    /// aligning their bottom baselines along a shared vertical baseline envelope.
    pub fn balance_page_frames(
        frames: &mut [TextFrameBox],
        config: &HeightBalanceConfig,
    ) -> Vec<ColumnBalanceReport> {
        let mut reports = Vec::new();

        // 1. Identify active participating frames and their current bottom baselines
        let mut column_bottoms: Vec<(usize, f32)> = Vec::new();
        for (idx, frame) in frames.iter().enumerate() {
            if frame.lines.len() >= config.min_lines_for_balance {
                if let Some(last_line) = frame.lines.last() {
                    column_bottoms.push((idx, last_line.baseline_y));
                }
            }
        }

        if column_bottoms.is_empty() {
            return reports;
        }

        // 2. Determine target bottom baseline Y_target
        let target_y = match config.target_mode {
            BalanceTargetMode::TallestColumn => {
                column_bottoms
                    .iter()
                    .map(|(_, y)| *y)
                    .fold(0.0_f32, |acc, y| acc.max(y))
            }
            BalanceTargetMode::FixedPageBottom(y) => y,
            BalanceTargetMode::AverageHeight => {
                let sum: f32 = column_bottoms.iter().map(|(_, y)| *y).sum();
                sum / column_bottoms.len() as f32
            }
        };

        // 3. For each participating frame, distribute elastic springs to bridge the height deficit
        for (frame_idx, orig_bottom_y) in column_bottoms {
            let deficit_pt = target_y - orig_bottom_y;
            let frame = &mut frames[frame_idx];

            if deficit_pt <= 0.5 {
                // Already at or exceeding target
                reports.push(ColumnBalanceReport {
                    flow_id: frame.flow_id.clone(),
                    original_bottom_y: orig_bottom_y,
                    balanced_bottom_y: orig_bottom_y,
                    spring_injected_pt: 0.0,
                    gaps_expanded: 0,
                });
                continue;
            }

            let num_lines = frame.lines.len();
            if num_lines < 2 {
                continue;
            }

            // Identify gaps: inter-line and paragraph boundaries
            let mut gap_weights = Vec::with_capacity(num_lines - 1);
            let mut total_weight = 0.0;

            for i in 0..(num_lines - 1) {
                let is_para_boundary = frame.lines[i].paragraph_id != frame.lines[i + 1].paragraph_id;
                let weight = if is_para_boundary {
                    // Paragraph boundaries absorb more vertical spring
                    config.max_paragraph_expansion_pt.max(1.0)
                } else {
                    // Regular line gap
                    config.max_line_expansion_pt.max(0.5)
                };
                gap_weights.push((weight, is_para_boundary));
                total_weight += weight;
            }

            if total_weight <= 0.0 {
                continue;
            }

            // Clamp total expansion by max capacity
            let allowable_expansion = deficit_pt.min(total_weight);

            // Apply cumulative vertical spring to each subsequent line
            let mut accumulated_spring = 0.0;
            let gaps_count = gap_weights.len();

            for (i, (weight, is_para_boundary)) in gap_weights.into_iter().enumerate() {
                let gap_expansion = if is_para_boundary {
                    (allowable_expansion * (weight / total_weight))
                        .min(config.max_paragraph_expansion_pt)
                } else {
                    (allowable_expansion * (weight / total_weight))
                        .min(config.max_line_expansion_pt)
                };

                accumulated_spring += gap_expansion;
                frame.lines[i + 1].baseline_y += accumulated_spring;
            }

            let new_bottom_y = frame.lines.last().map(|l| l.baseline_y).unwrap_or(orig_bottom_y);

            reports.push(ColumnBalanceReport {
                flow_id: frame.flow_id.clone(),
                original_bottom_y: orig_bottom_y,
                balanced_bottom_y: new_bottom_y,
                spring_injected_pt: accumulated_spring,
                gaps_expanded: gaps_count,
            });
        }

        reports
    }
}
