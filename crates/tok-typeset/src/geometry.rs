use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Copy, PartialEq, Serialize, Deserialize)]
pub struct PhysicalPoint {
    pub x: f32, // in DTP points (pt)
    pub y: f32,
}

#[derive(Debug, Clone, Copy, PartialEq, Serialize, Deserialize)]
pub struct PhysicalRect {
    pub x: f32,
    pub y: f32,
    pub width: f32,
    pub height: f32,
}

impl PhysicalRect {
    pub fn new(x: f32, y: f32, width: f32, height: f32) -> Self {
        Self {
            x,
            y,
            width,
            height,
        }
    }

    pub fn contains_point(&self, pt: PhysicalPoint) -> bool {
        pt.x >= self.x
            && pt.x <= self.x + self.width
            && pt.y >= self.y
            && pt.y <= self.y + self.height
    }

    pub fn a4_portrait() -> Self {
        // A4: 210mm x 297mm = 595.28 pt x 841.89 pt
        Self {
            x: 0.0,
            y: 0.0,
            width: 595.28,
            height: 841.89,
        }
    }
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct GlyphBox {
    pub glyph_id: u32,
    pub cluster: u32,
    pub x: f32,
    pub y: f32,
    pub width: f32,
    pub height: f32,
    pub character: Option<char>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct LineBox {
    pub line_index: usize,
    pub baseline_y: f32,
    pub height: f32,
    pub width: f32,
    pub glyphs: Vec<GlyphBox>,
    pub text: String,
    pub is_rtl: bool,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct TextFrameBox {
    pub frame_id: String,
    pub flow_id: String,
    pub rect: PhysicalRect,
    pub lines: Vec<LineBox>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct BreakToken {
    pub section_index: usize,
    pub paragraph_index: usize,
    pub char_offset: usize,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct PageLayoutBox {
    pub page_index: usize,
    pub page_number_gematria: String,
    pub dimensions: PhysicalRect,
    pub frames: Vec<TextFrameBox>,
    pub break_token: Option<BreakToken>,
}
