//! Unicode Bidirectional Algorithm (UAX #9) Integration.
//!
//! Decomposes paragraphs into directional runs, computes embedding levels,
//! and maps logical character indices to visual display order.

use unicode_bidi::{BidiInfo, Level};

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct BidiRun {
    pub start: usize,
    pub end: usize,
    pub level: u8,
    pub is_rtl: bool,
    pub text: String,
}

pub struct BidiEngine;

impl BidiEngine {
    /// Decomposes a paragraph of text into directional runs according to UAX #9.
    pub fn resolve_runs(text: &str, default_rtl: bool) -> Vec<BidiRun> {
        if text.is_empty() {
            return Vec::new();
        }

        let default_level = if default_rtl {
            Some(Level::rtl())
        } else {
            Some(Level::ltr())
        };

        let bidi_info = BidiInfo::new(text, default_level);
        let mut resolved_runs = Vec::new();

        for para in &bidi_info.paragraphs {
            let line_range = para.range.clone();
            let (_levels, runs) = bidi_info.visual_runs(para, line_range);

            for run in runs {
                let run_text = &text[run.clone()];
                let level = bidi_info.levels[run.start];
                resolved_runs.push(BidiRun {
                    start: run.start,
                    end: run.end,
                    level: level.number(),
                    is_rtl: level.is_rtl(),
                    text: run_text.to_string(),
                });
            }
        }

        resolved_runs
    }

    /// Determines whether the dominant paragraph direction is RTL.
    pub fn is_paragraph_rtl(text: &str) -> bool {
        let bidi_info = BidiInfo::new(text, None);
        if let Some(first_para) = bidi_info.paragraphs.first() {
            first_para.level.is_rtl()
        } else {
            true
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_bidi_runs_pure_hebrew() {
        let text = "שלום עליכם";
        let runs = BidiEngine::resolve_runs(text, true);
        assert_eq!(runs.len(), 1);
        assert!(runs[0].is_rtl);
    }

    #[test]
    fn test_bidi_runs_mixed_hebrew_english() {
        let text = "ספר TypesetOK לעימוד מקצועי";
        let runs = BidiEngine::resolve_runs(text, true);
        // Should produce 3 runs: Hebrew (RTL), English (LTR), Hebrew (RTL)
        assert!(runs.len() >= 3);
        assert!(runs[0].is_rtl);
        // Find the English run
        let ltr_run = runs.iter().find(|r| !r.is_rtl).unwrap();
        assert_eq!(ltr_run.text, "TypesetOK");
    }
}
