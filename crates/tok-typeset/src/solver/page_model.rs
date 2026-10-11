//! Page Boundary, Margins, and Content Box Constraint Model.
//!
//! Models physical page bounds and spread-aware margin geometries as explicit
//! linear constraints for the geometric simplex solver.

use crate::multi_flow::SpreadSide;
use crate::solver::model::{
    ConstraintStrength, ConstraintVariable, LinearExpression, RectVariables, SolvedRect,
};
use crate::solver::solver_core::{GeometricConstraintSolver, SolverError};

/// Physical page configuration parameters.
#[derive(Debug, Clone, Copy, PartialEq)]
pub struct PageGeometryConfig {
    pub width_pt: f32,
    pub height_pt: f32,
    pub margin_inner_pt: f32,
    pub margin_outer_pt: f32,
    pub margin_top_pt: f32,
    pub margin_bottom_pt: f32,
    pub side: SpreadSide,
}

impl PageGeometryConfig {
    pub fn new(
        width_pt: f32,
        height_pt: f32,
        margin_inner_pt: f32,
        margin_outer_pt: f32,
        margin_top_pt: f32,
        margin_bottom_pt: f32,
        side: SpreadSide,
    ) -> Self {
        Self {
            width_pt,
            height_pt,
            margin_inner_pt,
            margin_outer_pt,
            margin_top_pt,
            margin_bottom_pt,
            side,
        }
    }

    /// Evaluates left and right margins based on RTL spread orientation.
    /// In Hebrew RTL books:
    /// - Recto (Right page): Spine is on the LEFT -> Left = inner, Right = outer.
    /// - Verso (Left page): Spine is on the RIGHT -> Left = outer, Right = inner.
    pub fn physical_horizontal_margins(&self) -> (f32, f32) {
        match self.side {
            SpreadSide::Recto => (self.margin_inner_pt, self.margin_outer_pt),
            SpreadSide::Verso => (self.margin_outer_pt, self.margin_inner_pt),
        }
    }
}

/// Variables and constraints governing a page's outer bounds and printable content area.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
pub struct PageConstraintModel {
    pub page_rect: RectVariables,
    pub content_rect: RectVariables,
    pub margin_left: ConstraintVariable,
    pub margin_right: ConstraintVariable,
    pub margin_top: ConstraintVariable,
    pub margin_bottom: ConstraintVariable,
}

impl PageConstraintModel {
    /// Instantiates page constraint variables.
    pub fn new() -> Self {
        Self {
            page_rect: RectVariables::new(),
            content_rect: RectVariables::new(),
            margin_left: ConstraintVariable::new(),
            margin_right: ConstraintVariable::new(),
            margin_top: ConstraintVariable::new(),
            margin_bottom: ConstraintVariable::new(),
        }
    }

