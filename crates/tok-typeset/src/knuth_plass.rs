//! Knuth-Plass Global Paragraph Line Breaking Algorithm.
//!
//! Replaces greedy line-breaking with dynamic programming to find optimal
//! breakpoints across the whole paragraph, eliminating rivers of white.
//!
//! Semantics follow TeX:
//! - A line may break at a glue that follows a box, or at a penalty below
//!   [`KnuthPlassBreaker::INFINITY_PENALTY`]. A penalty at or below
//!   [`KnuthPlassBreaker::FORCED_BREAK_PENALTY`] must be broken at.
//! - The breaking glue is dropped; a penalty's width (e.g. a hyphen) only
//!   counts on the line that breaks at it.
//! - Glue and non-forced penalties at the start of a line after a break are
//!   discarded.
//! - The last line behaves as if it ended with infinitely stretchable fill
//!   glue: it may be short without penalty.
//! - If no break sequence satisfies the tolerance, a second "emergency" pass
//!   accepts any stretch and, as a last resort, overfull lines (e.g. a single
//!   word wider than the measure), minimising the overflow. A paragraph with
//!   valid metrics therefore always gets a layout.

use crate::shaper::PositionedGlyph;

#[derive(Debug, Clone, PartialEq)]
pub enum LayoutItem {
    Box {
        width: f32,
        text: String,
        glyphs: Vec<PositionedGlyph>,
    },
    Glue {
        width: f32,
        stretch: f32,
        shrink: f32,
    },
    Penalty {
        width: f32,
        penalty: f32,
        flagged: bool,
    },
}

/// A line chosen by the breaker, expressed as a range of the input items.
#[derive(Debug, Clone, Copy, PartialEq)]
pub struct LineSpan {
    /// Index of the first item on the line.
    pub start: usize,
    /// One past the last item on the line. A penalty the line breaks at is
    /// included (its width counts); a breaking glue is not.
    pub end: usize,
    /// Natural width of the line (boxes, inner glue, break penalty width).
    pub natural_width: f32,
    /// r: < 0 is shrink, > 0 is stretch; 0 when the ratio is undefined
    /// (no stretch/shrink available) and on a short last line.
    pub adjustment_ratio: f32,
}

#[derive(Debug, Clone, PartialEq)]
pub struct BrokenLine {
    pub line_number: usize,
    pub items: Vec<LayoutItem>,
    pub width: f32,
    pub target_width: f32,
    pub adjustment_ratio: f32,
}

// f64 accumulation reduces cancellation when subtracting long paragraph prefixes.
// Penalties contribute no width here: their width only counts when broken at.
struct PrefixMetrics {
    width: Vec<f64>,
    stretch: Vec<f64>,
    shrink: Vec<f64>,
}

impl PrefixMetrics {
    fn new(items: &[LayoutItem]) -> Self {
        let mut sums = Self {
            width: Vec::with_capacity(items.len() + 1),
            stretch: Vec::with_capacity(items.len() + 1),
            shrink: Vec::with_capacity(items.len() + 1),
        };
        let (mut w, mut st, mut sh) = (0.0f64, 0.0f64, 0.0f64);
        sums.width.push(w);
        sums.stretch.push(st);
        sums.shrink.push(sh);
        for item in items {
            match item {
                LayoutItem::Box { width, .. } => w += f64::from(*width),
                LayoutItem::Glue {
                    width,
                    stretch,
                    shrink,
                } => {
                    w += f64::from(*width);
                    st += f64::from(*stretch);
                    sh += f64::from(*shrink);
                }
                LayoutItem::Penalty { .. } => {}
            }
            sums.width.push(w);
            sums.stretch.push(st);
            sums.shrink.push(sh);
        }
        sums
    }

    /// (width, stretch, shrink) summed over `items[start..end]`.
    fn range(&self, start: usize, end: usize) -> (f64, f64, f64) {
        (
            self.width[end] - self.width[start],
            self.stretch[end] - self.stretch[start],
            self.shrink[end] - self.shrink[start],
        )
    }
}

