use serde::{Deserialize, Serialize};
use std::fmt;
use std::hash::{BuildHasher, Hasher};
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::OnceLock;
use std::time::{SystemTime, UNIX_EPOCH};

const CROCKFORD_ALPHABET: &[u8; 32] = b"0123456789ABCDEFGHJKMNPQRSTVWXYZ";

static MONOTONIC_COUNTER: AtomicU64 = AtomicU64::new(0);

/// Per-process random seed, so that two processes creating ids in the same
/// millisecond do not produce the same sequence.
fn process_seed() -> u64 {
    static SEED: OnceLock<u64> = OnceLock::new();
    *SEED.get_or_init(|| {
        // `RandomState` is keyed from the OS RNG once per process.
        let mut h = std::collections::hash_map::RandomState::new().build_hasher();
        h.write_u32(std::process::id());
        h.write_u128(
            SystemTime::now()
                .duration_since(UNIX_EPOCH)
                .map(|d| d.as_nanos())
                .unwrap_or(0),
        );
        h.finish()
    })
}

/// SplitMix64 finalizer.
fn mix64(mut z: u64) -> u64 {
    z = (z ^ (z >> 30)).wrapping_mul(0xBF58476D1CE4E5B9);
    z = (z ^ (z >> 27)).wrapping_mul(0x94D049BB133111EB);
    z ^ (z >> 31)
}

/// 128-bit Universally Unique Lexicographically Sortable Identifier (ULID).
/// 48-bit timestamp + 80-bit randomness/entropy encoded as 26 Crockford Base32 characters.
#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord, Hash)]
pub struct Ulid(pub u128);

impl Ulid {
    pub fn new() -> Self {
        let now_millis = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .map(|d| d.as_millis() as u64)
            .unwrap_or(0)
            & ((1u64 << 48) - 1);

        // A strictly increasing counter guarantees uniqueness inside the process;
        // the per-process seed separates concurrent processes.
        let count = MONOTONIC_COUNTER.fetch_add(1, Ordering::Relaxed);
        let seed = process_seed();
        let hi = mix64(seed ^ count.wrapping_mul(0x9E3779B97F4A7C15));
        let lo = mix64(hi ^ seed.rotate_left(32));
        let entropy = ((hi as u128) << 16) | ((lo as u128) & 0xFFFF);

        let value = ((now_millis as u128) << 80) | (entropy & ((1u128 << 80) - 1));
        Self(value)
    }

    pub fn from_string(s: &str) -> Result<Self, &'static str> {
        if s.len() != 26 {
            return Err("ULID string must be 26 characters long");
        }
        let mut value: u128 = 0;
        for (i, b) in s.bytes().enumerate() {
            let digit = match b {
                b'0'..=b'9' => (b - b'0') as u128,
                b'A'..=b'H' => (b - b'A' + 10) as u128,
                b'J'..=b'K' => (b - b'J' + 18) as u128,
                b'M'..=b'N' => (b - b'M' + 20) as u128,
                b'P'..=b'T' => (b - b'P' + 22) as u128,
                b'V'..=b'Z' => (b - b'V' + 27) as u128,
                b'a'..=b'h' => (b - b'a' + 10) as u128,
                b'j'..=b'k' => (b - b'j' + 18) as u128,
                b'm'..=b'n' => (b - b'm' + 20) as u128,
                b'p'..=b't' => (b - b'p' + 22) as u128,
                b'v'..=b'z' => (b - b'v' + 27) as u128,
                _ => return Err("Invalid character in ULID string"),
            };
            // 26 base-32 digits carry 130 bits; the first digit may only use 3.
            if i == 0 && digit > 7 {
                return Err("ULID value exceeds 128 bits");
            }
            value = (value << 5) | digit;
        }
        Ok(Self(value))
    }
}

impl Default for Ulid {
    fn default() -> Self {
        Self::new()
    }
}

impl fmt::Display for Ulid {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        let mut chars = [0u8; 26];
        let mut val = self.0;
        for slot in chars.iter_mut().rev() {
            *slot = CROCKFORD_ALPHABET[(val & 0x1F) as usize];
            val >>= 5;
        }
        let s = std::str::from_utf8(&chars).map_err(|_| fmt::Error)?;
        f.write_str(s)
    }
}

impl Serialize for Ulid {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: serde::Serializer,
    {
        serializer.serialize_str(&self.to_string())
    }
}

