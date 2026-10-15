//! Dynamic L-Shape Commentary Expansion Constraint Model ("צורת הדף").
//!
//! Models commentary expansion below an early-terminating primary stream,
//! enforcing non-overlap, column alignment, and vertical gutters.

use crate::geometry::PhysicalRect;
use crate::polygon_engine::PolygonFrame;
use crate::solver::frame_model::ColumnFrameVariables;
use crate::solver::model::{
    ConstraintStrength, ConstraintVariable, LinearExpression, RectVariables, SolvedRect,
};
use crate::solver::solver_core::{GeometricConstraintSolver, SolverError};
use tok_core::FlowId;

/// Configuration for dynamic L-shape commentary expansion.
#[derive(Debug, Clone, PartialEq)]
pub struct LShapeConfig {
    pub primary_flow_id: FlowId,
    pub primary_target_height_pt: f32,
    pub min_gap_pt: f32,
    pub gutter_pt: f32,
}

impl LShapeConfig {
    pub const DEFAULT_MIN_GAP_PT: f32 = 30.0;

    pub fn new(primary_flow_id: FlowId, primary_target_height_pt: f32, gutter_pt: f32) -> Self {
        Self {
            primary_flow_id,
            primary_target_height_pt,
            min_gap_pt: Self::DEFAULT_MIN_GAP_PT,
            gutter_pt,
        }
    }
}

/// Variables allocated for an L-shaped expansion frame below the primary stream.
#[derive(Debug, Clone, PartialEq, Eq, Hash)]
pub struct LShapeExpansionVariables {
    pub expansion_flow_id: FlowId,
    pub rect: RectVariables,
    pub gutter: ConstraintVariable,
}

impl LShapeExpansionVariables {
    pub fn new(expansion_flow_id: FlowId) -> Self {
        Self {
            expansion_flow_id,
            rect: RectVariables::new(),
            gutter: ConstraintVariable::new(),
        }
    }

    /// Constrains the primary column height and creates the expansion frame below it.
    ///
    /// The expansion frame:
    /// - Aligns horizontally with the primary column: `exp.x == prim.x`, `exp.width == prim.width`.
    /// - Starts below primary column separated by gutter: `exp.y == prim.y + prim.height + gutter`.
    /// - Reaches bottom boundary: `exp.bottom == bottom_limit`.
    pub fn apply(
        &self,
        solver: &mut GeometricConstraintSolver,
        primary_col: &ColumnFrameVariables,
        bottom_limit_expr: LinearExpression,
        config: &LShapeConfig,
    ) -> Result<(), SolverError> {
        let prim_h = config.primary_target_height_pt.max(0.0) as f64;

        // Set fixed gutter
        solver.add_eq(
            self.gutter.to_expr(),
            LinearExpression::constant(config.gutter_pt as f64),
            ConstraintStrength::Required,
        )?;

        // 1. Constrain primary column height
        solver.add_eq(
            primary_col.rect.height.to_expr(),
            LinearExpression::constant(prim_h),
            ConstraintStrength::Required,
        )?;

        // 2. Horizontal alignment with primary column
        solver.add_eq(
            self.rect.x.to_expr(),
            primary_col.rect.x.to_expr(),
            ConstraintStrength::Required,
        )?;
        solver.add_eq(
            self.rect.width.to_expr(),
            primary_col.rect.width.to_expr(),
            ConstraintStrength::Required,
        )?;

        // 3. Vertical position: exp.y == prim.bottom + gutter
        let exp_top_target = primary_col.rect.bottom_expr().plus(&self.gutter.to_expr());
        solver.add_eq(
            self.rect.y.to_expr(),
            exp_top_target,
            ConstraintStrength::Required,
        )?;

        // 4. Vertical extent: exp.bottom == bottom_limit
        solver.add_eq(
            self.rect.bottom_expr(),
            bottom_limit_expr,
            ConstraintStrength::Required,
        )?;

        // 5. Non-negativity
        solver.add_non_negative(self.rect.height)?;

        Ok(())
    }

