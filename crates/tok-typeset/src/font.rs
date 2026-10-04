//! OpenType / TrueType Font Management and Shaping Engine for TypesetOK.
//!
//! Provides:
//! - Embedded high-quality OpenType Hebrew fonts (Noto Serif Hebrew & David Libre).
//! - Dynamic font loading and registration (system fonts or project fonts).
//! - OpenType text shaping with rustybuzz (HarfBuzz-compatible) supporting GPOS mark/mkmk,
//!   GSUB ligatures, and font fallback.
//! - Accurate typographic metrics extraction (ascender, descender, cap-height, upem).

use crate::shaper::{ShapedRun, TextShaper};
use rustybuzz::Face;
use std::collections::BTreeMap;
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
        if face.units_per_em() == 0 {
            return Err("Failed to parse font: unitsPerEm is zero".to_string());
        }

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
        ttf_parser::Face::parse(&self.raw_bytes, 0)
            .map(|face| face.glyph_index(ch).is_some())
            .unwrap_or(false)
    }

    /// Parses a shaping face over this font's bytes.
    pub fn shaping_face(&self) -> Option<Face<'_>> {
        Face::from_slice(&self.raw_bytes, 0)
    }
}

/// Which font shaped a run (see [`ShapingSession::shape`]).
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum FontChoice {
    /// The requested family (after alias / default resolution).
    Primary,
    /// The fallback family, used because the primary lacked glyphs.
    Fallback,
    /// No usable font: metric heuristics, glyph ids are code points.
    Heuristic,
}

/// Fonts resolved and parsed once, for shaping many runs.
pub struct ShapingSession<'a> {
    primary: Option<(&'a FontData, Face<'a>)>,
    fallback: Option<(&'a FontData, Face<'a>)>,
}

impl<'a> ShapingSession<'a> {
    fn missing_glyphs(face: &Face<'_>, text: &str) -> usize {
        text.chars()
            .filter(|c| !c.is_whitespace() && !c.is_control())
            .filter(|c| face.glyph_index(*c).is_none())
            .count()
    }

    /// Shapes `text`, switching to the fallback font when it covers more of
    /// the text than the primary font does.
    pub fn shape(&self, text: &str, font_size_pt: f32, is_rtl: bool) -> (ShapedRun, FontChoice) {
        if text.is_empty() {
            return (
                ShapedRun {
                    glyphs: Vec::new(),
                    total_width_pt: 0.0,
                    font_size_pt,
                    is_rtl,
                },
                FontChoice::Primary,
            );
        }

        match (&self.primary, &self.fallback) {
            (Some((_, primary)), fallback) => {
                let missing = Self::missing_glyphs(primary, text);
                if missing > 0 {
                    if let Some((_, fallback)) = fallback {
                        if Self::missing_glyphs(fallback, text) < missing {
                            return (
                                TextShaper::shape_with_face(fallback, text, font_size_pt, is_rtl),
                                FontChoice::Fallback,
                            );
                        }
                    }
                }
                (
                    TextShaper::shape_with_face(primary, text, font_size_pt, is_rtl),
                    FontChoice::Primary,
                )
            }
            (None, Some((_, fallback))) => (
                TextShaper::shape_with_face(fallback, text, font_size_pt, is_rtl),
                FontChoice::Fallback,
            ),
            (None, None) => (
                TextShaper::shape_fallback(text, font_size_pt, is_rtl),
                FontChoice::Heuristic,
            ),
        }
    }

    /// The registered family name of the font behind `choice`.
    pub fn family_of(&self, choice: FontChoice) -> Option<&'a str> {
        let font = match choice {
            FontChoice::Primary => self.primary.as_ref().map(|(f, _)| *f),
            FontChoice::Fallback => self.fallback.as_ref().map(|(f, _)| *f),
            FontChoice::Heuristic => None,
        };
        font.map(|f| f.family_name.as_str())
    }

    /// Glyph id of the space character in the primary font.
    pub fn space_glyph_id(&self) -> Option<u32> {
        self.primary
            .as_ref()
            .or(self.fallback.as_ref())
            .and_then(|(_, face)| face.glyph_index(' '))
            .map(|g| u32::from(g.0))
    }
}

