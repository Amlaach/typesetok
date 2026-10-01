//! Knuth-Plass Global Paragraph Line Breaking Algorithm.
//!
//! Replaces greedy line-breaking with dynamic programming to find optimal
//! breakpoints across the whole paragraph, eliminating rivers of white.

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

#[derive(Debug, Clone, PartialEq)]
pub struct LineBreak {
    pub item_index: usize,
    pub line_width: f32,
    pub adjustment_ratio: f32, // r: < 0 is shrink, > 0 is stretch
    pub demerits: f32,
}

#[derive(Debug, Clone, PartialEq)]
pub struct BrokenLine {
    pub line_number: usize,
    pub items: Vec<LayoutItem>,
    pub width: f32,
    pub target_width: f32,
    pub adjustment_ratio: f32,
}

pub struct KnuthPlassBreaker;

impl KnuthPlassBreaker {
    pub const INFINITY_PENALTY: f32 = 10000.0;
    pub const FORCED_BREAK_PENALTY: f32 = -10000.0;

    /// Breaks a stream of Box-Glue-Penalty items into optimal lines.
    pub fn break_paragraph(
        items: &[LayoutItem],
        target_width: f32,
        tolerance: f32, // Typically 1.0 - 2.5
    ) -> Vec<BrokenLine> {
        if items.is_empty() {
            return Vec::new();
        }

        if target_width <= 0.0 || target_width.is_nan() || target_width.is_infinite() {
            return Vec::new();
        }

        // Node in DP: (index in items, line_number, total_demerits, prev_node_index, adjustment_ratio)
        #[derive(Clone, Debug)]
        struct ActiveNode {
            item_idx: usize,
            line: usize,
            total_demerits: f32,
            prev: Option<usize>,
            ratio: f32,
        }

        // Find all possible break positions:
        // A break is allowed:
        // 1. After a Glue if the previous item was a Box.
        // 2. At a Penalty with penalty < INFINITY_PENALTY.
        let mut candidates = vec![0]; // Start of paragraph
        for (i, item) in items.iter().enumerate() {
            match item {
                LayoutItem::Glue { .. } => {
                    if i > 0 && matches!(items[i - 1], LayoutItem::Box { .. }) {
                        candidates.push(i);
                    }
                }
                LayoutItem::Penalty { penalty, .. } if *penalty < Self::INFINITY_PENALTY => {
                    candidates.push(i);
                }
                _ => {}
            }
        }
        // Ensure last item is a candidate
        if let Some(&last) = candidates.last() {
            if last != items.len() {
                candidates.push(items.len());
            }
        }

        // DP table of best active nodes reaching each candidate
        let mut best_nodes: Vec<ActiveNode> = vec![ActiveNode {
            item_idx: 0,
            line: 0,
            total_demerits: 0.0,
            prev: None,
            ratio: 0.0,
        }];

        for &j in &candidates[1..] {
            let mut best_for_j: Option<ActiveNode> = None;

            for (node_idx, node) in best_nodes.iter().enumerate() {
                let i = node.item_idx;
                if i >= j {
                    continue;
                }

                // Compute total box width, glue width, stretch and shrink between i and j
                let mut box_and_normal_glue = 0.0;
                let mut total_stretch = 0.0;
                let mut total_shrink = 0.0;

                for k in i..j {
                    match &items[k] {
                        LayoutItem::Box { width, .. } => {
                            box_and_normal_glue += *width;
                        }
                        LayoutItem::Glue {
                            width,
                            stretch,
                            shrink,
                        } => {
                            // Trailing glue at line break is discarded from width
                            if k < j - 1 || !matches!(items[j - 1], LayoutItem::Glue { .. }) {
                                box_and_normal_glue += *width;
                            }
                            total_stretch += *stretch;
                            total_shrink += *shrink;
                        }
                        LayoutItem::Penalty { width, .. } => {
                            box_and_normal_glue += *width;
                        }
                    }
                }

                // Compute adjustment ratio r
                let delta = target_width - box_and_normal_glue;
                let r = if delta > 0.0 {
                    if total_stretch > 0.0 {
                        delta / total_stretch
                    } else {
                        // Needs stretch but no glue stretch available
                        10.0
                    }
                } else if delta < 0.0 {
                    if total_shrink > 0.0 {
                        delta / total_shrink
                    } else {
                        // Needs shrink but cannot shrink
                        -10.0
                    }
                } else {
                    0.0
                };

                // Check feasibility: r must be >= -1.0 (cannot shrink below minimum)
                // and r <= tolerance (cannot stretch beyond tolerance)
                let is_last_line = j == items.len();
                let is_feasible = (r >= -1.0 && r <= tolerance) || (is_last_line && r >= -1.0);

                if is_feasible {
                    let badness = 100.0 * r.abs().powi(3);
                    let penalty_val = if j < items.len() {
                        if let LayoutItem::Penalty { penalty, .. } = &items[j] {
                            *penalty
                        } else {
                            0.0
                        }
                    } else {
                        0.0
                    };

                    let line_demerits = (1.0 + badness + penalty_val.max(0.0)).powi(2);
                    let total_demerits = node.total_demerits + line_demerits;

                    if best_for_j
                        .as_ref()
                        .is_none_or(|b| total_demerits < b.total_demerits)
                    {
                        best_for_j = Some(ActiveNode {
                            item_idx: j,
                            line: node.line + 1,
                            total_demerits,
                            prev: Some(node_idx),
                            ratio: r,
                        });
                    }
                }
            }

            if let Some(valid_node) = best_for_j {
                best_nodes.push(valid_node);
            }
        }

        // Find best path reaching end of items
        let end_node = best_nodes
            .iter()
            .filter(|n| n.item_idx == items.len())
            .min_by(|a, b| {
                a.total_demerits
                    .partial_cmp(&b.total_demerits)
                    .unwrap_or(std::cmp::Ordering::Equal)
            });

        let mut lines = Vec::new();

        if let Some(end) = end_node {
            let mut current = Some(end);
            let mut path = Vec::new();
            while let Some(node) = current {
                path.push(node.clone());
                current = node.prev.map(|idx| &best_nodes[idx]);
            }
            path.reverse();

            // Convert path to BrokenLines
            for w in path.windows(2) {
                let start = w[0].item_idx;
                let end = w[1].item_idx;
                let line_items = items[start..end].to_vec();

                let mut width = 0.0;
                for it in &line_items {
                    match it {
                        LayoutItem::Box { width: w, .. } => width += *w,
                        LayoutItem::Glue { width: w, .. } => width += *w,
                        LayoutItem::Penalty { width: w, .. } => width += *w,
                    }
                }

                lines.push(BrokenLine {
                    line_number: lines.len() + 1,
                    items: line_items,
                    width,
                    target_width,
                    adjustment_ratio: w[1].ratio,
                });
            }
        } else {
            // Emergency greedy fallback
            let mut current_line_items = Vec::new();
            let mut current_width = 0.0;

            for item in items {
                match item {
                    LayoutItem::Box { width, .. } => {
                        current_width += width;
                        current_line_items.push(item.clone());
                    }
                    LayoutItem::Glue { width, .. } => {
                        // Break if adding this glue exceeds target width and we have items
                        if current_width + width > target_width && !current_line_items.is_empty() {
                            lines.push(BrokenLine {
                                line_number: lines.len() + 1,
                                items: std::mem::take(&mut current_line_items),
                                width: current_width,
                                target_width,
                                adjustment_ratio: 0.0,
                            });
                            current_width = 0.0;
                        }
                        current_width += width;
                        current_line_items.push(item.clone());
                    }
                    LayoutItem::Penalty { width, penalty, .. } => {
                        current_width += width;
                        current_line_items.push(item.clone());
                        if *penalty <= Self::FORCED_BREAK_PENALTY {
                            lines.push(BrokenLine {
                                line_number: lines.len() + 1,
                                items: std::mem::take(&mut current_line_items),
                                width: current_width,
                                target_width,
                                adjustment_ratio: 0.0,
                            });
                            current_width = 0.0;
                        }
                    }
                }
            }
            if !current_line_items.is_empty() {
                lines.push(BrokenLine {
                    line_number: lines.len() + 1,
                    items: current_line_items,
                    width: current_width,
                    target_width,
                    adjustment_ratio: 0.0,
                });
            }
        }

        lines
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_knuth_plass_line_break() {
        // Construct Box-Glue stream: 4 words with glue
        let items = vec![
            LayoutItem::Box {
                width: 50.0,
                text: "שלום".to_string(),
                glyphs: Vec::new(),
            },
            LayoutItem::Glue {
                width: 10.0,
                stretch: 5.0,
                shrink: 2.0,
            },
            LayoutItem::Box {
                width: 50.0,
                text: "עליכם".to_string(),
                glyphs: Vec::new(),
            },
            LayoutItem::Glue {
                width: 10.0,
                stretch: 5.0,
                shrink: 2.0,
            },
            LayoutItem::Box {
                width: 50.0,
                text: "מלאכי".to_string(),
                glyphs: Vec::new(),
            },
            LayoutItem::Glue {
                width: 10.0,
                stretch: 5.0,
                shrink: 2.0,
            },
            LayoutItem::Box {
                width: 50.0,
                text: "השלום".to_string(),
                glyphs: Vec::new(),
            },
            LayoutItem::Penalty {
                width: 0.0,
                penalty: KnuthPlassBreaker::FORCED_BREAK_PENALTY,
                flagged: false,
            },
        ];

        // Target width 120 pt -> should break into 2 balanced lines of 2 words each
        let lines = KnuthPlassBreaker::break_paragraph(&items, 120.0, 2.0);
        assert_eq!(lines.len(), 2);
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
        let items = vec![LayoutItem::Box {
            width: 50.0,
            text: "word".to_string(),
            glyphs: Vec::new(),
        }];
        let _lines = KnuthPlassBreaker::break_paragraph(&items, 0.0, 2.0);
    }

    #[test]
    fn test_knuth_plass_nan_width() {
        let items = vec![LayoutItem::Box {
            width: 50.0,
            text: "word".to_string(),
            glyphs: Vec::new(),
        }];
        let _lines = KnuthPlassBreaker::break_paragraph(&items, f32::NAN, 2.0);
    }
}