#[derive(Clone, Debug)]
struct Node {
    /// Item index of the break (0 for the paragraph start).
    position: usize,
    /// First item of the line that follows this break.
    line_start: usize,
    total_demerits: f64,
    prev: Option<usize>,
    natural_width: f64,
    ratio: f64,
    flagged: bool,
}

pub struct KnuthPlassBreaker;

impl KnuthPlassBreaker {
    pub const INFINITY_PENALTY: f32 = 10000.0;
    pub const FORCED_BREAK_PENALTY: f32 = -10000.0;

    /// Badness ceiling (TeX's `inf_bad`).
    const INF_BAD: f64 = 10000.0;
    /// Extra demerits for two consecutive flagged (hyphen) breaks.
    const DOUBLE_HYPHEN_DEMERITS: f64 = 3000.0;
    /// Demerits per point of unavoidable overflow in the emergency pass.
    const OVERFLOW_DEMERITS_PER_PT: f64 = 1.0e8;

    /// Breaks a stream of Box-Glue-Penalty items into optimal lines.
    pub fn break_paragraph(
        items: &[LayoutItem],
        target_width: f32,
        tolerance: f32, // Typically 1.0 - 2.5
    ) -> Vec<BrokenLine> {
        Self::break_paragraph_spans(items, target_width, tolerance)
            .into_iter()
            .enumerate()
            .map(|(i, span)| BrokenLine {
                line_number: i + 1,
                items: items[span.start..span.end].to_vec(),
                width: span.natural_width,
                target_width,
                adjustment_ratio: span.adjustment_ratio,
            })
            .collect()
    }

    /// Like [`Self::break_paragraph`] but returns item ranges instead of
    /// cloning the items of every line.
    ///
    /// Returns no lines for an empty paragraph, a non-positive or non-finite
    /// `target_width`, a negative or non-finite `tolerance`, or non-finite
    /// item metrics.
    pub fn break_paragraph_spans(
        items: &[LayoutItem],
        target_width: f32,
        tolerance: f32,
    ) -> Vec<LineSpan> {
        if items.is_empty() || !target_width.is_finite() || target_width <= 0.0 {
            return Vec::new();
        }

        let metrics_valid = items.iter().all(|item| match item {
            LayoutItem::Box { width, .. } => width.is_finite(),
            LayoutItem::Glue {
                width,
                stretch,
                shrink,
            } => width.is_finite() && stretch.is_finite() && shrink.is_finite(),
            LayoutItem::Penalty { width, penalty, .. } => width.is_finite() && !penalty.is_nan(),
        });
        if !tolerance.is_finite() || tolerance < 0.0 || !metrics_valid {
            return Vec::new();
        }

        let ctx = BreakContext::new(items, f64::from(target_width));
        match ctx
            .run(Some(f64::from(tolerance)))
            .or_else(|| ctx.run(None))
        {
            Some(nodes) => ctx.spans(&nodes),
            None => {
                // The emergency pass accepts every line, so this is unreachable;
                // degrade to a single line rather than losing the text.
                debug_assert!(false, "emergency pass failed to reach the paragraph end");
                vec![LineSpan {
                    start: 0,
                    end: items.len(),
                    natural_width: ctx.metrics.range(0, items.len()).0 as f32,
                    adjustment_ratio: 0.0,
                }]
            }
        }
    }
}

struct BreakContext<'a> {
    items: &'a [LayoutItem],
    target: f64,
    metrics: PrefixMetrics,
    candidates: Vec<usize>,
    /// Box widths and glue (width - shrink) are non-negative, so the minimum
    /// width of a line only grows as it gets longer: overfull start nodes can
    /// be dropped for good.
    monotone: bool,
}

