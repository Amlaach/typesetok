//! Variable-Width Polygon Engine for Non-Rectangular Text Frame Wrapping.
//!
//! Maps non-rectangular geometric frames (such as L-shaped commentary columns,
//! absorbed frames, and polygon exclusion zones) to Knuth-Plass measure profiles,
//! ensuring seamless multi-paragraph flow across expanding or narrowing boundaries.

use crate::geometry::{LineBox, PhysicalRect};
use crate::knuth_plass::MeasureProfile;
use crate::polygon::{ExclusionZone, GeometricPolygon, ScanlineSpan};
use serde::{Deserialize, Serialize};

/// A non-rectangular or multi-segment text frame capable of receiving text flow.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct PolygonFrame {
    /// Distinct contiguous rectangular bands composing the frame (ordered vertically).
    pub bands: Vec<PhysicalRect>,
    /// Optional arbitrary polygonal boundary.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub polygon: Option<GeometricPolygon>,
    /// Active exclusion zones inside or intersecting this frame.
    #[serde(default)]
    pub exclusions: Vec<ExclusionZone>,
}

impl PolygonFrame {
    /// Creates a polygon frame from a single rectangular boundary.
    pub fn from_rect(rect: PhysicalRect) -> Self {
        Self {
            bands: vec![rect],
            polygon: Some(GeometricPolygon::from_rect(&rect)),
            exclusions: Vec::new(),
        }
    }

    /// Creates an L-shaped composite frame consisting of a narrow upper column
    /// and a wide lower absorption band.
    pub fn l_shaped(
        upper_x: f32,
        upper_y: f32,
        upper_width: f32,
        upper_height: f32,
        lower_x: f32,
        lower_width: f32,
        lower_height: f32,
    ) -> Self {
        let upper_rect = PhysicalRect::new(upper_x, upper_y, upper_width, upper_height);
        let lower_y = upper_y + upper_height;
        let lower_rect = PhysicalRect::new(lower_x, lower_y, lower_width, lower_height);

        Self {
            bands: vec![upper_rect, lower_rect],
            polygon: None,
            exclusions: Vec::new(),
        }
    }

    /// Creates a polygon frame from an arbitrary GeometricPolygon.
    pub fn from_polygon(poly: GeometricPolygon) -> Self {
        Self {
            bands: Vec::new(),
            polygon: Some(poly),
            exclusions: Vec::new(),
        }
    }

    /// Adds an exclusion zone to the frame.
    pub fn with_exclusion(mut self, exclusion: ExclusionZone) -> Self {
        self.exclusions.push(exclusion);
        self
    }

    /// Adds multiple exclusion zones to the frame.
    pub fn with_exclusions(mut self, exclusions: Vec<ExclusionZone>) -> Self {
        self.exclusions.extend(exclusions);
        self
    }

    /// Total bounding rectangle enclosing all bands and polygon vertices.
    pub fn total_bounds(&self) -> PhysicalRect {
        if let Some(ref poly) = self.polygon {
            let mut pb = poly.bounds();
            for b in &self.bands {
                let min_x = pb.x.min(b.x);
                let min_y = pb.y.min(b.y);
                let max_x = (pb.x + pb.width).max(b.x + b.width);
                let max_y = (pb.y + pb.height).max(b.y + b.height);
                pb = PhysicalRect::new(min_x, min_y, max_x - min_x, max_y - min_y);
            }
            pb
        } else if !self.bands.is_empty() {
            let mut min_x = f32::INFINITY;
            let mut min_y = f32::INFINITY;
            let mut max_x = f32::NEG_INFINITY;
            let mut max_y = f32::NEG_INFINITY;
            for b in &self.bands {
                min_x = min_x.min(b.x);
                min_y = min_y.min(b.y);
                max_x = max_x.max(b.x + b.width);
                max_y = max_y.max(b.y + b.height);
            }
            PhysicalRect::new(min_x, min_y, max_x - min_x, max_y - min_y)
        } else {
            PhysicalRect::new(0.0, 0.0, 0.0, 0.0)
        }
    }

    /// Computes the usable horizontal span at physical vertical coordinate `y` with given `height`.
    pub fn span_at_y(&self, y: f32, height: f32) -> Option<ScanlineSpan> {
        // 1. If bands are explicitly defined, find the band containing the midpoint of [y, y + height]
        let sample_y = y + height * 0.5;

        let mut base_span: Option<ScanlineSpan> = None;

        for b in &self.bands {
            if sample_y >= b.y && sample_y < b.y + b.height {
                base_span = Some(ScanlineSpan::new(b.x, b.width));
                break;
            }
        }

        // 2. Otherwise fall back to polygon scanline slicing
        if base_span.is_none() {
            if let Some(ref poly) = self.polygon {
                let spans = poly.scanline_spans(y, height);
                base_span = spans.into_iter().max_by(|a, b| a.width.total_cmp(&b.width));
            }
        }

        let mut span = base_span?;

        // 3. Subtract intersecting exclusions
        for ex in &self.exclusions {
            if ex.intersects_y(y, height) {
                let exp = ex.expanded_rect();
                let remaining = span.subtract_range(exp.x, exp.x + exp.width);
                if let Some(longest) = remaining.into_iter().max_by(|a, b| a.width.total_cmp(&b.width)) {
                    span = longest;
                } else {
                    return None;
                }
            }
        }

        if span.width > 1.0 {
            Some(span)
        } else {
            None
        }
    }

    /// Computes total capacity of lines fitting inside this frame.
    pub fn capacity_lines(&self, line_height: f32) -> usize {
        if line_height <= 0.0 {
            return 0;
        }
        let bounds = self.total_bounds();
        let num_bands = (bounds.height / line_height).ceil() as usize;

        let mut count = 0;
        for i in 0..num_bands {
            let y = bounds.y + (i as f32) * line_height;
            if self.span_at_y(y, line_height).is_some() {
                count += 1;
            }
        }
        count
    }

    /// Synthesizes a variable [`MeasureProfile`] for a paragraph beginning at `start_line`
    /// within this polygon frame.
    pub fn profile_for_paragraph(
        &self,
        line_height: f32,
        start_line: usize,
        max_lines: usize,
    ) -> MeasureProfile {
        let bounds = self.total_bounds();
        let mut measures = Vec::with_capacity(max_lines);

        for i in 0..max_lines {
            let line_idx = start_line + i;
            let y = bounds.y + (line_idx as f32) * line_height;

            if let Some(span) = self.span_at_y(y, line_height) {
                measures.push((span.x, span.width));
            } else {
                // Beyond frame capacity: repeat last or use narrow minimal width
                if let Some(&last) = measures.last() {
                    measures.push(last);
                } else {
                    measures.push((bounds.x, bounds.width.max(100.0)));
                }
            }
        }

        if measures.is_empty() {
            MeasureProfile::uniform(bounds.width.max(100.0))
        } else {
            MeasureProfile::from_measures(&measures, true)
        }
    }

    /// Positions a set of formatted paragraph lines within the frame starting at `start_line`.
    pub fn position_paragraph_lines(
        &self,
        lines: &mut [LineBox],
        start_line: usize,
        line_height: f32,
    ) {
        let bounds = self.total_bounds();
        for (i, line) in lines.iter_mut().enumerate() {
            let abs_line = start_line + i;
            let y_top = bounds.y + (abs_line as f32) * line_height;
            line.baseline_y = y_top + line_height;

            if let Some(span) = self.span_at_y(y_top, line_height) {
                line.x_offset = span.x;
            }
        }
    }
}
