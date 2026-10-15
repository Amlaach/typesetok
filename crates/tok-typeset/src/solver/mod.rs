//! Geometric Constraint Solving System for TypesetOK (Stage 7).
//!
//! Replaces heuristic frame allocation and nominal dimensions with a mathematically
//! rigorous geometric constraint-solving system driven by the Cassowary simplex algorithm.
//!
//! # Architecture
//! - [`model`]: Mathematical domain model for variables, linear combinations, relational
//!   constraints, strengths, and physical solved rectangles.
//! - [`solver_core`]: Core [`GeometricConstraintSolver`] wrapping the linear simplex solver with
//!   conflict detection and contradiction handling.
//! - [`page_model`]: [`PageConstraintModel`] enforcing page boundary containment, printable area,
//!   and facing spread margin alternation (Recto vs Verso).
//! - [`frame_model`]: [`MultiColumnConstraintModel`] enforcing column containment, vertical
//!   alignments, inter-column gutters, and strict non-overlap.
//! - [`proportions`]: [`ColumnWidthDistribution`] modeling relative column measure relations as linear
//!   equations without hardcoded percentages or geometry magic numbers.
//! - [`footnote_model`]: [`FootnoteBandVariables`] modeling full-width bottom apparatus bands with
//!   dynamic column height compression and gutter separation.
//! - [`l_shape_model`]: [`LShapeExpansionVariables`] modeling dynamic Tzurat HaDaf commentary
//!   expansion below early-terminating primary streams.

pub mod footnote_model;
pub mod frame_model;
pub mod l_shape_model;
pub mod model;
pub mod page_model;
pub mod proportions;
pub mod solver_core;

pub use footnote_model::{FootnoteBandConfig, FootnoteBandVariables};
pub use frame_model::{
    ColumnFrameVariables, ColumnSpec, MultiColumnConstraintModel, SolvedColumnAllocation,
};
pub use l_shape_model::{
    AbsorptionKind, CommentaryAbsorptionConfig, CommentaryAbsorptionVariables, LShapeConfig,
    LShapeExpansionVariables,
};
pub use model::{
    ConstraintRelation, ConstraintStrength, ConstraintVariable, GeometricConstraint,
    LinearExpression, LinearTerm, RectVariables, SolvedRect,
};
pub use page_model::{PageConstraintModel, PageGeometryConfig};
pub use proportions::ColumnWidthDistribution;
pub use solver_core::{GeometricConstraintSolver, SolverError};