impl<'a> BreakContext<'a> {
    fn new(items: &'a [LayoutItem], target: f64) -> Self {
        let mut candidates = Vec::new();
        for (i, item) in items.iter().enumerate() {
            match item {
                LayoutItem::Glue { .. } => {
                    if i > 0 && matches!(items[i - 1], LayoutItem::Box { .. }) {
                        candidates.push(i);
                    }
                }
                LayoutItem::Penalty { penalty, .. }
                    if *penalty < KnuthPlassBreaker::INFINITY_PENALTY =>
                {
                    candidates.push(i);
                }
                _ => {}
            }
        }
        // The paragraph must end with a forced break; add an implicit one.
        let last_is_forced = candidates.last() == Some(&(items.len() - 1))
            && Self::forced_at(items, items.len() - 1);
        if !last_is_forced {
            candidates.push(items.len());
        }

        let monotone = items.iter().all(|item| match item {
            LayoutItem::Box { width, .. } => *width >= 0.0,
            LayoutItem::Glue { width, shrink, .. } => *shrink >= 0.0 && *width - *shrink >= 0.0,
            LayoutItem::Penalty { .. } => true,
        });

        Self {
            items,
            target,
            metrics: PrefixMetrics::new(items),
            candidates,
            monotone,
        }
    }

    fn forced_at(items: &[LayoutItem], j: usize) -> bool {
        matches!(items.get(j), Some(LayoutItem::Penalty { penalty, .. })
            if *penalty <= KnuthPlassBreaker::FORCED_BREAK_PENALTY)
    }

    fn is_forced(&self, j: usize) -> bool {
        j == self.items.len() || Self::forced_at(self.items, j)
    }

    /// (penalty value, penalty width, flagged) of a break at `j`.
    fn break_penalty(&self, j: usize) -> (f64, f64, bool) {
        match self.items.get(j) {
            Some(LayoutItem::Penalty {
                width,
                penalty,
                flagged,
            }) => (f64::from(*penalty), f64::from(*width), *flagged),
            _ => (0.0, 0.0, false),
        }
    }

    /// One past the last item of a line that breaks at `j`.
    fn line_end(&self, j: usize) -> usize {
        match self.items.get(j) {
            Some(LayoutItem::Penalty { .. }) => j + 1,
            _ => j,
        }
    }

    /// First item of the line after a break at `j` (discardable items skipped).
    fn next_line_start(&self, j: usize) -> usize {
        let mut k = j + 1;
        while k < self.items.len() {
            match &self.items[k] {
                LayoutItem::Glue { .. } => k += 1,
                LayoutItem::Penalty { penalty, .. }
                    if *penalty > KnuthPlassBreaker::FORCED_BREAK_PENALTY =>
                {
                    k += 1
                }
                _ => break,
            }
        }
        k.min(self.items.len())
    }

    fn badness(r: f64) -> f64 {
        if r.is_finite() {
            (100.0 * r.abs().powi(3)).min(KnuthPlassBreaker::INF_BAD)
        } else {
            KnuthPlassBreaker::INF_BAD
        }
    }

