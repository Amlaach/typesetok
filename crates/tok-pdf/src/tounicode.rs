//! /ToUnicode CMap Generator for Searchable & Copy-Pasteable Hebrew Text in PDF.
//!
//! Maps glyph IDs to standard Unicode scalar values, guaranteeing that
//! Hebrew text copied from the PDF matches SI 6100 normalized text.

use std::collections::BTreeMap;

pub struct ToUnicodeCMap;

impl ToUnicodeCMap {
    /// Generates a valid PostScript CMap stream mapping glyph IDs to Unicode code points.
    pub fn generate(mapping: &BTreeMap<u16, char>) -> Vec<u8> {
        let mut cmap = String::new();
        cmap.push_str("/CIDInit /ProcSet findresource begin\n");
        cmap.push_str("12 dict begin\n");
        cmap.push_str("begincmap\n");
        cmap.push_str("/CIDSystemInfo << /Registry (Adobe) /Ordering (UCS) /Supplement 0 >> def\n");
        cmap.push_str("/CMapName /TOK-Custom-ToUnicode def\n");
        cmap.push_str("/CMapType 2 def\n");
        cmap.push_str("1 begincodespacerange\n");
        cmap.push_str("<0000> <FFFF>\n");
        cmap.push_str("endcodespacerange\n");

        if !mapping.is_empty() {
            // Write in chunks of up to 100 entries (Adobe CMap standard limit per operator)
            let entries: Vec<(&u16, &char)> = mapping.iter().collect();
            for chunk in entries.chunks(100) {
                cmap.push_str(&format!("{} beginbfrange\n", chunk.len()));
                for (gid, ch) in chunk {
                    let utf16_val = **ch as u32;
                    if utf16_val <= 0xFFFF {
                        cmap.push_str(&format!("<{:04X}> <{:04X}> <{:04X}>\n", gid, gid, utf16_val));
                    } else {
                        // Surrogate pair
                        let high = 0xD800 + ((utf16_val - 0x10000) >> 10);
                        let low = 0xDC00 + ((utf16_val - 0x10000) & 0x3FF);
                        cmap.push_str(&format!("<{:04X}> <{:04X}> <{:04X}{:04X}>\n", gid, gid, high, low));
                    }
                }
                cmap.push_str("endbfrange\n");
            }
        }

        cmap.push_str("endcmap\n");
        cmap.push_str("CMapName currentdict /CMap defineresource pop\n");
        cmap.push_str("end\n");
        cmap.push_str("end\n");

        cmap.into_bytes()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_tounicode_cmap_generation() {
        let mut map = BTreeMap::new();
        map.insert(1, 'א');
        map.insert(2, 'ב');
        map.insert(3, 'ג');

        let bytes = ToUnicodeCMap::generate(&map);
        let s = String::from_utf8(bytes).unwrap();
        assert!(s.contains("begincmap"));
        assert!(s.contains("beginbfrange"));
        // 'א' is U+05D0
        assert!(s.contains("<0001> <0001> <05D0>"));
        // 'ב' is U+05D1
        assert!(s.contains("<0002> <0002> <05D1>"));
        assert!(s.contains("endcmap"));
    }

    #[test]
    fn test_tounicode_empty_mapping() {
        let mapping = std::collections::BTreeMap::new();
        let bytes = ToUnicodeCMap::generate(&mapping);
        let s = String::from_utf8(bytes).unwrap();
        assert!(s.contains("begincmap"), "Must contain CMap header");
        assert!(s.contains("endcmap"), "Must contain CMap footer");
    }
}
