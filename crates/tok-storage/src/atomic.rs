//! Crash-safe file replacement shared by `.tok` and `.tokbook` saves.

use crate::error::StorageError;
use std::fs::{self, File};
use std::path::{Path, PathBuf};
use std::time::{SystemTime, UNIX_EPOCH};

/// Writes `dest` atomically: the content goes to a temporary file in the same
/// directory, is flushed to disk, and then replaces `dest` with a single
/// rename. Readers see either the old or the new file, never a partial one,
/// and no other file next to `dest` is touched.
///
/// `write` receives the temporary file and must return it once done (so
/// wrappers such as `ZipWriter` can hand it back after finishing).
pub(crate) fn write_atomic<F>(dest: &Path, write: F) -> Result<(), StorageError>
where
    F: FnOnce(File) -> Result<File, StorageError>,
{
    let parent = match dest.parent() {
        Some(p) if !p.as_os_str().is_empty() => p.to_path_buf(),
        _ => PathBuf::from("."),
    };
    fs::create_dir_all(&parent)?;

    let file_name = dest
        .file_name()
        .and_then(|n| n.to_str())
        .ok_or_else(|| StorageError::AtomicSaveFailed(format!("invalid path {:?}", dest)))?;
    let tmp_path = parent.join(format!(".{}.tmp_{}", file_name, tok_core::id::Ulid::new()));

    let written = File::create(&tmp_path)
        .map_err(StorageError::from)
        .and_then(write)
        .and_then(|file| {
            file.sync_all()?;
            Ok(())
        });
    if let Err(e) = written {
        let _ = fs::remove_file(&tmp_path);
        return Err(e);
    }

    // `fs::rename` replaces an existing destination atomically on every
    // supported platform (MoveFileExW with MOVEFILE_REPLACE_EXISTING on Windows).
    if let Err(e) = fs::rename(&tmp_path, dest) {
        let _ = fs::remove_file(&tmp_path);
        return Err(StorageError::AtomicSaveFailed(e.to_string()));
    }

    // Persist the directory entry too (best effort; not supported on Windows).
    #[cfg(unix)]
    if let Ok(dir) = File::open(&parent) {
        let _ = dir.sync_all();
    }

    Ok(())
}

/// Current UTC time as an RFC 3339 timestamp (`YYYY-MM-DDTHH:MM:SSZ`).
pub(crate) fn utc_timestamp_now() -> String {
    let secs = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_secs())
        .unwrap_or(0);
    format_utc(secs)
}

pub(crate) fn format_utc(secs: u64) -> String {
    let days = (secs / 86_400) as i64;
    let rem = secs % 86_400;
    // Civil-from-days (Howard Hinnant's algorithm).
    let z = days + 719_468;
    let era = z.div_euclid(146_097);
    let doe = z.rem_euclid(146_097);
    let yoe = (doe - doe / 1_460 + doe / 36_524 - doe / 146_096) / 365;
    let doy = doe - (365 * yoe + yoe / 4 - yoe / 100);
    let mp = (5 * doy + 2) / 153;
    let day = doy - (153 * mp + 2) / 5 + 1;
    let month = if mp < 10 { mp + 3 } else { mp - 9 };
    let year = yoe + era * 400 + i64::from(month <= 2);
    format!(
        "{:04}-{:02}-{:02}T{:02}:{:02}:{:02}Z",
        year,
        month,
        day,
        rem / 3_600,
        (rem / 60) % 60,
        rem % 60
    )
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::io::Write;

    #[test]
    fn formats_known_instants() {
        assert_eq!(format_utc(0), "1970-01-01T00:00:00Z");
        assert_eq!(format_utc(951_782_400), "2000-02-29T00:00:00Z");
        assert_eq!(format_utc(1_790_000_000), "2026-09-21T14:13:20Z");
    }

    #[test]
    fn replaces_existing_file_and_cleans_up() {
        let dir = tempfile::tempdir().unwrap();
        let dest = dir.path().join("out.bin");
        for content in [&b"first"[..], b"second"] {
            write_atomic(&dest, |mut f| {
                f.write_all(content)?;
                Ok(f)
            })
            .unwrap();
            assert_eq!(fs::read(&dest).unwrap(), content);
        }
        assert_eq!(fs::read_dir(dir.path()).unwrap().count(), 1);
    }

    #[test]
    fn failed_write_keeps_old_file_and_leaves_no_temp() {
        let dir = tempfile::tempdir().unwrap();
        let dest = dir.path().join("out.bin");
        fs::write(&dest, b"old").unwrap();
        let result = write_atomic(&dest, |_| {
            Err(StorageError::CorruptedPackage("boom".to_string()))
        });
        assert!(result.is_err());
        assert_eq!(fs::read(&dest).unwrap(), b"old");
        assert_eq!(fs::read_dir(dir.path()).unwrap().count(), 1);
    }
}
