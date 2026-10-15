//! Geometric Polygon and Exclusion Zone Engine.
//!
//! Provides polygon representation, scanline slicing, and exclusion zone subtractions
//! for non-rectangular text frames and drop cap windows ("חלון").

use crate::geometry::{PhysicalPoint, PhysicalRect};
use serde::{Deserialize, Serialize};

/// A single continuous horizontal slice available for text on a line.
#[derive(Debug, Clone, Copy, PartialEq, Serialize, Deserialize)]
pub struct ScanlineSpan {
    /// Leftmost x-coordinate of the span (in pt).
    pub x: f32,
    /// Usable width of the span (in pt).
    pub width: f32,
}

impl ScanlineSpan {
    pub fn new(x: f32, width: f32) -> Self {
        Self {
            x,
            width: width.max(0.0),
        }
    }

    #[inline]
    pub fn right(&self) -> f32 {
        self.x + self.width
    }

    /// Subtracts a horizontal exclusion range `[ex_left, ex_right]` from this span.
    /// Returns 0, 1, or 2 remaining spans.
    pub fn subtract_range(&self, ex_left: f32, ex_right: f32) -> Vec<ScanlineSpan> {
        if ex_right <= self.x || ex_left >= self.right() {
            // No overlap
            return vec![*self];
        }

        let mut out = Vec::with_capacity(2);
        // Left remainder
        if ex_left > self.x {
            out.push(ScanlineSpan::new(self.x, ex_left - self.x));
        }
        // Right remainder
        if ex_right < self.right() {
            out.push(ScanlineSpan::new(ex_right, self.right() - ex_right));
        }
        out
    }
}

/// A geometric exclusion zone (e.g. drop cap window, embedded image, callout).
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct ExclusionZone {
    pub rect: PhysicalRect,
    /// Margin / clearance (pt) applied around the exclusion zone.
    pub margin_pt: f32,
}

impl ExclusionZone {
    pub fn new(rect: PhysicalRect, margin_pt: f32) -> Self {
        Self {
            rect,
            margin_pt: margin_pt.max(0.0),
        }
    }

    /// Bounding rectangle including margin.
    pub fn expanded_rect(&self) -> PhysicalRect {
        PhysicalRect::new(
            self.rect.x - self.margin_pt,
            self.rect.y - self.margin_pt,
            self.rect.width + 2.0 * self.margin_pt,
            self.rect.height + 2.0 * self.margin_pt,
        )
    }

    /// Checks if this exclusion intersects the vertical band `[y, y + height]`.
    pub fn intersects_y(&self, y: f32, height: f32) -> bool {
        let exp = self.expanded_rect();
        let top = exp.y;
        let bottom = exp.y + exp.height;
        let band_top = y;
        let band_bottom = y + height;
        band_top < bottom && band_bottom > top
    }
}

/// A 2D polygon defining a text frame boundary.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct GeometricPolygon {
    /// Ordered boundary vertices (clockwise or counter-clockwise).
    pub vertices: Vec<PhysicalPoint>,
}

impl GeometricPolygon {
    pub fn new(vertices: Vec<PhysicalPoint>) -> Self {
        Self { vertices }
    }

    /// Creates an axis-aligned rectangular polygon.
    pub fn from_rect(rect: &PhysicalRect) -> Self {
        Self {
            vertices: vec![
                PhysicalPoint {
                    x: rect.x,
                    y: rect.y,
                },
                PhysicalPoint {
                    x: rect.x + rect.width,
                    y: rect.y,
                },
                PhysicalPoint {
                    x: rect.x + rect.width,
                    y: rect.y + rect.height,
                },
                PhysicalPoint {
                    x: rect.x,
                    y: rect.y + rect.height,
                },
            ],
        }
    }

