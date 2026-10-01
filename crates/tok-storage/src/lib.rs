//! `tok-storage` - Professional Storage Engine for TypesetOK (TOK).
//!
//! Provides:
//! - `DocumentWorkspace`: ACID transactional workspace with redb and continuous transaction logging.
//! - `TokPackage`: Official `.tok` ZIP archive container with atomic safe-save.
//! - `TokBook`: Multi-document coordinator for complex multi-volume holy books.
//! - `MigrationPipeline`: Forward/backward schema compatibility.

pub mod book;
pub mod error;
pub mod migration;
pub mod package;
pub mod workspace;

pub use book::{BookVolumeEntry, TocEntry, TokBook};
pub use error::StorageError;
pub use migration::{MigrationPipeline, CURRENT_SCHEMA_VERSION};
pub use package::{TokManifest, TokPackage};
pub use workspace::DocumentWorkspace;

#[cfg(test)]
mod tests {
    use super::*;
    use tok_core::id::FractionalIndex;
    use tok_core::model::{DocumentModel, DocumentRoot, ParagraphNode};
    use tok_core::transaction::{AtomicOperation, CompoundTransaction};

    fn create_test_document() -> DocumentModel {
        let mut root = DocumentRoot::new("מסכת ברכות");
        let sec = &mut root.sections[0];
        let flow = sec.main_flow_mut().unwrap();

        let idx1 = FractionalIndex::initial();
        let idx2 = FractionalIndex::between(Some(&idx1), None).unwrap();

        flow.paragraphs.push(ParagraphNode::new(
            idx1,
            "normal",
            "מֵאֵימָתַי קוֹרִין אֶת שְׁמַע בְּעַרְבִית?",
        ));
        flow.paragraphs.push(ParagraphNode::new(
            idx2,
            "normal",
            "מִשָּׁעָה שֶׁהַכֹּהֲנִים נִכְנָסִים לֶאֱכֹל בִּתְרוּמָתָן.",
        ));

        DocumentModel::new(root)
    }

    #[test]
    fn test_tok_package_atomic_save_and_open() {
        let doc = create_test_document();
        let tmp_dir = tempfile::tempdir().unwrap();
        let tok_path = tmp_dir.path().join("berakhot.tok");

        let mut package = TokPackage::new();
        package.add_asset("cover.svg", b"<svg>test</svg>".to_vec());
        package.add_preview(1, b"fake_png_data".to_vec());

        // 1. Save atomically
        package.save_atomic(&doc, &tok_path).expect("Safe save must succeed");
        assert!(tok_path.exists(), "The .tok file must exist on disk");

        // 2. Open and verify contents
        let (loaded_doc, loaded_pkg) = TokPackage::open(&tok_path).expect("Package open must succeed");
        assert_eq!(loaded_doc.root().metadata.title, "מסכת ברכות");
        assert_eq!(loaded_doc.root().sections[0].main_flow().unwrap().paragraphs.len(), 2);

        // Verify embedded assets and previews
        assert_eq!(loaded_pkg.assets.get("cover.svg").unwrap(), b"<svg>test</svg>");
        assert_eq!(loaded_pkg.previews.get("page_1.png").unwrap(), b"fake_png_data");
    }

    #[test]
    fn test_workspace_acid_transactions() {
        let doc = create_test_document();
        let workspace = DocumentWorkspace::create_temporary().expect("Workspace creation must succeed");

        // Save snapshot
        workspace.save_snapshot(&doc).expect("Snapshot must save");

        // Load document
        let loaded = workspace.load_document().expect("Load document must succeed");
        assert_eq!(loaded.root().metadata.title, "מסכת ברכות");

        // Record transaction
        let mut tx = CompoundTransaction::new("הוספת מילה");
        tx.push(AtomicOperation::InsertText {
            node_id: tok_core::id::NodeId::new(),
            char_offset: 0,
            text: "תוספת".to_string(),
        });

        workspace.record_transaction(&tx, 1).expect("Transaction record must succeed");
        let txs = workspace.load_transactions().expect("Transactions must load");
        assert_eq!(txs.len(), 1);
        assert_eq!(txs[0].description, "הוספת מילה");
    }

    #[test]
    fn test_tok_book_pagination_coordination() {
        let mut book = TokBook::new("ש\"ס בבלי");
        book.add_volume("ברכות", "berakhot.tok", 64);
        book.add_volume("שבת", "shabbat.tok", 157);
        book.add_volume("עירובין", "eruvin.tok", 105);

        let ranges = book.calculate_pagination_ranges().expect("Pagination must succeed");
        assert_eq!(ranges.len(), 3);
        // Vol 1: pages 1 to 64
        assert_eq!(ranges[0].1, 1);
        assert_eq!(ranges[0].2, 64);
        // Vol 2: pages 65 to 221
        assert_eq!(ranges[1].1, 65);
        assert_eq!(ranges[1].2, 221);
        // Vol 3: pages 222 to 326
        assert_eq!(ranges[2].1, 222);
        assert_eq!(ranges[2].2, 326);
    }

    #[test]
    fn test_book_zero_page_volume() {
        let mut book = TokBook::new("Test Book");
        book.add_volume("Vol1", "vol1.tok", 10);
        book.add_volume("Empty", "empty.tok", 0); // 0-page volume
        book.add_volume("Vol3", "vol3.tok", 20);
        
        let ranges = book.calculate_pagination_ranges().expect("Must succeed");
        // Empty volume should be skipped
        assert_eq!(ranges.len(), 2, "0-page volume should be skipped");
        assert_eq!(ranges[0].1, 1);
        assert_eq!(ranges[0].2, 10);
        assert_eq!(ranges[1].1, 11);
        assert_eq!(ranges[1].2, 30);
    }

    #[test]
    fn test_book_save_load_roundtrip() {
        let tmp_dir = tempfile::tempdir().unwrap();
        let book_path = tmp_dir.path().join("test.tokbook");
        
        let mut book = TokBook::new("Test Book");
        book.add_volume("Vol 1", "v1.tok", 50);
        book.save(&book_path).expect("Save must succeed");
        
        let loaded = TokBook::open(&book_path).expect("Open must succeed");
        assert_eq!(loaded.title, "Test Book");
        assert_eq!(loaded.volumes.len(), 1);
        assert_eq!(loaded.volumes[0].title, "Vol 1");
    }

    #[test]
    fn test_migration_invalid_version() {
        let result = MigrationPipeline::validate_version("invalid");
        assert!(result.is_err(), "Invalid version string must return error");
    }

    #[test]
    fn test_migration_future_major_version() {
        let result = MigrationPipeline::validate_version("2.0.0");
        assert!(result.is_err(), "Future major version must be rejected");
    }
}
