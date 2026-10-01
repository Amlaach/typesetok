//! Text Shaping and Font Metrics Engine via rustybuzz (HarfBuzz-compatible).
//!
//! Enforces:
//! - Monotone grapheme clusters: `BufferClusterLevel::MonotoneGraphemes`
//! - OpenType GPOS/GSUB features: `mark`, `mkmk`, `kern`, `liga`, `ccmp`
//! - Full support for TrueType and OpenType fonts

use rustybuzz::{BufferClusterLevel, Direction, Face, Feature, UnicodeBuffer};
use std::str::FromStr;

#[derive(Debug, Clone, PartialEq)]
pub struct PositionedGlyph {
    pub glyph_id: u32,
    pub cluster: u32,
    pub x_advance: f32, // in points (pt)
    pub y_advance: f32,
    pub x_offset: f32,
    pub y_offset: f32,
    pub character: Option<char>,
}

#[derive(Debug, Clone, PartialEq)]
pub struct ShapedRun {
    pub glyphs: Vec<PositionedGlyph>,
    pub total_width_pt: f32,
    pub font_size_pt: f32,
    pub is_rtl: bool,
}

pub struct TextShaper;

impl TextShaper {
    /// Shapes text using an OpenType/TrueType font face.
    pub fn shape_with_face(face: &Face, text: &str, font_size_pt: f32, is_rtl: bool) -> ShapedRun {
        let mut buffer = UnicodeBuffer::new();
        buffer.set_cluster_level(BufferClusterLevel::MonotoneGraphemes);
        buffer.set_direction(if is_rtl {
            Direction::RightToLeft
        } else {
            Direction::LeftToRight
        });
        buffer.push_str(text);

        // Standard OpenType typography features
        let features = [
            Feature::from_str("kern=1").unwrap(),
            Feature::from_str("liga=1").unwrap(),
            Feature::from_str("mark=1").unwrap(),
            Feature::from_str("mkmk=1").unwrap(),
            Feature::from_str("ccmp=1").unwrap(),
        ];

        let glyph_buffer = rustybuzz::shape(face, &features, buffer);
        let infos = glyph_buffer.glyph_infos();
        let positions = glyph_buffer.glyph_positions();

        let upem = face.units_per_em() as f32;
        let scale = font_size_pt / upem;

        let mut glyphs = Vec::with_capacity(infos.len());
        let mut total_width_pt = 0.0;

        let chars: Vec<char> = text.chars().collect();

        for (info, pos) in infos.iter().zip(positions.iter()) {
            let x_adv = pos.x_advance as f32 * scale;
            let y_adv = pos.y_advance as f32 * scale;
            let x_off = pos.x_offset as f32 * scale;
            let y_off = pos.y_offset as f32 * scale;

            total_width_pt += x_adv;

            let char_idx = info.cluster as usize;
            let character = chars.get(char_idx).copied();

            glyphs.push(PositionedGlyph {
                glyph_id: info.glyph_id,
                cluster: info.cluster,
                x_advance: x_adv,
                y_advance: y_adv,
                x_offset: x_off,
                y_offset: y_off,
                character,
            });
        }

        ShapedRun {
            glyphs,
            total_width_pt,
            font_size_pt,
            is_rtl,
        }
    }

    /// Built-in fallback shaper based on standard typographic metric proportions.
    /// Used for headless testing and when external font files are loading.
    pub fn shape_fallback(text: &str, font_size_pt: f32, is_rtl: bool) -> ShapedRun {
        let mut glyphs = Vec::new();
        let mut total_width_pt = 0.0;

        for (i, ch) in text.chars().enumerate() {
            // Niqqud, Dagesh, Te'amim have 0 advance width in fallback
            let width_ratio = match ch as u32 {
                0x0591..=0x05C7 => 0.0,  // Combining marks: zero width
                0x0020 => 0.28,          // Space
                0x05D0..=0x05EA => 0.55, // Standard Hebrew letter
                0x0061..=0x007A => 0.45, // 'a'..='z'
                0x0041..=0x005A => 0.60, // 'A'..='Z'
                0x0030..=0x0039 => 0.50, // '0'..='9'
                _ => 0.50,
            };

            let x_adv = font_size_pt * width_ratio;
            total_width_pt += x_adv;

            glyphs.push(PositionedGlyph {
                glyph_id: ch as u32,
                cluster: i as u32,
                x_advance: x_adv,
                y_advance: 0.0,
                x_offset: 0.0,
                y_offset: 0.0,
                character: Some(ch),
            });
        }

        ShapedRun {
            glyphs,
            total_width_pt,
            font_size_pt,
            is_rtl,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_shape_fallback_hebrew() {
        let text = "בְּרֵאשִׁית";
        let run = TextShaper::shape_fallback(text, 12.0, true);
        assert!(run.is_rtl);
        // Combining marks should have 0 advance
        let non_zero_advances = run.glyphs.iter().filter(|g| g.x_advance > 0.0).count();
        // 6 base Hebrew letters: ב, ר, א, ש, י, ת
        assert_eq!(non_zero_advances, 6);
        assert!(run.total_width_pt > 0.0);
    }
}