impl<'de> Deserialize<'de> for Ulid {
    fn deserialize<D>(deserializer: D) -> Result<Self, D::Error>
    where
        D: serde::Deserializer<'de>,
    {
        let s = String::deserialize(deserializer)?;
        Ulid::from_string(&s).map_err(serde::de::Error::custom)
    }
}

/// Stable unique identifier for every structural AST node.
#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord, Hash, Serialize, Deserialize)]
pub struct NodeId(pub Ulid);

impl NodeId {
    pub fn new() -> Self {
        Self(Ulid::new())
    }

    pub fn from_string(s: &str) -> Result<Self, &'static str> {
        Ok(Self(Ulid::from_string(s)?))
    }
}

impl Default for NodeId {
    fn default() -> Self {
        Self::new()
    }
}

impl fmt::Display for NodeId {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "{}", self.0)
    }
}

use crate::error::ModelError;

/// Fractional index key for O(1) ordering without rewriting all sibling indices.
/// Lexicographically sorted string key.
///
/// Keys compare by `String` ordering, i.e. by Unicode scalar value, so the
/// generator below works on `char`s and accepts arbitrary existing keys
/// (digits, upper case, non-ASCII) while only ever emitting printable ASCII
/// for the characters it invents.
#[derive(Debug, Clone, PartialEq, Eq, PartialOrd, Ord, Hash, Serialize, Deserialize)]
pub struct FractionalIndex(pub String);

/// Lowest / highest characters the generator invents.
const KEY_LO: char = '0';
const KEY_HI: char = 'z';
/// Preferred lower bound for new leading characters, so keys stay lower-case
/// whenever there is room.
const KEY_LOWER_A: char = 'a';

fn char_mid(lo: char, hi: char) -> Option<char> {
    // Strictly between `lo` and `hi`, skipping the surrogate gap.
    let (lo, hi) = (lo as u32, hi as u32);
    if hi <= lo + 1 {
        return None;
    }
    let mid = lo + (hi - lo) / 2;
    char::from_u32(mid)
        .or_else(|| char::from_u32(0xD7FF).filter(|c| (*c as u32) > lo))
        .or_else(|| char::from_u32(0xE000).filter(|c| (*c as u32) < hi))
}

/// Appends to `out` a non-empty sequence that sorts strictly after `tail`
/// (no upper bound).
fn push_after(out: &mut Vec<char>, tail: &[char]) {
    match tail.iter().position(|&c| c < KEY_HI) {
        // Bump the first character that still has room; shorter keys win.
        Some(i) => {
            out.extend_from_slice(&tail[..i]);
            let c = tail[i];
            let bumped = if c < KEY_LO {
                KEY_LO
            } else {
                // c < 'z', so c + 1 is ASCII and valid.
                char::from_u32(c as u32 + 1).unwrap_or(KEY_HI)
            };
            out.push(bumped);
        }
        None => {
            out.extend_from_slice(tail);
            out.push('m');
        }
    }
}

/// Appends to `out` a non-empty sequence that sorts strictly before `tail`.
/// Returns `false` when no such sequence exists (`tail` is `"\0"`).
fn push_before(out: &mut Vec<char>, tail: &[char]) -> bool {
    let Some(&first) = tail.first() else {
        return false;
    };
    // Prefer a single lower-case character below `first`.
    if first > KEY_HI {
        out.push('m');
        return true;
    }
    if let Some(c) = char_mid(KEY_LOWER_A, first) {
        out.push(c);
        return true;
    }
    // Otherwise decrement the first character that still has room. A result
    // that would end in KEY_LO gets a trailing KEY_HI so that repeated
    // prepends never run out of space.
    if let Some(i) = tail.iter().position(|&c| c > KEY_LO) {
        out.extend_from_slice(&tail[..i]);
        let c = tail[i];
        if c > KEY_HI {
            out.push(KEY_HI);
        } else if (c as u32) - 1 > KEY_LO as u32 {
            // c <= 'z', so c - 1 is ASCII and valid.
            out.push(char::from_u32(c as u32 - 1).unwrap_or(KEY_LO));
        } else {
            out.push(KEY_LO);
            out.push(KEY_HI);
        }
        return true;
    }
    // Every character is <= KEY_LO (only possible for foreign keys).
    if tail.len() > 1 {
        // A proper prefix sorts before the whole string.
        out.push(first);
        return true;
    }
    match (first as u32).checked_sub(1).and_then(char::from_u32) {
        Some(c) => {
            out.push(c);
            true
        }
        None => false,
    }
}

