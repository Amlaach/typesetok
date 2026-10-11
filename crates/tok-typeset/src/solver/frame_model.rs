//! Column Frames, Containment, Alignment, and Non-Overlap Constraint Model.
//!
//! Models text frames within the printable area, enforcing strict containment,
//! inter-column gutters, non-overlap, and vertical alignments.

use crate::solver::model::{
    ConstraintStrength, ConstraintVariable, LinearExpression, RectVariables, SolvedRect,
};
use crate::solver::page_model::PageConstraintModel;
use crate::solver::solver_core::{GeometricConstraintSolver, SolverError};
use tok_core::FlowId;

/// A text column frame being solved for geometric placement.
#[derive(Debug, Clone, PartialEq)]
pub struct ColumnSpec {
    pub flow_id: FlowId,
    pub min_width_pt: f32,
    pub max_width_pt: f32,
}

impl ColumnSpec {
    pub fn new(flow_id: FlowId) -> Self {
        Self {
            flow_id,
            min_width_pt: 20.0,
            max_width_pt: 2000.0,
        }
    }

    pub fn with_min_width(mut self, min_w: f32) -> Self {
        self.min_width_pt = min_w;
        self
    }

    pub fn with_max_width(mut self, max_w: f32) -> Self {
        self.max_width_pt = max_w;
        self
    }
}

/// Variables allocated for an individual column frame.
#[derive(Debug, Clone, PartialEq, Eq, Hash)]
pub struct ColumnFrameVariables {
    pub flow_id: FlowId,
    pub rect: RectVariables,
}

impl ColumnFrameVariables {
    pub fn new(flow_id: FlowId) -> Self {
        Self {
            flow_id,
            rect: RectVariables::new(),
        }
    }
}

/// Solved allocation of a column frame.
#[derive(Debug, Clone, PartialEq)]
pub struct SolvedColumnAllocation {
    pub flow_id: FlowId,
    pub rect: SolvedRect,
}

/// Geometric constraints governing multi-column layouts within a page.
#[derive(Debug, Clone, PartialEq)]
pub struct MultiColumnConstraintModel {
    pub columns: Vec<ColumnFrameVariables>,
    pub gutter: ConstraintVariable,
}

impl MultiColumnConstraintModel {
    /// Creates a column constraint model for the given flow specifications.
    pub fn new(flow_ids: &[FlowId]) -> Self {
        Self {
            columns: flow_ids
                .iter()
                .map(|id| ColumnFrameVariables::new(id.clone()))
                .collect(),
            gutter: ConstraintVariable::new(),
        }
    }

    /// Constrains the columns within the page's printable content area:
    /// - Strict containment inside content boundaries.
    /// - Strict non-overlap: `col[i+1].x == col[i].right + gutter`.
    /// - Top and bottom vertical alignment: `col[i].y == content.y`, `col[i].height == content.height`.
    /// - Width conservation: `sum(col.width) + (n-1)*gutter == content.width`.
    pub fn apply(
        &self,
        solver: &mut GeometricConstraintSolver,
        page_model: &PageConstraintModel,
        gutter_pt: f32,
        column_specs: &[ColumnSpec],
    ) -> Result<(), SolverError> {
        let n = self.columns.len();
        if n == 0 {
            return Ok(());
        }

        // Set fixed gutter variable
        solver.add_eq(
            self.gutter.to_expr(),
            LinearExpression::constant(gutter_pt as f64),
            ConstraintStrength::Required,
        )?;

        let content = &page_model.content_rect;

        // 1. Single column case: spans full content width and height
        if n == 1 {
            let col = &self.columns[0];
            solver.add_eq(col.rect.x.to_expr(), content.x.to_expr(), ConstraintStrength::Required)?;
            solver.add_eq(col.rect.y.to_expr(), content.y.to_expr(), ConstraintStrength::Required)?;
            solver.add_eq(col.rect.width.to_expr(), content.width.to_expr(), ConstraintStrength::Required)?;
            solver.add_eq(col.rect.height.to_expr(), content.height.to_expr(), ConstraintStrength::Required)?;

            if let Some(spec) = column_specs.first() {
                solver.add_min_value(col.rect.width, spec.min_width_pt as f64, ConstraintStrength::Required)?;
                solver.add_max_value(col.rect.width, spec.max_width_pt as f64, ConstraintStrength::Required)?;
            }
            return Ok(());
        }

        // 2. Multi-column case (n >= 2)
        // First column left edge aligns with content left
        solver.add_eq(
            self.columns[0].rect.x.to_expr(),
            content.x.to_expr(),
            ConstraintStrength::Required,
        )?;

        // Vertical alignments and non-negativity for all columns
        for (i, col) in self.columns.iter().enumerate() {
            // y == content.y
            solver.add_eq(
                col.rect.y.to_expr(),
                content.y.to_expr(),
                ConstraintStrength::Required,
            )?;
            // height == content.height
            solver.add_eq(
                col.rect.height.to_expr(),
                content.height.to_expr(),
                ConstraintStrength::Required,
            )?;
            // non-negative dimensions
            solver.add_non_negative(col.rect.width)?;
            solver.add_non_negative(col.rect.height)?;

            // Min and Max width bounds from specs
            if let Some(spec) = column_specs.get(i) {
                solver.add_min_value(
                    col.rect.width,
                    spec.min_width_pt as f64,
                    ConstraintStrength::Required,
                )?;
                solver.add_max_value(
                    col.rect.width,
                    spec.max_width_pt as f64,
                    ConstraintStrength::Required,
                )?;
            }
        }

        // Horizontal adjacency and non-overlap: col[i+1].x == col[i].right + gutter
        for i in 0..(n - 1) {
            let left_col = &self.columns[i];
            let right_col = &self.columns[i + 1];

            let required_next_x = left_col
                .rect
                .right_expr()
                .plus(&self.gutter.to_expr());

            solver.add_eq(
                right_col.rect.x.to_expr(),
                required_next_x,
                ConstraintStrength::Required,
            )?;
        }

        // Last column right edge aligns with content right
        let last_col = &self.columns[n - 1];
        solver.add_eq(
            last_col.rect.right_expr(),
            content.right_expr(),
            ConstraintStrength::Required,
        )?;

        Ok(())
    }

