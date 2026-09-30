use thiserror::Error;

#[derive(Error, Debug, Clone, PartialEq, Eq)]
pub enum ModelError {
    #[error("Node not found: {0}")]
    NodeNotFound(String),

    #[error("Flow not found: {0}")]
    FlowNotFound(String),

    #[error("Invalid transaction: {0}")]
    InvalidTransaction(String),

    #[error("Invalid range: start anchor is after end anchor")]
    InvalidRange,

    #[error("Undo stack empty")]
    UndoStackEmpty,

    #[error("Redo stack empty")]
    RedoStackEmpty,

    #[error("Serialization error: {0}")]
    SerializationError(String),
}
