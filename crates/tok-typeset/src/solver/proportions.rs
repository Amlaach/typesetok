//! Proportional Width and Column Distribution Constraints.
//!
//! Models relative width proportions, equal distributions, and min/max bounds
//! as linear constraints without relying on hardcoded page percentages.

use crate::solver::frame_model::ColumnFrameVariables;
use crate::solver::model::{ConstraintStrength, LinearExpression};
use crate::solver::solver_core::{GeometricConstraintSolver, SolverError};

/// Specification for distributing horizontal measure across multiple columns.
#[derive(Debug, Clone, PartialEq)]
pub enum ColumnWidthDistribution {
    /// Equal width across all columns.
    Equal,
    /// Arbitrary relative proportions (e.g. `[4.0, 3.0, 3.0]`, `[0.6, 0.4]`).
    Proportional(Vec<f32>),
}

impl ColumnWidthDistribution {
    /// Applies proportional linear constraints to the solver for the given columns.
    ///
    /// For columns `i` and `j` with proportions `p_i` and `p_j`, the linear relation is:
    /// `p_j * col_i.width - p_i * col_j.width == 0`.
    pub fn apply(
        &self,
        solver: &mut GeometricConstraintSolver,
        columns: &[ColumnFrameVariables],
        strength: ConstraintStrength,
    ) -> Result<(), SolverError> {
        let n = columns.len();
        if n <= 1 {
            return Ok(());
        }

        match self {
            Self::Equal => {
                for i in 0..(n - 1) {
                    solver.add_eq(
                        columns[i].rect.width.to_expr(),
                        columns[i + 1].rect.width.to_expr(),
                        strength,
                    )?;
                }
            }
            Self::Proportional(props) => {
                if props.len() < n {
                    return Err(SolverError::InvalidExpression(format!(
                        "Proportions count ({}) is less than column count ({})",
                        props.len(),
                        n
                    )));
                }

                // Check for non-positive or non-finite values
                let all_positive = props[..n]
                    .iter()
                    .all(|&p| p.is_finite() && p > 0.0);

                if !all_positive {
                    return Err(SolverError::InvalidExpression(
                        "All column proportions must be finite, strictly positive numbers".to_string(),
                    ));
                }

                for i in 0..(n - 1) {
                    let p_i = props[i] as f64;
                    let p_next = props[i + 1] as f64;

                    // p_next * col[i].width == p_i * col[i+1].width
                    let lhs = LinearExpression::term(columns[i].rect.width, p_next);
                    let rhs = LinearExpression::term(columns[i + 1].rect.width, p_i);

                    solver.add_eq(lhs, rhs, strength)?;
                }
            }
        }

        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::multi_flow::SpreadSide;
    use crate::solver::frame_model::{ColumnSpec, MultiColumnConstraintModel};
    use crate::solver::page_model::{PageConstraintModel, PageGeometryConfig};
    use tok_core::FlowId;

    #[test]
    fn test_equal_distribution_three_columns() {
        let mut solver = GeometricConstraintSolver::new();
        let page_model = PageConstraintModel::new();
        let config = PageGeometryConfig::new(600.0, 800.0, 30.0, 30.0, 20.0, 20.0, SpreadSide::Recto);
        page_model.apply(&mut solver, &config).unwrap();

        let flows = vec![FlowId::new("c1"), FlowId::new("c2"), FlowId::new("c3")];
        let model = MultiColumnConstraintModel::new(&flows);
        let specs = vec![
            ColumnSpec::new(FlowId::new("c1")),
            ColumnSpec::new(FlowId::new("c2")),
            ColumnSpec::new(FlowId::new("c3")),
        ];

        let gutter = 10.0;
        model.apply(&mut solver, &page_model, gutter, &specs).unwrap();

        ColumnWidthDistribution::Equal
            .apply(&mut solver, &model.columns, ConstraintStrength::Required)
            .unwrap();

        let allocs = model.get_allocations(&solver);
        let total_avail = 600.0 - 60.0 - 2.0 * gutter;
        let expected_w = total_avail / 3.0;

        for a in &allocs {
            assert!((a.rect.width - expected_w).abs() < 1e-4);
        }
    }

    #[test]
    fn test_proportional_distribution_talmud_ratios() {
        let mut solver = GeometricConstraintSolver::new();
        let page_model = PageConstraintModel::new();
        let config = PageGeometryConfig::new(500.0, 700.0, 25.0, 25.0, 25.0, 25.0, SpreadSide::Recto);
        page_model.apply(&mut solver, &config).unwrap();

        let flows = vec![FlowId::new("rashi"), FlowId::new("main"), FlowId::new("tosafot")];
        let model = MultiColumnConstraintModel::new(&flows);
        let specs = vec![
            ColumnSpec::new(FlowId::new("rashi")),
            ColumnSpec::new(FlowId::new("main")),
            ColumnSpec::new(FlowId::new("tosafot")),
        ];

        let gutter = 12.0;
        model.apply(&mut solver, &page_model, gutter, &specs).unwrap();

        // 28% Rashi, 40% Main, 32% Tosafot -> ratios 0.28, 0.40, 0.32
        let ratios = vec![0.28, 0.40, 0.32];
        ColumnWidthDistribution::Proportional(ratios)
            .apply(&mut solver, &model.columns, ConstraintStrength::Required)
            .unwrap();

        let allocs = model.get_allocations(&solver);
        let total_w = 500.0 - 50.0 - 2.0 * gutter;

        assert!((allocs[0].rect.width - total_w * 0.28).abs() < 1e-3);
        assert!((allocs[1].rect.width - total_w * 0.40).abs() < 1e-3);
        assert!((allocs[2].rect.width - total_w * 0.32).abs() < 1e-3);
    }
}
