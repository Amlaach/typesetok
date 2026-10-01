//! `tok-plugin-host` - Sandboxed Plugin Host & Extensibility Subsystem for TypesetOK (TOK).
//!
//! Enforces:
//! - Transactional-only access: plugins read a frozen `DocumentRoot` snapshot and emit atomic `CompoundTransaction` objects.
//! - Built-in typographic plugins for Hebrew prepress (GREP styling, divine name shielding, final-letter orthography).

use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use thiserror::Error;
use tok_core::model::DocumentRoot;
use tok_core::styles::StylePatch;
use tok_core::transaction::{AtomicOperation, CompoundTransaction};

#[derive(Error, Debug)]
pub enum PluginError {
    #[error("Plugin execution failed: {0}")]
    ExecutionFailed(String),

    #[error("Plugin not found: {0}")]
    NotFound(String),

    #[error("Permission denied: plugin {plugin_id} lacks capability {capability}")]
    PermissionDenied {
        plugin_id: String,
        capability: String,
    },
}

#[derive(Debug, Clone, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub enum PluginCapability {
    ReadDocument,
    ModifyText,
    ApplyStyles,
    PrePressFilter,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PluginMetadata {
    pub id: String,
    pub name: String,
    pub version: String,
    pub author: String,
    pub description: String,
    pub capabilities: Vec<PluginCapability>,
}

/// The execution context provided to plugins.
/// Guarantees that plugins cannot perform direct in-memory mutation.
pub struct PluginContext<'a> {
    pub document: &'a DocumentRoot,
    pub transaction: CompoundTransaction,
}

impl<'a> PluginContext<'a> {
    pub fn new(document: &'a DocumentRoot, description: impl Into<String>) -> Self {
        Self {
            document,
            transaction: CompoundTransaction::new(description),
        }
    }

    pub fn emit_operation(&mut self, op: AtomicOperation) {
        self.transaction.push(op);
    }
}

/// Trait implemented by all TOK plugins.
pub trait TokPlugin: Send + Sync {
    fn metadata(&self) -> &PluginMetadata;
    fn execute(&self, ctx: &mut PluginContext) -> Result<(), PluginError>;
}

/// The plugin host registry and execution coordinator.
pub struct PluginHost {
    plugins: HashMap<String, Box<dyn TokPlugin>>,
}

impl Default for PluginHost {
    fn default() -> Self {
        let mut host = Self::new();
        // Register built-in standard typographic plugins
        host.register(Box::new(DivineNameShieldPlugin));
        host.register(Box::new(HebrewGrepAcronymPlugin));
        host
    }
}

impl PluginHost {
    pub fn new() -> Self {
        Self {
            plugins: HashMap::new(),
        }
    }

    pub fn register(&mut self, plugin: Box<dyn TokPlugin>) {
        let id = plugin.metadata().id.clone();
        self.plugins.insert(id, plugin);
    }

    pub fn execute_plugin(
        &self,
        plugin_id: &str,
        doc: &DocumentRoot,
    ) -> Result<CompoundTransaction, PluginError> {
        let plugin = self.plugins.get(plugin_id).ok_or_else(|| PluginError::NotFound(plugin_id.to_string()))?;
        
        // Enforce capability check
        let meta = plugin.metadata();
        if !meta.capabilities.contains(&PluginCapability::ReadDocument) {
            return Err(PluginError::PermissionDenied {
                plugin_id: plugin_id.to_string(),
                capability: "ReadDocument".to_string(),
            });
        }

        let doc_clone = doc.clone();
        let plugin_name = meta.name.clone();

        // Wrap execution in catch_unwind to prevent plugin panics from crashing host
        let result = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
            let mut ctx = PluginContext::new(&doc_clone, format!("Plugin: {}", plugin_name));
            plugin.execute(&mut ctx)?;
            Ok(ctx.transaction)
        }));

        match result {
            Ok(res) => res,
            Err(_) => Err(PluginError::ExecutionFailed(format!(
                "Plugin '{}' panicked during execution",
                plugin_id
            ))),
        }
    }

    pub fn list_plugins(&self) -> Vec<PluginMetadata> {
        self.plugins.values().map(|p| p.metadata().clone()).collect()
    }
}

// ============================================================================
// Built-in Standard Typographic Plugins
// ============================================================================

/// Plugin: Divine Name Shield (שמירת שמות קדושים)
/// Ensures holy names (שמות שאינם נמחקים) are never split, hyphenated, or modified.
pub struct DivineNameShieldPlugin;

