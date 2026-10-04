//! 3-Tier Hebrew Justification Engine according to ADL-012.
//!
//! Enforces:
//! 1. Tier 1: Inter-word spacing adjustment within [80%, 130%] of base space.
//! 2. Tier 2: Ahalterm (אהלתר"ם) letter stretching:
//!    - Applicable to: Alef (א), He (ה), Lamed (ל), Tav (ת), Resh (ר), Final Mem (ם), Dalet (ד), Final Kaf (ך).
//!    - Distributes excess line width without vertical stroke weight (Stem Weight) distortion.
//! 3. Tier 3: Micro-tracking fallback (±2% of em) when letter stretch is not applicable.
//!
//! Only glyphs with a positive advance take part in Tier 2 and Tier 3: with
//! grapheme clustering, niqqud and te'amim glyphs report their base letter as
//! `character` but have zero advance, and must stay attached to that letter.
//!
//! Rejection Invariants:
//! - Rejects Arabic Tatweel (U+0640) - strictly forbidden in Hebrew typography.
//! - Suppresses hyphenation for Hebrew sacred and classical texts.

use crate::shaper::PositionedGlyph;

pub const AHALTERM_LETTERS: &[char] = &['א', 'ה', 'ל', 'ת', 'ר', 'ם', 'ד', 'ך'];

/// Inter-word space limits for Tier 1, as a multiple of the natural space.
pub const MIN_SPACE_RATIO: f32 = 0.80;
pub const MAX_SPACE_RATIO: f32 = 1.30;
/// Tier 3 tracking limit per glyph, as a fraction of the em.
pub const MAX_TRACKING_EM: f32 = 0.02;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum JustificationTier {
    Tier1WordSpacing,
    Tier2AhaltermStretch,
    Tier3MicroTracking,
}

#[derive(Debug, Clone, PartialEq)]
pub struct JustifiedLine {
    pub glyphs: Vec<PositionedGlyph>,
    pub tier_used: JustificationTier,
    pub space_multiplier: f32,
    pub stretch_per_ahalterm_pt: f32,
    pub micro_tracking_pt: f32,
}

impl JustifiedLine {
    fn unchanged(glyphs: Vec<PositionedGlyph>) -> Self {
        Self {
            glyphs,
            tier_used: JustificationTier::Tier1WordSpacing,
            space_multiplier: 1.0,
            stretch_per_ahalterm_pt: 0.0,
            micro_tracking_pt: 0.0,
        }
    }
}

pub struct HebrewJustifier;

impl HebrewJustifier {
    /// Checks if a character belongs to the traditional Ahalterm stretchable group.
    pub fn is_ahalterm_letter(c: char) -> bool {
        AHALTERM_LETTERS.contains(&c)
    }

    fn is_space(g: &PositionedGlyph) -> bool {
        g.character == Some(' ')
    }

    fn scale_spaces(glyphs: &mut [PositionedGlyph], factor: f32) {
        for g in glyphs.iter_mut().filter(|g| Self::is_space(g)) {
            g.x_advance *= factor;
        }
    }