    /// Runs one pass. `tolerance == None` is the emergency pass, which accepts
    /// every line and therefore always succeeds.
    fn run(&self, tolerance: Option<f64>) -> Option<Vec<Node>> {
        let emergency = tolerance.is_none();
        let tolerance = tolerance.unwrap_or(f64::INFINITY);
        let final_break = *self.candidates.last()?;

        let mut nodes = vec![Node {
            position: 0,
            line_start: 0,
            total_demerits: 0.0,
            prev: None,
            natural_width: 0.0,
            ratio: 0.0,
            flagged: false,
        }];
        let mut window_start = 0;

        for &j in &self.candidates {
            let forced = self.is_forced(j);
            let is_last = j == final_break;
            let (penalty, penalty_width, flagged) = self.break_penalty(j);
            let mut best: Option<Node> = None;
            // Overfull nodes form a prefix of the window when widths are monotone.
            let mut overfull_prefix_end = window_start;
            let mut prefix_overfull = true;

            for (k, node) in nodes.iter().enumerate().skip(window_start) {
                if node.line_start > j || (node.line_start == j && !forced) {
                    prefix_overfull = false;
                    continue;
                }
                let (sum_w, stretch, shrink) = self.metrics.range(node.line_start, j);
                let natural = sum_w + penalty_width;
                let delta = self.target - natural;

                // Ignores the break-penalty width so that it is monotone in j.
                if prefix_overfull && sum_w - shrink > self.target {
                    overfull_prefix_end = k + 1;
                } else {
                    prefix_overfull = false;
                }

                let r = if delta > 0.0 {
                    if is_last {
                        0.0 // fill glue at the end of the paragraph
                    } else if stretch > 0.0 {
                        delta / stretch
                    } else {
                        f64::INFINITY
                    }
                } else if delta < 0.0 {
                    if shrink > 0.0 {
                        delta / shrink
                    } else {
                        f64::NEG_INFINITY
                    }
                } else {
                    0.0
                };
                let overfull = r < -1.0;
                if !emergency && (overfull || r > tolerance) {
                    continue;
                }

                let mut demerits = (1.0 + Self::badness(r)).powi(2);
                if penalty >= 0.0 {
                    demerits += penalty * penalty;
                } else if !forced {
                    demerits -= penalty * penalty;
                }
                if flagged && node.flagged {
                    demerits += KnuthPlassBreaker::DOUBLE_HYPHEN_DEMERITS;
                }
                if overfull {
                    let overflow = (natural - shrink - self.target).max(0.0);
                    demerits += KnuthPlassBreaker::OVERFLOW_DEMERITS_PER_PT * (1.0 + overflow);
                }

                let total = node.total_demerits + demerits;
                if best.as_ref().is_none_or(|b| total < b.total_demerits) {
                    best = Some(Node {
                        position: j,
                        line_start: if j < self.items.len() {
                            self.next_line_start(j)
                        } else {
                            j
                        },
                        total_demerits: total,
                        prev: Some(k),
                        natural_width: natural,
                        ratio: if r.is_finite() { r } else { 0.0 },
                        flagged,
                    });
                }
            }

            if self.monotone {
                window_start = overfull_prefix_end;
            }
            match best {
                Some(node) => {
                    nodes.push(node);
                    if forced {
                        // Nothing may be carried across a forced break.
                        window_start = nodes.len() - 1;
                    }
                    if is_last {
                        break;
                    }
                }
                None if forced => return None,
                None => {
                    if window_start >= nodes.len() {
                        if emergency {
                            // Keep the newest node so the paragraph stays reachable.
                            window_start = nodes.len() - 1;
                        } else {
                            return None;
                        }
                    }
                }
            }
        }

        match nodes.last() {
            Some(last) if last.position == final_break && nodes.len() > 1 => Some(nodes),
            _ => None,
        }
    }