    /// Evaluates solved rectangular allocation.
    pub fn get_rect(&self, solver: &GeometricConstraintSolver) -> SolvedRect {
        solver.get_rect(self.rect)
    }
}

/// The geometric pattern of commentary absorption below early terminating flows.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum AbsorptionKind {
    /// Absorbs directly within the boundary of the terminating column.
    ColumnExtension,
    /// Merges the absorbing column and the terminating column into a single wide contiguous frame.
    CombinedAdjacent,
    /// Expands across the entire content width below all terminating columns.
    FullWidth,
}

/// Configuration for dynamic commentary absorption.
#[derive(Debug, Clone, PartialEq)]
pub struct CommentaryAbsorptionConfig {
    pub absorbing_flow_id: FlowId,
    pub terminating_flow_id: FlowId,
    pub terminating_target_height_pt: f32,
    pub gutter_pt: f32,
    pub kind: AbsorptionKind,
}

impl CommentaryAbsorptionConfig {
    pub fn new(
        absorbing_flow_id: FlowId,
        terminating_flow_id: FlowId,
        terminating_target_height_pt: f32,
        gutter_pt: f32,
        kind: AbsorptionKind,
    ) -> Self {
        Self {
            absorbing_flow_id,
            terminating_flow_id,
            terminating_target_height_pt,
            gutter_pt,
            kind,
        }
    }
}

/// Variables allocated for adjacent commentary absorption ("מסגרת בליעה").
#[derive(Debug, Clone, PartialEq, Eq, Hash)]
pub struct CommentaryAbsorptionVariables {
    pub absorbing_flow_id: FlowId,
    pub rect: RectVariables,
    pub gutter: ConstraintVariable,
}

impl CommentaryAbsorptionVariables {
    pub fn new(absorbing_flow_id: FlowId) -> Self {
        Self {
            absorbing_flow_id,
            rect: RectVariables::new(),
            gutter: ConstraintVariable::new(),
        }
    }

    /// Constrains the terminating column and sets up the absorbed region for an adjacent commentary.
    pub fn apply_adjacent(
        &self,
        solver: &mut GeometricConstraintSolver,
        terminating_col: &ColumnFrameVariables,
        absorbing_col: &ColumnFrameVariables,
        terminating_is_left: bool,
        bottom_limit_expr: LinearExpression,
        config: &CommentaryAbsorptionConfig,
    ) -> Result<(), SolverError> {
        let term_h = config.terminating_target_height_pt.max(0.0) as f64;

        // Set fixed gutter
        solver.add_eq(
            self.gutter.to_expr(),
            LinearExpression::constant(config.gutter_pt as f64),
            ConstraintStrength::Required,
        )?;

        // 1. Constrain terminating column height
        solver.add_eq(
            terminating_col.rect.height.to_expr(),
            LinearExpression::constant(term_h),
            ConstraintStrength::Required,
        )?;

        // 2. Horizontal placement depending on AbsorptionKind
        match config.kind {
            AbsorptionKind::ColumnExtension => {
                // Aligns exactly within the terminating column
                solver.add_eq(
                    self.rect.x.to_expr(),
                    terminating_col.rect.x.to_expr(),
                    ConstraintStrength::Required,
                )?;
                solver.add_eq(
                    self.rect.width.to_expr(),
                    terminating_col.rect.width.to_expr(),
                    ConstraintStrength::Required,
                )?;
            }
            AbsorptionKind::CombinedAdjacent | AbsorptionKind::FullWidth => {
                // Unites both columns continuously
                let (left_x, right_x) = if terminating_is_left {
                    (terminating_col.rect.x.to_expr(), absorbing_col.rect.right_expr())
                } else {
                    (absorbing_col.rect.x.to_expr(), terminating_col.rect.right_expr())
                };
                solver.add_eq(self.rect.x.to_expr(), left_x, ConstraintStrength::Required)?;
                solver.add_eq(self.rect.right_expr(), right_x, ConstraintStrength::Required)?;
            }
        }

        // 3. Vertical position: starts below terminating column + gutter
        let top_target = terminating_col.rect.bottom_expr().plus(&self.gutter.to_expr());
        solver.add_eq(self.rect.y.to_expr(), top_target, ConstraintStrength::Required)?;

        // 4. Vertical extent: reaches bottom limit
        solver.add_eq(
            self.rect.bottom_expr(),
            bottom_limit_expr,
            ConstraintStrength::Required,
        )?;

        // 5. Non-negativity
        solver.add_non_negative(self.rect.height)?;

        Ok(())
    }