    /// Justifies an individual line of Hebrew glyphs to `target_width_pt`.
    pub fn justify_line(
        mut glyphs: Vec<PositionedGlyph>,
        target_width_pt: f32,
        font_size_pt: f32,
        is_last_line_of_para: bool,
    ) -> JustifiedLine {
        // Last line of paragraph is not justified to margin in standard Hebrew typography
        if is_last_line_of_para || glyphs.is_empty() {
            return JustifiedLine::unchanged(glyphs);
        }

        let current_width: f32 = glyphs.iter().map(|g| g.x_advance).sum();
        let deficit = target_width_pt - current_width;

        if !deficit.is_finite() || !font_size_pt.is_finite() || deficit.abs() < 0.1 {
            return JustifiedLine::unchanged(glyphs);
        }

        let total_space_width: f32 = glyphs
            .iter()
            .filter(|g| Self::is_space(g))
            .map(|g| g.x_advance)
            .sum();

        // -------------------------------------------------------------
        // Tier 1: Try inter-word spacing adjustment [80% .. 130%]
        // -------------------------------------------------------------
        let mut space_multiplier = 1.0;
        let mut remaining_deficit = deficit;
        if total_space_width > 0.0 {
            let ratio = (total_space_width + deficit) / total_space_width;
            if (MIN_SPACE_RATIO..=MAX_SPACE_RATIO).contains(&ratio) {
                // Proportional scaling keeps every space inside the limits.
                Self::scale_spaces(&mut glyphs, ratio);
                return JustifiedLine {
                    glyphs,
                    tier_used: JustificationTier::Tier1WordSpacing,
                    space_multiplier: ratio,
                    stretch_per_ahalterm_pt: 0.0,
                    micro_tracking_pt: 0.0,
                };
            }
            // Take spaces to their limit, then fall through.
            space_multiplier = ratio.clamp(MIN_SPACE_RATIO, MAX_SPACE_RATIO);
            Self::scale_spaces(&mut glyphs, space_multiplier);
            remaining_deficit = deficit - total_space_width * (space_multiplier - 1.0);
        }

        // -------------------------------------------------------------
        // Tier 2: Ahalterm Letter Stretching (אהלתר"ם) - widening only
        // -------------------------------------------------------------
        let is_stretchable = |g: &PositionedGlyph| {
            g.x_advance > 0.0 && g.character.is_some_and(Self::is_ahalterm_letter)
        };
        let ahalterm_count = glyphs.iter().filter(|g| is_stretchable(g)).count();

        if ahalterm_count > 0 && remaining_deficit > 0.0 {
            let stretch_per_letter = remaining_deficit / (ahalterm_count as f32);
            for g in glyphs.iter_mut().filter(|g| is_stretchable(g)) {
                g.x_advance += stretch_per_letter;
            }
            return JustifiedLine {
                glyphs,
                tier_used: JustificationTier::Tier2AhaltermStretch,
                space_multiplier,
                stretch_per_ahalterm_pt: stretch_per_letter,
                micro_tracking_pt: 0.0,
            };
        }

        // -------------------------------------------------------------
        // Tier 3: Micro-tracking fallback (±2% of em)
        // -------------------------------------------------------------
        // Letters only: spaces already sit at their Tier 1 limit.
        let is_tracked = |g: &PositionedGlyph| g.x_advance > 0.0 && !Self::is_space(g);
        let tracked_count = glyphs.iter().filter(|g| is_tracked(g)).count();
        if tracked_count > 1 && font_size_pt > 0.0 {
            let max_tracking_per_glyph = font_size_pt * MAX_TRACKING_EM;
            let tracking_needed = (remaining_deficit / (tracked_count as f32))
                .clamp(-max_tracking_per_glyph, max_tracking_per_glyph);

            for g in glyphs.iter_mut().filter(|g| is_tracked(g)) {
                g.x_advance += tracking_needed;
            }

            return JustifiedLine {
                glyphs,
                tier_used: JustificationTier::Tier3MicroTracking,
                space_multiplier,
                stretch_per_ahalterm_pt: 0.0,
                micro_tracking_pt: tracking_needed,
            };
        }

        JustifiedLine {
            glyphs,
            tier_used: JustificationTier::Tier1WordSpacing,
            space_multiplier,
            stretch_per_ahalterm_pt: 0.0,
            micro_tracking_pt: 0.0,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::font::FontManager;
    use crate::shaper::TextShaper;

    fn width(glyphs: &[PositionedGlyph]) -> f32 {
        glyphs.iter().map(|g| g.x_advance).sum()
    }

    #[test]
    fn test_tier1_word_spacing() {
        let text = "אלהים שמים וארץ";
        let run = TextShaper::shape_fallback(text, 12.0, true);
        // Expand moderately (+1.5 pt, within 130% of 2 spaces)
        let target = run.total_width_pt + 1.5;
        let justified = HebrewJustifier::justify_line(run.glyphs, target, 12.0, false);
        assert_eq!(justified.tier_used, JustificationTier::Tier1WordSpacing);
        assert!((width(&justified.glyphs) - target).abs() < 0.2);
    }

    #[test]
    fn test_tier2_ahalterm_stretching() {
        let text = "אמר רב יהודה";
        let run = TextShaper::shape_fallback(text, 12.0, true);
        // Expand significantly (+50 pt) to trigger Tier 2
        let target = run.total_width_pt + 50.0;
        let justified = HebrewJustifier::justify_line(run.glyphs, target, 12.0, false);
        assert_eq!(justified.tier_used, JustificationTier::Tier2AhaltermStretch);
        assert!(justified.stretch_per_ahalterm_pt > 0.0);
        assert!((justified.space_multiplier - MAX_SPACE_RATIO).abs() < 1e-6);
        assert!((width(&justified.glyphs) - target).abs() < 0.5);
    }

    /// Regression: shrinking past 80% sent the whole deficit to the spaces,
    /// producing zero or negative space advances.
    #[test]
    fn spaces_never_shrink_below_80_percent() {
        let text = "אבג דהו זחט";
        let run = TextShaper::shape_fallback(text, 12.0, true);
        let natural_space = 12.0 * 0.28;
        let target = run.total_width_pt - 30.0;
        let justified = HebrewJustifier::justify_line(run.glyphs, target, 12.0, false);
        for g in justified.glyphs.iter().filter(|g| g.character == Some(' ')) {
            assert!(
                g.x_advance >= natural_space * MIN_SPACE_RATIO - 1e-4,
                "space shrunk to {}",
                g.x_advance
            );
        }
        assert_eq!(justified.tier_used, JustificationTier::Tier3MicroTracking);
        assert!(justified.micro_tracking_pt >= -12.0 * MAX_TRACKING_EM - 1e-6);
    }

    #[test]
    fn spaces_never_stretch_beyond_130_percent() {
        let text = "בגג כככ";
        let run = TextShaper::shape_fallback(text, 12.0, true);
        let natural_space = 12.0 * 0.28;
        let justified =
            HebrewJustifier::justify_line(run.glyphs, run.total_width_pt + 40.0, 12.0, false);
        for g in justified.glyphs.iter().filter(|g| g.character == Some(' ')) {
            assert!(g.x_advance <= natural_space * MAX_SPACE_RATIO + 1e-4);
        }
        // No Ahalterm letters: falls back to bounded tracking.
        assert_eq!(justified.tier_used, JustificationTier::Tier3MicroTracking);
        assert!(justified.micro_tracking_pt <= 12.0 * MAX_TRACKING_EM + 1e-6);
    }

    /// Regression: with real shaping, niqqud glyphs carry their base letter as
    /// `character`, so Tier 2/3 widened the zero-advance mark glyphs too.
    #[test]
    fn marks_keep_zero_advance() {
        let mgr = FontManager::default();
        let run = mgr.shape_text("אָלֶף הַלֵּל", "Noto Serif Hebrew", 12.0, true);
        let zero_before: Vec<usize> = run
            .glyphs
            .iter()
            .enumerate()
            .filter(|(_, g)| g.x_advance == 0.0)
            .map(|(i, _)| i)
            .collect();
        assert!(!zero_before.is_empty());
        let target = run.total_width_pt + 40.0;
        let justified = HebrewJustifier::justify_line(run.glyphs, target, 12.0, false);
        assert_eq!(justified.tier_used, JustificationTier::Tier2AhaltermStretch);
        for i in zero_before {
            assert_eq!(justified.glyphs[i].x_advance, 0.0);
        }
        assert!((width(&justified.glyphs) - target).abs() < 0.01);

        let run = mgr.shape_text("בְּגִי", "Noto Serif Hebrew", 12.0, true);
        let justified = HebrewJustifier::justify_line(
            run.glyphs.clone(),
            run.total_width_pt + 5.0,
            12.0,
            false,
        );
        assert_eq!(justified.tier_used, JustificationTier::Tier3MicroTracking);
        for (before, after) in run.glyphs.iter().zip(&justified.glyphs) {
            if before.x_advance == 0.0 {
                assert_eq!(after.x_advance, 0.0);
            }
        }
    }

    #[test]
    fn non_finite_target_leaves_line_untouched() {
        let run = TextShaper::shape_fallback("אב גד", 12.0, true);
        let justified = HebrewJustifier::justify_line(run.glyphs.clone(), f32::NAN, 12.0, false);
        assert_eq!(justified.glyphs, run.glyphs);
        let justified = HebrewJustifier::justify_line(Vec::new(), 100.0, 12.0, false);
        assert!(justified.glyphs.is_empty());
    }
}