    fn spans(&self, nodes: &[Node]) -> Vec<LineSpan> {
        let mut chain = Vec::new();
        let mut current = nodes.len().checked_sub(1);
        while let Some(idx) = current {
            chain.push(idx);
            current = nodes[idx].prev;
        }
        chain.reverse();
        chain
            .windows(2)
            .map(|w| {
                let (from, to) = (&nodes[w[0]], &nodes[w[1]]);
                LineSpan {
                    start: from.line_start,
                    end: self.line_end(to.position).max(from.line_start),
                    natural_width: to.natural_width as f32,
                    adjustment_ratio: to.ratio as f32,
                }
            })
            .collect()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn word(width: f32) -> LayoutItem {
        LayoutItem::Box {
            width,
            text: String::new(),
            glyphs: Vec::new(),
        }
    }

    fn space() -> LayoutItem {
        LayoutItem::Glue {
            width: 10.0,
            stretch: 5.0,
            shrink: 2.0,
        }
    }

    fn forced() -> LayoutItem {
        LayoutItem::Penalty {
            width: 0.0,
            penalty: KnuthPlassBreaker::FORCED_BREAK_PENALTY,
            flagged: false,
        }
    }

    fn paragraph(widths: &[f32]) -> Vec<LayoutItem> {
        let mut items = Vec::new();
        for (i, w) in widths.iter().enumerate() {
            if i > 0 {
                items.push(space());
            }
            items.push(word(*w));
        }
        items.push(forced());
        items
    }

    fn boxes_per_line(items: &[LayoutItem], spans: &[LineSpan]) -> Vec<usize> {
        spans
            .iter()
            .map(|s| {
                items[s.start..s.end]
                    .iter()
                    .filter(|i| matches!(i, LayoutItem::Box { .. }))
                    .count()
            })
            .collect()
    }

    #[test]
    fn prefix_metrics_match_reference_scan_for_all_ranges() {
        let mut items = Vec::new();
        for i in 0..64 {
            items.push(LayoutItem::Box {
                width: 10.25 + (i % 7) as f32,
                text: String::new(),
                glyphs: vec![],
            });
            items.push(LayoutItem::Glue {
                width: 3.25,
                stretch: 1.5,
                shrink: 0.75,
            });
            items.push(LayoutItem::Penalty {
                width: 2.5,
                penalty: 50.0,
                flagged: false,
            });
        }
        let metrics = PrefixMetrics::new(&items);
        for start in 0..items.len() {
            for end in start + 1..=items.len() {
                let (mut width, mut stretch, mut shrink) = (0.0f64, 0.0f64, 0.0f64);
                for item in &items[start..end] {
                    match item {
                        LayoutItem::Box { width: w, .. } => width += f64::from(*w),
                        LayoutItem::Glue {
                            width: w,
                            stretch: s,
                            shrink: h,
                        } => {
                            width += f64::from(*w);
                            stretch += f64::from(*s);
                            shrink += f64::from(*h);
                        }
                        LayoutItem::Penalty { .. } => {}
                    }
                }
                let (w, s, h) = metrics.range(start, end);
                assert!((w - width).abs() < 1e-9);
                assert!((s - stretch).abs() < 1e-9);
                assert!((h - shrink).abs() < 1e-9);
            }
        }
    }

    #[test]
    fn nonfinite_metrics_and_tolerance_are_rejected() {
        let item = LayoutItem::Box {
            width: f32::NAN,
            text: String::new(),
            glyphs: vec![],
        };
        assert!(KnuthPlassBreaker::break_paragraph(&[item], 100.0, 2.0).is_empty());
        let item = LayoutItem::Glue {
            width: 2.0,
            stretch: 1.0,
            shrink: 1.0,
        };
        assert!(KnuthPlassBreaker::break_paragraph(&[item], 100.0, f32::INFINITY).is_empty());
    }

    #[test]
    fn test_knuth_plass_line_break() {
        // Target width 120 pt -> should break into 2 balanced lines of 2 words each
        let items = paragraph(&[50.0, 50.0, 50.0, 50.0]);
        let lines = KnuthPlassBreaker::break_paragraph(&items, 120.0, 2.0);
        assert_eq!(lines.len(), 2);
        let spans = KnuthPlassBreaker::break_paragraph_spans(&items, 120.0, 2.0);
        assert_eq!(boxes_per_line(&items, &spans), vec![2, 2]);
    }

    #[test]
    fn test_knuth_plass_empty_paragraph() {
        let items: Vec<LayoutItem> = vec![];
        let lines = KnuthPlassBreaker::break_paragraph(&items, 300.0, 2.0);
        assert!(lines.is_empty(), "Empty items should produce empty lines");
    }

    #[test]
    fn test_knuth_plass_single_word() {
        let items = vec![LayoutItem::Box {
            width: 50.0,
            text: "word".to_string(),
            glyphs: Vec::new(),
        }];
        let lines = KnuthPlassBreaker::break_paragraph(&items, 300.0, 2.0);
        assert_eq!(lines.len(), 1, "Single word should produce one line");
        let has_word = lines[0].items.iter().any(|item| {
            if let LayoutItem::Box { text, .. } = item {
                text.contains("word")
            } else {
                false
            }
        });
        assert!(has_word);
    }

    #[test]
    fn test_knuth_plass_zero_width() {
        let items = vec![word(50.0)];
        assert!(KnuthPlassBreaker::break_paragraph(&items, 0.0, 2.0).is_empty());
    }

    #[test]
    fn test_knuth_plass_nan_width() {
        let items = vec![word(50.0)];
        assert!(KnuthPlassBreaker::break_paragraph(&items, f32::NAN, 2.0).is_empty());
    }

    /// Regression: the line after a glue break used to start with that glue,
    /// counting its width and stretch.
    #[test]
    fn lines_never_start_with_glue() {
        let items = paragraph(&[40.0, 30.0, 55.0, 20.0, 45.0, 35.0, 50.0, 25.0, 60.0]);
        let spans = KnuthPlassBreaker::break_paragraph_spans(&items, 120.0, 2.0);
        assert!(spans.len() > 1);
        for s in &spans {
            assert!(
                matches!(items[s.start], LayoutItem::Box { .. }),
                "line starts with {:?}",
                items[s.start]
            );
        }
        // Lines partition the boxes: every word appears exactly once.
        let total: usize = boxes_per_line(&items, &spans).iter().sum();
        assert_eq!(total, 9);
    }

    /// Regression: a short last line was infeasible (it needed more stretch than
    /// the tolerance), which sent every ordinary paragraph to a greedy fallback.
    #[test]
    fn short_last_line_is_free() {
        let items = paragraph(&[50.0, 50.0, 50.0, 50.0, 30.0]);
        let spans = KnuthPlassBreaker::break_paragraph_spans(&items, 120.0, 2.0);
        assert_eq!(boxes_per_line(&items, &spans), vec![2, 2, 1]);
        let last = spans.last().unwrap();
        assert_eq!(last.adjustment_ratio, 0.0);
        for s in &spans[..spans.len() - 1] {
            assert!(s.adjustment_ratio.abs() <= 2.0);
        }
    }

    /// Regression: a forced break in the middle of a paragraph could be
    /// skipped over by a line.
    #[test]
    fn forced_break_in_the_middle_is_honoured() {
        let mut items = vec![word(20.0), space(), word(20.0)];
        items.push(forced());
        items.extend([word(20.0), space(), word(20.0), forced()]);
        let spans = KnuthPlassBreaker::break_paragraph_spans(&items, 300.0, 2.0);
        assert_eq!(boxes_per_line(&items, &spans), vec![2, 2]);
    }

    /// Regression: a word wider than the measure made the whole paragraph fall
    /// back to a greedy breaker whose lines could exceed the measure anywhere.
    #[test]
    fn overlong_word_gets_its_own_line_and_the_rest_stays_optimal() {
        let items = paragraph(&[50.0, 50.0, 400.0, 50.0, 50.0]);
        let spans = KnuthPlassBreaker::break_paragraph_spans(&items, 120.0, 2.0);
        assert_eq!(boxes_per_line(&items, &spans), vec![2, 1, 2]);
        assert!(spans[1].natural_width > 120.0);
        assert!(spans[0].natural_width <= 120.0 + 1e-3);
    }

    #[test]
    fn penalty_width_counts_only_when_broken_at() {
        let items = vec![
            word(50.0),
            LayoutItem::Penalty {
                width: 7.0,
                penalty: 50.0,
                flagged: true,
            },
            word(50.0),
            forced(),
        ];
        // Fits on one line: the unused hyphen must not add 7pt.
        let spans = KnuthPlassBreaker::break_paragraph_spans(&items, 100.0, 2.0);
        assert_eq!(spans.len(), 1);
        assert_eq!(spans[0].natural_width, 100.0);
        // Too narrow: break at the hyphen, whose width now counts.
        let spans = KnuthPlassBreaker::break_paragraph_spans(&items, 60.0, 2.0);
        assert_eq!(spans.len(), 2);
        assert_eq!(spans[0].natural_width, 57.0);
        assert_eq!(spans[0].end, 2);
    }

    #[test]
    fn paragraph_without_final_penalty_ends_implicitly() {
        let items = vec![word(30.0), space(), word(30.0)];
        let spans = KnuthPlassBreaker::break_paragraph_spans(&items, 100.0, 2.0);
        assert_eq!(spans.len(), 1);
        assert_eq!((spans[0].start, spans[0].end), (0, 3));
    }

    #[test]
    fn no_extra_empty_line_at_paragraph_end() {
        let items = paragraph(&[30.0, 30.0]);
        let lines = KnuthPlassBreaker::break_paragraph(&items, 100.0, 2.0);
        assert_eq!(lines.len(), 1);
    }

    #[test]
    fn huge_paragraph_is_fast_and_complete() {
        let widths: Vec<f32> = (0..20_000).map(|i| 20.0 + (i % 13) as f32 * 3.0).collect();
        let items = paragraph(&widths);
        let start = std::time::Instant::now();
        let spans = KnuthPlassBreaker::break_paragraph_spans(&items, 300.0, 2.0);
        assert!(start.elapsed().as_secs() < 5);
        let total: usize = boxes_per_line(&items, &spans).iter().sum();
        assert_eq!(total, widths.len());
    }
}