    /// Constrains absorption across the full page content width below the terminating flow.
    pub fn apply_full_width(
        &self,
        solver: &mut GeometricConstraintSolver,
        terminating_col: &ColumnFrameVariables,
        left_bound_expr: LinearExpression,
        right_bound_expr: LinearExpression,
        bottom_limit_expr: LinearExpression,
        config: &CommentaryAbsorptionConfig,
    ) -> Result<(), SolverError> {
        let term_h = config.terminating_target_height_pt.max(0.0) as f64;

        solver.add_eq(
            self.gutter.to_expr(),
            LinearExpression::constant(config.gutter_pt as f64),
            ConstraintStrength::Required,
        )?;

        solver.add_eq(
            terminating_col.rect.height.to_expr(),
            LinearExpression::constant(term_h),
            ConstraintStrength::Required,
        )?;

        // Full width bounds
        solver.add_eq(self.rect.x.to_expr(), left_bound_expr, ConstraintStrength::Required)?;
        solver.add_eq(self.rect.right_expr(), right_bound_expr, ConstraintStrength::Required)?;

        // Vertical position: below terminating column + gutter
        let top_target = terminating_col.rect.bottom_expr().plus(&self.gutter.to_expr());
        solver.add_eq(self.rect.y.to_expr(), top_target, ConstraintStrength::Required)?;

        // Vertical bottom
        solver.add_eq(
            self.rect.bottom_expr(),
            bottom_limit_expr,
            ConstraintStrength::Required,
        )?;

        solver.add_non_negative(self.rect.height)?;

        Ok(())
    }

    /// Evaluates solved rectangular allocation.
    pub fn get_rect(&self, solver: &GeometricConstraintSolver) -> SolvedRect {
        solver.get_rect(self.rect)
    }

