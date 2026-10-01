use crate::error::StorageError;
use redb::{Database, ReadableTable, TableDefinition};
use std::path::{Path, PathBuf};
use std::sync::Arc;
use tok_core::model::{DocumentModel, DocumentRoot};
use tok_core::transaction::CompoundTransaction;

const TABLE_METADATA: TableDefinition<&str, &str> = TableDefinition::new("metadata");
const TABLE_PARAGRAPHS: TableDefinition<&str, &str> = TableDefinition::new("paragraphs");
const TABLE_TRANSACTIONS: TableDefinition<u64, &str> = TableDefinition::new("transactions");

/// Embedded transactional workspace for active user sessions.
/// Provides continuous ACID transaction logging and instant crash resilience.
pub struct DocumentWorkspace {
    db: Arc<Database>,
    _db_path: PathBuf,
    _temp_guard: Option<tempfile::TempPath>,
}

impl DocumentWorkspace {
    /// Opens or creates an active workspace database at the given path.
    pub fn open_or_create(path: impl AsRef<Path>) -> Result<Self, StorageError> {
        let p = path.as_ref().to_path_buf();
        if let Some(parent) = p.parent() {
            std::fs::create_dir_all(parent)?;
        }
        let db = Database::create(&p).map_err(|e| StorageError::Database(e.to_string()))?;

        // Initialize tables
        let write_txn = db
            .begin_write()
            .map_err(|e| StorageError::Database(e.to_string()))?;
        {
            let _ = write_txn
                .open_table(TABLE_METADATA)
                .map_err(|e| StorageError::Database(e.to_string()))?;
            let _ = write_txn
                .open_table(TABLE_PARAGRAPHS)
                .map_err(|e| StorageError::Database(e.to_string()))?;
            let _ = write_txn
                .open_table(TABLE_TRANSACTIONS)
                .map_err(|e| StorageError::Database(e.to_string()))?;
        }
        write_txn
            .commit()
            .map_err(|e| StorageError::Database(e.to_string()))?;

        Ok(Self {
            db: Arc::new(db),
            _db_path: p,
            _temp_guard: None,
        })
    }

    /// Creates a transient workspace in a temporary file.
    pub fn create_temporary() -> Result<Self, StorageError> {
        let tmp = tempfile::Builder::new()
            .prefix("tok_workspace_")
            .suffix(".db")
            .tempfile()?;
        let path = tmp.into_temp_path();
        let path_buf = path.to_path_buf();
        let mut ws = Self::open_or_create(path_buf)?;
        ws._temp_guard = Some(path);
        Ok(ws)
    }

    /// Saves a complete snapshot of the DocumentModel atomically.
    pub fn save_snapshot(&self, doc: &DocumentModel) -> Result<(), StorageError> {
        let root = doc.root();
        let root_json = serde_json::to_string(root)?;

        let write_txn = self
            .db
            .begin_write()
            .map_err(|e| StorageError::Database(e.to_string()))?;
        {
            let mut meta_table = write_txn
                .open_table(TABLE_METADATA)
                .map_err(|e| StorageError::Database(e.to_string()))?;
            meta_table
                .insert("doc_root", root_json.as_str())
                .map_err(|e| StorageError::Database(e.to_string()))?;

            // Save individual paragraphs for high-performance sub-queries
            let mut para_table = write_txn
                .open_table(TABLE_PARAGRAPHS)
                .map_err(|e| StorageError::Database(e.to_string()))?;
            for section in &root.sections {
                for flow in &section.flows {
                    for para in &flow.paragraphs {
                        let para_id_str = para.id.to_string();
                        let para_json = serde_json::to_string(para)?;
                        para_table
                            .insert(para_id_str.as_str(), para_json.as_str())
                            .map_err(|e| StorageError::Database(e.to_string()))?;
                    }
                }
            }
        }
        write_txn
            .commit()
            .map_err(|e| StorageError::Database(e.to_string()))?;
        Ok(())
    }

    /// Loads the latest document snapshot from the workspace.
    pub fn load_document(&self) -> Result<DocumentModel, StorageError> {
        let read_txn = self
            .db
            .begin_read()
            .map_err(|e| StorageError::Database(e.to_string()))?;
        let meta_table = read_txn
            .open_table(TABLE_METADATA)
            .map_err(|e| StorageError::Database(e.to_string()))?;

        let root_val = meta_table
            .get("doc_root")
            .map_err(|e| StorageError::Database(e.to_string()))?
            .ok_or_else(|| {
                StorageError::DocumentModel("Document root not found in workspace".into())
            })?;

        let root: DocumentRoot = serde_json::from_str(root_val.value())?;
        Ok(DocumentModel::new(root))
    }

    /// Appends a transactional edit to the persistent WAL log.
    pub fn record_transaction(
        &self,
        tx: &CompoundTransaction,
        tx_index: u64,
    ) -> Result<(), StorageError> {
        let tx_json = serde_json::to_string(tx)?;
        let write_txn = self
            .db
            .begin_write()
            .map_err(|e| StorageError::Database(e.to_string()))?;
        {
            let mut tx_table = write_txn
                .open_table(TABLE_TRANSACTIONS)
                .map_err(|e| StorageError::Database(e.to_string()))?;
            tx_table
                .insert(tx_index, tx_json.as_str())
                .map_err(|e| StorageError::Database(e.to_string()))?;
        }
        write_txn
            .commit()
            .map_err(|e| StorageError::Database(e.to_string()))?;
        Ok(())
    }

    /// Loads the recorded transaction history from the workspace.
    pub fn load_transactions(&self) -> Result<Vec<CompoundTransaction>, StorageError> {
        let read_txn = self
            .db
            .begin_read()
            .map_err(|e| StorageError::Database(e.to_string()))?;
        let tx_table = read_txn
            .open_table(TABLE_TRANSACTIONS)
            .map_err(|e| StorageError::Database(e.to_string()))?;

        let mut txs = Vec::new();
        for item in tx_table
            .iter()
            .map_err(|e| StorageError::Database(e.to_string()))?
        {
            let (_, val) = item.map_err(|e| StorageError::Database(e.to_string()))?;
            let tx: CompoundTransaction = serde_json::from_str(val.value())?;
            txs.push(tx);
        }
        Ok(txs)
    }
}
