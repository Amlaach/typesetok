//! Canonical Hebrew Normalization (Unicode NFC + Masoretic/SBL Combining Class Ordering:
//! Base -> Dagesh/Shin-Sin -> Vowel Niqqud -> Cantillation Taamim).
//!
//! Re-exports the canonical Hebrew normalizer and verifies normalization invariants:
//! - Idempotence: `canonicalize_hebrew(canonicalize_hebrew(s)) == canonicalize_hebrew(s)`
//! - Length preservation after Unicode NFC
//! - Commutative equivalence of arbitrary combining mark permutations on Hebrew letters

pub use crate::normalizer::{canonicalize_hebrew, HebrewMarkCategory, HebrewNormalizer};

#[cfg(test)]
mod tests {
    use super::*;
    use unicode_normalization::UnicodeNormalization;

    #[test]
    fn invariant_idempotence_across_hebrew_corpus() {
        let samples = [
            "",
            "שלום עולם",
            "בְּרֵאשִׁ֖ית בָּרָ֣א אֱלֹהִ֑ים",
            "\u{05E9}\u{0591}\u{05BD}\u{05B8}\u{05BC}\u{05C1}",
            "\u{FB2C}\u{05B8}\u{05D1}\u{05B7}\u{0591}\u{05BC}",
            "Mixed עִבְרִית and English 123",
        ];

        for s in samples {
            let once = canonicalize_hebrew(s);
            let twice = canonicalize_hebrew(&once);
            assert_eq!(once, twice, "Idempotence failed for {:?}", s);
        }
    }

    #[test]
    fn invariant_length_preservation_after_nfc() {
        let inputs = [
            "\u{05E9}\u{05B8}\u{05BC}\u{05C1}\u{05DC}\u{05D5}\u{05B9}\u{05DD}",
            "\u{05D1}\u{05B0}\u{05BC}\u{05E8}\u{05B5}\u{05D0}\u{05E9}\u{05B4}\u{05C1}\u{0596}\u{05D9}\u{05EA}",
            "\u{05D0}\u{05B1}\u{05DC}\u{05B9}\u{05D4}\u{05B4}\u{0591}\u{05D9}\u{05DD}",
        ];

        for raw in inputs {
            let nfc: String = raw.nfc().collect();
            let canonical = canonicalize_hebrew(&nfc);
            assert_eq!(
                canonical.chars().count(),
                nfc.chars().count(),
                "Char count must be preserved after NFC for {:?}",
                raw
            );
            assert_eq!(
                canonical.len(),
                nfc.len(),
                "UTF-8 byte length must be preserved after NFC for {:?}",
                raw
            );
        }
    }

    #[test]
    fn invariant_commutative_equivalence_of_mark_permutations() {
        let letters = ['\u{05E9}', '\u{05D1}', '\u{05EA}'];
        let marks = ['\u{05C1}', '\u{05BC}', '\u{05B8}', '\u{05BD}', '\u{0591}'];

        for base in letters {
            let expected = format!("{base}\u{05C1}\u{05BC}\u{05B8}\u{05BD}\u{0591}");
            let mut perm = marks;
            let mut c = [0usize; 5];
            let mut i = 0;

            let first: String = std::iter::once(base).chain(perm).collect();
            assert_eq!(canonicalize_hebrew(&first), expected);

            while i < 5 {
                if c[i] < i {
                    if i % 2 == 0 {
                        perm.swap(0, i);
                    } else {
                        perm.swap(c[i], i);
                    }
                    let candidate: String = std::iter::once(base).chain(perm).collect();
                    assert_eq!(
                        canonicalize_hebrew(&candidate),
                        expected,
                        "Permutation {:?} on {:?} violated commutative equivalence",
                        perm,
                        base
                    );
                    c[i] += 1;
                    i = 0;
                } else {
                    c[i] = 0;
                    i += 1;
                }
            }
        }
    }
}
