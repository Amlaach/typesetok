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
//!    - 304 -> ד״ש (avoid "שֵׁד"; the natural ש״ד spells "demon")
//!    - 314 -> שי״ד (the natural order; never the divine name Sh-d-y)
//!    - 344 -> שד״מ (avoid "שְׁמַד")
//!    - 359 -> נט״ש (avoid "שָׂטָן")
//!    - 698 -> תרח״צ (avoid "רֶצַח")
//!    - 744 -> תשד״מ (avoid "שְׁמַד", e.g. the year ה׳תשד״מ)
//!
//! Every substitution is a reordering of the same letters, so the numeric value
//! of the output always equals the input.

pub const HEBREW_GERESH: char = '\u{05F3}'; // ׳
pub const HEBREW_GERSHAYIM: char = '\u{05F4}'; // ״

pub struct GematriaEngine;

impl GematriaEngine {
    /// Formats an unsigned integer into standard Hebrew numerals with correct punctuation.
    /// Zero has no Hebrew numeral and yields an empty string.
    pub fn to_hebrew_numeral(number: usize) -> String {
        if number == 0 {
            return String::new();
        }

        let thousands = number / 1000;
        let remainder = number % 1000;

        let mut result = String::new();

        if thousands > 0 {
            result.push_str(&Self::to_letters(thousands));
            result.push(HEBREW_GERESH);
        }

        if remainder > 0 {
            Self::push_punctuated(&mut result, &Self::convert_sub_1000(remainder));
        }

        result
    }

    /// Letters for an arbitrary positive count (used for the thousands part,
    /// which can itself exceed 999 for very large inputs).
    fn to_letters(num: usize) -> String {
        let mut s = String::new();
        let mut rest = num;
        // Beyond 999 there is no further multiplier letter: spell every extra
        // thousand as תתר (400 + 400 + 200), which keeps the value exact.
        while rest >= 1000 {
            s.push_str("תתר");
            rest -= 1000;
        }
        s.push_str(&Self::convert_sub_1000(rest));
        s
    }

