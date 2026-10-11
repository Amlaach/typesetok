//! Typographic Page-Break Penalty Model & Defect Prevention.
//!
//! Evaluates page-break candidates across consecutive lines and paragraphs,
//! enforcing TeX-style penalties and badness functions to eliminate:
//! - Stranded headings (`keep_with_next`)
//! - Orphan lines at the bottom of a page (`orphan_control`)
//! - Widow lines at the top of the subsequent page (`widow_control`)
//! - Excessive underfull or overfull page slack

use tok_core::id::FractionalIndex;

/// Standard typographic penalties for page breaks.
pub struct PageBreakPenalty;

impl PageBreakPenalty {
    /// Severe penalty representing a prohibited break (e.g. immediately after a heading).
    pub const INFINITE: f32 = 10_000.0;
    /// Forced page break (e.g. explicit page-break directive or section boundary).
    pub const FORCED: f32 = -10_000.0;
    /// Penalty for creating an orphan line (fewer lines than `orphan_control` at bottom of page).
    pub const ORPHAN: f32 = 8_000.0;
    /// Penalty for creating a widow line (fewer lines than `widow_control` on the next page).
    pub const WIDOW: f32 = 8_000.0;
    /// Penalty for breaking right after a paragraph marked with `keep_with_next`.
    pub const KEEP_WITH_NEXT: f32 = 10_000.0;
}

/// A candidate point between two lines where a page break could potentially occur.
#[derive(Debug, Clone, PartialEq)]
pub struct BreakOpportunity {
    /// Absolute index in the flattened lines sequence.
    pub global_line_idx: usize,
    /// ID of the paragraph this line belongs to.
    pub paragraph_id: Option<FractionalIndex>,
    /// 0-based index of this line within its paragraph.
    pub line_in_paragraph: usize,
    /// Total lines comprising this paragraph.
    pub total_lines_in_paragraph: usize,
    /// Whether the paragraph's style requests keeping it with the next paragraph.
    pub keep_with_next: bool,
    /// Minimum lines that must remain at the bottom of the page (typically 2).
    pub orphan_control: u8,
    /// Minimum lines that must be pushed to the top of the next page (typically 2).
    pub widow_control: u8,
    /// Height of the line box itself.
    pub line_height: f32,
    /// Collapsed inter-paragraph margin after this line (if this is the last line of the paragraph).
    pub margin_after: f32,
}

impl BreakOpportunity {
    /// Returns true if this line is the final line of its paragraph.
    #[inline]
    pub fn is_last_line_of_paragraph(&self) -> bool {
        self.line_in_paragraph + 1 == self.total_lines_in_paragraph
    }

    /// Calculates typographic penalty for breaking *immediately after* this line.
    pub fn calculate_penalty(&self) -> f32 {
        let mut penalty = 0.0;

        // 1. Heading stranded check: if paragraph requests keep_with_next and this is its last line,
        // breaking immediately after it leaves the heading stranded at the page bottom.
        if self.keep_with_next && self.is_last_line_of_paragraph() {
            penalty += PageBreakPenalty::KEEP_WITH_NEXT;
        }

        // 2. Orphan check: if paragraph is broken, how many lines remain on the current page?
        // If fewer than orphan_control lines remain, heavily penalize.
        let lines_on_current_page = self.line_in_paragraph + 1;
        if lines_on_current_page < self.total_lines_in_paragraph {
            let min_orphans = (self.orphan_control as usize).max(1);
            if lines_on_current_page < min_orphans {
                penalty += PageBreakPenalty::ORPHAN;
            }

            // 3. Widow check: how many lines will be pushed to the next page?
            // If fewer than widow_control lines are pushed, heavily penalize.
            let lines_on_next_page = self.total_lines_in_paragraph - lines_on_current_page;
            let min_widows = (self.widow_control as usize).max(1);
            if lines_on_next_page < min_widows {
                penalty += PageBreakPenalty::WIDOW;
            }
        }

        penalty
    }
}

/// Evaluates underfull badness for a page according to TeX's cubic badness model:
/// $B = 100 \times (\Delta h / h_{\text{target}})^3$.
pub fn compute_badness(accumulated_height: f32, target_height: f32) -> f32 {
    if !target_height.is_finite() || target_height <= 0.0 {
        return 0.0;
    }
    if accumulated_height > target_height {
        // Overfull page: extreme penalty proportional to overflow
        let overflow = accumulated_height - target_height;
        return 10_000.0 + (overflow * 100.0);
    }

    let deficit = target_height - accumulated_height;
    let ratio = (deficit / target_height).clamp(0.0, 1.0);
    // Cubic scaling: a nearly full page has badness near 0; a half-empty page has badness ~ 12.5; empty is 100.
    100.0 * ratio.powi(3)
}