    /// Retrieves solved rectangular allocations for all columns.
    pub fn get_allocations(
        &self,
        solver: &GeometricConstraintSolver,
    ) -> Vec<SolvedColumnAllocation> {
        self.columns
            .iter()
            .map(|col| SolvedColumnAllocation {
                flow_id: col.flow_id.clone(),
                rect: solver.get_rect(col.rect),
            })
            .collect()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::multi_flow::SpreadSide;
    use crate::solver::page_model::PageGeometryConfig;

    fn page_setup(solver: &mut GeometricConstraintSolver) -> PageConstraintModel {
        let page_model = PageConstraintModel::new();
        let config = PageGeometryConfig::new(
            595.0,
            842.0,
            30.0,
            30.0,
            40.0,
            40.0,
            SpreadSide::Recto,
        );
        page_model.apply(solver, &config).unwrap();
        page_model
    }

    #[test]
    fn test_single_column_fills_content() {
        let mut solver = GeometricConstraintSolver::new();
        let page_model = page_setup(&mut solver);

        let flows = vec![FlowId::new("main")];
        let model = MultiColumnConstraintModel::new(&flows);
        let specs = vec![ColumnSpec::new(FlowId::new("main"))];

        model.apply(&mut solver, &page_model, 10.0, &specs).unwrap();

        let allocs = model.get_allocations(&solver);
        assert_eq!(allocs.len(), 1);
        let r = allocs[0].rect;
        assert!((r.x - 30.0).abs() < 1e-4);
        assert!((r.y - 40.0).abs() < 1e-4);
        assert!((r.width - (595.0 - 60.0)).abs() < 1e-4);
        assert!((r.height - (842.0 - 80.0)).abs() < 1e-4);
    }

    #[test]
    fn test_two_columns_containment_and_non_overlap() {
        let mut solver = GeometricConstraintSolver::new();
        let page_model = page_setup(&mut solver);

        let flows = vec![FlowId::new("col1"), FlowId::new("col2")];
        let model = MultiColumnConstraintModel::new(&flows);
        let specs = vec![
            ColumnSpec::new(FlowId::new("col1")),
            ColumnSpec::new(FlowId::new("col2")),
        ];

        // Equal width constraint between the two columns
        solver
            .add_eq(
                model.columns[0].rect.width.to_expr(),
                model.columns[1].rect.width.to_expr(),
                ConstraintStrength::Required,
            )
            .unwrap();

        let gutter = 15.0;
        model.apply(&mut solver, &page_model, gutter, &specs).unwrap();

        let allocs = model.get_allocations(&solver);
        assert_eq!(allocs.len(), 2);

        let c1 = allocs[0].rect;
        let c2 = allocs[1].rect;

        // Strict containment
        assert!((c1.x - 30.0).abs() < 1e-4);
        assert!((c2.right() - (595.0 - 30.0)).abs() < 1e-4);

        // Strict non-overlap and exact gutter
        assert!((c2.x - (c1.right() + gutter)).abs() < 1e-4);

        // Vertical alignment
        assert!((c1.y - 40.0).abs() < 1e-4);
        assert!((c2.y - 40.0).abs() < 1e-4);
        assert!((c1.height - c2.height).abs() < 1e-4);

        // Exact equal widths
        let expected_w = (595.0 - 60.0 - gutter) / 2.0;
        assert!((c1.width - expected_w).abs() < 1e-4);
        assert!((c2.width - expected_w).abs() < 1e-4);
    }
}
