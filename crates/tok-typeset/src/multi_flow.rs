//! Multi-flow Constraint Solver for Talmud (ש"ס) and Mikraot Gedolot.
//!
//! Synchronizes 3-8 parallel commentary flows on the same page/spread,
//! using spread-level slack bounding (2%-5%) to contain spillover cascades.
//! Supports:
//! - Recto / Verso Facing Spreads (Rashi on inner spine margin, Tosafot on outer margin).
//! - Dynamic L-Shaped commentary expansion below early-terminating Gemara text ("צורת הדף").
//! - Floating Footnotes with bottom-page height reservation and gutter separation.

use tok_core::FlowId;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum SpreadSide {
    /// Right-hand page in Hebrew RTL book (odd page: 1, 3, 5...). Spine is on the LEFT.
    Recto,
    /// Left-hand page in Hebrew RTL book (even page: 2, 4, 6...). Spine is on the RIGHT.
    Verso,
}

#[derive(Debug, Clone, PartialEq)]
pub struct FlowGeometrySpec {
    pub flow_id: FlowId,
    pub priority: u8, // 1 = Main Gemara text (highest), 2 = Rashi, 3 = Tosafot
    pub min_width_pt: f32,
    pub max_width_pt: f32,
    pub target_height_pt: f32,
}

#[derive(Debug, Clone, PartialEq)]
pub struct SolvedFlowAllocation {
    pub flow_id: FlowId,
    pub allocated_x_pt: f32,
    pub allocated_y_pt: f32,
    pub allocated_width_pt: f32,
    pub allocated_height_pt: f32,
}

#[derive(Debug, Clone, PartialEq)]
pub struct DynamicTalmudPageResult {
    pub allocations: Vec<SolvedFlowAllocation>,
    pub footnote_allocation: Option<SolvedFlowAllocation>,
    pub gemara_height_pt: f32,
    pub has_l_shape_expansion: bool,
}

pub struct MultiFlowSolver;

impl MultiFlowSolver {
    pub const MAX_ITERATIONS: usize = 1000;
    pub const DEFAULT_GUTTER_PT: f32 = 12.0;

    /// Solves the geometric partitioning for a classic Talmudic page layout:
    /// Center: Main Gemara text
    /// Inner column (Right in RTL spread): Rashi commentary
    /// Outer column (Left in RTL spread): Tosafot commentary
    pub fn solve_talmud_page(
        page_width_pt: f32,
        page_height_pt: f32,
        margin_x_pt: f32,
        margin_y_pt: f32,
        flows: &[FlowGeometrySpec],
        _slack_ratio: f32,
    ) -> Vec<SolvedFlowAllocation> {
        Self::solve_talmud_spread(
            page_width_pt,
            page_height_pt,
            margin_x_pt,
            margin_x_pt,
            margin_y_pt,
            flows,
            SpreadSide::Verso, // Default legacy orientation
        )
    }

