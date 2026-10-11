//! Character-level formatting runs (direct formatting) attached to a paragraph.
//!
//! A paragraph's text stays a plain Unicode string; formatting is a separate,
//! semantic list of [`TextSpan`]s. Offsets are **character offsets** (Unicode
//! scalar values), the same unit used by [`crate::AtomicOperation`].
//!
//! The canonical form of a span list — which every operation produces and
//! which makes undo results comparable with `==` — is:
//! * every span is non-empty (`start < end`) and lies inside the text,
//! * every span carries a non-empty [`CharacterFormat`],
//! * spans are sorted by `start` and do not overlap,
//! * touching spans with an identical format are merged.

use crate::styles::CharacterFormat;
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct TextSpan {
    /// First character covered (inclusive).
    pub start: usize,
    /// One past the last character covered (exclusive).
    pub end: usize,
    pub format: CharacterFormat,
}

impl TextSpan {
    pub fn new(start: usize, end: usize, format: CharacterFormat) -> Self {
        Self { start, end, format }
    }
}

/// Brings any span list into canonical form for a text of `len` characters.
/// Overlaps are resolved in favour of the span that appears later in the input.
pub fn normalize_spans(spans: Vec<TextSpan>, len: usize) -> Vec<TextSpan> {
    // Paint spans onto disjoint segments, later spans win on overlap.
    let mut out: Vec<TextSpan> = Vec::with_capacity(spans.len());
    for span in spans {
        let start = span.start.min(len);
        let end = span.end.min(len);
        if start >= end || span.format.is_empty() {
            continue;
        }
        let mut next = Vec::with_capacity(out.len() + 2);
        for s in out.drain(..) {
            if s.end <= start || s.start >= end {
                next.push(s);
                continue;
            }
            if s.start < start {
                next.push(TextSpan::new(s.start, start, s.format.clone()));
            }
            if s.end > end {
                next.push(TextSpan::new(end, s.end, s.format));
            }
        }
        next.push(TextSpan::new(start, end, span.format));
        out = next;
    }
    out.sort_by_key(|s| s.start);
    let mut merged: Vec<TextSpan> = Vec::with_capacity(out.len());
    for s in out {
        match merged.last_mut() {
            Some(prev) if prev.end == s.start && prev.format == s.format => prev.end = s.end,
            _ => merged.push(s),
        }
    }
    merged
}

/// True when `spans` is already in canonical form for a text of `len` chars.
pub fn is_canonical(spans: &[TextSpan], len: usize) -> bool {
    normalize_spans(spans.to_vec(), len) == spans
}

/// The formatting of `[start, end)`, re-based so offsets start at 0.
pub fn spans_in_range(spans: &[TextSpan], start: usize, end: usize) -> Vec<TextSpan> {
    spans
        .iter()
        .filter(|s| s.end > start && s.start < end)
        .map(|s| TextSpan::new(s.start.max(start) - start, s.end.min(end) - start, s.format.clone()))
        .collect()
}

/// Spans after deleting the characters `[start, end)` from a text of
/// `len` characters (the length *before* the deletion).
pub fn remove_range(spans: &[TextSpan], start: usize, end: usize, len: usize) -> Vec<TextSpan> {
    let removed = end.saturating_sub(start);
    let shifted = spans
        .iter()
        .map(|s| {
            let map = |x: usize| {
                if x <= start {
                    x
                } else if x >= end {
                    x - removed
                } else {
                    start
                }
            };
            TextSpan::new(map(s.start), map(s.end), s.format.clone())
        })
        .collect();
    normalize_spans(shifted, len.saturating_sub(removed))
}

/// Spans after inserting `inserted_len` characters at `offset` into a text
/// of `len` characters (the length *before* the insertion).
///
/// The inserted characters get exactly the formatting described by
/// `inserted` (offsets relative to the insertion point): a span that
/// surrounds the insertion point is split, never silently stretched. The
/// editor decides what formatting typed text inherits and says so explicitly.
pub fn insert_range(
    spans: &[TextSpan],
    offset: usize,
    inserted_len: usize,
    inserted: &[TextSpan],
    len: usize,
) -> Vec<TextSpan> {
    let mut out: Vec<TextSpan> = Vec::with_capacity(spans.len() + inserted.len() + 1);
    for s in spans {
        if s.end <= offset {
            out.push(s.clone());
        } else if s.start >= offset {
            out.push(TextSpan::new(s.start + inserted_len, s.end + inserted_len, s.format.clone()));
        } else {
            out.push(TextSpan::new(s.start, offset, s.format.clone()));
            out.push(TextSpan::new(offset + inserted_len, s.end + inserted_len, s.format.clone()));
        }
    }
    for s in inserted {
        let start = s.start.min(inserted_len);
        let end = s.end.min(inserted_len);
        out.push(TextSpan::new(offset + start, offset + end, s.format.clone()));
    }
    normalize_spans(out, len + inserted_len)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn bold() -> CharacterFormat {
        CharacterFormat { font_weight: Some(700), ..Default::default() }
    }
    fn italic() -> CharacterFormat {
        CharacterFormat { italic: Some(true), ..Default::default() }
    }

    #[test]
    fn normalize_merges_clamps_and_drops() {
        let spans = vec![
            TextSpan::new(4, 6, bold()),
            TextSpan::new(0, 2, bold()),
            TextSpan::new(2, 4, bold()),
            TextSpan::new(7, 7, italic()),
            TextSpan::new(8, 99, italic()),
            TextSpan::new(1, 3, CharacterFormat::default()),
        ];
        let n = normalize_spans(spans, 10);
        assert_eq!(n, vec![TextSpan::new(0, 6, bold()), TextSpan::new(8, 10, italic())]);
        assert!(is_canonical(&n, 10));
    }

    #[test]
    fn later_span_wins_on_overlap() {
        let n = normalize_spans(vec![TextSpan::new(0, 10, bold()), TextSpan::new(3, 5, italic())], 10);
        assert_eq!(
            n,
            vec![TextSpan::new(0, 3, bold()), TextSpan::new(3, 5, italic()), TextSpan::new(5, 10, bold())]
        );
    }

    #[test]
    fn remove_then_reinsert_restores_spans() {
        let spans = vec![TextSpan::new(2, 8, bold()), TextSpan::new(9, 12, italic())];
        let deleted = spans_in_range(&spans, 5, 10);
        assert_eq!(deleted, vec![TextSpan::new(0, 3, bold()), TextSpan::new(4, 5, italic())]);
        let after = remove_range(&spans, 5, 10, 12);
        assert_eq!(after, vec![TextSpan::new(2, 5, bold()), TextSpan::new(5, 7, italic())]);
        let restored = insert_range(&after, 5, 5, &deleted, 7);
        assert_eq!(restored, spans);
    }

    #[test]
    fn plain_insert_inside_span_splits_it() {
        let spans = vec![TextSpan::new(0, 4, bold())];
        let after = insert_range(&spans, 2, 3, &[], 4);
        assert_eq!(after, vec![TextSpan::new(0, 2, bold()), TextSpan::new(5, 7, bold())]);
        let styled = insert_range(&spans, 2, 3, &[TextSpan::new(0, 3, bold())], 4);
        assert_eq!(styled, vec![TextSpan::new(0, 7, bold())]);
    }
}