#[derive(Debug, Clone)]
pub struct FontManager {
    // BTreeMap: lookups that fall back to "any font" must be deterministic.
    fonts: BTreeMap<String, Arc<FontData>>,
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
            fonts: BTreeMap::new(),
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

    /// Resolves a family (or alias), falling back to the default Hebrew family.
    pub fn font_ref(&self, family: &str) -> Option<&Arc<FontData>> {
        self.fonts.get(family).or_else(|| {
            if self.default_hebrew_family.is_empty() {
                self.fonts.values().next()
            } else {
                self.fonts.get(&self.default_hebrew_family)
            }
        })
    }

    /// Exact lookup of a registered family or alias, without default fallback.
    pub fn font_exact(&self, family: &str) -> Option<&Arc<FontData>> {
        self.fonts.get(family)
    }

    pub fn get_font(&self, family: &str) -> Option<Arc<FontData>> {
        self.font_ref(family).cloned()
    }

    pub fn default_font(&self) -> Option<Arc<FontData>> {
        self.get_font(&self.default_hebrew_family)
    }

    /// Resolves and parses the fonts needed to shape text in `font_family`.
    pub fn session(&self, font_family: &str) -> ShapingSession<'_> {
        fn parse(font: &Arc<FontData>) -> Option<(&FontData, Face<'_>)> {
            let font: &FontData = font;
            font.shaping_face().map(|face| (font, face))
        }
        let primary = self.font_ref(font_family).and_then(parse);
        let fallback = self
            .fonts
            .get(&self.fallback_family)
            .filter(|f| {
                primary
                    .as_ref()
                    .is_none_or(|(p, _)| !std::ptr::eq(*p, f.as_ref()))
            })
            .and_then(parse);
        ShapingSession { primary, fallback }
    }

    /// Shapes text with the requested font family, automatically falling back for missing glyphs.
    pub fn shape_text(
        &self,
        text: &str,
        font_family: &str,
        font_size_pt: f32,
        is_rtl: bool,
    ) -> ShapedRun {
        self.session(font_family)
            .shape(text, font_size_pt, is_rtl)
            .0
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
        let text = "בְּרֵאשִׁית בָּרָא אֱלֹהִים";
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

    #[test]
    fn session_reports_the_font_that_shaped_the_run() {
        let mgr = FontManager::default();
        let session = mgr.session("Noto Serif Hebrew");
        let (_, choice) = session.shape("שלום", 12.0, true);
        assert_eq!(choice, FontChoice::Primary);
        assert_eq!(session.family_of(choice), Some("Noto Serif Hebrew"));
        let (_, choice) = session.shape("Typeset", 12.0, false);
        assert_eq!(choice, FontChoice::Fallback);
        assert_eq!(session.family_of(choice), Some("David Libre"));

        // Aliases resolve to the real family name.
        let session = mgr.session("David CLM");
        assert_eq!(session.family_of(FontChoice::Primary), Some("David Libre"));
        assert!(session.space_glyph_id().is_some());
    }

    #[test]
    fn unknown_family_without_default_is_deterministic() {
        let mut mgr = FontManager::new();
        for name in ["Zeta", "Alpha", "Mid"] {
            mgr.register_font(
                FontData::from_bytes(name, EMBEDDED_NOTO_SERIF_HEBREW.to_vec()).unwrap(),
            );
        }
        for _ in 0..5 {
            assert_eq!(mgr.get_font("missing").unwrap().family_name, "Alpha");
        }
    }

    #[test]
    fn empty_manager_uses_heuristic_shaper() {
        let mgr = FontManager::new();
        let (run, choice) = mgr.session("x").shape("אב", 10.0, true);
        assert_eq!(choice, FontChoice::Heuristic);
        assert_eq!(run.glyphs.len(), 2);
    }

    #[test]
    fn invalid_font_bytes_are_rejected() {
        assert!(FontData::from_bytes("bad", vec![0, 1, 2, 3]).is_err());
    }
}
