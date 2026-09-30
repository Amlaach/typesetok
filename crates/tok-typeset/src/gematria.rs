//! Deterministic Hebrew Gematria Engine according to ADL-014.
//!
//! Enforces:
//! 1. Dedicated Unicode Hebrew punctuation with strong RTL directionality (R):
//!    - Standard Hebrew Geresh `U+05F3` (׳) for single-letter numerals (e.g. `א׳`, `ב׳`, `י׳`, `ק׳`).
//!    - Standard Hebrew Gershayim `U+05F4` (״) inserted before the last letter of multi-letter numerals (e.g. `י״א`, `ט״ו`, `תשפ״ו`).
//! 2. Mandatory Taboo & Sacred Name Replacement Table:
//!    - 15 -> ט״ו (including derivatives 115=קט״ו, 215=רט״ו, etc.)
//!    - 16 -> ט״ז (including derivatives 116=קט״ז, 216=רט״ז, etc.)
//!    - 270 -> ע״ר (avoid "רַע")
//!    - 272 -> ער״ב (avoid "רָעָב")
//!    - 275 -> ער״ה (avoid "רָעָה")
//!    - 298 -> חר״צ (avoid "רֶצַח")
//!    - 304 -> שי״ד (avoid "שְׁדֹד")
//!    - 314 -> שי״ד (avoid divine name Sh-d-y in profane contexts)
//!    - 359 -> נט״ש (avoid "שָׂטָן")
//!    - 644 -> תשי״ד (avoid "תשדד")

pub const HEBREW_GERESH: char = '\u{05F3}';     // ׳
pub const HEBREW_GERSHAYIM: char = '\u{05F4}';  // ״

pub struct GematriaEngine;

impl GematriaEngine {
    /// Formats an unsigned integer into standard Hebrew numerals with correct punctuation.
    pub fn to_hebrew_numeral(number: usize) -> String {
        if number == 0 {
            return String::new();
        }

        let thousands = number / 1000;
        let remainder = number % 1000;

        let mut result = String::new();

        if thousands > 0 {
            let thousands_letters = Self::convert_sub_1000(thousands);
            result.push_str(&thousands_letters);
            result.push(HEBREW_GERESH);
        }

        if remainder > 0 {
            let remainder_letters = Self::convert_sub_1000(remainder);
            result.push_str(&Self::punctuate_number(&remainder_letters));
        }

        result
    }

    /// Converts a number 1..999 to Hebrew letters, applying taboo substitutions.
    fn convert_sub_1000(mut num: usize) -> String {
        // Check exact taboo replacements first
        match num {
            270 => return "ער".to_string(),
            272 => return "ערב".to_string(),
            275 => return "ערה".to_string(),
            298 => return "חרצ".to_string(),
            304 => return "שיד".to_string(),
            314 => return "שיד".to_string(),
            359 => return "נטש".to_string(),
            644 => return "תשיד".to_string(),
            _ => {}
        }

        let mut s = String::new();

        // Hundreds (400, 300, 200, 100)
        while num >= 400 {
            s.push('ת');
            num -= 400;
        }
        if num >= 300 {
            s.push('ש');
            num -= 300;
        } else if num >= 200 {
            s.push('ר');
            num -= 200;
        } else if num >= 100 {
            s.push('ק');
            num -= 100;
        }

        // Tens & Units (special handling for 15 and 16)
        if num == 15 {
            s.push('ט');
            s.push('ו');
            return s;
        } else if num == 16 {
            s.push('ט');
            s.push('ז');
            return s;
        }

        // Standard Tens
        let tens_chars = [' ', 'י', 'כ', 'ל', 'מ', 'נ', 'ס', 'ע', 'פ', 'צ'];
        let tens_digit = num / 10;
        if tens_digit > 0 && tens_digit <= 9 {
            s.push(tens_chars[tens_digit]);
            num %= 10;
        }

        // Standard Units
        let units_chars = [' ', 'א', 'ב', 'ג', 'ד', 'ה', 'ו', 'ז', 'ח', 'ט'];
        if num > 0 && num <= 9 {
            s.push(units_chars[num]);
        }

        s
    }

