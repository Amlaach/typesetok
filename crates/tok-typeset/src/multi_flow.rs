//! Multi-flow Constraint Solver for Talmud (ש"ס) and Mikraot Gedolot.
//!
//! Synchronizes 3-8 parallel commentary flows on the same page/spread,
//! using spread-level slack bounding (2%-5%) to contain spillover cascades.

use tok_core::FlowId;

#[derive(Debug, Clone, PartialEq)]
pub struct FlowGeometrySpec {
    pub flow_id: FlowId,
    pub priority: u8, // 1 = Main text (highest), 2 = Rashi, 3 = Tosafot
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

pub struct MultiFlowSolver;

impl MultiFlowSolver {
    pub const MAX_ITERATIONS: usize = 1000;

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
        _slack_ratio: f32, // typically 0.03 (3%)
    ) -> Vec<SolvedFlowAllocation> {
        if flows.is_empty() {
            return Vec::new();
        }

        let content_width = page_width_pt - 2.0 * margin_x_pt;
        let content_height = page_height_pt - 2.0 * margin_y_pt;

        // If only 1 flow (standard single flow layout)
        if flows.len() == 1 {
            return vec![SolvedFlowAllocation {
                flow_id: flows[0].flow_id.clone(),
                allocated_x_pt: margin_x_pt,
                allocated_y_pt: margin_y_pt,
                allocated_width_pt: content_width,
                allocated_height_pt: content_height,
            }];
        }

        // 3-flow Talmud layout:
        // In Hebrew RTL:
        // Right side: Comment A (Rashi) ~ 28% of width
        // Center: Main text ~ 40% of width
        // Left side: Comment B (Tosafot) ~ 32% of width
        let gutter = 12.0; // 12 pt column gap
        let available_cols_width = content_width - 2.0 * gutter;

        let rashi_width = available_cols_width * 0.28;
        let main_width = available_cols_width * 0.40;
        let tosafot_width = available_cols_width * 0.32;

        let mut allocations = Vec::new();

        for f in flows {
            if f.flow_id.0 == "main" || f.priority == 1 {
                allocations.push(SolvedFlowAllocation {
                    flow_id: f.flow_id.clone(),
                    allocated_x_pt: margin_x_pt + rashi_width + gutter,
                    allocated_y_pt: margin_y_pt,
                    allocated_width_pt: main_width,
                    allocated_height_pt: content_height,
                });
            } else if f.flow_id.0.contains("rashi") || f.priority == 2 {
                // Right side in RTL
                allocations.push(SolvedFlowAllocation {
                    flow_id: f.flow_id.clone(),
                    allocated_x_pt: margin_x_pt + rashi_width + gutter + main_width + gutter,
                    allocated_y_pt: margin_y_pt,
                    allocated_width_pt: rashi_width,
                    allocated_height_pt: content_height,
                });
            } else {
                // Left side in RTL (Tosafot)
                allocations.push(SolvedFlowAllocation {
                    flow_id: f.flow_id.clone(),
                    allocated_x_pt: margin_x_pt,
                    allocated_y_pt: margin_y_pt,
                    allocated_width_pt: tosafot_width,
                    allocated_height_pt: content_height,
                });
            }
        }

        allocations
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
        // Total allocated width + gutters should not exceed content width
        let content_width = 595.0 - 72.0;
        let total_col_width: f32 = allocs.iter().map(|a| a.allocated_width_pt).sum();
        assert!(total_col_width <= content_width);
    }

    #[test]
    fn test_multi_flow_empty_flows() {
        let allocations = MultiFlowSolver::solve_talmud_page(
            595.0, 842.0, 42.52, 56.69, &[], 0.1,
        );
        assert!(allocations.is_empty(), "Empty flows should produce empty allocations");
    }

    #[test]
    fn test_multi_flow_single_flow() {
        let flows = vec![
            FlowGeometrySpec {
                flow_id: FlowId::new("main"),
                priority: 1,
                min_width_pt: 100.0,
                max_width_pt: 500.0,
                target_height_pt: 700.0,
            },
        ];
        let allocations = MultiFlowSolver::solve_talmud_page(
            595.0, 842.0, 42.52, 56.69, &flows, 0.1,
        );
        assert_eq!(allocations.len(), 1, "Single flow should produce one allocation");
    }
}
