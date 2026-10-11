//! Floating Footnote and Apparatus Bottom Band Constraint Model.
//!
//! Models full-width bottom-anchored footnote apparatus bands, enforcing
//! exact vertical separation gutters and dynamic column height compression.

use crate::solver::frame_model::ColumnFrameVariables;
use crate::solver::model::{
    ConstraintStrength, ConstraintVariable, LinearExpression, RectVariables, SolvedRect,
};
use crate::solver::page_model::PageConstraintModel;
use crate::solver::solver_core::{GeometricConstraintSolver, SolverError};
use tok_core::FlowId;

/// Configuration for a floating bottom apparatus band.
#[derive(Debug, Clone, Copy, PartialEq)]
pub struct FootnoteBandConfig {
    pub target_height_pt: f32,
    pub max_height_ratio: f32,
    pub gutter_pt: f32,
}

impl FootnoteBandConfig {
    pub fn new(target_height_pt: f32, gutter_pt: f32) -> Self {
        Self {
            target_height_pt,
            max_height_ratio: 0.45,
            gutter_pt,
        }
    }

    pub fn with_max_height_ratio(mut self, ratio: f32) -> Self {
        self.max_height_ratio = ratio;
        self
    }
}

/// Variables allocated for the bottom footnote apparatus band.
#[derive(Debug, Clone, PartialEq, Eq, Hash)]
pub struct FootnoteBandVariables {
    pub flow_id: FlowId,
    pub rect: RectVariables,
    pub gutter: ConstraintVariable,
}

impl FootnoteBandVariables {
    pub fn new(flow_id: FlowId) -> Self {
        Self {
            flow_id,
            rect: RectVariables::new(),
            gutter: ConstraintVariable::new(),
        }
    }

    /// Constrains the footnote band and adjusts the columns above:
    /// - Spans full printable width: `fn.x == content.x`, `fn.width == content.width`.
    /// - Anchored to content bottom: `fn.bottom == content.bottom`.
    /// - Height capped to `max_ratio * content.height`.
    /// - All columns above terminate exactly at `fn.y - gutter`.
    pub fn apply(
        &self,
        solver: &mut GeometricConstraintSolver,
        page_model: &PageConstraintModel,
        columns: &[ColumnFrameVariables],
        config: &FootnoteBandConfig,
    ) -> Result<(), SolverError> {
        let content = &page_model.content_rect;

        if config.target_height_pt <= 0.0 {
            // Inactive footnote: zero height, positioned at bottom
            solver.add_eq(
                self.rect.height.to_expr(),
                LinearExpression::constant(0.0),
                ConstraintStrength::Required,
            )?;
            solver.add_eq(
                self.rect.width.to_expr(),
                content.width.to_expr(),
                ConstraintStrength::Required,
            )?;
            solver.add_eq(
                self.rect.x.to_expr(),
                content.x.to_expr(),
                ConstraintStrength::Required,
            )?;
            solver.add_eq(
                self.rect.bottom_expr(),
                content.bottom_expr(),
                ConstraintStrength::Required,
            )?;

            // Columns use full content height
            for col in columns {
                solver.add_eq(
                    col.rect.bottom_expr(),
                    content.bottom_expr(),
                    ConstraintStrength::Required,
                )?;
            }
            return Ok(());
        }

        // Set gutter variable
        solver.add_eq(
            self.gutter.to_expr(),
            LinearExpression::constant(config.gutter_pt as f64),
            ConstraintStrength::Required,
        )?;

        // 1. Horizontal span
        solver.add_eq(
            self.rect.x.to_expr(),
            content.x.to_expr(),
            ConstraintStrength::Required,
        )?;
        solver.add_eq(
            self.rect.width.to_expr(),
            content.width.to_expr(),
            ConstraintStrength::Required,
        )?;

        // 2. Anchored to bottom: fn.bottom == content.bottom
        solver.add_eq(
            self.rect.bottom_expr(),
            content.bottom_expr(),
            ConstraintStrength::Required,
        )?;

        // 3. Height constraints
        solver.add_non_negative(self.rect.height)?;
        solver.add_eq(
            self.rect.height.to_expr(),
            LinearExpression::constant(config.target_height_pt as f64),
            ConstraintStrength::Strong,
        )?;

        // Maximum height constraint: fn.height <= max_ratio * content.height
        let max_h_expr = LinearExpression::term(content.height, config.max_height_ratio as f64);
        solver.add_le(
            self.rect.height.to_expr(),
            max_h_expr,
            ConstraintStrength::Required,
        )?;

        // 4. Separation from columns above:
        // For each column above: col.bottom == fn.y - gutter
        let col_bottom_target = self.rect.y.to_expr().minus(&self.gutter.to_expr());
        for col in columns {
            solver.add_eq(
                col.rect.bottom_expr(),
                col_bottom_target.clone(),
                ConstraintStrength::Required,
            )?;
        }

        Ok(())
    }

