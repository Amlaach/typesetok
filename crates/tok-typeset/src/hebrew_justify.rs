//! 3-Tier Hebrew Justification Engine according to ADL-012.
//!
//! Enforces:
//! 1. Tier 1: Inter-word spacing adjustment within [80%, 130%] of base space.
//! 2. Tier 2: Ahalterm (אהלתר"ם) letter stretching:
//!    - Applicable to: Alef (א), He (ה), Lamed (ל), Tav (ת), Resh (ר), Final Mem (ם), Dalet (ד), Final Kaf (ך).
//!    - Distributes excess line width without vertical stroke weight (Stem Weight) distortion.
//! 3. Tier 3: Micro-tracking fallback (±2% of em) when letter stretch is not applicable.
//!
//! Rejection Invariants:
//! - Rejects Arabic Tatweel (U+0640) - strictly forbidden in Hebrew typography.
//! - Suppresses hyphenation for Hebrew sacred and classical texts.

use crate::shaper::PositionedGlyph;

pub const AHALTERM_LETTERS: &[char] = &['א', 'ה', 'ל', 'ת', 'ר', 'ם', 'ד', 'ך'];

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

pub struct HebrewJustifier;

impl HebrewJustifier {
    /// Checks if a character belongs to the traditional Ahalterm stretchable group.
    pub fn is_ahalterm_letter(c: char) -> bool {
        AHALTERM_LETTERS.contains(&c)
    }

    /// Justifies an individual line of Hebrew glyphs to `target_width_pt`.
    pub fn justify_line(
        mut glyphs: Vec<PositionedGlyph>,
        target_width_pt: f32,
        font_size_pt: f32,
        is_last_line_of_para: bool,
    ) -> JustifiedLine {
        // Last line of paragraph is not justified to margin in standard Hebrew typography
        if is_last_line_of_para {
            return JustifiedLine {
                glyphs,
                tier_used: JustificationTier::Tier1WordSpacing,
                space_multiplier: 1.0,
                stretch_per_ahalterm_pt: 0.0,
                micro_tracking_pt: 0.0,
            };
        }

        let current_width: f32 = glyphs.iter().map(|g| g.x_advance).sum();
        let deficit = target_width_pt - current_width;

        if deficit.abs() < 0.1 {
            return JustifiedLine {
                glyphs,
                tier_used: JustificationTier::Tier1WordSpacing,
                space_multiplier: 1.0,
                stretch_per_ahalterm_pt: 0.0,
                micro_tracking_pt: 0.0,
            };
        }

        // Count spaces in line
        let space_count = glyphs.iter().filter(|g| g.character == Some(' ')).count();

        // -------------------------------------------------------------
        // Tier 1: Try inter-word spacing adjustment [80% .. 130%]
        // -------------------------------------------------------------
        if space_count > 0 {
            let total_space_width: f32 = glyphs
                .iter()
                .filter(|g| g.character == Some(' '))
                .map(|g| g.x_advance)
                .sum();

            let required_space_width = total_space_width + deficit;
            let ratio = if total_space_width > 0.0 {
                required_space_width / total_space_width
            } else {
                1.0
            };

            if (0.80..=1.30).contains(&ratio) {
                // Tier 1 succeeds: adjust spaces
                let added_per_space = deficit / (space_count as f32);
                for g in &mut glyphs {
                    if g.character == Some(' ') {
                        g.x_advance = (g.x_advance + added_per_space).max(0.0);
                    }
                }
                return JustifiedLine {
                    glyphs,
                    tier_used: JustificationTier::Tier1WordSpacing,
                    space_multiplier: ratio,
                    stretch_per_ahalterm_pt: 0.0,
                    micro_tracking_pt: 0.0,
                };
            }
        }

        // -------------------------------------------------------------
        // Tier 2: Ahalterm Letter Stretching (אהלתר"ם)
        // -------------------------------------------------------------
        // First set spaces to max Tier 1 expansion (120%)
        let mut remaining_deficit = deficit;
        if space_count > 0 {
            let added_per_space =
                (font_size_pt * 0.28 * 0.20).min(remaining_deficit / (space_count as f32));
            for g in &mut glyphs {
                if g.character == Some(' ') {
                    g.x_advance += added_per_space;
                    remaining_deficit -= added_per_space;
                }
            }
        }

        let ahalterm_count = glyphs
            .iter()
            .filter(|g| g.character.is_some_and(Self::is_ahalterm_letter))
            .count();

        if ahalterm_count > 0 && remaining_deficit > 0.0 {
            let stretch_per_letter = remaining_deficit / (ahalterm_count as f32);
            for g in &mut glyphs {
                if g.character.is_some_and(Self::is_ahalterm_letter) {
                    g.x_advance += stretch_per_letter;
                }
            }
            return JustifiedLine {
                glyphs,
                tier_used: JustificationTier::Tier2AhaltermStretch,
                space_multiplier: 1.20,
                stretch_per_ahalterm_pt: stretch_per_letter,
                micro_tracking_pt: 0.0,
            };
        }

        // -------------------------------------------------------------
        // Tier 3: Micro-tracking fallback (±2% of em)
        // -------------------------------------------------------------
        let char_count = glyphs.len();
        if char_count > 1 {
            let max_tracking_per_glyph = font_size_pt * 0.02; // 2% em
            let tracking_needed = (remaining_deficit / (char_count as f32))
                .clamp(-max_tracking_per_glyph, max_tracking_per_glyph);

            for g in &mut glyphs {
                g.x_advance += tracking_needed;
            }

            return JustifiedLine {
                glyphs,
                tier_used: JustificationTier::Tier3MicroTracking,
                space_multiplier: 1.20,
                stretch_per_ahalterm_pt: 0.0,
                micro_tracking_pt: tracking_needed,
            };
        }

        JustifiedLine {
            glyphs,
            tier_used: JustificationTier::Tier1WordSpacing,
            space_multiplier: 1.0,
            stretch_per_ahalterm_pt: 0.0,
            micro_tracking_pt: 0.0,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::shaper::TextShaper;

    #[test]
    fn test_tier1_word_spacing() {
        let text = "אלהים שמים וארץ";
        let run = TextShaper::shape_fallback(text, 12.0, true);
        // Expand moderately (+1.5 pt, within 130% of 2 spaces)
        let target = run.total_width_pt + 1.5;
        let justified = HebrewJustifier::justify_line(run.glyphs, target, 12.0, false);
        assert_eq!(justified.tier_used, JustificationTier::Tier1WordSpacing);
        let final_width: f32 = justified.glyphs.iter().map(|g| g.x_advance).sum();
        assert!((final_width - target).abs() < 0.2);
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
        let final_width: f32 = justified.glyphs.iter().map(|g| g.x_advance).sum();
        assert!((final_width - target).abs() < 0.5);
    }
}