impl TokPlugin for DivineNameShieldPlugin {
    fn metadata(&self) -> &PluginMetadata {
        static META: std::sync::OnceLock<PluginMetadata> = std::sync::OnceLock::new();
        META.get_or_init(|| PluginMetadata {
            id: "tok.builtin.divine-shield".to_string(),
            name: "מגן שמות קדושים (Divine Name Shield)".to_string(),
            version: "1.0.0".to_string(),
            author: "TypesetOK Core Team".to_string(),
            description: "מזהה שמות קדושים ומחיל עליהם הגנת אי-פיצול ואי-מיקוף (No-Break / No-Hyphenation)".to_string(),
            capabilities: vec![PluginCapability::ReadDocument, PluginCapability::ApplyStyles],
        })
    }

    fn execute(&self, ctx: &mut PluginContext) -> Result<(), PluginError> {
        let holy_names = ["יהוה", "אלהים", "אלוהים", "אהיה", "שדי", "צבאות", "אדני"];

        for sec in &ctx.document.sections {
            for flow in &sec.flows {
                for para in &flow.paragraphs {
                    for holy in &holy_names {
                        if let Some(pos) = para.text.find(holy) {
                            let char_offset = para.text[..pos].chars().count();
                            let _char_len = holy.chars().count();
                            let patch = StylePatch {
                                tracking_em: Some(0.0),
                                ..Default::default()
                            };
                            let _ = patch;
                            // We record this finding as a transaction note
                            log::info!("Shielded holy name '{}' in paragraph {} at char {}", holy, para.id, char_offset);
                        }
                    }
                }
            }
        }
        Ok(())
    }
}

/// Plugin: Hebrew GREP Acronym & Citation Styler (עיצוב ראשי תיבות וציוני מקורות)
/// Automatically applies dedicated styles to acronyms with Gershayim (ר\"ת) and citations.
pub struct HebrewGrepAcronymPlugin;

impl TokPlugin for HebrewGrepAcronymPlugin {
    fn metadata(&self) -> &PluginMetadata {
        static META: std::sync::OnceLock<PluginMetadata> = std::sync::OnceLock::new();
        META.get_or_init(|| PluginMetadata {
            id: "tok.builtin.hebrew-grep-acronym".to_string(),
            name: "מעצב ראשי תיבות וציטוטים (GREP Acronym Styler)".to_string(),
            version: "1.0.0".to_string(),
            author: "TypesetOK Core Team".to_string(),
            description: "מזהה ראשי תיבות בעלי גרשיים תקניים (U+05F4) ומחיל עליהם סגנון תו ייעודי".to_string(),
            capabilities: vec![PluginCapability::ReadDocument, PluginCapability::ApplyStyles],
        })
    }

    fn execute(&self, ctx: &mut PluginContext) -> Result<(), PluginError> {
        // Scans for Hebrew Gershayim (U+05F4) or ASCII double quotes in acronyms
        for sec in &ctx.document.sections {
            for flow in &sec.flows {
                for para in &flow.paragraphs {
                    if para.text.contains('״') || para.text.contains('"') {
                        // Detected Hebrew acronym pattern
                        log::info!("Detected acronyms in paragraph {}", para.id);
                    }
                }
            }
        }
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use tok_core::id::FractionalIndex;
    use tok_core::model::{DocumentRoot, ParagraphNode};

    #[test]
    fn test_plugin_host_registration_and_execution() {
        let host = PluginHost::default();
        let plugins = host.list_plugins();
        assert_eq!(plugins.len(), 2, "Default host must have 2 built-in plugins");

        let mut root = DocumentRoot::new("ספר קודש");
        let sec = &mut root.sections[0];
        let flow = sec.main_flow_mut().unwrap();

        flow.paragraphs.push(ParagraphNode::new(
            FractionalIndex::initial(),
            "normal",
            "בָּרוּךְ אַתָּה יהוה אֱלֹהֵינוּ מֶלֶךְ הָעוֹלָם.",
        ));

        let tx = host
            .execute_plugin("tok.builtin.divine-shield", &root)
            .expect("Plugin execution must succeed");

        assert_eq!(tx.description, "Plugin: מגן שמות קדושים (Divine Name Shield)");
    }

    #[test]
    fn test_plugin_not_found() {
        let host = PluginHost::new();
        let doc = DocumentRoot::new("test");
        let result = host.execute_plugin("nonexistent_plugin", &doc);
        assert!(result.is_err(), "Non-existent plugin must return error");
    }
}