    /// Evaluates solved rectangular allocation.
    pub fn get_rect(&self, solver: &GeometricConstraintSolver) -> SolvedRect {
        solver.get_rect(self.rect)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::multi_flow::SpreadSide;
    use crate::solver::frame_model::ColumnSpec;
    use crate::solver::frame_model::MultiColumnConstraintModel;
    use crate::solver::page_model::PageGeometryConfig;

    #[test]
    fn test_footnote_band_geometric_constraints() {
        let mut solver = GeometricConstraintSolver::new();
        let page_model = PageConstraintModel::new();
        // Page 500 x 800, margins 50 -> content 400 x 700 (y from 50 to 750)
        let config =
            PageGeometryConfig::new(500.0, 800.0, 50.0, 50.0, 50.0, 50.0, SpreadSide::Recto);
        page_model.apply(&mut solver, &config).unwrap();

        let flows = vec![FlowId::new("main")];
        let col_model = MultiColumnConstraintModel::new(&flows);
        let _specs = [ColumnSpec::new(FlowId::new("main"))];

        let fn_band = FootnoteBandVariables::new(FlowId::new("footnotes"));
        let fn_config = FootnoteBandConfig::new(120.0, 10.0);

        // First apply column frame boundaries without forcing col.height == content.height
        solver
            .add_eq(
                col_model.columns[0].rect.x.to_expr(),
                page_model.content_rect.x.to_expr(),
                ConstraintStrength::Required,
            )
            .unwrap();
        solver
            .add_eq(
                col_model.columns[0].rect.y.to_expr(),
                page_model.content_rect.y.to_expr(),
                ConstraintStrength::Required,
            )
            .unwrap();
        solver
            .add_eq(
                col_model.columns[0].rect.width.to_expr(),
                page_model.content_rect.width.to_expr(),
                ConstraintStrength::Required,
            )
            .unwrap();

        fn_band
            .apply(&mut solver, &page_model, &col_model.columns, &fn_config)
            .unwrap();

        let fn_rect = fn_band.get_rect(&solver);
        let col_rect = solver.get_rect(col_model.columns[0].rect);

        // Footnote spans full width: 400 pt, left: 50 pt
        assert!((fn_rect.x - 50.0).abs() < 1e-4);
        assert!((fn_rect.width - 400.0).abs() < 1e-4);

        // Footnote bottom aligns with content bottom: 50 + 700 = 750 pt
        assert!((fn_rect.bottom() - 750.0).abs() < 1e-4);
        assert!((fn_rect.height - 120.0).abs() < 1e-4);
        assert!((fn_rect.y - (750.0 - 120.0)).abs() < 1e-4); // y = 630.0

        // Column bottom is fn.y - gutter = 630 - 10 = 620 pt
        assert!((col_rect.bottom() - 620.0).abs() < 1e-4);
        // Column height is 620 - 50 = 570 pt
        assert!((col_rect.height - 570.0).abs() < 1e-4);

        // Sum: col.height (570) + gutter (10) + fn.height (120) == 700 pt
        assert!((col_rect.height + 10.0 + fn_rect.height - 700.0).abs() < 1e-4);
    }
}
