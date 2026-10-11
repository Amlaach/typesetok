//! Geometric Constraint Solving System for TypesetOK.
//!
//! Provides mathematically rigorous frame allocation and spread mathematics
//! via linear inequality constraint solving over the Cassowary simplex algorithm.

pub mod footnote_model;
pub mod frame_model;
pub mod model;
pub mod page_model;
pub mod proportions;
pub mod solver_core;

pub use footnote_model::{FootnoteBandConfig, FootnoteBandVariables};
pub use frame_model::{
    ColumnFrameVariables, ColumnSpec, MultiColumnConstraintModel, SolvedColumnAllocation,
};
pub use model::{
    ConstraintRelation, ConstraintStrength, ConstraintVariable, GeometricConstraint,
    LinearExpression, LinearTerm, RectVariables, SolvedRect,
};
pub use page_model::{PageConstraintModel, PageGeometryConfig};
pub use proportions::ColumnWidthDistribution;
pub use solver_core::{GeometricConstraintSolver, SolverError};