    /// Creates an L-shaped polygon:
    /// - Narrow upper column: `[x, y]` with `narrow_width` and `narrow_height`.
    /// - Expanded lower band: `[x, y + narrow_height]` with `wide_width` and `expanded_height`.
    pub fn l_shape(
        x: f32,
        y: f32,
        narrow_width: f32,
        narrow_height: f32,
        wide_width: f32,
        expanded_height: f32,
    ) -> Self {
        Self {
            vertices: vec![
                PhysicalPoint { x, y },
                PhysicalPoint {
                    x: x + narrow_width,
                    y,
                },
                PhysicalPoint {
                    x: x + narrow_width,
                    y: y + narrow_height,
                },
                PhysicalPoint {
                    x: x + wide_width,
                    y: y + narrow_height,
                },
                PhysicalPoint {
                    x: x + wide_width,
                    y: y + narrow_height + expanded_height,
                },
                PhysicalPoint {
                    x,
                    y: y + narrow_height + expanded_height,
                },
            ],
        }
    }

    /// Computes bounding box enclosing the polygon.
    pub fn bounds(&self) -> PhysicalRect {
        if self.vertices.is_empty() {
            return PhysicalRect::new(0.0, 0.0, 0.0, 0.0);
        }
        let mut min_x = f32::INFINITY;
        let mut min_y = f32::INFINITY;
        let mut max_x = f32::NEG_INFINITY;
        let mut max_y = f32::NEG_INFINITY;

        for v in &self.vertices {
            if v.x < min_x {
                min_x = v.x;
            }
            if v.x > max_x {
                max_x = v.x;
            }
            if v.y < min_y {
                min_y = v.y;
            }
            if v.y > max_y {
                max_y = v.y;
            }
        }
        PhysicalRect::new(min_x, min_y, max_x - min_x, max_y - min_y)
    }

    /// Slices the polygon with a horizontal line or narrow band at `y` (sampled at mid-height `y + height/2.0`).
    /// Returns the continuous horizontal spans inside the polygon.
    pub fn scanline_spans(&self, y: f32, height: f32) -> Vec<ScanlineSpan> {
        let n = self.vertices.len();
        if n < 3 {
            return Vec::new();
        }
        let sample_y = y + height * 0.5;

        // Find intersections with all polygon segments
        let mut x_inters = Vec::new();
        for i in 0..n {
            let p1 = self.vertices[i];
            let p2 = self.vertices[(i + 1) % n];

            let y_min = p1.y.min(p2.y);
            let y_max = p1.y.max(p2.y);

            if sample_y >= y_min && sample_y < y_max {
                let dy = p2.y - p1.y;
                if dy.abs() > 1e-5 {
                    let t = (sample_y - p1.y) / dy;
                    let inter_x = p1.x + t * (p2.x - p1.x);
                    x_inters.push(inter_x);
                }
            }
        }

        x_inters.sort_by(|a, b| a.partial_cmp(b).unwrap_or(std::cmp::Ordering::Equal));

        let mut spans = Vec::new();
        for chunk in x_inters.chunks_exact(2) {
            let left = chunk[0];
            let right = chunk[1];
            if right > left + 1e-3 {
                spans.push(ScanlineSpan::new(left, right - left));
            }
        }
        spans
    }

    /// Slices the polygon with a horizontal band at `y`, subtracting all overlapping exclusion zones.
    pub fn scanline_spans_with_exclusions(
        &self,
        y: f32,
        height: f32,
        exclusions: &[ExclusionZone],
    ) -> Vec<ScanlineSpan> {
        let base_spans = self.scanline_spans(y, height);
        let mut current_spans = base_spans;

        for ex in exclusions {
            if !ex.intersects_y(y, height) {
                continue;
            }
            let exp = ex.expanded_rect();
            let ex_left = exp.x;
            let ex_right = exp.x + exp.width;

            let mut next_spans = Vec::new();
            for span in current_spans {
                next_spans.extend(span.subtract_range(ex_left, ex_right));
            }
            current_spans = next_spans;
        }

        current_spans
    }
}