/// Combined cost of taking a page break at a given height and opportunity.
pub fn score_page_break(accumulated_height: f32, target_height: f32, opportunity: &BreakOpportunity) -> f32 {
    let badness = compute_badness(accumulated_height, target_height);
    let penalty = opportunity.calculate_penalty();
    badness + penalty
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_normal_break_has_zero_penalty() {
        let opp = BreakOpportunity {
            global_line_idx: 3,
            paragraph_id: Some(FractionalIndex::new("p1")),
            line_in_paragraph: 2, // 3rd line of 6
            total_lines_in_paragraph: 6,
            keep_with_next: false,
            orphan_control: 2,
            widow_control: 2,
            line_height: 14.5,
            margin_after: 0.0,
        };
        assert_eq!(opp.calculate_penalty(), 0.0);
    }

    #[test]
    fn test_orphan_penalty_triggered() {
        // Line 0 of 5 -> only 1 line on current page, but orphan_control is 2
        let opp = BreakOpportunity {
            global_line_idx: 10,
            paragraph_id: Some(FractionalIndex::new("p2")),
            line_in_paragraph: 0,
            total_lines_in_paragraph: 5,
            keep_with_next: false,
            orphan_control: 2,
            widow_control: 2,
            line_height: 14.5,
            margin_after: 0.0,
        };
        let penalty = opp.calculate_penalty();
        assert!(penalty >= PageBreakPenalty::ORPHAN);
    }

    #[test]
    fn test_widow_penalty_triggered() {
        // Line 3 of 5 -> 4 lines on current page, only 1 line left for next page!
        let opp = BreakOpportunity {
            global_line_idx: 14,
            paragraph_id: Some(FractionalIndex::new("p3")),
            line_in_paragraph: 3,
            total_lines_in_paragraph: 5,
            keep_with_next: false,
            orphan_control: 2,
            widow_control: 2,
            line_height: 14.5,
            margin_after: 0.0,
        };
        let penalty = opp.calculate_penalty();
        assert!(penalty >= PageBreakPenalty::WIDOW);
    }

    #[test]
    fn test_keep_with_next_heading_penalty() {
        // 1-line heading with keep_with_next = true
        let opp = BreakOpportunity {
            global_line_idx: 5,
            paragraph_id: Some(FractionalIndex::new("h1")),
            line_in_paragraph: 0,
            total_lines_in_paragraph: 1,
            keep_with_next: true,
            orphan_control: 2,
            widow_control: 2,
            line_height: 20.0,
            margin_after: 8.0,
        };
        assert!(opp.is_last_line_of_paragraph());
        let penalty = opp.calculate_penalty();
        assert!(penalty >= PageBreakPenalty::KEEP_WITH_NEXT);
    }

    #[test]
    fn test_compute_badness_cubic_and_overflow() {
        let target = 500.0;
        // Perfect fit: 0 deficit -> 0 badness
        assert!((compute_badness(500.0, target) - 0.0).abs() < 1e-4);

        // Small deficit (450/500, ratio 0.1) -> 100 * (0.1)^3 = 0.1
        let b_450 = compute_badness(450.0, target);
        assert!(b_450 < 1.0);

        // Half page (250/500, ratio 0.5) -> 100 * (0.5)^3 = 12.5
        let b_250 = compute_badness(250.0, target);
        assert!((b_250 - 12.5).abs() < 1e-4);

        // Empty page (0/500, ratio 1.0) -> 100 * (1.0)^3 = 100.0
        let b_0 = compute_badness(0.0, target);
        assert!((b_0 - 100.0).abs() < 1e-4);

        // Overfull (510/500) -> 10,000 + 10 * 100 = 11,000
        let b_over = compute_badness(510.0, target);
        assert!(b_over >= 10_000.0);
    }

    #[test]
    fn test_score_page_break_combines_badness_and_penalty() {
        let opp_clean = BreakOpportunity {
            global_line_idx: 10,
            paragraph_id: Some(FractionalIndex::new("p1")),
            line_in_paragraph: 2,
            total_lines_in_paragraph: 5,
            keep_with_next: false,
            orphan_control: 2,
            widow_control: 2,
            line_height: 14.5,
            margin_after: 0.0,
        };
        let opp_heading = BreakOpportunity {
            global_line_idx: 11,
            paragraph_id: Some(FractionalIndex::new("h1")),
            line_in_paragraph: 0,
            total_lines_in_paragraph: 1,
            keep_with_next: true,
            orphan_control: 2,
            widow_control: 2,
            line_height: 20.0,
            margin_after: 10.0,
        };

        let score_clean = score_page_break(480.0, 500.0, &opp_clean);
        let score_heading = score_page_break(480.0, 500.0, &opp_heading);

        assert!(score_clean < 5.0);
        assert!(score_heading >= 10_000.0);
        assert!(score_clean < score_heading);
    }
}
