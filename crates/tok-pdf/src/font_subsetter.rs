//! TrueType / OpenType Font Subsetter & CID Embedding for Pre-Press PDF.
//!
//! Subsets TrueType/OpenType font files to include strictly the glyphs used
//! in the document, generating the required Type 0 / CIDFont Type 2 structures,
//! FontDescriptor, FontFile2 stream, and /ToUnicode mapping table.

use std::collections::{BTreeMap, HashMap};

#[derive(Debug, Clone)]
pub struct SubsetFontResult {
    pub subset_bytes: Vec<u8>,
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
        let mut gid_to_cid = HashMap::new();
        let mut cid_widths_1000 = Vec::with_capacity(total_cids);

        for (new_cid, orig_gid) in remapper.remapped_gids().enumerate() {
            gid_to_cid.insert(orig_gid, new_cid as u16);
            let adv = face
                .glyph_hor_advance(ttf_parser::GlyphId(orig_gid))
                .unwrap_or(upem / 2);
            cid_widths_1000.push(adv as f32 * scale);
        }

        // Build /ToUnicode map
        let mut to_unicode_map = BTreeMap::new();
        for &(gid, maybe_char) in glyph_char_pairs {
            if let Some(ch) = maybe_char {
                if let Some(&new_cid) = gid_to_cid.get(&gid) {
                    to_unicode_map.insert(new_cid, ch);
                }
            }
        }

        let raw_bbox = face.global_bounding_box();
        let bbox_1000 = [
            raw_bbox.x_min as f32 * scale,
            raw_bbox.y_min as f32 * scale,
            raw_bbox.x_max as f32 * scale,
            raw_bbox.y_max as f32 * scale,
        ];

        let font_name = "TOK+NotoSerifHebrew".to_string();

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
}
