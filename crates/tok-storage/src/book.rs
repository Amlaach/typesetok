use crate::atomic::write_atomic;
use crate::error::StorageError;
use serde::{Deserialize, Serialize};
use std::fs::File;
use std::io::Write;
use std::path::{Path, PathBuf};
use tok_core::id::Ulid;
use tok_core::styles::ParagraphStyle;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BookVolumeEntry {
    pub id: Ulid,
    pub title: String,
    pub file_path: PathBuf,
    pub page_count: u32,
    pub order: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TocEntry {
    pub title: String,
    pub volume_index: u32,
    pub volume_page: u32,
    pub continuous_page: u32,
    pub hebrew_page_label: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TokBook {
    pub id: Ulid,
    pub title: String,
    pub volumes: Vec<BookVolumeEntry>,
    pub master_styles: Vec<ParagraphStyle>,
}

impl Default for TokBook {
    fn default() -> Self {
        Self::new("ספר חדש")
    }
}

impl TokBook {
    pub fn new(title: impl Into<String>) -> Self {
        Self {
            id: Ulid::new(),
            title: title.into(),
            volumes: Vec::new(),
            master_styles: Vec::new(),
        }
    }

    pub fn add_volume(
        &mut self,
        title: impl Into<String>,
        file_path: impl Into<PathBuf>,
        page_count: u32,
    ) {
        // Append after the highest existing order, even if orders have gaps.
        let order = self
            .volumes
            .iter()
            .map(|v| v.order.saturating_add(1))
            .max()
            .unwrap_or(0);
        self.volumes.push(BookVolumeEntry {
            id: Ulid::new(),
            title: title.into(),
            file_path: file_path.into(),
            page_count,
            order,
        });
    }

    /// Calculates continuous page ranges for each volume in the book.
    /// Returns: Vec<(volume_id, start_page, end_page)>
    pub fn calculate_pagination_ranges(&self) -> Result<Vec<(Ulid, u32, u32)>, StorageError> {
        let mut ranges = Vec::new();
        // `None` once the page numbers are exhausted.
        let mut next_page = Some(1u32);

        let mut sorted_vols: Vec<&BookVolumeEntry> = self.volumes.iter().collect();
        sorted_vols.sort_by_key(|v| v.order);

        for vol in sorted_vols {
            if vol.page_count == 0 {
                continue;
            }
            let overflow =
                || StorageError::DocumentModel(format!("Page count overflow in volume {}", vol.id));
            let start = next_page.ok_or_else(overflow)?;
            let end = start.checked_add(vol.page_count - 1).ok_or_else(overflow)?;
            ranges.push((vol.id, start, end));
            next_page = end.checked_add(1);
        }

        Ok(ranges)
    }

    /// Saves the `.tokbook` project coordinator to disk atomically.
    pub fn save(&self, path: impl AsRef<Path>) -> Result<(), StorageError> {
        write_atomic(path.as_ref(), |file| {
            let mut writer = std::io::BufWriter::new(file);
            serde_json::to_writer_pretty(&mut writer, self)?;
            writer.flush()?;
            writer.into_inner().map_err(|e| e.into_error().into())
        })
    }

    /// Opens a `.tokbook` project from disk.
    pub fn open(path: impl AsRef<Path>) -> Result<Self, StorageError> {
        let file = File::open(path)?;
        let reader = std::io::BufReader::new(file);
        let book: Self = serde_json::from_reader(reader)?;
        Ok(book)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn page_ranges_up_to_u32_max() {
        let mut book = TokBook::new("big");
        book.add_volume("a", "a.tok", u32::MAX);
        let ranges = book.calculate_pagination_ranges().unwrap();
        assert_eq!((ranges[0].1, ranges[0].2), (1, u32::MAX));

        book.add_volume("b", "b.tok", 1);
        assert!(book.calculate_pagination_ranges().is_err());

        let mut book = TokBook::new("edge");
        book.add_volume("a", "a.tok", u32::MAX - 1);
        book.add_volume("b", "b.tok", 1);
        let ranges = book.calculate_pagination_ranges().unwrap();
        assert_eq!((ranges[1].1, ranges[1].2), (u32::MAX, u32::MAX));
    }

    #[test]
    fn add_volume_after_reordering_keeps_orders_unique() {
        let mut book = TokBook::new("b");
        book.add_volume("a", "a.tok", 1);
        book.add_volume("b", "b.tok", 1);
        book.volumes.remove(0);
        book.add_volume("c", "c.tok", 1);
        let orders: Vec<u32> = book.volumes.iter().map(|v| v.order).collect();
        assert_eq!(orders, vec![1, 2]);
    }

    #[test]
    fn save_replaces_existing_book() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("set.tokbook");
        TokBook::new("one").save(&path).unwrap();
        TokBook::new("two").save(&path).unwrap();
        assert_eq!(TokBook::open(&path).unwrap().title, "two");
        assert_eq!(std::fs::read_dir(dir.path()).unwrap().count(), 1);
    }
}
