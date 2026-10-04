//! TrueType / OpenType Font Subsetter & CID Embedding for Pre-Press PDF.
//!
//! Subsets TrueType/OpenType font files to include strictly the glyphs used
//! in the document, generating the required Type 0 / CIDFont Type 2 structures,
//! FontDescriptor, FontFile2 stream, and /ToUnicode mapping table.

use std::collections::{BTreeMap, HashMap};

#[derive(Debug, Clone)]
pub struct SubsetFontResult {
    pub subset_bytes: Vec<u8>,
    /// `ABCDEF+PostScriptName`, as required for embedded subsets (ISO 32000 9.6.4).
    pub font_name: String,
    pub upem: u16,
    pub ascender_1000: f32,
    pub descender_1000: f32,
    pub cap_height_1000: f32,
    pub bbox_1000: [f32; 4],
    pub italic_angle: f32,
    pub cid_widths_1000: Vec<f32>,
    pub to_unicode_map: BTreeMap<u16, char>,
    pub gid_to_cid: HashMap<u16, u16>,
}

/// 64-bit FNV-1a, used for deterministic subset tags.
pub(crate) fn fnv1a(seed: u64, bytes: &[u8]) -> u64 {
    let mut h = seed;
    for &b in bytes {
        h ^= u64::from(b);
        h = h.wrapping_mul(0x0000_0100_0000_01B3);
    }
    h
}

pub(crate) const FNV_OFFSET: u64 = 0xCBF2_9CE4_8422_2325;

/// The font's PostScript name restricted to characters allowed in a PDF name
/// without escaping.
fn postscript_name(face: &ttf_parser::Face) -> String {
    let raw = face
        .names()
        .into_iter()
        .filter(|n| n.name_id == ttf_parser::name_id::POST_SCRIPT_NAME)
        .find_map(|n| n.to_string())
        .unwrap_or_default();
    let clean: String = raw
        .chars()
        .filter(|c| c.is_ascii_alphanumeric() || *c == '-' || *c == '_')
        .take(63 - 7)
        .collect();
    if clean.is_empty() {
        "TOKFont".to_string()
    } else {
        clean
    }
}

pub struct FontSubsetter;

impl FontSubsetter {
    /// Subsets the provided TrueType font data for the given set of glyph IDs and Unicode mappings.
    pub fn create_subset(
        font_data: &[u8],
        glyph_char_pairs: &[(u16, Option<char>)],
    ) -> Result<SubsetFontResult, String> {
        let face = ttf_parser::Face::parse(font_data, 0)
            .map_err(|e| format!("Failed to parse font for subsetting: {}", e))?;

        let upem = face.units_per_em();
        if upem == 0 {
            return Err("Failed to parse font for subsetting: unitsPerEm is zero".to_string());
        }
        let scale = 1000.0 / upem as f32;

        let num_glyphs = face.number_of_glyphs();
        let mut remapper = subsetter::GlyphRemapper::new();
        for &(gid, _) in glyph_char_pairs {
            if gid > 0 && gid < num_glyphs {
                remapper.remap(gid);
            }
        }

        let subset_bytes = subsetter::subset(font_data, 0, &remapper)
            .map_err(|e| format!("Font subsetting failed: {}", e))?;

        let total_cids = remapper.num_gids() as usize;
        let mut gid_to_cid = HashMap::with_capacity(total_cids);
        let mut cid_widths_1000 = Vec::with_capacity(total_cids);

        let base_name = postscript_name(&face);
        let mut tag_hash = fnv1a(FNV_OFFSET, base_name.as_bytes());
        for (new_cid, orig_gid) in remapper.remapped_gids().enumerate() {
            gid_to_cid.insert(orig_gid, new_cid as u16);
            tag_hash = fnv1a(tag_hash, &orig_gid.to_le_bytes());
            let adv = face
                .glyph_hor_advance(ttf_parser::GlyphId(orig_gid))
                .unwrap_or(upem / 2);
            cid_widths_1000.push(adv as f32 * scale);
        }

        // Build /ToUnicode map (first known character wins for a glyph)
        let mut to_unicode_map = BTreeMap::new();
        for &(gid, maybe_char) in glyph_char_pairs {
            if let (Some(ch), Some(&new_cid)) = (maybe_char, gid_to_cid.get(&gid)) {
                to_unicode_map.entry(new_cid).or_insert(ch);
            }
        }

        let raw_bbox = face.global_bounding_box();
        let bbox_1000 = [
            raw_bbox.x_min as f32 * scale,
            raw_bbox.y_min as f32 * scale,
            raw_bbox.x_max as f32 * scale,
            raw_bbox.y_max as f32 * scale,
        ];

        // Subset tag: six upper-case letters derived from the glyph set.
        let tag: String = (0..6)
            .map(|i| char::from(b'A' + ((tag_hash >> (i * 5)) % 26) as u8))
            .collect();
        let font_name = format!("{}+{}", tag, base_name);

        Ok(SubsetFontResult {
            subset_bytes,
            font_name,
            upem,
            ascender_1000: face.ascender() as f32 * scale,
            descender_1000: face.descender() as f32 * scale,
            cap_height_1000: face.capital_height().unwrap_or(700) as f32 * scale,
            bbox_1000,
            italic_angle: face.italic_angle().unwrap_or(0.0),
            cid_widths_1000,
            to_unicode_map,
            gid_to_cid,
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_font_subset_creation() {
        let font_bytes = tok_typeset::font::EMBEDDED_NOTO_SERIF_HEBREW;
        let pairs = vec![(10, Some('א')), (15, Some('ב')), (20, Some('ג'))];

        let res =
            FontSubsetter::create_subset(font_bytes, &pairs).expect("Subsetting should succeed");
        assert!(!res.subset_bytes.is_empty());
        assert!(res.subset_bytes.len() < font_bytes.len());
        assert_eq!(res.gid_to_cid.get(&0), Some(&0));
        assert!(res.gid_to_cid.contains_key(&10));
        assert_eq!(res.to_unicode_map.len(), 3);
        assert!(!res.cid_widths_1000.is_empty());
    }

    /// Regression: every subset was named "TOK+NotoSerifHebrew", which is not
    /// a valid subset tag and mislabels other fonts.
    #[test]
    fn subset_names_follow_the_pdf_convention() {
        let noto = FontSubsetter::create_subset(
            tok_typeset::font::EMBEDDED_NOTO_SERIF_HEBREW,
            &[(10, Some('א'))],
        )
        .unwrap();
        let david = FontSubsetter::create_subset(
            tok_typeset::font::EMBEDDED_DAVID_LIBRE,
            &[(10, Some('א'))],
        )
        .unwrap();
        for name in [&noto.font_name, &david.font_name] {
            let (tag, base) = name.split_once('+').unwrap();
            assert_eq!(tag.len(), 6);
            assert!(tag.bytes().all(|b| b.is_ascii_uppercase()));
            assert!(!base.is_empty());
        }
        assert!(noto.font_name.contains("Noto"));
        assert!(david.font_name.contains("David"));
        // Deterministic for the same input.
        let again = FontSubsetter::create_subset(
            tok_typeset::font::EMBEDDED_NOTO_SERIF_HEBREW,
            &[(10, Some('א'))],
        )
        .unwrap();
        assert_eq!(again.font_name, noto.font_name);
    }

    #[test]
    fn invalid_font_is_an_error() {
        assert!(FontSubsetter::create_subset(b"not a font", &[(1, None)]).is_err());
    }
}
