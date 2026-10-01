//! Color handling for Pre-press PDF/X generation.
//!
//! Enforces DeviceCMYK color space and Spot Color separation.

use tok_core::styles::Color;

#[derive(Debug, Clone, Copy, PartialEq)]
pub struct CmykColor {
    pub c: f32, // 0.0 .. 1.0
    pub m: f32,
    pub y: f32,
    pub k: f32,
}

impl CmykColor {
    pub const BLACK: Self = Self {
        c: 0.0,
        m: 0.0,
        y: 0.0,
        k: 1.0,
    };
    pub const WHITE: Self = Self {
        c: 0.0,
        m: 0.0,
        y: 0.0,
        k: 0.0,
    };

    pub fn new(c: f32, m: f32, y: f32, k: f32) -> Self {
        Self {
            c: c.clamp(0.0, 1.0),
            m: m.clamp(0.0, 1.0),
            y: y.clamp(0.0, 1.0),
            k: k.clamp(0.0, 1.0),
        }
    }

    /// Converts a generic Color into pure DeviceCMYK.
    pub fn from_core_color(color: &Color) -> Self {
        match color {
            Color::DeviceCmyk { c, m, y, k } => Self::new(*c, *m, *y, *k),
            Color::Rgb { r, g, b } => {
                // Convert sRGB to CMYK
                let r = r.clamp(0.0, 1.0);
                let g = g.clamp(0.0, 1.0);
                let b = b.clamp(0.0, 1.0);
                let k = 1.0 - r.max(g).max(b);
                if (1.0 - k).abs() < 1e-5 {
                    Self::BLACK
                } else {
                    let c = (1.0 - r - k) / (1.0 - k);
                    let m = (1.0 - g - k) / (1.0 - k);
                    let y = (1.0 - b - k) / (1.0 - k);
                    Self::new(c, m, y, k)
                }
            }
            Color::Spot {
                tint,
                fallback_cmyk,
                ..
            } => Self::new(
                fallback_cmyk.0 * tint,
                fallback_cmyk.1 * tint,
                fallback_cmyk.2 * tint,
                fallback_cmyk.3 * tint,
            ),
        }
    }

    /// PDF operator for setting non-stroking (fill) color in DeviceCMYK.
    pub fn to_pdf_fill_op(&self) -> String {
        format!(
            "{:.3} {:.3} {:.3} {:.3} k\n",
            self.c, self.m, self.y, self.k
        )
    }

    /// PDF operator for setting stroking color in DeviceCMYK.
    pub fn to_pdf_stroke_op(&self) -> String {
        format!(
            "{:.3} {:.3} {:.3} {:.3} K\n",
            self.c, self.m, self.y, self.k
        )
    }
}
