use thiserror::Error;

#[derive(Error, Debug)]
pub enum StorageError {
    #[error("I/O error: {0}")]
    Io(#[from] std::io::Error),

    #[error("Serialization error: {0}")]
    Serialization(#[from] serde_json::Error),

    #[error("Zip error: {0}")]
    Zip(#[from] zip::result::ZipError),

    #[error("Database error: {0}")]
    Database(String),

    #[error("Schema version mismatch: expected {expected}, found {found}")]
    SchemaVersionMismatch { expected: String, found: String },

    #[error("Package corrupted or missing required file: {0}")]
    CorruptedPackage(String),

    #[error("Atomic save failed: {0}")]
    AtomicSaveFailed(String),

    #[error("Document model error: {0}")]
    DocumentModel(String),
}