    /// Constrains the solver with page boundaries, margins, and content containment.
    pub fn apply(
        &self,
        solver: &mut GeometricConstraintSolver,
        config: &PageGeometryConfig,
    ) -> Result<(), SolverError> {
        let (margin_l, margin_r) = config.physical_horizontal_margins();

        if config.width_pt <= 0.0 || config.height_pt <= 0.0 {
            return Err(SolverError::DegenerateGeometry(format!(
                "Non-positive page dimensions: {} x {}",
                config.width_pt, config.height_pt
            )));
        }

        let printable_w = config.width_pt - margin_l - margin_r;
        let printable_h = config.height_pt - config.margin_top_pt - config.margin_bottom_pt;
        if printable_w <= 0.0 || printable_h <= 0.0 {
            return Err(SolverError::DegenerateGeometry(format!(
                "Margins exceed page dimensions: printable {} x {}",
                printable_w, printable_h
            )));
        }

        // 1. Page origin: x == 0, y == 0
        solver.add_eq(
            self.page_rect.x.to_expr(),
            LinearExpression::constant(0.0),
            ConstraintStrength::Required,
        )?;
        solver.add_eq(
            self.page_rect.y.to_expr(),
            LinearExpression::constant(0.0),
            ConstraintStrength::Required,
        )?;

        // 2. Page dimensions
        solver.add_eq(
            self.page_rect.width.to_expr(),
            LinearExpression::constant(config.width_pt as f64),
            ConstraintStrength::Required,
        )?;
        solver.add_eq(
            self.page_rect.height.to_expr(),
            LinearExpression::constant(config.height_pt as f64),
            ConstraintStrength::Required,
        )?;

        // 3. Margin variables
        solver.add_eq(
            self.margin_left.to_expr(),
            LinearExpression::constant(margin_l as f64),
            ConstraintStrength::Required,
        )?;
        solver.add_eq(
            self.margin_right.to_expr(),
            LinearExpression::constant(margin_r as f64),
            ConstraintStrength::Required,
        )?;
        solver.add_eq(
            self.margin_top.to_expr(),
            LinearExpression::constant(config.margin_top_pt as f64),
            ConstraintStrength::Required,
        )?;
        solver.add_eq(
            self.margin_bottom.to_expr(),
            LinearExpression::constant(config.margin_bottom_pt as f64),
            ConstraintStrength::Required,
        )?;

        // 4. Content position: content.x == page.x + margin_left, content.y == page.y + margin_top
        solver.add_eq(
            self.content_rect.x.to_expr(),
            self.page_rect.x.to_expr().plus(&self.margin_left.to_expr()),
            ConstraintStrength::Required,
        )?;
        solver.add_eq(
            self.content_rect.y.to_expr(),
            self.page_rect.y.to_expr().plus(&self.margin_top.to_expr()),
            ConstraintStrength::Required,
        )?;

        // 5. Content size: content.width == page.width - margin_left - margin_right
        let total_margin_x = self
            .margin_left
            .to_expr()
            .plus(&self.margin_right.to_expr());
        solver.add_eq(
            self.content_rect.width.to_expr(),
            self.page_rect.width.to_expr().minus(&total_margin_x),
            ConstraintStrength::Required,
        )?;

        // 6. Content height: content.height == page.height - margin_top - margin_bottom
        let total_margin_y = self
            .margin_top
            .to_expr()
            .plus(&self.margin_bottom.to_expr());
        solver.add_eq(
            self.content_rect.height.to_expr(),
            self.page_rect.height.to_expr().minus(&total_margin_y),
            ConstraintStrength::Required,
        )?;

        // 7. Non-negativity
        solver.add_non_negative(self.content_rect.width)?;
        solver.add_non_negative(self.content_rect.height)?;

        Ok(())
    }

    /// Evaluates the solved printable content rect.
    pub fn get_content_rect(&self, solver: &GeometricConstraintSolver) -> SolvedRect {
        solver.get_rect(self.content_rect)
    }

    /// Evaluates the solved physical page rect.
    pub fn get_page_rect(&self, solver: &GeometricConstraintSolver) -> SolvedRect {
        solver.get_rect(self.page_rect)
    }
}

impl Default for PageConstraintModel {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_page_recto_verso_spine_handling() {
        let mut solver = GeometricConstraintSolver::new();
        let page_model = PageConstraintModel::new();

        // Recto: Inner (spine) = 40.0 on LEFT, Outer = 20.0 on RIGHT
        let config_recto =
            PageGeometryConfig::new(595.0, 842.0, 40.0, 20.0, 30.0, 30.0, SpreadSide::Recto);

        page_model.apply(&mut solver, &config_recto).unwrap();

        let content = page_model.get_content_rect(&solver);
        assert!((content.x - 40.0).abs() < 1e-4);
        assert!((content.y - 30.0).abs() < 1e-4);
        assert!((content.width - (595.0 - 60.0)).abs() < 1e-4);
        assert!((content.height - (842.0 - 60.0)).abs() < 1e-4);
        assert!((content.right() - (595.0 - 20.0)).abs() < 1e-4);

        // Verso: Outer = 20.0 on LEFT, Inner (spine) = 40.0 on RIGHT
        let mut solver_verso = GeometricConstraintSolver::new();
        let config_verso =
            PageGeometryConfig::new(595.0, 842.0, 40.0, 20.0, 30.0, 30.0, SpreadSide::Verso);

        page_model.apply(&mut solver_verso, &config_verso).unwrap();
        let content_verso = page_model.get_content_rect(&solver_verso);
        assert!((content_verso.x - 20.0).abs() < 1e-4);
        assert!((content_verso.right() - (595.0 - 40.0)).abs() < 1e-4);
    }

    #[test]
    fn test_degenerate_page_detection() {
        let mut solver = GeometricConstraintSolver::new();
        let page_model = PageConstraintModel::new();

        let invalid_config =
            PageGeometryConfig::new(100.0, 100.0, 60.0, 60.0, 10.0, 10.0, SpreadSide::Recto);

        let res = page_model.apply(&mut solver, &invalid_config);
        assert!(res.is_err());
        match res {
            Err(SolverError::DegenerateGeometry(_)) => {}
            other => panic!("Expected DegenerateGeometry, got {:?}", other),
        }
    }
}
