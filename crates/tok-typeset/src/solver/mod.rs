//! Geometric Constraint Solving System for TypesetOK.
//!
//! Provides mathematically rigorous frame allocation and spread mathematics
//! via linear inequality constraint solving over the Cassowary simplex algorithm.

pub mod model;
pub mod solver_core;

pub use model::{
    ConstraintRelation, ConstraintStrength, ConstraintVariable, GeometricConstraint,
    LinearExpression, LinearTerm, RectVariables, SolvedRect,
};
pub use solver_core::{GeometricConstraintSolver, SolverError};