    /// Synthesizes an L-shaped `PolygonFrame` combining the upper absorbing column
    /// and the lower absorbed expansion region.
    pub fn to_polygon_frame(
        &self,
        solver: &GeometricConstraintSolver,
        absorbing_col_rect: SolvedRect,
    ) -> PolygonFrame {
        let absorbed = self.get_rect(solver);
        let upper_h = (absorbed.y - absorbing_col_rect.y).max(0.0);
        let upper_rect = PhysicalRect::new(
            absorbing_col_rect.x,
            absorbing_col_rect.y,
            absorbing_col_rect.width,
            upper_h,
        );
        let lower_rect = PhysicalRect::new(
            absorbed.x,
            absorbed.y,
            absorbed.width,
            absorbed.height,
        );
        PolygonFrame {
            bands: vec![upper_rect, lower_rect],
            polygon: None,
            exclusions: Vec::new(),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::multi_flow::SpreadSide;
    use crate::solver::frame_model::{ColumnSpec, MultiColumnConstraintModel};
    use crate::solver::page_model::{PageConstraintModel, PageGeometryConfig};

    #[test]
    fn test_l_shape_expansion_geometry() {
        let mut solver = GeometricConstraintSolver::new();
        let page_model = PageConstraintModel::new();
        // Page 500 x 800, margins 50 -> content 400 x 700 (y: 50 to 750)
        let config =
            PageGeometryConfig::new(500.0, 800.0, 50.0, 50.0, 50.0, 50.0, SpreadSide::Recto);
        page_model.apply(&mut solver, &config).unwrap();

        let flows = vec![
            FlowId::new("rashi"),
            FlowId::new("main"),
            FlowId::new("tosafot"),
        ];
        let col_model = MultiColumnConstraintModel::new(&flows);
        let _specs: Vec<_> = flows.iter().map(|f| ColumnSpec::new(f.clone())).collect();

        let gutter = 12.0;

        // Apply basic column placement without forcing all heights to content.height
        solver
            .add_eq(
                col_model.columns[0].rect.x.to_expr(),
                page_model.content_rect.x.to_expr(),
                ConstraintStrength::Required,
            )
            .unwrap();
        for col in &col_model.columns {
            solver
                .add_eq(
                    col.rect.y.to_expr(),
                    page_model.content_rect.y.to_expr(),
                    ConstraintStrength::Required,
                )
                .unwrap();
        }
        for i in 0..2 {
            let next_x = col_model.columns[i]
                .rect
                .right_expr()
                .plus(&LinearExpression::constant(gutter as f64));
            solver
                .add_eq(
                    col_model.columns[i + 1].rect.x.to_expr(),
                    next_x,
                    ConstraintStrength::Required,
                )
                .unwrap();
        }
        solver
            .add_eq(
                col_model.columns[2].rect.right_expr(),
                page_model.content_rect.right_expr(),
                ConstraintStrength::Required,
            )
            .unwrap();

        // Equal column widths
        solver
            .add_eq(
                col_model.columns[0].rect.width.to_expr(),
                col_model.columns[1].rect.width.to_expr(),
                ConstraintStrength::Required,
            )
            .unwrap();
        solver
            .add_eq(
                col_model.columns[1].rect.width.to_expr(),
                col_model.columns[2].rect.width.to_expr(),
                ConstraintStrength::Required,
            )
            .unwrap();

        // Side commentaries reach content bottom
        solver
            .add_eq(
                col_model.columns[0].rect.bottom_expr(),
                page_model.content_rect.bottom_expr(),
                ConstraintStrength::Required,
            )
            .unwrap();
        solver
            .add_eq(
                col_model.columns[2].rect.bottom_expr(),
                page_model.content_rect.bottom_expr(),
                ConstraintStrength::Required,
            )
            .unwrap();

        // Gemara (main, index 1) finishes at 300 pt height (out of 700 pt)
        let l_shape = LShapeExpansionVariables::new(FlowId::new("rashi_expansion"));
        let l_config = LShapeConfig::new(FlowId::new("main"), 300.0, gutter);

        l_shape
            .apply(
                &mut solver,
                &col_model.columns[1],
                page_model.content_rect.bottom_expr(),
                &l_config,
            )
            .unwrap();

        let main_rect = solver.get_rect(col_model.columns[1].rect);
        let exp_rect = l_shape.get_rect(&solver);

        // Gemara top: 50, height: 300 -> bottom: 350
        assert!((main_rect.y - 50.0).abs() < 1e-4);
        assert!((main_rect.height - 300.0).abs() < 1e-4);
        assert!((main_rect.bottom() - 350.0).abs() < 1e-4);

        // Expansion top: 350 + 12 = 362
        assert!((exp_rect.y - 362.0).abs() < 1e-4);
        // Expansion bottom: content bottom = 750
        assert!((exp_rect.bottom() - 750.0).abs() < 1e-4);
        // Expansion height: 750 - 362 = 388
        assert!((exp_rect.height - 388.0).abs() < 1e-4);

        // Exact horizontal match with main column
        assert!((exp_rect.x - main_rect.x).abs() < 1e-4);
        assert!((exp_rect.width - main_rect.width).abs() < 1e-4);
    }
}
