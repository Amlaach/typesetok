use crate::error::StorageError;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;

pub const CURRENT_SCHEMA_VERSION: &str = "1.0.0";

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SchemaMetadata {
    pub schema_version: String,
    pub min_compatible_version: String,
    #[serde(default)]
    pub unrecognized_extensions: HashMap<String, serde_json::Value>,
}

impl Default for SchemaMetadata {
    fn default() -> Self {
        Self {
            schema_version: CURRENT_SCHEMA_VERSION.to_string(),
            min_compatible_version: "1.0.0".to_string(),
            unrecognized_extensions: HashMap::new(),
        }
    }
}

pub struct MigrationPipeline;

impl MigrationPipeline {
    pub fn validate_version(version: &str) -> Result<(), StorageError> {
        let (major, _, _) = Self::parse_semver(version)?;
        let (cur_major, _, _) = Self::parse_semver(CURRENT_SCHEMA_VERSION)?;

        if major > cur_major {
            return Err(StorageError::SchemaVersionMismatch {
                expected: CURRENT_SCHEMA_VERSION.to_string(),
                found: version.to_string(),
            });
        }
        Ok(())
    }

    pub fn migrate_document_json(mut json_val: serde_json::Value) -> Result<serde_json::Value, StorageError> {
        let version_str = json_val
            .get("schema_version")
            .and_then(|v| v.as_str())
            .unwrap_or("1.0.0");

        Self::validate_version(version_str)?;

        // If from older future migrations (e.g. 0.9.0 -> 1.0.0), apply steps here.
        if version_str != CURRENT_SCHEMA_VERSION {
            if let Some(obj) = json_val.as_object_mut() {
                obj.insert("schema_version".to_string(), serde_json::json!(CURRENT_SCHEMA_VERSION));
            }
        }

        Ok(json_val)
    }

    fn parse_semver(v: &str) -> Result<(u32, u32, u32), StorageError> {
        let parts: Vec<&str> = v.split('.').collect();
        if parts.len() < 3 {
            return Err(StorageError::SchemaVersionMismatch {
                expected: "x.y.z format".to_string(),
                found: v.to_string(),
            });
        }
        let major = parts[0].parse().map_err(|_| StorageError::SchemaVersionMismatch {
            expected: "valid integer".to_string(),
            found: parts[0].to_string(),
        })?;
        let minor = parts[1].parse().map_err(|_| StorageError::SchemaVersionMismatch {
            expected: "valid integer".to_string(),
            found: parts[1].to_string(),
        })?;
        let patch = parts[2].parse().map_err(|_| StorageError::SchemaVersionMismatch {
            expected: "valid integer".to_string(),
            found: parts[2].to_string(),
        })?;
        Ok((major, minor, patch))
    }
}