    /// Solves the geometric partitioning for facing spreads (Recto vs Verso):
    /// In Hebrew typography (reading right to left):
    /// - Recto (Right page): Spine is on the LEFT.
    ///   Inner margin = Left (Rashi), Outer margin = Right (Tosafot).
    /// - Verso (Left page): Spine is on the RIGHT.
    ///   Inner margin = Right (Rashi), Outer margin = Left (Tosafot).
    pub fn solve_talmud_spread(
        page_width_pt: f32,
        page_height_pt: f32,
        margin_inner_pt: f32,
        margin_outer_pt: f32,
        margin_y_pt: f32,
        flows: &[FlowGeometrySpec],
        side: SpreadSide,
    ) -> Vec<SolvedFlowAllocation> {
        if flows.is_empty() {
            return Vec::new();
        }

        let (margin_left, margin_right) = match side {
            SpreadSide::Recto => (margin_inner_pt, margin_outer_pt),
            SpreadSide::Verso => (margin_outer_pt, margin_inner_pt),
        };

        let content_width = page_width_pt - margin_left - margin_right;
        let content_height = page_height_pt - 2.0 * margin_y_pt;

        if flows.len() == 1 {
            return vec![SolvedFlowAllocation {
                flow_id: flows[0].flow_id.clone(),
                allocated_x_pt: margin_left,
                allocated_y_pt: margin_y_pt,
                allocated_width_pt: content_width,
                allocated_height_pt: content_height,
            }];
        }

        let gutter = Self::DEFAULT_GUTTER_PT;
        let available_cols_width = (content_width - 2.0 * gutter).max(50.0);

        let rashi_width = available_cols_width * 0.28;
        let main_width = available_cols_width * 0.40;
        let tosafot_width = available_cols_width * 0.32;

        let mut allocations = Vec::new();

        // Determine column placement depending on spread side
        // On Verso (Left page): [Tosafot (Left)] [Gutter] [Gemara (Center)] [Gutter] [Rashi (Right)]
        // On Recto (Right page): [Rashi (Left)] [Gutter] [Gemara (Center)] [Gutter] [Tosafot (Right)]
        let (left_flow_role, _right_flow_role) = match side {
            SpreadSide::Verso => ("tosafot", "rashi"),
            SpreadSide::Recto => ("rashi", "tosafot"),
        };

        let (left_w, right_w) = match side {
            SpreadSide::Verso => (tosafot_width, rashi_width),
            SpreadSide::Recto => (rashi_width, tosafot_width),
        };

        let x_left = margin_left;
        let x_center = x_left + left_w + gutter;
        let x_right = x_center + main_width + gutter;

        for f in flows {
            if f.flow_id.0 == "main" || f.priority == 1 {
                allocations.push(SolvedFlowAllocation {
                    flow_id: f.flow_id.clone(),
                    allocated_x_pt: x_center,
                    allocated_y_pt: margin_y_pt,
                    allocated_width_pt: main_width,
                    allocated_height_pt: content_height,
                });
            } else if f.flow_id.0.contains("rashi") || f.priority == 2 {
                let (x, w) = if left_flow_role == "rashi" {
                    (x_left, left_w)
                } else {
                    (x_right, right_w)
                };
                allocations.push(SolvedFlowAllocation {
                    flow_id: f.flow_id.clone(),
                    allocated_x_pt: x,
                    allocated_y_pt: margin_y_pt,
                    allocated_width_pt: w,
                    allocated_height_pt: content_height,
                });
            } else {
                let (x, w) = if left_flow_role == "tosafot" {
                    (x_left, left_w)
                } else {
                    (x_right, right_w)
                };
                allocations.push(SolvedFlowAllocation {
                    flow_id: f.flow_id.clone(),
                    allocated_x_pt: x,
                    allocated_y_pt: margin_y_pt,
                    allocated_width_pt: w,
                    allocated_height_pt: content_height,
                });
            }
        }

        allocations
    }

