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

    /// Validates the schema version a serialized `DocumentRoot` declares and
    /// returns the JSON ready for deserialization.
    ///
    /// The version lives in `metadata.schema_version` (a top-level
    /// `schema_version` is accepted for older files) and may be written as
    /// `major.minor` ("1.0"). Upgrade steps for older field layouts follow.
    pub fn migrate_document_json(
        mut json_val: serde_json::Value,
    ) -> Result<serde_json::Value, StorageError> {
        let declared = json_val
            .pointer("/metadata/schema_version")
            .or_else(|| json_val.get("schema_version"))
            .and_then(|v| v.as_str())
            .unwrap_or(CURRENT_SCHEMA_VERSION);

        Self::validate_version(&Self::normalize_version(declared))?;
        Self::bold_to_font_weight(&mut json_val);
        Ok(json_val)
    }

    /// Paragraph styles briefly stored `"bold": bool`; they now store
    /// `"font_weight": 400 | 700`. An explicit `font_weight` wins.
    fn bold_to_font_weight(json_val: &mut serde_json::Value) {
        let Some(styles) = json_val
            .get_mut("paragraph_styles")
            .and_then(|s| s.as_array_mut())
        else {
            return;
        };
        for style in styles.iter_mut().filter_map(|s| s.as_object_mut()) {
            let Some(bold) = style.remove("bold") else {
                continue;
            };
            if !style.contains_key("font_weight") {
                let weight = if bold.as_bool() == Some(true) {
                    700
                } else {
                    400
                };
                style.insert("font_weight".to_string(), serde_json::json!(weight));
            }
        }
    }

    /// "1" -> "1.0.0", "1.0" -> "1.0.0"; anything else is returned unchanged.
    fn normalize_version(v: &str) -> String {
        match v.split('.').count() {
            1 => format!("{v}.0.0"),
            2 => format!("{v}.0"),
            _ => v.to_string(),
        }
    }

    fn parse_semver(v: &str) -> Result<(u32, u32, u32), StorageError> {
        let parts: Vec<&str> = v.split('.').collect();
        if parts.len() != 3 {
            return Err(StorageError::SchemaVersionMismatch {
                expected: "x.y.z format".to_string(),
                found: v.to_string(),
            });
        }
        let major = parts[0]
            .parse()
            .map_err(|_| StorageError::SchemaVersionMismatch {
                expected: "valid integer".to_string(),
                found: parts[0].to_string(),
            })?;
        let minor = parts[1]
            .parse()
            .map_err(|_| StorageError::SchemaVersionMismatch {
                expected: "valid integer".to_string(),
                found: parts[1].to_string(),
            })?;
        let patch = parts[2]
            .parse()
            .map_err(|_| StorageError::SchemaVersionMismatch {
                expected: "valid integer".to_string(),
                found: parts[2].to_string(),
            })?;
        Ok((major, minor, patch))
    }
}
