//! OpenType / TrueType Font Management and Shaping Engine for TypesetOK.
//!
//! Provides:
//! - Embedded high-quality OpenType Hebrew fonts (Noto Serif Hebrew & David Libre).
//! - Dynamic font loading and registration (system fonts or project fonts).
//! - OpenType text shaping with rustybuzz (HarfBuzz-compatible) supporting GPOS mark/mkmk,
//!   GSUB ligatures, and font fallback.
//! - Accurate typographic metrics extraction (ascender, descender, cap-height, upem).

use crate::shaper::{PositionedGlyph, ShapedRun};
use rustybuzz::{BufferClusterLevel, Direction, Face, Feature, UnicodeBuffer};
use std::collections::HashMap;
use std::str::FromStr;
use std::sync::Arc;

pub static EMBEDDED_NOTO_SERIF_HEBREW: &[u8] =
    include_bytes!("../../../assets/fonts/NotoSerifHebrew-Regular.ttf");
pub static EMBEDDED_DAVID_LIBRE: &[u8] =
    include_bytes!("../../../assets/fonts/DavidLibre-Regular.ttf");

#[derive(Debug, Clone)]
pub struct FontMetrics {
    pub units_per_em: u16,
    pub ascender: i16,
    pub descender: i16,
    pub line_gap: i16,
    pub cap_height: Option<i16>,
    pub x_height: Option<i16>,
    pub x_min: i16,
    pub y_min: i16,
    pub x_max: i16,
    pub y_max: i16,
}

#[derive(Clone)]
pub struct FontData {
    pub family_name: String,
    pub raw_bytes: Arc<Vec<u8>>,
    pub metrics: FontMetrics,
}

impl std::fmt::Debug for FontData {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.debug_struct("FontData")
            .field("family_name", &self.family_name)
            .field("bytes_len", &self.raw_bytes.len())
            .field("metrics", &self.metrics)
            .finish()
    }
}

impl FontData {
    pub fn from_bytes(family_name: impl Into<String>, bytes: Vec<u8>) -> Result<Self, String> {
        let face = ttf_parser::Face::parse(&bytes, 0)
            .map_err(|e| format!("Failed to parse font: {}", e))?;

        let bbox = face.global_bounding_box();
        let metrics = FontMetrics {
            units_per_em: face.units_per_em(),
            ascender: face.ascender(),
            descender: face.descender(),
            line_gap: face.line_gap(),
            cap_height: face.capital_height(),
            x_height: face.x_height(),
            x_min: bbox.x_min,
            y_min: bbox.y_min,
            x_max: bbox.x_max,
            y_max: bbox.y_max,
        };

        Ok(Self {
            family_name: family_name.into(),
            raw_bytes: Arc::new(bytes),
            metrics,
        })
    }

    pub fn has_glyph(&self, ch: char) -> bool {
        if let Ok(face) = ttf_parser::Face::parse(&self.raw_bytes, 0) {
            face.glyph_index(ch).is_some()
        } else {
            false
        }
    }
}

#[derive(Debug, Clone)]
pub struct FontManager {
    fonts: HashMap<String, Arc<FontData>>,
    default_hebrew_family: String,
    fallback_family: String,
}

impl Default for FontManager {
    fn default() -> Self {
        let mut mgr = Self::new();
        // Load embedded default fonts
        let noto = FontData::from_bytes("Noto Serif Hebrew", EMBEDDED_NOTO_SERIF_HEBREW.to_vec())
            .expect("Embedded Noto Serif Hebrew must be valid font");

        let david = FontData::from_bytes("David Libre", EMBEDDED_DAVID_LIBRE.to_vec())
            .expect("Embedded David Libre must be valid font");

        mgr.register_font(noto);
        mgr.register_font(david);

        mgr.set_default_hebrew_family("Noto Serif Hebrew");
        mgr.set_fallback_family("David Libre");

        // Common aliases
        mgr.alias_font("Taamey Frank CLM", "Noto Serif Hebrew");
        mgr.alias_font("David CLM", "David Libre");
        mgr.alias_font("David", "David Libre");
        mgr.alias_font("Frank Ruehl CLM", "Noto Serif Hebrew");

        mgr
    }
}

impl FontManager {
    pub fn new() -> Self {
        Self {
            fonts: HashMap::new(),
            default_hebrew_family: String::new(),
            fallback_family: String::new(),
        }
    }

    pub fn register_font(&mut self, font: FontData) {
        self.fonts.insert(font.family_name.clone(), Arc::new(font));
    }

    pub fn alias_font(&mut self, alias: &str, target_family: &str) {
        if let Some(target) = self.fonts.get(target_family).cloned() {
            self.fonts.insert(alias.to_string(), target);
        }
    }

