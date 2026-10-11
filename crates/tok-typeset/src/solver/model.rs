//! Geometric Constraint Modeling Abstractions.
//!
//! Provides mathematically sound representations of geometric variables,
//! linear expressions, relational constraints, and strengths for layout solving.

use cassowary::Variable;
use std::fmt;

/// Priority level of a geometric constraint in the solver.
#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord, Hash)]
pub enum ConstraintStrength {
    /// Lowest priority; soft preferences and default slack.
    Weak,
    /// Moderate priority; standard gutters and secondary alignments.
    Medium,
    /// High priority; user-defined proportions and explicit column widths.
    Strong,
    /// Mandatory; physical boundaries, non-overlap, and positive dimensions.
    Required,
}

impl ConstraintStrength {
    /// Maps our domain strength into Cassowary's numeric strength.
    pub fn to_cassowary(self) -> f64 {
        match self {
            Self::Weak => cassowary::strength::WEAK,
            Self::Medium => cassowary::strength::MEDIUM,
            Self::Strong => cassowary::strength::STRONG,
            Self::Required => cassowary::strength::REQUIRED,
        }
    }
}

/// Relational operator for a linear constraint.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
pub enum ConstraintRelation {
    Equal,
    LessThanOrEqual,
    GreaterThanOrEqual,
}

/// A named unknown in the geometric constraint system.
#[derive(Clone, Copy, PartialEq, Eq, Hash)]
pub struct ConstraintVariable {
    pub(crate) raw: Variable,
}

impl ConstraintVariable {
    /// Creates a new unique constraint variable.
    pub fn new() -> Self {
        Self {
            raw: Variable::new(),
        }
    }

    /// Converts into a linear expression with coefficient 1.0 and constant 0.0.
    pub fn to_expr(self) -> LinearExpression {
        LinearExpression::from_var(self)
    }
}

impl Default for ConstraintVariable {
    fn default() -> Self {
        Self::new()
    }
}

impl fmt::Debug for ConstraintVariable {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "Var({:?})", self.raw)
    }
}

/// A single variable term with a scalar coefficient: `coeff * var`.
#[derive(Debug, Clone, Copy, PartialEq)]
pub struct LinearTerm {
    pub variable: ConstraintVariable,
    pub coefficient: f64,
}

/// A linear combination of constraint variables and a scalar constant:
/// `c0 * v0 + c1 * v1 + ... + cn * vn + constant`.
#[derive(Debug, Clone, PartialEq, Default)]
pub struct LinearExpression {
    pub terms: Vec<LinearTerm>,
    pub constant: f64,
}

impl LinearExpression {
    /// Empty expression evaluating to constant 0.0.
    pub fn zero() -> Self {
        Self {
            terms: Vec::new(),
            constant: 0.0,
        }
    }

    /// Constant scalar value.
    pub fn constant(val: f64) -> Self {
        Self {
            terms: Vec::new(),
            constant: val,
        }
    }

    /// Single variable with coefficient 1.0.
    pub fn from_var(var: ConstraintVariable) -> Self {
        Self {
            terms: vec![LinearTerm {
                variable: var,
                coefficient: 1.0,
            }],
            constant: 0.0,
        }
    }

    /// Single variable with explicit coefficient.
    pub fn term(var: ConstraintVariable, coeff: f64) -> Self {
        Self {
            terms: vec![LinearTerm {
                variable: var,
                coefficient: coeff,
            }],
            constant: 0.0,
        }
    }

    /// Adds a term to this expression.
    pub fn add_term(&mut self, var: ConstraintVariable, coeff: f64) -> &mut Self {
        self.terms.push(LinearTerm {
            variable: var,
            coefficient: coeff,
        });
        self
    }

    /// Adds a constant scalar to this expression.
    pub fn add_constant(&mut self, val: f64) -> &mut Self {
        self.constant += val;
        self
    }

    /// Multiplies the entire expression by a scalar.
    pub fn multiply(&self, scalar: f64) -> Self {
        Self {
            terms: self
                .terms
                .iter()
                .map(|t| LinearTerm {
                    variable: t.variable,
                    coefficient: t.coefficient * scalar,
                })
                .collect(),
            constant: self.constant * scalar,
        }
    }

    /// Sums two linear expressions.
    pub fn plus(&self, other: &Self) -> Self {
        let mut terms = self.terms.clone();
        terms.extend_from_slice(&other.terms);
        Self {
            terms,
            constant: self.constant + other.constant,
        }
    }

    /// Subtracts another linear expression from this one.
    pub fn minus(&self, other: &Self) -> Self {
        let mut terms = self.terms.clone();
        for t in &other.terms {
            terms.push(LinearTerm {
                variable: t.variable,
                coefficient: -t.coefficient,
            });
        }
        Self {
            terms,
            constant: self.constant - other.constant,
        }
    }
}