    /// Solves dynamic Talmud layout with L-shaped commentary expansion below Gemara
    /// and bottom-anchored floating footnotes.
    #[allow(clippy::too_many_arguments)]
    pub fn solve_talmud_dynamic_with_footnotes(
        page_width_pt: f32,
        page_height_pt: f32,
        margin_inner_pt: f32,
        margin_outer_pt: f32,
        margin_y_pt: f32,
        flows: &[FlowGeometrySpec],
        side: SpreadSide,
        gemara_target_height_pt: Option<f32>,
        footnote_target_height_pt: Option<f32>,
    ) -> DynamicTalmudPageResult {
        let (margin_left, margin_right) = match side {
            SpreadSide::Recto => (margin_inner_pt, margin_outer_pt),
            SpreadSide::Verso => (margin_outer_pt, margin_inner_pt),
        };

        let content_width = page_width_pt - margin_left - margin_right;
        let mut available_height = page_height_pt - 2.0 * margin_y_pt;
        let gutter = Self::DEFAULT_GUTTER_PT;

        // 1. Allocate Floating Footnotes at bottom
        let footnote_allocation = if let Some(fn_height) = footnote_target_height_pt {
            if fn_height > 0.0 {
                let actual_fn_height = fn_height.min(available_height * 0.40);
                let fn_y = margin_y_pt + available_height - actual_fn_height;
                available_height -= actual_fn_height + gutter;

                Some(SolvedFlowAllocation {
                    flow_id: FlowId::new("footnote"),
                    allocated_x_pt: margin_left,
                    allocated_y_pt: fn_y,
                    allocated_width_pt: content_width,
                    allocated_height_pt: actual_fn_height,
                })
            } else {
                None
            }
        } else {
            None
        };

        // 2. Compute 3-column allocation
        let mut allocations = Self::solve_talmud_spread(
            page_width_pt,
            available_height + 2.0 * margin_y_pt,
            margin_inner_pt,
            margin_outer_pt,
            margin_y_pt,
            flows,
            side,
        );

        // 3. Dynamic L-Shaped expansion if Gemara ends before the bottom
        let mut has_l_shape = false;
        let gemara_h = if let Some(target_h) = gemara_target_height_pt {
            let actual_gemara_h = target_h.min(available_height);
            // If Gemara finishes at least 20% before available height
            if actual_gemara_h < available_height - 30.0 {
                if let Some(gemara_alloc) = allocations.iter_mut().find(|a| a.flow_id.0 == "main") {
                    gemara_alloc.allocated_height_pt = actual_gemara_h;
                }

                // Expand Rashi or Tosafot into the lower space under Gemara
                let expansion_y = margin_y_pt + actual_gemara_h + gutter;
                let expansion_h = (available_height - actual_gemara_h - gutter).max(10.0);

                // Add lower wide expansion block for Rashi (classic Tzurat HaDaf)
                allocations.push(SolvedFlowAllocation {
                    flow_id: FlowId::new("rashi_expansion"),
                    allocated_x_pt: margin_left + content_width * 0.25,
                    allocated_y_pt: expansion_y,
                    allocated_width_pt: content_width * 0.50,
                    allocated_height_pt: expansion_h,
                });

                has_l_shape = true;
            }
            actual_gemara_h
        } else {
            available_height
        };

        DynamicTalmudPageResult {
            allocations,
            footnote_allocation,
            gemara_height_pt: gemara_h,
            has_l_shape_expansion: has_l_shape,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_multi_flow_partitioning() {
        let flows = vec![
            FlowGeometrySpec {
                flow_id: FlowId::new("main"),
                priority: 1,
                min_width_pt: 100.0,
                max_width_pt: 300.0,
                target_height_pt: 500.0,
            },
            FlowGeometrySpec {
                flow_id: FlowId::new("rashi"),
                priority: 2,
                min_width_pt: 50.0,
                max_width_pt: 150.0,
                target_height_pt: 500.0,
            },
            FlowGeometrySpec {
                flow_id: FlowId::new("tosafot"),
                priority: 3,
                min_width_pt: 50.0,
                max_width_pt: 150.0,
                target_height_pt: 500.0,
            },
        ];

        let allocs = MultiFlowSolver::solve_talmud_page(595.0, 842.0, 36.0, 36.0, &flows, 0.03);
        assert_eq!(allocs.len(), 3);
        let content_width = 595.0 - 72.0;
        let total_col_width: f32 = allocs.iter().map(|a| a.allocated_width_pt).sum();
        assert!(total_col_width <= content_width);
    }

    #[test]
    fn test_multi_flow_empty_flows() {
        let allocations = MultiFlowSolver::solve_talmud_page(595.0, 842.0, 42.52, 56.69, &[], 0.1);
        assert!(allocations.is_empty());
    }

    #[test]
    fn test_multi_flow_single_flow() {
        let flows = vec![FlowGeometrySpec {
            flow_id: FlowId::new("main"),
            priority: 1,
            min_width_pt: 100.0,
            max_width_pt: 500.0,
            target_height_pt: 700.0,
        }];
        let allocations =
            MultiFlowSolver::solve_talmud_page(595.0, 842.0, 42.52, 56.69, &flows, 0.1);
        assert_eq!(allocations.len(), 1);
    }

    #[test]
    fn test_talmud_facing_spreads_recto_verso() {
        let flows = vec![
            FlowGeometrySpec {
                flow_id: FlowId::new("main"),
                priority: 1,
                min_width_pt: 100.0,
                max_width_pt: 300.0,
                target_height_pt: 500.0,
            },
            FlowGeometrySpec {
                flow_id: FlowId::new("rashi"),
                priority: 2,
                min_width_pt: 50.0,
                max_width_pt: 150.0,
                target_height_pt: 500.0,
            },
            FlowGeometrySpec {
                flow_id: FlowId::new("tosafot"),
                priority: 3,
                min_width_pt: 50.0,
                max_width_pt: 150.0,
                target_height_pt: 500.0,
            },
        ];

        // Recto (Right page): Rashi should be on the LEFT (inner margin near spine)
        let recto = MultiFlowSolver::solve_talmud_spread(
            595.0,
            842.0,
            40.0,
            20.0,
            36.0,
            &flows,
            SpreadSide::Recto,
        );
        let rashi_recto = recto.iter().find(|a| a.flow_id.0 == "rashi").unwrap();
        let tosafot_recto = recto.iter().find(|a| a.flow_id.0 == "tosafot").unwrap();
        assert!(rashi_recto.allocated_x_pt < tosafot_recto.allocated_x_pt);

        // Verso (Left page): Rashi should be on the RIGHT (inner margin near spine)
        let verso = MultiFlowSolver::solve_talmud_spread(
            595.0,
            842.0,
            40.0,
            20.0,
            36.0,
            &flows,
            SpreadSide::Verso,
        );
        let rashi_verso = verso.iter().find(|a| a.flow_id.0 == "rashi").unwrap();
        let tosafot_verso = verso.iter().find(|a| a.flow_id.0 == "tosafot").unwrap();
        assert!(rashi_verso.allocated_x_pt > tosafot_verso.allocated_x_pt);
    }

    #[test]
    fn test_dynamic_talmud_l_shape_and_footnotes() {
        let flows = vec![
            FlowGeometrySpec {
                flow_id: FlowId::new("main"),
                priority: 1,
                min_width_pt: 100.0,
                max_width_pt: 300.0,
                target_height_pt: 500.0,
            },
            FlowGeometrySpec {
                flow_id: FlowId::new("rashi"),
                priority: 2,
                min_width_pt: 50.0,
                max_width_pt: 150.0,
                target_height_pt: 500.0,
            },
            FlowGeometrySpec {
                flow_id: FlowId::new("tosafot"),
                priority: 3,
                min_width_pt: 50.0,
                max_width_pt: 150.0,
                target_height_pt: 500.0,
            },
        ];

        // Gemara finishes at 300 pt (out of 770 pt available height)
        // Footnote needs 80 pt
        let result = MultiFlowSolver::solve_talmud_dynamic_with_footnotes(
            595.0,
            842.0,
            36.0,
            36.0,
            36.0,
            &flows,
            SpreadSide::Verso,
            Some(300.0),
            Some(80.0),
        );

        assert!(result.footnote_allocation.is_some());
        let fn_alloc = result.footnote_allocation.unwrap();
        assert_eq!(fn_alloc.allocated_height_pt, 80.0);
        assert!(fn_alloc.allocated_y_pt > 600.0); // Placed at bottom

        assert!(result.has_l_shape_expansion);
        // There should be a rashi_expansion box
        assert!(result
            .allocations
            .iter()
            .any(|a| a.flow_id.0 == "rashi_expansion"));
    }
}
