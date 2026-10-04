//! Color handling for Pre-press PDF/X generation.
//!
//! Enforces DeviceCMYK color space and Spot Color separation.

use tok_core::styles::Color;

/// Clamps a colour component to [0, 1]; NaN becomes 0 (`f32::clamp` keeps NaN).
fn unit(v: f32) -> f32 {
    if v.is_nan() {
        0.0
    } else {
        v.clamp(0.0, 1.0)
    }
}

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
            c: unit(c),
            m: unit(m),
            y: unit(y),
            k: unit(k),
        }
    }

    /// Converts a generic Color into pure DeviceCMYK.
    pub fn from_core_color(color: &Color) -> Self {
        match color {
            Color::DeviceCmyk { c, m, y, k } => Self::new(*c, *m, *y, *k),
            Color::Rgb { r, g, b } => {
                // Convert sRGB to CMYK
                let (r, g, b) = (unit(*r), unit(*g), unit(*b));
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
            } => {
                let tint = unit(*tint);
                Self::new(
                    fallback_cmyk.0 * tint,
                    fallback_cmyk.1 * tint,
                    fallback_cmyk.2 * tint,
                    fallback_cmyk.3 * tint,
                )
            }
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

#[cfg(test)]
mod tests {
    use super::*;

    /// Regression: `f32::clamp` keeps NaN, which ended up as "NaN" in the
    /// content stream.
    #[test]
    fn nan_components_become_zero() {
        let c = CmykColor::new(f32::NAN, 2.0, -1.0, 0.5);
        assert_eq!((c.c, c.m, c.y, c.k), (0.0, 1.0, 0.0, 0.5));
        let spot = CmykColor::from_core_color(&Color::Spot {
            name: "PANTONE".to_string(),
            tint: f32::NAN,
            fallback_cmyk: (1.0, 1.0, 1.0, 1.0),
        });
        assert_eq!(spot, CmykColor::WHITE);
        let rgb = CmykColor::from_core_color(&Color::Rgb {
            r: f32::NAN,
            g: 0.0,
            b: 0.0,
        });
        assert_eq!(rgb, CmykColor::BLACK);
        assert!(!c.to_pdf_fill_op().contains("NaN"));
    }

    #[test]
    fn rgb_primaries_convert() {
        let red = CmykColor::from_core_color(&Color::Rgb {
            r: 1.0,
            g: 0.0,
            b: 0.0,
        });
        assert_eq!(red, CmykColor::new(0.0, 1.0, 1.0, 0.0));
        assert_eq!(
            CmykColor::from_core_color(&Color::Rgb {
                r: 1.0,
                g: 1.0,
                b: 1.0
            }),
            CmykColor::WHITE
        );
    }
}
