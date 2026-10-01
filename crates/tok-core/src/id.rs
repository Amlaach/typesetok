use serde::{Deserialize, Serialize};
use std::fmt;
use std::sync::atomic::{AtomicU64, Ordering};
use std::time::{SystemTime, UNIX_EPOCH};

const CROCKFORD_ALPHABET: &[u8; 32] = b"0123456789ABCDEFGHJKMNPQRSTVWXYZ";

static MONOTONIC_COUNTER: AtomicU64 = AtomicU64::new(0x123456789ABCDEF0);

/// 128-bit Universally Unique Lexicographically Sortable Identifier (ULID).
/// 48-bit timestamp + 80-bit randomness/entropy encoded as 26 Crockford Base32 characters.
#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord, Hash)]
pub struct Ulid(pub u128);

impl Ulid {
    pub fn new() -> Self {
        let now_millis = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .map(|d| d.as_millis() as u64)
            .unwrap_or(0);

        // Mix thread id and monotonic counter to produce 80 bits of unique entropy
        let c1 = MONOTONIC_COUNTER.fetch_add(0x9E3779B97F4A7C15, Ordering::Relaxed);
        let c2 = (c1 ^ (c1 >> 30)).wrapping_mul(0xBF58476D1CE4E5B9);
        let entropy = ((c1 as u128) << 16) | ((c2 as u128) & 0xFFFF);

        let value = ((now_millis as u128) << 80) | (entropy & ((1u128 << 80) - 1));
        Self(value)
    }

    pub fn from_string(s: &str) -> Result<Self, &'static str> {
        if s.len() != 26 {
            return Err("ULID string must be 26 characters long");
        }
        let mut value: u128 = 0;
        for b in s.bytes() {
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
            value = (value << 5) | digit;
        }
        Ok(Self(value))
    }

    pub fn to_string(&self) -> String {
        let mut chars = [0u8; 26];
        let mut val = self.0;
        for i in (0..26).rev() {
            chars[i] = CROCKFORD_ALPHABET[(val & 0x1F) as usize];
            val >>= 5;
        }
        // Crockford alphabet contains only valid ASCII characters
        String::from_utf8(chars.to_vec()).unwrap()
    }
}

impl Default for Ulid {
    fn default() -> Self {
        Self::new()
    }
}

impl fmt::Display for Ulid {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "{}", self.to_string())
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

    pub fn to_string(&self) -> String {
        self.0.to_string()
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
#[derive(Debug, Clone, PartialEq, Eq, PartialOrd, Ord, Hash, Serialize, Deserialize)]
pub struct FractionalIndex(pub String);

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
    pub fn between(prev: Option<&Self>, next: Option<&Self>) -> Result<Self, ModelError> {
        match (prev, next) {
            (None, None) => Ok(Self::initial()),
            (None, Some(b)) => {
                let b_str = &b.0;
                let first_char = b_str.chars().next().unwrap_or('m');
                if first_char > 'a' {
                    let mid = ((b'a' + first_char as u8) / 2) as char;
                    Ok(Self(mid.to_string()))
                } else {
                    // Prepend smaller prefix
                    Ok(Self(format!("Z{}", b_str)))
                }
            }
            (Some(a), None) => {
                let a_str = &a.0;
                if a_str.is_empty() {
                    return Err(ModelError::InvalidRange);
                }
                let last_char = a_str.chars().last().unwrap_or('m');
                if last_char < 'z' {
                    let next_char = (last_char as u8 + 1) as char;
                    let mut s = a_str[..a_str.len() - 1].to_string();
                    s.push(next_char);
                    Ok(Self(s))
                } else {
                    Ok(Self(format!("{}m", a_str)))
                }
            }
            (Some(a), Some(b)) => {
                if a >= b {
                    return Err(ModelError::InvalidRange);
                }
                let a_bytes = a.0.as_bytes();
                let b_bytes = b.0.as_bytes();
                let mut result = Vec::new();
                let mut i = 0;

                loop {
                    let byte_a = *a_bytes.get(i).unwrap_or(&b'a');
                    let byte_b = *b_bytes.get(i).unwrap_or(&b'z');

                    if byte_a == byte_b {
                        result.push(byte_a);
                        i += 1;
                        if i >= a_bytes.len() && i < b_bytes.len() {
                            let next_b = b_bytes[i];
                            if next_b > b'a' {
                                result.push(b'a');
                            } else {
                                result.push(b'Z');
                            }
                            break;
                        }
                        continue;
                    }

                    if byte_b > byte_a + 1 {
                        // Midpoint available between byte_a and byte_b
                        let mid = (byte_a + byte_b) / 2;
                        result.push(mid);
                        break;
                    } else {
                        // byte_b == byte_a + 1
                        result.push(byte_a);
                        i += 1;
                        // Search in remaining characters of a
                        while i < a_bytes.len() {
                            let next_a = a_bytes[i];
                            if next_a < b'z' {
                                let mid = (next_a + b'z') / 2;
                                if mid > next_a {
                                    result.push(mid);
                                    return Ok(Self(String::from_utf8(result).unwrap()));
                                }
                                result.push(next_a);
                            } else {
                                result.push(b'z');
                            }
                            i += 1;
                        }
                        result.push(b'm');
                        break;
                    }
                }

                Ok(Self(String::from_utf8(result).unwrap_or_else(|_| format!("{}m", a.0))))
            }
        }
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
}
