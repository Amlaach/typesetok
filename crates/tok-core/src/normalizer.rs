//! Hebrew Typographic Normalizer according to Israeli Standard SI 6100 (ת"י 6100).
//!
//! Standard Unicode NFD sorts combining marks strictly by Canonical Combining Class (CCC).
//! This erroneously swaps Dagesh (CCC=21) before Shin Dot (CCC=24) and pushes Qamats (CCC=18)
//! ahead of Dagesh, which breaks OpenType GPOS feature lookups (`mark`, `mkmk`) in fonts.
//!
//! SI 6100 mandates the canonical order:
//! Base Letter -> Shin/Sin Dot -> Dagesh/Mapiq/Rafe -> Niqqud -> Meteg -> Te'amim

use unicode_normalization::UnicodeNormalization;

#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord)]
pub enum HebrewMarkCategory {
    ShinSinDot = 1,
    DageshRafe = 2,
    Niqqud = 3,
    Meteg = 4,
    Teamin = 5,
    OtherMark = 6,
}

pub struct HebrewNormalizer;

impl HebrewNormalizer {
    /// Classifies a combining character into the SI 6100 category.
    pub fn mark_category(c: char) -> Option<HebrewMarkCategory> {
        let code = c as u32;
        match code {
            // Shin / Sin Dots
            0x05C1 | 0x05C2 => Some(HebrewMarkCategory::ShinSinDot),

            // Dagesh / Mapiq / Rafe
            0x05BC | 0x05BF => Some(HebrewMarkCategory::DageshRafe),

            // Niqqud: Sheva .. Qubuts, Qamats Qatan
            0x05B0..=0x05BB | 0x05C7 => Some(HebrewMarkCategory::Niqqud),

            // Meteg
            0x05BD => Some(HebrewMarkCategory::Meteg),

            // Te'amim (Cantillation marks)
            0x0591..=0x05AF => Some(HebrewMarkCategory::Teamin),

            // Other Hebrew dots/accents
            0x05C4 | 0x05C5 => Some(HebrewMarkCategory::OtherMark),

            _ => None,
        }
    }

    /// Decomposes legacy Hebrew presentation forms (U+FB1D..U+FB4F) only.
    /// Unlike global NFKD, this preserves non-breaking spaces, ligatures, and other characters.
    pub fn decompose_presentation_forms(input: &str) -> String {
        let mut result = String::with_capacity(input.len());
        for ch in input.chars() {
            if ('\u{FB1D}'..='\u{FB4F}').contains(&ch) {
                // Decompose only Hebrew Presentation Forms via NFKD
                let s: String = ch.to_string().nfkd().collect();
                result.push_str(&s);
            } else {
                result.push(ch);
            }
        }
        result
    }

    /// Normalizes Hebrew text strictly according to SI 6100.
    pub fn normalize(input: &str) -> String {
        // Step 1: Decompose any legacy presentation forms
        let decomposed = Self::decompose_presentation_forms(input);

        // Step 2: Iterate over grapheme clusters and sort combining marks per base letter
        let mut result = String::with_capacity(decomposed.len());
        let mut current_marks: Vec<(HebrewMarkCategory, u32, char)> = Vec::new();

        let flush_marks = |marks: &mut Vec<(HebrewMarkCategory, u32, char)>, out: &mut String| {
            if marks.is_empty() {
                return;
            }
            // Sort by category first, preserving relative insertion order (stable sort)
            marks.sort_by_key(|&(cat, index, _)| (cat, index));
            for &(_, _, ch) in marks.iter() {
                out.push(ch);
            }
            marks.clear();
        };

        for (idx, ch) in decomposed.chars().enumerate() {
            if let Some(cat) = Self::mark_category(ch) {
                current_marks.push((cat, idx as u32, ch));
            } else {
                // Not a combining mark; flush collected marks for previous base character
                flush_marks(&mut current_marks, &mut result);
                result.push(ch);
            }
        }

        flush_marks(&mut current_marks, &mut result);
        result
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_si_6100_ordering_shin_dagesh_qamats() {
        // Input with wrong order: Base + Qamats (\u{05B8}) + Dagesh (\u{05BC}) + Shin Dot (\u{05C1})
        let wrong_input = "\u{05E9}\u{05B8}\u{05BC}\u{05C1}";

        let normalized = HebrewNormalizer::normalize(wrong_input);

        // Expected order:
        // 1. \u{05E9} (Shin)
        // 2. \u{05C1} (Shin Dot)
        // 3. \u{05BC} (Dagesh)
        // 4. \u{05B8} (Qamats)
        let expected = "\u{05E9}\u{05C1}\u{05BC}\u{05B8}";
        assert_eq!(normalized, expected);
    }

    #[test]
    fn test_si_6100_with_meteg_and_teamim() {
        // Base Bet + Patah + Te'amim (Etnahta \u{0591}) + Dagesh + Meteg
        let input = "\u{05D1}\u{05B7}\u{0591}\u{05BC}\u{05BD}";
        let normalized = HebrewNormalizer::normalize(input);

        // Expected:
        // 1. Bet \u{05D1}
        // 2. Dagesh \u{05BC}
        // 3. Patah \u{05B7}
        // 4. Meteg \u{05BD}
        // 5. Etnahta \u{0591}
        let expected = "\u{05D1}\u{05BC}\u{05B7}\u{05BD}\u{0591}";
        assert_eq!(normalized, expected);
    }

    #[test]
    fn test_decompose_presentation_forms() {
        // Presentation form U+FB2C (Shin with Shin Dot and Dagesh) + Qamats
        let input = "\u{FB2C}\u{05B8}";
        let normalized = HebrewNormalizer::normalize(input);

        // Decomposes and normalizes to: Shin, Shin Dot, Dagesh, Qamats
        let expected = "\u{05E9}\u{05C1}\u{05BC}\u{05B8}";
        assert_eq!(normalized, expected);
    }

    #[test]
    fn test_normalizer_preserves_nbsp() {
        // Non-breaking space (U+00A0) must survive normalization
        let input = "\u{05E9}\u{05C1}\u{05B8}\u{00A0}\u{05DC}\u{05B9}\u{05DD}";
        let result = HebrewNormalizer::normalize(input);
        assert!(
            result.contains('\u{00A0}'),
            "NBSP must be preserved, got: {:?}",
            result
        );
    }

    #[test]
    fn test_normalizer_empty_string() {
        let result = HebrewNormalizer::normalize("");
        assert_eq!(result, "");
    }

    #[test]
    fn test_normalizer_idempotent() {
        let input = "\u{05E9}\u{05B8}\u{05C1}\u{05DC}\u{05D5}\u{05B9}\u{05DD}";
        let once = HebrewNormalizer::normalize(input);
        let twice = HebrewNormalizer::normalize(&once);
        assert_eq!(once, twice, "Normalization must be idempotent");
    }

    #[test]
    fn test_normalizer_plain_ascii() {
        let input = "Hello World 123";
        let result = HebrewNormalizer::normalize(input);
        assert_eq!(result, input, "ASCII text must pass through unchanged");
    }
}