    /// Injects Hebrew Geresh or Gershayim into a Hebrew letter sequence.
    fn punctuate_number(letters: &str) -> String {
        let count = letters.chars().count();
        if count == 0 {
            return String::new();
        }
        if count == 1 {
            // Single-letter numeral: append Hebrew Geresh U+05F3
            let mut out = letters.to_string();
            out.push(HEBREW_GERESH);
            out
        } else {
            // Multi-letter numeral: insert Hebrew Gershayim U+05F4 before the last character
            let mut chars: Vec<char> = letters.chars().collect();
            let last_idx = chars.len() - 1;
            chars.insert(last_idx, HEBREW_GERSHAYIM);
            chars.into_iter().collect()
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_single_letter_geresh() {
        assert_eq!(GematriaEngine::to_hebrew_numeral(1), format!("א{}", HEBREW_GERESH));
        assert_eq!(GematriaEngine::to_hebrew_numeral(5), format!("ה{}", HEBREW_GERESH));
        assert_eq!(GematriaEngine::to_hebrew_numeral(10), format!("י{}", HEBREW_GERESH));
        assert_eq!(GematriaEngine::to_hebrew_numeral(100), format!("ק{}", HEBREW_GERESH));
        assert_eq!(GematriaEngine::to_hebrew_numeral(400), format!("ת{}", HEBREW_GERESH));
    }

    #[test]
    fn test_multi_letter_gershayim() {
        assert_eq!(GematriaEngine::to_hebrew_numeral(11), format!("י{}א", HEBREW_GERSHAYIM));
        assert_eq!(GematriaEngine::to_hebrew_numeral(24), format!("כ{}ד", HEBREW_GERSHAYIM));
        assert_eq!(GematriaEngine::to_hebrew_numeral(586), format!("תקפ{}ו", HEBREW_GERSHAYIM));
    }

    #[test]
    fn test_taboo_substitutions() {
        // 15 -> ט״ו
        assert_eq!(GematriaEngine::to_hebrew_numeral(15), format!("ט{}ו", HEBREW_GERSHAYIM));
        // 16 -> ט״ז
        assert_eq!(GematriaEngine::to_hebrew_numeral(16), format!("ט{}ז", HEBREW_GERSHAYIM));
        // 115 -> קט״ו
        assert_eq!(GematriaEngine::to_hebrew_numeral(115), format!("קט{}ו", HEBREW_GERSHAYIM));
        // 216 -> רט״ז
        assert_eq!(GematriaEngine::to_hebrew_numeral(216), format!("רט{}ז", HEBREW_GERSHAYIM));

        // 270 -> ע״ר
        assert_eq!(GematriaEngine::to_hebrew_numeral(270), format!("ע{}ר", HEBREW_GERSHAYIM));
        // 272 -> ער״ב
        assert_eq!(GematriaEngine::to_hebrew_numeral(272), format!("ער{}ב", HEBREW_GERSHAYIM));
        // 275 -> ער״ה
        assert_eq!(GematriaEngine::to_hebrew_numeral(275), format!("ער{}ה", HEBREW_GERSHAYIM));
        // 298 -> חר״צ
        assert_eq!(GematriaEngine::to_hebrew_numeral(298), format!("חר{}צ", HEBREW_GERSHAYIM));
        // 359 -> נט״ש
        assert_eq!(GematriaEngine::to_hebrew_numeral(359), format!("נט{}ש", HEBREW_GERSHAYIM));
        // 644 -> תשי״ד
        assert_eq!(GematriaEngine::to_hebrew_numeral(644), format!("תשי{}ד", HEBREW_GERSHAYIM));
    }

    #[test]
    fn test_thousands() {
        // 5786 (ה'תשפ"ו)
        let expected = format!("ה{}תשפ{}ו", HEBREW_GERESH, HEBREW_GERSHAYIM);
        assert_eq!(GematriaEngine::to_hebrew_numeral(5786), expected);
    }
}
