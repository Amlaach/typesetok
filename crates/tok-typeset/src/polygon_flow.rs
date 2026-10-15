//! Multi-Column Polygon Flow Synthesizer for Absorbed Commentary Frames.
//!
//! Synthesizes non-rectangular geometric frames (L-shaped, stepped, and expanded columns)
//! and lays out Hebrew commentary streams across dynamic column boundaries using the
//! polygon-aware Knuth-Plass line breaker and Hebrew justifier.

use crate::engine::TypesettingEngine;
use crate::geometry::{LineBox, PhysicalRect};
use crate::polygon_engine::PolygonFrame;
use crate::solver::AbsorptionKind;
use tok_core::model::ParagraphNode;
use tok_core::styles::ParagraphStyle;
use tok_core::FlowId;

/// Specification for dynamic commentary column absorption.
#[derive(Debug, Clone, PartialEq)]
pub struct CommentaryAbsorptionSpec {
    pub absorbing_flow_id: FlowId,
    pub terminating_flow_id: FlowId,
    pub terminating_height_pt: f32,
    pub gutter_pt: f32,
    pub kind: AbsorptionKind,
}

impl CommentaryAbsorptionSpec {
    pub fn new(
        absorbing_flow_id: FlowId,
        terminating_flow_id: FlowId,
        terminating_height_pt: f32,
        gutter_pt: f32,
        kind: AbsorptionKind,
    ) -> Self {
        Self {
            absorbing_flow_id,
            terminating_flow_id,
            terminating_height_pt,
            gutter_pt,
            kind,
        }
    }
}

/// The result of typesetting a text stream into a non-rectangular polygon frame.
#[derive(Debug, Clone, PartialEq)]
pub struct SynthesizedPolygonFlow {
    pub flow_id: FlowId,
    pub frame: PolygonFrame,
    pub lines: Vec<LineBox>,
    pub consumed_paragraphs: usize,
    pub is_complete: bool,
}

/// Synthesizer for multi-column text flows wrapped within non-rectangular polygon frames.
pub struct MultiColumnPolygonFlowSynthesizer;

impl MultiColumnPolygonFlowSynthesizer {
    /// Synthesizes an L-shaped `PolygonFrame` where an absorbing commentary column expands
    /// below an adjacent terminating flow.
    pub fn synthesize_l_shaped_frame(
        absorbing_rect: PhysicalRect,
        terminating_rect: PhysicalRect,
        gutter_pt: f32,
        content_bottom_pt: f32,
        kind: AbsorptionKind,
        terminating_is_left: bool,
    ) -> PolygonFrame {
        let absorption_top = terminating_rect.y + terminating_rect.height + gutter_pt;
        let upper_height = (absorption_top - absorbing_rect.y).max(0.0);

        // Upper band: absorbing column before expansion
        let upper_band = PhysicalRect::new(
            absorbing_rect.x,
            absorbing_rect.y,
            absorbing_rect.width,
            upper_height,
        );

        // Lower band: absorbed expansion region
        let lower_y = absorption_top;
        let lower_height = (content_bottom_pt - lower_y).max(0.0);

        let lower_band = match kind {
            AbsorptionKind::ColumnExtension => {
                // Occupies the column below the terminating stream
                PhysicalRect::new(
                    terminating_rect.x,
                    lower_y,
                    terminating_rect.width,
                    lower_height,
                )
            }
            AbsorptionKind::CombinedAdjacent | AbsorptionKind::FullWidth => {
                // Spans continuously across both columns including the gutter
                let left_x = if terminating_is_left {
                    terminating_rect.x
                } else {
                    absorbing_rect.x
                };
                let right_x = if terminating_is_left {
                    absorbing_rect.x + absorbing_rect.width
                } else {
                    terminating_rect.x + terminating_rect.width
                };
                let width = (right_x - left_x).max(0.0);
                PhysicalRect::new(left_x, lower_y, width, lower_height)
            }
        };

        PolygonFrame {
            bands: vec![upper_band, lower_band],
            polygon: None,
            exclusions: Vec::new(),
        }
    }

    /// Typesets a series of paragraphs into a `PolygonFrame`, calculating exact Knuth-Plass
    /// line breaking across variable column widths and stepped absorption transitions.
    pub fn typeset_flow_into_polygon(
        engine: &TypesettingEngine,
        flow_id: FlowId,
        paragraphs: &[ParagraphNode],
        styles: &[ParagraphStyle],
        frame: &PolygonFrame,
        default_font_family: &str,
        font_size_pt: f32,
        line_height_pt: f32,
    ) -> SynthesizedPolygonFlow {
        let max_capacity = frame.capacity_lines(line_height_pt);
        let mut lines = Vec::new();
        let mut consumed_paras = 0;
        let mut current_line_idx = 0;
        let default_style = ParagraphStyle::default();

        for p in paragraphs {
            if current_line_idx >= max_capacity {
                break;
            }

            let style = styles
                .iter()
                .find(|s| s.id == p.style_id)
                .unwrap_or(&default_style);

            let family = if p.style_id == default_style.id {
                default_font_family
            } else {
                &style.font_family
            };

            let remaining_capacity = max_capacity - current_line_idx;
            // Generate variable profile starting at current line position within the polygon frame
            let profile = frame.profile_for_paragraph(line_height_pt, current_line_idx, remaining_capacity);

            let mut p_lines = engine.typeset_paragraph_shaped(
                p,
                family,
                &profile,
                font_size_pt,
                line_height_pt,
            );

            // Re-position baseline and coordinate origins within the polygon frame
            let bounds = frame.total_bounds();
            for (offset, line) in p_lines.iter_mut().enumerate() {
                let abs_line = current_line_idx + offset;
                let y_top = bounds.y + (abs_line as f32) * line_height_pt;
                line.baseline_y = y_top + line_height_pt;

                if let Some(span) = frame.span_at_y(y_top, line_height_pt) {
                    line.x_offset = span.x;
                }
            }

            current_line_idx += p_lines.len();
            lines.extend(p_lines);
            consumed_paras += 1;

            if current_line_idx >= max_capacity {
                break;
            }
        }

        let is_complete = consumed_paras == paragraphs.len();

        SynthesizedPolygonFlow {
            flow_id,
            frame: frame.clone(),
            lines,
            consumed_paragraphs: consumed_paras,
            is_complete,
        }
    }
}