/// A linear geometric constraint relating two expressions with a given strength.
#[derive(Debug, Clone, PartialEq)]
pub struct GeometricConstraint {
    pub lhs: LinearExpression,
    pub relation: ConstraintRelation,
    pub rhs: LinearExpression,
    pub strength: ConstraintStrength,
}

impl GeometricConstraint {
    pub fn new(
        lhs: LinearExpression,
        relation: ConstraintRelation,
        rhs: LinearExpression,
        strength: ConstraintStrength,
    ) -> Self {
        Self {
            lhs,
            relation,
            rhs,
            strength,
        }
    }

    pub fn eq(lhs: LinearExpression, rhs: LinearExpression, strength: ConstraintStrength) -> Self {
        Self::new(lhs, ConstraintRelation::Equal, rhs, strength)
    }

    pub fn le(lhs: LinearExpression, rhs: LinearExpression, strength: ConstraintStrength) -> Self {
        Self::new(lhs, ConstraintRelation::LessThanOrEqual, rhs, strength)
    }

    pub fn ge(lhs: LinearExpression, rhs: LinearExpression, strength: ConstraintStrength) -> Self {
        Self::new(lhs, ConstraintRelation::GreaterThanOrEqual, rhs, strength)
    }
}

/// Variables defining a 2-dimensional bounding box.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
pub struct RectVariables {
    pub x: ConstraintVariable,
    pub y: ConstraintVariable,
    pub width: ConstraintVariable,
    pub height: ConstraintVariable,
}

impl RectVariables {
    pub fn new() -> Self {
        Self {
            x: ConstraintVariable::new(),
            y: ConstraintVariable::new(),
            width: ConstraintVariable::new(),
            height: ConstraintVariable::new(),
        }
    }

    /// Expression for right edge: `x + width`.
    pub fn right_expr(&self) -> LinearExpression {
        self.x.to_expr().plus(&self.width.to_expr())
    }

    /// Expression for bottom edge: `y + height`.
    pub fn bottom_expr(&self) -> LinearExpression {
        self.y.to_expr().plus(&self.height.to_expr())
    }
}

impl Default for RectVariables {
    fn default() -> Self {
        Self::new()
    }
}

/// Evaluated physical rectangle produced by the constraint solver.
#[derive(Debug, Clone, Copy, PartialEq)]
pub struct SolvedRect {
    pub x: f32,
    pub y: f32,
    pub width: f32,
    pub height: f32,
}

impl SolvedRect {
    pub fn new(x: f32, y: f32, width: f32, height: f32) -> Self {
        Self {
            x,
            y,
            width,
            height,
        }
    }

    pub fn right(&self) -> f32 {
        self.x + self.width
    }

    pub fn bottom(&self) -> f32 {
        self.y + self.height
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_variable_and_expressions() {
        let v1 = ConstraintVariable::new();
        let v2 = ConstraintVariable::new();
        assert_ne!(v1, v2);

        let e1 = v1.to_expr();
        assert_eq!(e1.terms.len(), 1);
        assert_eq!(e1.terms[0].coefficient, 1.0);
        assert_eq!(e1.constant, 0.0);

        let mut e2 = LinearExpression::from_var(v2);
        e2.add_constant(15.0);
        assert_eq!(e2.constant, 15.0);

        let sum = e1.plus(&e2);
        assert_eq!(sum.terms.len(), 2);
        assert_eq!(sum.constant, 15.0);

        let diff = e1.minus(&e2);
        assert_eq!(diff.terms.len(), 2);
        assert_eq!(diff.terms[1].coefficient, -1.0);
        assert_eq!(diff.constant, -15.0);
    }

    #[test]
    fn test_rect_variables_derived_expressions() {
        let rect = RectVariables::new();
        let right_expr = rect.right_expr();
        assert_eq!(right_expr.terms.len(), 2);
        assert_eq!(right_expr.terms[0].variable, rect.x);
        assert_eq!(right_expr.terms[1].variable, rect.width);

        let bottom_expr = rect.bottom_expr();
        assert_eq!(bottom_expr.terms.len(), 2);
        assert_eq!(bottom_expr.terms[0].variable, rect.y);
        assert_eq!(bottom_expr.terms[1].variable, rect.height);
    }

    #[test]
    fn test_constraint_strength_mapping() {
        assert_eq!(ConstraintStrength::Required.to_cassowary(), cassowary::strength::REQUIRED);
        assert_eq!(ConstraintStrength::Strong.to_cassowary(), cassowary::strength::STRONG);
        assert_eq!(ConstraintStrength::Medium.to_cassowary(), cassowary::strength::MEDIUM);
        assert_eq!(ConstraintStrength::Weak.to_cassowary(), cassowary::strength::WEAK);
    }
}
