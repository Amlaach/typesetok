use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub enum Color {
    Rgb { r: f32, g: f32, b: f32 },
    DeviceCmyk { c: f32, m: f32, y: f32, k: f32 },
    Spot { name: String, tint: f32, fallback_cmyk: (f32, f32, f32, f32) },
}

impl Default for Color {
    fn default() -> Self {
        // Standard DTP 100% black in CMYK
        Color::DeviceCmyk { c: 0.0, m: 0.0, y: 0.0, k: 1.0 }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum Progression {
    Rtl,
    Ltr,
}

impl Default for Progression {
    fn default() -> Self {
        Progression::Rtl
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum TextAlignment {
    Right,
    Left,
    Center,
    Justified,
}

impl Default for TextAlignment {
    fn default() -> Self {
        TextAlignment::Justified
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum AhaltermStretchMode {
    Off,
    AutoVariable,
    StaticSwash,
}

impl Default for AhaltermStretchMode {
    fn default() -> Self {
        AhaltermStretchMode::AutoVariable
    }
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct ParagraphStyle {
    pub id: String,
    pub name: String,
    pub font_family: String,
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

impl Default for ParagraphStyle {
    fn default() -> Self {
        Self {
            id: "default-body".to_string(),
            name: "גוף הטקסט".to_string(),
            font_family: "David CLM".to_string(),
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
    pub font_size_pt: Option<f32>,
    pub bold: Option<bool>,
    pub italic: Option<bool>,
    pub tracking_em: Option<f32>,
    pub color: Option<Color>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, Default)]
pub struct StylePatch {
    pub font_family: Option<String>,
    pub font_size_pt: Option<f32>,
    pub line_height_pt: Option<f32>,
    pub alignment: Option<TextAlignment>,
    pub tracking_em: Option<f32>,
    pub color: Option<Color>,
}
