use crate::error::StorageError;
use redb::{Database, ReadableTable, TableDefinition};
use std::path::{Path, PathBuf};
use std::sync::Arc;
use tok_core::id::NodeId;
use tok_core::model::{DocumentModel, DocumentRoot, ParagraphNode};
use tok_core::transaction::CompoundTransaction;

const TABLE_METADATA: TableDefinition<&str, &str> = TableDefinition::new("metadata");
const TABLE_PARAGRAPHS: TableDefinition<&str, &str> = TableDefinition::new("paragraphs");
const TABLE_TRANSACTIONS: TableDefinition<u64, &str> = TableDefinition::new("transactions");

fn db_err(e: impl std::fmt::Display) -> StorageError {
    StorageError::Database(e.to_string())
}

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
        if let Some(parent) = p.parent().filter(|p| !p.as_os_str().is_empty()) {
            std::fs::create_dir_all(parent)?;
        }
        let db = Database::create(&p).map_err(db_err)?;

        // Initialize tables
        let write_txn = db.begin_write().map_err(db_err)?;
        {
            write_txn.open_table(TABLE_METADATA).map_err(db_err)?;
            write_txn.open_table(TABLE_PARAGRAPHS).map_err(db_err)?;
            write_txn.open_table(TABLE_TRANSACTIONS).map_err(db_err)?;
        }
        write_txn.commit().map_err(db_err)?;

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

        let write_txn = self.db.begin_write().map_err(db_err)?;
        {
            let mut meta_table = write_txn.open_table(TABLE_METADATA).map_err(db_err)?;
            meta_table
                .insert("doc_root", root_json.as_str())
                .map_err(db_err)?;

            // The paragraph index mirrors exactly this snapshot: drop rows of
            // paragraphs that no longer exist before re-inserting.
            write_txn.delete_table(TABLE_PARAGRAPHS).map_err(db_err)?;
            let mut para_table = write_txn.open_table(TABLE_PARAGRAPHS).map_err(db_err)?;
            for para in root
                .sections
                .iter()
                .flat_map(|s| &s.flows)
                .flat_map(|f| &f.paragraphs)
            {
                let para_id_str = para.id.to_string();
                let para_json = serde_json::to_string(para)?;
                para_table
                    .insert(para_id_str.as_str(), para_json.as_str())
                    .map_err(db_err)?;
            }
        }
        write_txn.commit().map_err(db_err)?;
        Ok(())
    }

    /// Loads the latest document snapshot from the workspace.
    pub fn load_document(&self) -> Result<DocumentModel, StorageError> {
        let read_txn = self.db.begin_read().map_err(db_err)?;
        let meta_table = read_txn.open_table(TABLE_METADATA).map_err(db_err)?;

        let root_val = meta_table.get("doc_root").map_err(db_err)?.ok_or_else(|| {
            StorageError::DocumentModel("Document root not found in workspace".into())
        })?;

        let root: DocumentRoot = serde_json::from_str(root_val.value())?;
        Ok(DocumentModel::new(root))
    }

    /// Loads a single paragraph of the latest snapshot without parsing the
    /// whole document.
    pub fn load_paragraph(&self, id: NodeId) -> Result<Option<ParagraphNode>, StorageError> {
        let read_txn = self.db.begin_read().map_err(db_err)?;
        let table = read_txn.open_table(TABLE_PARAGRAPHS).map_err(db_err)?;
        let key = id.to_string();
        match table.get(key.as_str()).map_err(db_err)? {
            Some(json) => Ok(Some(serde_json::from_str(json.value())?)),
            None => Ok(None),
        }
    }

    /// Appends a transactional edit to the persistent WAL log.
    pub fn record_transaction(
        &self,
        tx: &CompoundTransaction,
        tx_index: u64,
    ) -> Result<(), StorageError> {
        let tx_json = serde_json::to_string(tx)?;
        let write_txn = self.db.begin_write().map_err(db_err)?;
        {
            let mut tx_table = write_txn.open_table(TABLE_TRANSACTIONS).map_err(db_err)?;
            tx_table
                .insert(tx_index, tx_json.as_str())
                .map_err(db_err)?;
        }
        write_txn.commit().map_err(db_err)?;
        Ok(())
    }

    /// Loads the recorded transaction history from the workspace, in index order.
    pub fn load_transactions(&self) -> Result<Vec<CompoundTransaction>, StorageError> {
        let read_txn = self.db.begin_read().map_err(db_err)?;
        let tx_table = read_txn.open_table(TABLE_TRANSACTIONS).map_err(db_err)?;

        let mut txs = Vec::new();
        for item in tx_table.iter().map_err(db_err)? {
            let (_, val) = item.map_err(db_err)?;
            let tx: CompoundTransaction = serde_json::from_str(val.value())?;
            txs.push(tx);
        }
        Ok(txs)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use tok_core::id::FractionalIndex;

    /// Regression: deleted paragraphs stayed in the paragraph table forever.
    #[test]
    fn snapshot_drops_deleted_paragraphs() {
        let ws = DocumentWorkspace::create_temporary().unwrap();
        let mut root = DocumentRoot::new("t");
        let flow = root.sections[0].main_flow_mut().unwrap();
        let keep = ParagraphNode::new(FractionalIndex::new("a"), "x", "נשאר");
        let gone = ParagraphNode::new(FractionalIndex::new("b"), "x", "נמחק");
        let (keep_id, gone_id) = (keep.id, gone.id);
        flow.add_paragraph(keep);
        flow.add_paragraph(gone);
        ws.save_snapshot(&DocumentModel::new(root.clone())).unwrap();
        assert!(ws.load_paragraph(gone_id).unwrap().is_some());

        root.sections[0].flows[0]
            .paragraphs
            .retain(|p| p.id != gone_id);
        ws.save_snapshot(&DocumentModel::new(root)).unwrap();
        assert!(ws.load_paragraph(gone_id).unwrap().is_none());
        assert_eq!(ws.load_paragraph(keep_id).unwrap().unwrap().text, "נשאר");
    }

    #[test]
    fn load_document_from_empty_workspace_is_an_error() {
        let ws = DocumentWorkspace::create_temporary().unwrap();
        assert!(ws.load_document().is_err());
        assert!(ws.load_transactions().unwrap().is_empty());
    }
}
