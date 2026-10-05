use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub enum Color {
    Rgb {
        r: f32,
        g: f32,
        b: f32,
    },
    DeviceCmyk {
        c: f32,
        m: f32,
        y: f32,
        k: f32,
    },
    Spot {
        name: String,
        tint: f32,
        fallback_cmyk: (f32, f32, f32, f32),
    },
}

impl Default for Color {
    fn default() -> Self {
        // Standard DTP 100% black in CMYK
        Color::DeviceCmyk {
            c: 0.0,
            m: 0.0,
            y: 0.0,
            k: 1.0,
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Default, Serialize, Deserialize)]
pub enum Progression {
    #[default]
    Rtl,
    Ltr,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Default, Serialize, Deserialize)]
pub enum TextAlignment {
    Right,
    Left,
    Center,
    #[default]
    Justified,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Default, Serialize, Deserialize)]
pub enum AhaltermStretchMode {
    Off,
    #[default]
    AutoVariable,
    StaticSwash,
}

pub const DEFAULT_FONT_WEIGHT: u16 = 400;
pub const BOLD_FONT_WEIGHT: u16 = 700;

pub const fn default_font_weight() -> u16 {
    DEFAULT_FONT_WEIGHT
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct ParagraphStyle {
    pub id: String,
    pub name: String,
    pub font_family: String,
    /// Font weight (e.g. 400 for Regular, 700 for Bold).
    #[serde(default = "default_font_weight")]
    pub font_weight: u16,
    /// Bold (700) weight; maintained for backwards compatibility with documents using `bold`.
    #[serde(default)]
    pub bold: bool,
    pub font_size_pt: f32,
    pub line_height_pt: f32,
    pub space_before_pt: f32,
    pub space_after_pt: f32,
    pub first_line_indent_pt: f32,
    pub alignment: TextAlignment,
    pub ahalterm_stretch: AhaltermStretchMode,
    pub color: Color,
    pub keep_with_next: bool,
    pub orphan_control: u8,
    pub widow_control: u8,
}

impl ParagraphStyle {
    /// Returns true if either `font_weight >= 700` or `bold` is true.
    pub fn is_bold(&self) -> bool {
        self.bold || self.font_weight >= BOLD_FONT_WEIGHT
    }

    /// Resolves the effective font weight, taking `bold` flag into account.
    pub fn resolved_font_weight(&self) -> u16 {
        if self.bold && self.font_weight == DEFAULT_FONT_WEIGHT {
            BOLD_FONT_WEIGHT
        } else {
            self.font_weight
        }
    }
}

impl Default for ParagraphStyle {
    fn default() -> Self {
        Self {
            id: "default-body".to_string(),
            name: "גוף הטקסט".to_string(),
            font_family: "Frank Ruhl Libre".to_string(),
            font_weight: DEFAULT_FONT_WEIGHT,
            bold: false,
            font_size_pt: 11.0,
            line_height_pt: 14.5,
            space_before_pt: 0.0,
            space_after_pt: 2.0,
            first_line_indent_pt: 0.0,
            alignment: TextAlignment::Justified,
            ahalterm_stretch: AhaltermStretchMode::AutoVariable,
            color: Color::default(),
            keep_with_next: false,
            orphan_control: 2,
            widow_control: 2,
        }
    }
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct CharacterStyle {
    pub id: String,
    pub name: String,
    pub font_family: Option<String>,
    pub font_weight: Option<u16>,
    pub font_size_pt: Option<f32>,
    pub bold: Option<bool>,
    pub italic: Option<bool>,
    pub tracking_em: Option<f32>,
    pub color: Option<Color>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, Default)]
pub struct StylePatch {
    pub font_family: Option<String>,
    pub font_weight: Option<u16>,
    pub font_size_pt: Option<f32>,
    pub line_height_pt: Option<f32>,
    pub alignment: Option<TextAlignment>,
    pub tracking_em: Option<f32>,
    pub color: Option<Color>,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn paragraph_style_without_bold_field_loads_as_regular() {
        let mut json = serde_json::to_value(ParagraphStyle::default()).unwrap();
        json.as_object_mut().unwrap().remove("bold");
        let style: ParagraphStyle = serde_json::from_value(json).unwrap();
        assert!(!style.bold);
    }

    #[test]
    fn paragraph_style_without_font_weight_field_defaults_to_400() {
        let mut json = serde_json::to_value(ParagraphStyle::default()).unwrap();
        json.as_object_mut().unwrap().remove("font_weight");
        let style: ParagraphStyle = serde_json::from_value(json).unwrap();
        assert_eq!(style.font_weight, 400);
        assert!(!style.is_bold());
    }

    #[test]
    fn paragraph_style_with_font_weight_700_is_bold() {
        let mut json = serde_json::to_value(ParagraphStyle::default()).unwrap();
        json.as_object_mut()
            .unwrap()
            .insert("font_weight".to_string(), serde_json::json!(700));
        let style: ParagraphStyle = serde_json::from_value(json).unwrap();
        assert_eq!(style.font_weight, 700);
        assert!(style.is_bold());
        assert_eq!(style.resolved_font_weight(), 700);
    }

    #[test]
    fn paragraph_style_with_legacy_bold_resolves_font_weight_700() {
        let mut json = serde_json::to_value(ParagraphStyle::default()).unwrap();
        json.as_object_mut().unwrap().remove("font_weight");
        json.as_object_mut()
            .unwrap()
            .insert("bold".to_string(), serde_json::json!(true));
        let style: ParagraphStyle = serde_json::from_value(json).unwrap();
        assert!(style.bold);
        assert!(style.is_bold());
        assert_eq!(style.resolved_font_weight(), 700);
    }
}
