//! Template Layout Mathematics & Spread Geometry.
//!
//! Models multi-stream layout mathematics across facing book spreads:
//! - Talmud Classic (Central Gemara, Inner Rashi at spine, Outer Tosafot at margin).
//! - Mikraot Gedolot (Center Scripture, Targum, Rashi inner, Ramban/Ibn Ezra outer).
//! - Academic Dual-Stream (Primary text + commentary/apparatus).
//!
//! Provides mathematically exact Recto/Verso spine-relative geometry, gutter calculation,
//! and dynamic [`MeasureProfile`] synthesis for standard and L-shaped columns.

use crate::knuth_plass::MeasureProfile;
use crate::multi_flow::SpreadSide;
use crate::solver::{
    ColumnSpec, ColumnWidthDistribution, ConstraintStrength, GeometricConstraintSolver,
    MultiColumnConstraintModel, PageConstraintModel, PageGeometryConfig,
};
use tok_core::FlowId;

/// Layout template presets for Jewish and academic multi-stream books.
#[derive(Debug, Clone, PartialEq)]
pub enum TemplateKind {
    /// Classic Talmud: Gemara (40%), Rashi (28% on spine), Tosafot (32% on outer margin).
    TalmudClassic,
    /// Mikraot Gedolot: Torah (38%), Targum (18%), Rashi (24%), Additional Commentary (20%).
    MikraotGedolot,
    /// Dual stream: Main text (60%), Commentary (40%).
    AcademicDualStream,
    /// Custom column proportions (percentages summing to 1.0).
    Custom {
        main_ratio: f32,
        inner_commentary_ratio: f32,
        outer_commentary_ratio: f32,
    },
    /// Multi-stream layout with arbitrary named flows and column proportions.
    MultiFlow {
        streams: Vec<(FlowId, f32)>,
    },
}

#[derive(Debug, Clone, PartialEq)]
pub struct TemplateConfig {
    pub page_width_pt: f32,
    pub page_height_pt: f32,
    pub margin_inner_pt: f32,
    pub margin_outer_pt: f32,
    pub margin_top_pt: f32,
    pub margin_bottom_pt: f32,
    pub gutter_pt: f32,
    pub kind: TemplateKind,
    pub main_font_family: String,
    pub main_font_size: f32,
    pub main_line_height: f32,
    pub commentary_font_family: String,
    pub commentary_font_size: f32,
    pub commentary_line_height: f32,
}

impl Default for TemplateConfig {
    fn default() -> Self {
        Self {
            page_width_pt: 595.28,
            page_height_pt: 841.89,
            margin_inner_pt: 40.0,
            margin_outer_pt: 30.0,
            margin_top_pt: 36.0,
            margin_bottom_pt: 36.0,
            gutter_pt: 10.0,
            kind: TemplateKind::TalmudClassic,
            main_font_family: "Frank Ruhl Libre".to_string(),
            main_font_size: 13.0,
            main_line_height: 18.0,
            commentary_font_family: "Noto Rashi Hebrew".to_string(),
            commentary_font_size: 10.0,
            commentary_line_height: 13.5,
        }
    }
}

/// Geometric allocation of a single column on a page.
#[derive(Debug, Clone, PartialEq)]
pub struct ColumnAllocation {
    pub stream_id: String,
    pub x_pt: f32,
    pub y_pt: f32,
    pub width_pt: f32,
    pub max_height_pt: f32,
    pub is_inner_spine: bool,
}

/// Solved mathematics and column allocations for a specific page in a spread.
#[derive(Debug, Clone, PartialEq)]
pub struct SpreadMathematics {
    pub page_number: usize,
    pub side: SpreadSide,
    pub content_width_pt: f32,
    pub content_height_pt: f32,
    pub margin_left_pt: f32,
    pub margin_right_pt: f32,
    pub gutter_pt: f32,
    pub columns: Vec<ColumnAllocation>,
    pub main_column_width_pt: f32,
    pub inner_column_width_pt: f32,
    pub outer_column_width_pt: f32,
}

impl SpreadMathematics {
    /// Determines spread side for a 1-based page number in Hebrew RTL books:
    /// - Odd pages (1, 3, 5...): Recto (right page, spine is on LEFT).
    /// - Even pages (2, 4, 6...): Verso (left page, spine is on RIGHT).
    pub fn side_for_page(page_number: usize) -> SpreadSide {
        if page_number % 2 == 1 {
            SpreadSide::Recto
        } else {
            SpreadSide::Verso
        }
    }