    /// Converts a number 0..=999 to Hebrew letters, applying taboo substitutions.
    fn convert_sub_1000(mut num: usize) -> String {
        // Exact taboo replacements first (each one keeps the same letters).
        let taboo = match num {
            270 => Some("ער"),
            272 => Some("ערב"),
            275 => Some("ערה"),
            298 => Some("חרצ"),
            304 => Some("דש"),
            344 => Some("שדמ"),
            359 => Some("נטש"),
            698 => Some("תרחצ"),
            744 => Some("תשדמ"),
            _ => None,
        };
        if let Some(letters) = taboo {
            return letters.to_string();
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

        // Tens & Units (15 and 16 avoid spelling the divine name)
        match num {
            15 => s.push_str("טו"),
            16 => s.push_str("טז"),
            _ => {
                const TENS: [char; 10] = [' ', 'י', 'כ', 'ל', 'מ', 'נ', 'ס', 'ע', 'פ', 'צ'];
                const UNITS: [char; 10] = [' ', 'א', 'ב', 'ג', 'ד', 'ה', 'ו', 'ז', 'ח', 'ט'];
                if num >= 10 {
                    s.push(TENS[num / 10]);
                }
                if !num.is_multiple_of(10) {
                    s.push(UNITS[num % 10]);
                }
            }
        }

        s
    }

    /// Appends `letters` with a Geresh (single letter) or with Gershayim
    /// inserted before the last letter (multi-letter numerals).
    fn push_punctuated(out: &mut String, letters: &str) {
        let mut chars = letters.chars();
        match chars.next_back() {
            None => {}
            Some(last) if chars.as_str().is_empty() => {
                out.push(last);
                out.push(HEBREW_GERESH);
            }
            Some(last) => {
                out.push_str(chars.as_str());
                out.push(HEBREW_GERSHAYIM);
                out.push(last);
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    /// Numeric value of a Hebrew numeral produced by this engine
    /// (letters before a Geresh that is not the final mark are thousands).
    fn value_of(s: &str) -> usize {
        fn letter(c: char) -> usize {
            match c {
                'א' => 1,
                'ב' => 2,
                'ג' => 3,
                'ד' => 4,
                'ה' => 5,
                'ו' => 6,
                'ז' => 7,
                'ח' => 8,
                'ט' => 9,
                'י' => 10,
                'כ' => 20,
                'ל' => 30,
                'מ' => 40,
                'נ' => 50,
                'ס' => 60,
                'ע' => 70,
                'פ' => 80,
                'צ' => 90,
                'ק' => 100,
                'ר' => 200,
                'ש' => 300,
                'ת' => 400,
                _ => 0,
            }
        }
        let chars: Vec<char> = s.chars().collect();
        let mut total = 0;
        let mut current = 0;
        for (i, &c) in chars.iter().enumerate() {
            if c == HEBREW_GERESH && i + 1 < chars.len() {
                total += current * 1000;
                current = 0;
            } else {
                current += letter(c);
            }
        }
        total + current
    }

    #[test]
    fn test_single_letter_geresh() {
        assert_eq!(
            GematriaEngine::to_hebrew_numeral(1),
            format!("א{}", HEBREW_GERESH)
        );
        assert_eq!(
            GematriaEngine::to_hebrew_numeral(5),
            format!("ה{}", HEBREW_GERESH)
        );
        assert_eq!(
            GematriaEngine::to_hebrew_numeral(10),
            format!("י{}", HEBREW_GERESH)
        );
        assert_eq!(
            GematriaEngine::to_hebrew_numeral(100),
            format!("ק{}", HEBREW_GERESH)
        );
        assert_eq!(
            GematriaEngine::to_hebrew_numeral(400),
            format!("ת{}", HEBREW_GERESH)
        );
    }

    #[test]
    fn test_multi_letter_gershayim() {
        assert_eq!(
            GematriaEngine::to_hebrew_numeral(11),
            format!("י{}א", HEBREW_GERSHAYIM)
        );
        assert_eq!(
            GematriaEngine::to_hebrew_numeral(24),
            format!("כ{}ד", HEBREW_GERSHAYIM)
        );
        assert_eq!(
            GematriaEngine::to_hebrew_numeral(586),
            format!("תקפ{}ו", HEBREW_GERSHAYIM)
        );
    }

    #[test]
    fn test_taboo_substitutions() {
        let g = HEBREW_GERSHAYIM;
        let cases = [
            (15, format!("ט{g}ו")),
            (16, format!("ט{g}ז")),
            (115, format!("קט{g}ו")),
            (216, format!("רט{g}ז")),
            (715, format!("תשט{g}ו")),
            (270, format!("ע{g}ר")),
            (272, format!("ער{g}ב")),
            (275, format!("ער{g}ה")),
            (298, format!("חר{g}צ")),
            (304, format!("ד{g}ש")),
            (314, format!("שי{g}ד")),
            (344, format!("שד{g}מ")),
            (359, format!("נט{g}ש")),
            (644, format!("תרמ{g}ד")),
            (698, format!("תרח{g}צ")),
            (744, format!("תשד{g}מ")),
        ];
        for (n, expected) in cases {
            assert_eq!(GematriaEngine::to_hebrew_numeral(n), expected, "for {n}");
        }
    }

    #[test]
    fn test_thousands() {
        // 5786 (ה'תשפ"ו)
        let expected = format!("ה{}תשפ{}ו", HEBREW_GERESH, HEBREW_GERSHAYIM);
        assert_eq!(GematriaEngine::to_hebrew_numeral(5786), expected);
        assert_eq!(
            GematriaEngine::to_hebrew_numeral(1000),
            format!("א{}", HEBREW_GERESH)
        );
        assert_eq!(
            GematriaEngine::to_hebrew_numeral(5744),
            format!("ה{}תשד{}מ", HEBREW_GERESH, HEBREW_GERSHAYIM)
        );
    }

    #[test]
    fn test_zero_is_empty() {
        assert_eq!(GematriaEngine::to_hebrew_numeral(0), "");
    }

    /// Regression: 304 used to print שי״ד (= 314) and 644 printed תשי״ד (= 714).
    #[test]
    fn every_numeral_has_the_value_of_its_input() {
        for n in 1..=6000 {
            let s = GematriaEngine::to_hebrew_numeral(n);
            if n % 1000 == 0 {
                // Whole thousands are written like their multiplier (ה׳ = 5000).
                assert_eq!(s, GematriaEngine::to_hebrew_numeral(n / 1000));
                continue;
            }
            assert_eq!(value_of(&s), n, "{n} rendered as {s}");
        }
        for n in [999_999, 1_000_001, 2_345_678] {
            let s = GematriaEngine::to_hebrew_numeral(n);
            assert_eq!(value_of(&s), n, "{n} rendered as {s}");
        }
    }

    #[test]
    fn no_numeral_spells_the_divine_name() {
        for n in 1..=999 {
            let s = GematriaEngine::to_hebrew_numeral(n);
            let letters: String = s.chars().filter(|c| *c != HEBREW_GERSHAYIM).collect();
            assert!(!letters.ends_with("יה"), "{n} rendered as {s}");
            assert!(!letters.ends_with("יו"), "{n} rendered as {s}");
        }
    }
}
