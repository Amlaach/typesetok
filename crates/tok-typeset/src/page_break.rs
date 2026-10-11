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

use crate::geometry::LineBox;

/// Input line with paragraph context and typographic constraints for pagination.
#[derive(Debug, Clone)]
pub struct PaginationLineInput {
    pub line: LineBox,
    pub section_idx: usize,
    pub paragraph_idx: usize,
    pub paragraph_id: Option<FractionalIndex>,
    pub line_in_paragraph: usize,
    pub total_lines_in_paragraph: usize,
    pub keep_with_next: bool,
    pub orphan_control: u8,
    pub widow_control: u8,
    pub space_before: f32,
    pub space_after: f32,
}

impl PaginationLineInput {
    pub fn to_opportunity(&self, margin_after: f32) -> BreakOpportunity {
        BreakOpportunity {
            global_line_idx: 0,
            paragraph_id: self.paragraph_id.clone(),
            line_in_paragraph: self.line_in_paragraph,
            total_lines_in_paragraph: self.total_lines_in_paragraph,
            keep_with_next: self.keep_with_next,
            orphan_control: self.orphan_control,
            widow_control: self.widow_control,
            line_height: self.line.height,
            margin_after,
        }
    }
}

/// A sliced page containing lines and their vertical positions.
#[derive(Debug, Clone)]
pub struct PageSlice {
    pub lines: Vec<LineBox>,
    pub total_height: f32,
}

/// Dynamic global page breaker evaluating candidate breaks with lookahead and penalty optimization.
#[derive(Debug, Clone)]
pub struct GlobalPageBreaker {
    pub target_height: f32,
    pub lookahead_window: usize,
}

impl GlobalPageBreaker {
    pub const DEFAULT_LOOKAHEAD: usize = 8;

    pub fn new(target_height: f32) -> Self {
        Self {
            target_height,
            lookahead_window: Self::DEFAULT_LOOKAHEAD,
        }
    }

    pub fn with_lookahead(target_height: f32, lookahead_window: usize) -> Self {
        Self {
            target_height,
            lookahead_window,
        }
    }

    /// Breaks a flat list of positioned lines into pages, choosing break points
    /// that minimize typographic badness and penalties (preventing orphans, widows, and stranded headings).
    pub fn break_pages(&self, lines: &[PaginationLineInput]) -> Vec<PageSlice> {
        if lines.is_empty() {
            return Vec::new();
        }

        let mut pages = Vec::new();
        let mut start_idx = 0;

        while start_idx < lines.len() {
            let (end_idx, total_height) = self.find_best_page_break(&lines[start_idx..]);
            let page_lines_input = &lines[start_idx..start_idx + end_idx];

            // Position lines vertically within this page slice with top-of-page margin collapsing
            let mut page_lines = Vec::with_capacity(page_lines_input.len());
            let mut curr_y = 0.0;
            let mut prev_space_after: f32 = 0.0;
            let mut prev_sec = None;

            for (l_idx, item) in page_lines_input.iter().enumerate() {
                if prev_sec != Some(item.section_idx) {
                    prev_sec = Some(item.section_idx);
                    prev_space_after = 0.0;
                }

                let margin = if item.line_in_paragraph == 0 && l_idx > 0 {
                    prev_space_after.max(item.space_before)
                } else {
                    0.0
                };

                curr_y += margin;
                let mut line = item.line.clone();
                line.line_index = l_idx;
                line.baseline_y = curr_y + line.height;
                curr_y += line.height;
                page_lines.push(line);

                if item.line_in_paragraph + 1 == item.total_lines_in_paragraph {
                    prev_space_after = item.space_after;
                }
            }

            pages.push(PageSlice {
                lines: page_lines,
                total_height,
            });

            start_idx += end_idx;
        }

        pages
    }

    /// Finds the best break point for a single page from the given slice of remaining lines.
    /// Returns (number of lines to take on this page, actual accumulated height).
    fn find_best_page_break(&self, remaining: &[PaginationLineInput]) -> (usize, f32) {
        if remaining.is_empty() {
            return (0, 0.0);
        }

        // 1. Scan forwards accumulating lines until the page is full or overflows
        struct Candidate {
            count: usize,
            height: f32,
            score: f32,
            penalty: f32,
        }

        let mut candidates = Vec::new();
        let mut curr_h = 0.0;
        let mut prev_space_after: f32 = 0.0;
        let mut prev_sec = None;

        for (idx, item) in remaining.iter().enumerate() {
            if prev_sec != Some(item.section_idx) {
                prev_sec = Some(item.section_idx);
                prev_space_after = 0.0;
            }

            let margin = if item.line_in_paragraph == 0 && idx > 0 {
                prev_space_after.max(item.space_before)
            } else {
                0.0
            };

            let next_h = curr_h + margin + item.line.height;

            if next_h > self.target_height && idx > 0 {
                // We reached physical capacity. Stop collecting candidates.
                break;
            }

            curr_h = next_h;
            if item.line_in_paragraph + 1 == item.total_lines_in_paragraph {
                prev_space_after = item.space_after;
            }

            let opp = item.to_opportunity(prev_space_after);
            let penalty = opp.calculate_penalty();
            let score = score_page_break(curr_h, self.target_height, &opp);

            candidates.push(Candidate {
                count: idx + 1,
                height: curr_h,
                score,
                penalty,
            });
        }

        if candidates.is_empty() {
            // First line alone overflows target height: take 1 line anyway as emergency
            return (1, remaining[0].line.height);
        }

        // If all remaining lines fit on this final page, take them all!
        if candidates.len() == remaining.len() {
            let last = candidates.last().unwrap();
            return (last.count, last.height);
        }

        // 2. Look back within the lookahead window from the furthest candidate that fit
        let window_size = self.lookahead_window.min(candidates.len());
        let window_start = candidates.len() - window_size;
        let window = &candidates[window_start..];

        // First attempt: choose candidate with no severe penalty (penalty < PageBreakPenalty::ORPHAN)
        let clean_best = window
            .iter()
            .filter(|c| c.penalty < PageBreakPenalty::ORPHAN - 1.0)
            .min_by(|a, b| a.score.partial_cmp(&b.score).unwrap_or(std::cmp::Ordering::Equal));

        if let Some(best) = clean_best {
            return (best.count, best.height);
        }

        // Second attempt: choose lowest overall score in the window
        let best_in_window = window
            .iter()
            .min_by(|a, b| a.score.partial_cmp(&b.score).unwrap_or(std::cmp::Ordering::Equal));

        if let Some(best) = best_in_window {
            return (best.count, best.height);
        }

        // Fallback: take the furthest candidate that physically fit
        let last = candidates.last().unwrap();
        (last.count, last.height)
    }
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