    /// Solves the exact geometry and column coordinates for a given page number using GeometricConstraintSolver.
    pub fn for_page(config: &TemplateConfig, page_number: usize) -> Self {
        let side = Self::side_for_page(page_number);

        // In Hebrew typography (RTL reading order):
        // Recto (right-hand page): Spine is on the LEFT -> margin_left = margin_inner, margin_right = margin_outer.
        // Verso (left-hand page): Spine is on the RIGHT -> margin_left = margin_outer, margin_right = margin_inner.
        let (margin_left, margin_right) = match side {
            SpreadSide::Recto => (config.margin_inner_pt, config.margin_outer_pt),
            SpreadSide::Verso => (config.margin_outer_pt, config.margin_inner_pt),
        };

        let content_width = (config.page_width_pt - margin_left - margin_right).max(0.0);
        let content_height =
            (config.page_height_pt - config.margin_top_pt - config.margin_bottom_pt).max(0.0);

        let gutter = config.gutter_pt.min(content_width * 0.05).max(0.0);

        let (main_ratio, inner_ratio, outer_ratio) = match &config.kind {
            TemplateKind::TalmudClassic => (0.40, 0.28, 0.32),
            TemplateKind::MikraotGedolot => (0.38, 0.30, 0.32),
            TemplateKind::AcademicDualStream => (0.60, 0.40, 0.0),
            TemplateKind::Custom {
                main_ratio,
                inner_commentary_ratio,
                outer_commentary_ratio,
            } => (
                *main_ratio,
                *inner_commentary_ratio,
                *outer_commentary_ratio,
            ),
            TemplateKind::MultiFlow { .. } => (0.40, 0.30, 0.30),
        };

        let mut solver = GeometricConstraintSolver::new();
        let page_geom = PageGeometryConfig::new(
            config.page_width_pt,
            config.page_height_pt,
            config.margin_inner_pt,
            config.margin_outer_pt,
            config.margin_top_pt,
            config.margin_bottom_pt,
            side,
        );
        let page_model = PageConstraintModel::new();

        let mut columns = Vec::new();
        let mut main_width = 0.0;
        let mut inner_width = 0.0;
        let mut outer_width = 0.0;

        let solver_result = (|| -> Result<(), crate::solver::SolverError> {
            page_model.apply(&mut solver, &page_geom)?;

            let (flow_ids, col_specs, proportions) = match &config.kind {
                TemplateKind::MikraotGedolot => {
                    let streams = match side {
                        SpreadSide::Recto => vec![
                            (FlowId::new("rashi"), 0.24),
                            (FlowId::new("main"), 0.38),
                            (FlowId::new("targum"), 0.18),
                            (FlowId::new("ramban"), 0.20),
                        ],
                        SpreadSide::Verso => vec![
                            (FlowId::new("ramban"), 0.20),
                            (FlowId::new("targum"), 0.18),
                            (FlowId::new("main"), 0.38),
                            (FlowId::new("rashi"), 0.24),
                        ],
                    };
                    let ids: Vec<FlowId> = streams.iter().map(|(id, _)| id.clone()).collect();
                    let specs: Vec<ColumnSpec> = ids.iter().map(|id| ColumnSpec::new(id.clone())).collect();
                    let props: Vec<f32> = streams.iter().map(|(_, p)| *p).collect();
                    (ids, specs, props)
                }
                TemplateKind::MultiFlow { streams } => {
                    let mut s = streams.clone();
                    if side == SpreadSide::Verso {
                        s.reverse();
                    }
                    let ids: Vec<FlowId> = s.iter().map(|(id, _)| id.clone()).collect();
                    let specs: Vec<ColumnSpec> = ids.iter().map(|id| ColumnSpec::new(id.clone())).collect();
                    let props: Vec<f32> = s.iter().map(|(_, p)| *p).collect();
                    (ids, specs, props)
                }
                _ => {
                    if outer_ratio > 0.0 {
                        let (col1, col3) = match side {
                            SpreadSide::Recto => ("rashi", "tosafot"),
                            SpreadSide::Verso => ("tosafot", "rashi"),
                        };
                        let props = match side {
                            SpreadSide::Recto => vec![inner_ratio, main_ratio, outer_ratio],
                            SpreadSide::Verso => vec![outer_ratio, main_ratio, inner_ratio],
                        };
                        let ids = vec![FlowId::new(col1), FlowId::new("main"), FlowId::new(col3)];
                        let specs = vec![
                            ColumnSpec::new(FlowId::new(col1)),
                            ColumnSpec::new(FlowId::new("main")),
                            ColumnSpec::new(FlowId::new(col3)),
                        ];
                        (ids, specs, props)
                    } else {
                        let ids = vec![FlowId::new("main"), FlowId::new("rashi")];
                        let specs = vec![
                            ColumnSpec::new(FlowId::new("main")),
                            ColumnSpec::new(FlowId::new("rashi")),
                        ];
                        (ids, specs, vec![main_ratio, inner_ratio])
                    }
                }
            };

            let multi_model = MultiColumnConstraintModel::new(&flow_ids);
            multi_model.apply(&mut solver, &page_model, gutter, &col_specs)?;
            ColumnWidthDistribution::Proportional(proportions).apply(
                &mut solver,
                &multi_model.columns,
                ConstraintStrength::Required,
            )?;

            let allocations = multi_model.get_allocations(&solver);
            for alloc in &allocations {
                let is_inner = alloc.flow_id.0 == "rashi";
                if alloc.flow_id.0 == "main" {
                    main_width = alloc.rect.width;
                } else if alloc.flow_id.0 == "rashi" {
                    inner_width = alloc.rect.width;
                } else if alloc.flow_id.0 == "tosafot" {
                    outer_width = alloc.rect.width;
                }

                columns.push(ColumnAllocation {
                    stream_id: alloc.flow_id.0.clone(),
                    x_pt: alloc.rect.x,
                    y_pt: alloc.rect.y,
                    width_pt: alloc.rect.width,
                    max_height_pt: alloc.rect.height,
                    is_inner_spine: is_inner,
                });
            }

            Ok(())
        })();

        if solver_result.is_err() || columns.is_empty() {
            // Safe fallback arithmetic if page is degenerate
            columns.clear();
            let available_cols_width = (content_width - 2.0 * gutter).max(0.0);
            main_width = available_cols_width * main_ratio;
            inner_width = available_cols_width * inner_ratio;
            outer_width = available_cols_width * outer_ratio;

            let (col1_name, col1_w, col1_inner) = match side {
                SpreadSide::Recto => ("rashi", inner_width, true),
                SpreadSide::Verso => ("tosafot", outer_width, false),
            };
            let (col3_name, col3_w, col3_inner) = match side {
                SpreadSide::Recto => ("tosafot", outer_width, false),
                SpreadSide::Verso => ("rashi", inner_width, true),
            };

            let x1 = margin_left;
            let x2 = x1 + col1_w + gutter;
            let x3 = x2 + main_width + gutter;

            columns.push(ColumnAllocation {
                stream_id: col1_name.to_string(),
                x_pt: x1,
                y_pt: config.margin_top_pt,
                width_pt: col1_w,
                max_height_pt: content_height,
                is_inner_spine: col1_inner,
            });

            columns.push(ColumnAllocation {
                stream_id: "main".to_string(),
                x_pt: x2,
                y_pt: config.margin_top_pt,
                width_pt: main_width,
                max_height_pt: content_height,
                is_inner_spine: false,
            });

            if outer_ratio > 0.0 {
                columns.push(ColumnAllocation {
                    stream_id: col3_name.to_string(),
                    x_pt: x3,
                    y_pt: config.margin_top_pt,
                    width_pt: col3_w,
                    max_height_pt: content_height,
                    is_inner_spine: col3_inner,
                });
            }
        }

        Self {
            page_number,
            side,
            content_width_pt: content_width,
            content_height_pt: content_height,
            margin_left_pt: margin_left,
            margin_right_pt: margin_right,
            gutter_pt: gutter,
            columns,
            main_column_width_pt: main_width,
            inner_column_width_pt: inner_width,
            outer_column_width_pt: outer_width,
        }
    }