impl FractionalIndex {
    pub fn new(key: impl Into<String>) -> Self {
        Self(key.into())
    }

    /// Generate an initial key when no items exist.
    pub fn initial() -> Self {
        Self("m".to_string())
    }

    /// Generate a key that sorts strictly between `prev` and `next`.
    /// If `prev` is None, generate a key before `next`.
    /// If `next` is None, generate a key after `prev`.
    /// If both are None, generate initial key.
    ///
    /// Returns [`ModelError::InvalidRange`] when `prev >= next` or when no key
    /// can exist in the requested interval (e.g. before the empty key).
    pub fn between(prev: Option<&Self>, next: Option<&Self>) -> Result<Self, ModelError> {
        let a: Vec<char> = prev.map(|k| k.0.chars().collect()).unwrap_or_default();
        let mut out = Vec::new();
        match (prev, next) {
            (None, None) => return Ok(Self::initial()),
            (Some(_), None) => push_after(&mut out, &a),
            (None, Some(b)) => {
                let b: Vec<char> = b.0.chars().collect();
                if !push_before(&mut out, &b) {
                    return Err(ModelError::InvalidRange);
                }
            }
            (Some(pa), Some(pb)) => {
                if pa >= pb {
                    return Err(ModelError::InvalidRange);
                }
                let b: Vec<char> = pb.0.chars().collect();
                let n = a.iter().zip(&b).take_while(|(x, y)| x == y).count();
                out.extend_from_slice(&a[..n]);
                match a.get(n) {
                    // `a` is a proper prefix of `b`: extend `a` with something
                    // that still sorts below the rest of `b`.
                    None => {
                        if !push_before(&mut out, &b[n..]) {
                            return Err(ModelError::InvalidRange);
                        }
                    }
                    Some(&ca) => {
                        let cb = b[n];
                        if let Some(mid) = char_mid(ca, cb) {
                            out.push(mid);
                        } else {
                            // Adjacent characters: keep `a`'s character and
                            // go anywhere above the rest of `a`.
                            out.push(ca);
                            push_after(&mut out, &a[n + 1..]);
                        }
                    }
                }
            }
        }
        let key = Self(out.into_iter().collect());
        debug_assert!(prev.is_none_or(|p| *p < key) && next.is_none_or(|n| key < *n));
        Ok(key)
    }
}

