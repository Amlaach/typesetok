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
        let order = self.volumes.len() as u32;
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
        let mut current_page = 1u32;

        let mut sorted_vols: Vec<&BookVolumeEntry> = self.volumes.iter().collect();
        sorted_vols.sort_by_key(|v| v.order);

        for vol in sorted_vols {
            if vol.page_count == 0 {
                continue;
            }
            let start = current_page;
            let end = current_page
                .checked_add(vol.page_count)
                .and_then(|sum| sum.checked_sub(1))
                .ok_or_else(|| {
                    StorageError::DocumentModel(format!("Page count overflow in volume {}", vol.id))
                })?;

            ranges.push((vol.id, start, end));
            current_page = end
                .checked_add(1)
                .ok_or_else(|| StorageError::DocumentModel("Page count overflow".into()))?;
        }

        Ok(ranges)
    }

    /// Saves the `.tokbook` project coordinator to disk.
    pub fn save(&self, path: impl AsRef<Path>) -> Result<(), StorageError> {
        let file = File::create(path)?;
        let mut writer = std::io::BufWriter::new(file);
        serde_json::to_writer_pretty(&mut writer, self)?;
        writer.flush()?;
        Ok(())
    }

    /// Opens a `.tokbook` project from disk.
    pub fn open(path: impl AsRef<Path>) -> Result<Self, StorageError> {
        let file = File::open(path)?;
        let reader = std::io::BufReader::new(file);
        let book: Self = serde_json::from_reader(reader)?;
        Ok(book)
    }
}