    /// Synthesizes the dynamic [`MeasureProfile`] for a given stream on this page.
    ///
    /// If `gemara_height_pt` indicates that the central text terminates early with clearance
    /// ($\ge 2$ commentary lines below Gemara), the inner commentary (Rashi) expands into the
    /// freed space under Gemara, creating the classical Talmudic L-shape ("צורת הדף").
    pub fn create_measure_profile(
        &self,
        config: &TemplateConfig,
        stream_id: &str,
        gemara_height_pt: Option<f32>,
    ) -> MeasureProfile {
        let is_rashi = stream_id.contains("rashi");
        let is_main = stream_id == "main" || stream_id == "gemara";

        if is_main {
            return MeasureProfile::uniform(self.main_column_width_pt);
        }

        if !is_rashi {
            if let Some(col) = self.columns.iter().find(|c| c.stream_id == stream_id) {
                return MeasureProfile::uniform(col.width_pt);
            }
            // Tosafot or other outer commentary uses regular uniform width
            return MeasureProfile::uniform(self.outer_column_width_pt);
        }

        // Inner commentary (Rashi): check for L-shape clearance under Gemara
        if let Some(gemara_h) = gemara_height_pt {
            let space_below = self.content_height_pt - gemara_h - self.gutter_pt;
            let min_gap = 2.0 * config.commentary_line_height;

            if space_below >= min_gap {
                let narrow_lines = (gemara_h / config.commentary_line_height).ceil() as usize;
                let expanded_width =
                    self.inner_column_width_pt + self.main_column_width_pt + self.gutter_pt;
                return MeasureProfile::l_shape(
                    narrow_lines,
                    self.inner_column_width_pt,
                    expanded_width,
                );
            }
        }

        MeasureProfile::uniform(self.inner_column_width_pt)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_spread_side_recto_verso_alternation() {
        assert_eq!(SpreadMathematics::side_for_page(1), SpreadSide::Recto);
        assert_eq!(SpreadMathematics::side_for_page(2), SpreadSide::Verso);
        assert_eq!(SpreadMathematics::side_for_page(3), SpreadSide::Recto);
        assert_eq!(SpreadMathematics::side_for_page(4), SpreadSide::Verso);
    }

    #[test]
    fn test_spine_relative_margin_mapping() {
        let config = TemplateConfig::default();
        let recto = SpreadMathematics::for_page(&config, 1);
        let verso = SpreadMathematics::for_page(&config, 2);

        // Recto (page 1): Spine on left -> margin_left = 40 (inner), margin_right = 30 (outer)
        assert_eq!(recto.margin_left_pt, 40.0);
        assert_eq!(recto.margin_right_pt, 30.0);

        // Verso (page 2): Spine on right -> margin_left = 30 (outer), margin_right = 40 (inner)
        assert_eq!(verso.margin_left_pt, 30.0);
        assert_eq!(verso.margin_right_pt, 40.0);

        // Content width is invariant across facing spreads
        assert_eq!(recto.content_width_pt, verso.content_width_pt);
    }

    #[test]
    fn test_rashi_and_tosafot_spine_switching() {
        let config = TemplateConfig::default();
        let recto = SpreadMathematics::for_page(&config, 1);
        let verso = SpreadMathematics::for_page(&config, 2);

        // On Recto, column 0 (left) is Rashi (inner spine), column 2 (right) is Tosafot (outer)
        assert_eq!(recto.columns[0].stream_id, "rashi");
        assert!(recto.columns[0].is_inner_spine);
        assert_eq!(recto.columns[1].stream_id, "main");
        assert_eq!(recto.columns[2].stream_id, "tosafot");
        assert!(!recto.columns[2].is_inner_spine);

        // On Verso, column 0 (left) is Tosafot (outer), column 2 (right) is Rashi (inner spine)
        assert_eq!(verso.columns[0].stream_id, "tosafot");
        assert!(!verso.columns[0].is_inner_spine);
        assert_eq!(verso.columns[1].stream_id, "main");
        assert_eq!(verso.columns[2].stream_id, "rashi");
        assert!(verso.columns[2].is_inner_spine);
    }

    #[test]
    fn test_dynamic_l_shape_profile_generation() {
        let config = TemplateConfig::default();
        let math = SpreadMathematics::for_page(&config, 1);

        // Gemara occupies 180 pt of ~770 pt content height
        let gemara_h = 180.0;
        let profile = math.create_measure_profile(&config, "rashi", Some(gemara_h));

        assert!(!profile.is_uniform());
        assert_eq!(profile.width_for_line(0), math.inner_column_width_pt);
        // At line 14 (ceil(180 / 13.5)), should expand to full width (inner + main + gutter)
        let expected_expanded =
            math.inner_column_width_pt + math.main_column_width_pt + math.gutter_pt;
        assert_eq!(profile.width_for_line(14), expected_expanded);
        assert_eq!(profile.width_for_line(20), expected_expanded);
    }

    #[test]
    fn test_spread_mathematics_solver_proportions_recto_and_verso() {
        let config = TemplateConfig::default();
        let recto = SpreadMathematics::for_page(&config, 1);
        let verso = SpreadMathematics::for_page(&config, 2);

        for (math, label) in [(&recto, "Recto"), (&verso, "Verso")] {
            assert_eq!(math.columns.len(), 3, "Expected 3 columns on {}", label);
            let c0 = &math.columns[0];
            let c1 = &math.columns[1];
            let c2 = &math.columns[2];

            // Strict non-overlap and contiguous gutter spacing
            assert!(
                (c0.x_pt + c0.width_pt + math.gutter_pt - c1.x_pt).abs() < 1e-3,
                "Col 0 to Col 1 gutter continuity failed on {}",
                label
            );
            assert!(
                (c1.x_pt + c1.width_pt + math.gutter_pt - c2.x_pt).abs() < 1e-3,
                "Col 1 to Col 2 gutter continuity failed on {}",
                label
            );

            // Right alignment with content boundary
            let right_edge = c2.x_pt + c2.width_pt;
            let expected_right = math.margin_left_pt + math.content_width_pt;
            assert!(
                (right_edge - expected_right).abs() < 1e-3,
                "Right boundary alignment failed on {}",
                label
            );

            // Conservation of width
            let total_cols_w = c0.width_pt + c1.width_pt + c2.width_pt;
            let available_w = math.content_width_pt - 2.0 * math.gutter_pt;
            assert!(
                (total_cols_w - available_w).abs() < 1e-3,
                "Width conservation failed on {}",
                label
            );

            // Proportions: 40% main, 28% rashi, 32% tosafot
            let rashi_w = math.inner_column_width_pt;
            let main_w = math.main_column_width_pt;
            let tosafot_w = math.outer_column_width_pt;

            let rashi_ratio = rashi_w / main_w;
            let tosafot_ratio = tosafot_w / main_w;

            assert!(
                (rashi_ratio - (0.28 / 0.40)).abs() < 1e-3,
                "Rashi-to-Main ratio failed on {}: got {}",
                label,
                rashi_ratio
            );
            assert!(
                (tosafot_ratio - (0.32 / 0.40)).abs() < 1e-3,
                "Tosafot-to-Main ratio failed on {}: got {}",
                label,
                tosafot_ratio
            );
        }
    }

    #[test]
    fn test_spread_mathematics_academic_dual_stream_solver() {
        let config = TemplateConfig {
            kind: TemplateKind::AcademicDualStream,
            page_width_pt: 500.0,
            page_height_pt: 700.0,
            margin_inner_pt: 30.0,
            margin_outer_pt: 30.0,
            margin_top_pt: 30.0,
            margin_bottom_pt: 30.0,
            gutter_pt: 10.0,
            ..Default::default()
        };
        let math = SpreadMathematics::for_page(&config, 1);
        assert_eq!(math.columns.len(), 2);
        // AcademicDualStream: 60% main, 40% inner commentary
        let available_w = 440.0 - 10.0; // 430.0
        assert!((math.columns[0].width_pt - available_w * 0.60).abs() < 1e-2);
        assert!((math.columns[1].width_pt - available_w * 0.40).abs() < 1e-2);
    }

    #[test]
    fn test_spread_mathematics_custom_proportions_solver() {
        let config = TemplateConfig {
            kind: TemplateKind::Custom {
                main_ratio: 0.50,
                inner_commentary_ratio: 0.25,
                outer_commentary_ratio: 0.25,
            },
            page_width_pt: 600.0,
            page_height_pt: 800.0,
            margin_inner_pt: 40.0,
            margin_outer_pt: 40.0,
            margin_top_pt: 40.0,
            margin_bottom_pt: 40.0,
            gutter_pt: 12.0,
            ..Default::default()
        };
        let math = SpreadMathematics::for_page(&config, 1);
        assert_eq!(math.columns.len(), 3);
        let main_w = math.main_column_width_pt;
        let inner_w = math.inner_column_width_pt;
        let outer_w = math.outer_column_width_pt;

        assert!((main_w - 2.0 * inner_w).abs() < 1e-2);
        assert!((inner_w - outer_w).abs() < 1e-2);
    }
}