impl fmt::Display for FractionalIndex {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "{}", self.0)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_node_id_uniqueness() {
        let id1 = NodeId::new();
        let id2 = NodeId::new();
        assert_ne!(id1, id2);
        assert_eq!(id1.to_string().len(), 26);
    }

    #[test]
    fn test_ulid_roundtrip() {
        let id = NodeId::new();
        let s = id.to_string();
        let parsed = NodeId::from_string(&s).unwrap();
        assert_eq!(id, parsed);
    }

    #[test]
    fn ulid_ids_are_unique_in_bulk() {
        let ids: std::collections::HashSet<Ulid> = (0..10_000).map(|_| Ulid::new()).collect();
        assert_eq!(ids.len(), 10_000);
    }

    /// Regression: a first digit above 7 silently overflowed u128 and parsed
    /// to a different id.
    #[test]
    fn ulid_rejects_values_above_128_bits() {
        assert!(Ulid::from_string("7ZZZZZZZZZZZZZZZZZZZZZZZZZ").is_ok());
        assert!(Ulid::from_string("8ZZZZZZZZZZZZZZZZZZZZZZZZZ").is_err());
        assert!(Ulid::from_string("ZZZZZZZZZZZZZZZZZZZZZZZZZZ").is_err());
        let max = Ulid(u128::MAX);
        assert_eq!(Ulid::from_string(&max.to_string()), Ok(max));
    }

    #[test]
    fn test_fractional_indexing() {
        let k1 = FractionalIndex::initial(); // "m"
        let k2 = FractionalIndex::between(Some(&k1), None).unwrap();
        assert!(k1 < k2);

        let k0 = FractionalIndex::between(None, Some(&k1)).unwrap();
        assert!(k0 < k1);

        let k_mid = FractionalIndex::between(Some(&k1), Some(&k2)).unwrap();
        assert!(k1 < k_mid);
        assert!(k_mid < k2);

        let k_mid2 = FractionalIndex::between(Some(&k0), Some(&k1)).unwrap();
        assert!(k0 < k_mid2);
        assert!(k_mid2 < k1);

        // Test prefix collision
        let a = FractionalIndex::new("b");
        let b = FractionalIndex::new("ba");
        let mid_prefix = FractionalIndex::between(Some(&a), Some(&b)).unwrap();
        assert!(a < mid_prefix);
        assert!(mid_prefix < b);
    }

    fn assert_between(a: Option<&str>, b: Option<&str>) {
        let fa = a.map(FractionalIndex::new);
        let fb = b.map(FractionalIndex::new);
        let k = FractionalIndex::between(fa.as_ref(), fb.as_ref())
            .unwrap_or_else(|e| panic!("between({a:?}, {b:?}) failed: {e}"));
        if let Some(fa) = &fa {
            assert!(*fa < k, "between({a:?}, {b:?}) = {k:?} is not after {a:?}");
        }
        if let Some(fb) = &fb {
            assert!(k < *fb, "between({a:?}, {b:?}) = {k:?} is not before {b:?}");
        }
    }

    /// Regression: these used to return keys equal to or outside the bounds
    /// (e.g. between("p", "p0") = "pZ", before("Z") = "ZZ", between("", "a") = "am").
    #[test]
    fn fractional_index_edge_cases() {
        assert_between(Some("p"), Some("p0"));
        assert_between(Some("b"), Some("bZ"));
        assert_between(Some(""), Some("a"));
        assert_between(Some(""), Some("b"));
        assert_between(None, Some("Z"));
        assert_between(None, Some("A"));
        assert_between(None, Some("0"));
        assert_between(None, Some("a"));
        assert_between(None, Some("aa"));
        assert_between(Some("z"), None);
        assert_between(Some("zzz"), None);
        assert_between(Some("שלום"), None);
        assert_between(None, Some("שלום"));
        assert_between(Some("א"), Some("ב"));
        assert_between(Some("\u{D7FF}"), Some("\u{E001}"));
        assert_between(Some("a"), Some("a\u{1}"));
        assert!(FractionalIndex::between(None, Some(&FractionalIndex::new(""))).is_err());
        let x = FractionalIndex::new("x");
        assert!(FractionalIndex::between(Some(&x), Some(&x)).is_err());
        assert!(FractionalIndex::between(
            Some(&FractionalIndex::new("a")),
            Some(&FractionalIndex::new("a\0"))
        )
        .is_err());
    }

    #[test]
    fn fractional_index_exhaustive_small_alphabet() {
        let alphabet = ['0', '9', 'A', 'Z', 'a', 'b', 'm', 'y', 'z', 'א'];
        let mut keys = vec![String::new()];
        for &c1 in &alphabet {
            keys.push(c1.to_string());
            for &c2 in &alphabet {
                keys.push(format!("{c1}{c2}"));
                for &c3 in &alphabet[..4] {
                    keys.push(format!("{c1}{c2}{c3}"));
                }
            }
        }
        keys.sort();
        keys.dedup();
        for a in &keys {
            assert_between(Some(a), None);
            if !a.is_empty() {
                assert_between(None, Some(a));
            }
        }
        for w in keys.windows(2) {
            assert_between(Some(&w[0]), Some(&w[1]));
        }
        for (i, a) in keys.iter().enumerate().step_by(7) {
            for b in keys[i + 1..].iter().step_by(11) {
                assert_between(Some(a), Some(b));
            }
        }
    }

    #[test]
    fn repeated_append_and_prepend_stay_ordered() {
        let mut last = FractionalIndex::initial();
        for _ in 0..500 {
            let next = FractionalIndex::between(Some(&last), None).unwrap();
            assert!(last < next);
            last = next;
        }
        let mut first = FractionalIndex::initial();
        for _ in 0..500 {
            let prev = FractionalIndex::between(None, Some(&first)).unwrap();
            assert!(prev < first);
            first = prev;
        }
        // Repeatedly bisecting towards one side must keep working.
        let lo = FractionalIndex::new("a");
        let mut hi = FractionalIndex::new("b");
        for _ in 0..200 {
            let mid = FractionalIndex::between(Some(&lo), Some(&hi)).unwrap();
            assert!(lo < mid && mid < hi);
            hi = mid;
        }
    }
}