    pub fn set_default_hebrew_family(&mut self, family: &str) {
        self.default_hebrew_family = family.to_string();
    }

    pub fn set_fallback_family(&mut self, family: &str) {
        self.fallback_family = family.to_string();
    }

    pub fn get_font(&self, family: &str) -> Option<Arc<FontData>> {
        self.fonts.get(family).cloned().or_else(|| {
            if !self.default_hebrew_family.is_empty() {
                self.fonts.get(&self.default_hebrew_family).cloned()
            } else {
                self.fonts.values().next().cloned()
            }
        })
    }

    pub fn default_font(&self) -> Option<Arc<FontData>> {
        self.get_font(&self.default_hebrew_family)
    }

    /// Shapes text with the requested font family, automatically falling back for missing glyphs.
    pub fn shape_text(
        &self,
        text: &str,
        font_family: &str,
        font_size_pt: f32,
        is_rtl: bool,
    ) -> ShapedRun {
        if text.is_empty() {
            return ShapedRun {
                glyphs: Vec::new(),
                total_width_pt: 0.0,
                font_size_pt,
                is_rtl,
            };
        }

        let primary_font = self.get_font(font_family);
        let fallback_font = self.get_font(&self.fallback_family);

        if let Some(font) = primary_font {
            if let Some(rb_face) = Face::from_slice(&font.raw_bytes, 0) {
                // If primary font is missing letters in text (e.g. Latin letters in Noto Hebrew),
                // check if fallback font should be used instead
                let has_missing = text
                    .chars()
                    .filter(|c| !c.is_whitespace() && !('\u{0590}'..='\u{05FF}').contains(c))
                    .any(|c| !font.has_glyph(c));

                if has_missing {
                    if let Some(fallback) = fallback_font.as_ref() {
                        if let Some(fallback_face) = Face::from_slice(&fallback.raw_bytes, 0) {
                            return shape_with_rustybuzz(
                                &fallback_face,
                                text,
                                font_size_pt,
                                is_rtl,
                            );
                        }
                    }
                }

                return shape_with_rustybuzz(&rb_face, text, font_size_pt, is_rtl);
            }
        }

        // Graceful fallback to heuristic shaper if no font loaded
        crate::shaper::TextShaper::shape_fallback(text, font_size_pt, is_rtl)
    }
}

fn shape_with_rustybuzz(face: &Face, text: &str, font_size_pt: f32, is_rtl: bool) -> ShapedRun {
    let mut buffer = UnicodeBuffer::new();
    buffer.set_cluster_level(BufferClusterLevel::MonotoneGraphemes);
    buffer.set_direction(if is_rtl {
        Direction::RightToLeft
    } else {
        Direction::LeftToRight
    });
    buffer.push_str(text);

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

    for (info, pos) in infos.iter().zip(positions.iter()) {
        let x_adv = pos.x_advance as f32 * scale;
        let y_adv = pos.y_advance as f32 * scale;
        let x_off = pos.x_offset as f32 * scale;
        let y_off = pos.y_offset as f32 * scale;

        total_width_pt += x_adv;

        let character = text
            .get(info.cluster as usize..)
            .and_then(|s| s.chars().next());

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

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_embedded_font_manager() {
        let mgr = FontManager::default();
        let noto = mgr
            .get_font("Noto Serif Hebrew")
            .expect("Noto Serif Hebrew must exist");
        assert_eq!(noto.metrics.units_per_em, 1000);
        assert!(noto.metrics.ascender > 0);
        assert!(noto.metrics.descender < 0);

        let david = mgr.get_font("David Libre").expect("David Libre must exist");
        assert_eq!(david.metrics.units_per_em, 2048);
    }

    #[test]
    fn test_shape_hebrew_with_real_font() {
        let mgr = FontManager::default();
        let text = "בְּרֵאשִׁית בָּרָא אֱלֹהִים";
        let run = mgr.shape_text(text, "Noto Serif Hebrew", 12.0, true);

        assert!(run.is_rtl);
        assert!(!run.glyphs.is_empty());
        assert!(run.total_width_pt > 0.0);

        // Combining marks should have 0 or near-0 advance in OpenType mark positioning
        let zero_adv = run.glyphs.iter().filter(|g| g.x_advance == 0.0).count();
        assert!(
            zero_adv > 0,
            "Combining niqqud marks must have 0 advance in GPOS"
        );
    }

    #[test]
    fn test_font_fallback_for_latin_in_hebrew_font() {
        let mgr = FontManager::default();
        let text = "TypesetOK 2026";
        let run = mgr.shape_text(text, "Noto Serif Hebrew", 12.0, false);

        assert!(!run.glyphs.is_empty());
        assert!(run.total_width_pt > 0.0);
    }
}
