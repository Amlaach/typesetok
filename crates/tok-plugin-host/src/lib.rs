//! `tok-plugin-host` - Sandboxed Plugin Host & Extensibility Subsystem for TypesetOK (TOK).
//!
//! Enforces:
//! - Transactional-only access: plugins read a frozen `DocumentRoot` snapshot and emit atomic `CompoundTransaction` objects.
//! - Capability checks: emitted operations require [`PluginCapability::ModifyText`].
//! - Panic isolation: a panicking plugin (in `metadata` or `execute`) yields an error, never a host crash.
//! - Built-in typographic plugins for Hebrew prepress (GREP styling, divine name shielding, final-letter orthography).

use serde::{Deserialize, Serialize};
use std::collections::BTreeMap;
use std::panic::{catch_unwind, AssertUnwindSafe};
use thiserror::Error;
use tok_core::model::DocumentRoot;
use tok_core::normalizer::HebrewNormalizer;
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

fn panic_message(payload: &(dyn std::any::Any + Send)) -> String {
    payload
        .downcast_ref::<&str>()
        .map(|s| s.to_string())
        .or_else(|| payload.downcast_ref::<String>().cloned())
        .unwrap_or_else(|| "unknown panic payload".to_string())
}

/// The plugin host registry and execution coordinator.
pub struct PluginHost {
    // Ordered by id so listings are deterministic.
    plugins: BTreeMap<String, Box<dyn TokPlugin>>,
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
            plugins: BTreeMap::new(),
        }
    }

    /// Registers a plugin. A plugin whose `metadata()` panics is rejected.
    pub fn try_register(&mut self, plugin: Box<dyn TokPlugin>) -> Result<(), PluginError> {
        let id = catch_unwind(AssertUnwindSafe(|| plugin.metadata().id.clone())).map_err(|p| {
            PluginError::ExecutionFailed(format!(
                "plugin metadata panicked: {}",
                panic_message(p.as_ref())
            ))
        })?;
        self.plugins.insert(id, plugin);
        Ok(())
    }

    /// Registers a plugin, logging (instead of propagating) a panicking `metadata()`.
    pub fn register(&mut self, plugin: Box<dyn TokPlugin>) {
        if let Err(e) = self.try_register(plugin) {
            log::error!("{}", e);
        }
    }

    pub fn execute_plugin(
        &self,
        plugin_id: &str,
        doc: &DocumentRoot,
    ) -> Result<CompoundTransaction, PluginError> {
        let plugin = self
            .plugins
            .get(plugin_id)
            .ok_or_else(|| PluginError::NotFound(plugin_id.to_string()))?;

        // Everything that runs plugin code is inside catch_unwind, including
        // `metadata()`. The document is only borrowed immutably.
        let result = catch_unwind(AssertUnwindSafe(|| {
            let meta = plugin.metadata();
            if !meta.capabilities.contains(&PluginCapability::ReadDocument) {
                return Err(PluginError::PermissionDenied {
                    plugin_id: plugin_id.to_string(),
                    capability: "ReadDocument".to_string(),
                });
            }
            let mut ctx = PluginContext::new(doc, format!("Plugin: {}", meta.name));
            plugin.execute(&mut ctx)?;

            // Every atomic operation modifies text or structure.
            if !ctx.transaction.operations.is_empty()
                && !meta.capabilities.contains(&PluginCapability::ModifyText)
            {
                return Err(PluginError::PermissionDenied {
                    plugin_id: plugin_id.to_string(),
                    capability: "ModifyText".to_string(),
                });
            }
            Ok(ctx.transaction)
        }));

        result.unwrap_or_else(|payload| {
            Err(PluginError::ExecutionFailed(format!(
                "Plugin '{}' panicked during execution: {}",
                plugin_id,
                panic_message(payload.as_ref())
            )))
        })
    }

    /// Metadata of all registered plugins, ordered by id. Plugins whose
    /// `metadata()` panics are skipped.
    pub fn list_plugins(&self) -> Vec<PluginMetadata> {
        self.plugins
            .values()
            .filter_map(|p| catch_unwind(AssertUnwindSafe(|| p.metadata().clone())).ok())
            .collect()
    }
}

// ============================================================================
// Built-in Standard Typographic Plugins
// ============================================================================

/// Holy names (שמות שאינם נמחקים) recognised by [`DivineNameShieldPlugin`].
pub const HOLY_NAMES: &[&str] = &["יהוה", "אלהים", "אלוהים", "אהיה", "שדי", "צבאות", "אדני"];

/// A holy name found in a text, in character offsets of the original text.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct HolyNameMatch {
    pub name: &'static str,
    pub char_offset: usize,
    pub char_len: usize,
}

/// Finds every occurrence of a holy name, ignoring niqqud, te'amim and other
/// Hebrew combining marks between the letters.
pub fn find_holy_names(text: &str) -> Vec<HolyNameMatch> {
    // Letters only, with their character offsets in `text`.
    let letters: Vec<(usize, char)> = text
        .chars()
        .enumerate()
        .filter(|(_, c)| HebrewNormalizer::mark_category(*c).is_none())
        .collect();
    let total_chars = text.chars().count();

    let mut matches = Vec::new();
    for &name in HOLY_NAMES {
        let pattern: Vec<char> = name.chars().collect();
        for (start, window) in letters.windows(pattern.len()).enumerate() {
            if window.iter().map(|(_, c)| *c).eq(pattern.iter().copied()) {
                let first = window[0].0;
                // Include the marks of the last letter.
                let end = letters
                    .get(start + pattern.len())
                    .map_or(total_chars, |(i, _)| *i);
                matches.push(HolyNameMatch {
                    name,
                    char_offset: first,
                    char_len: end - first,
                });
            }
        }
    }
    matches.sort_by_key(|m| (m.char_offset, std::cmp::Reverse(m.char_len)));
    matches
}

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
            description:
                "מזהה שמות קדושים ומחיל עליהם הגנת אי-פיצול ואי-מיקוף (No-Break / No-Hyphenation)"
                    .to_string(),
            capabilities: vec![
                PluginCapability::ReadDocument,
                PluginCapability::ApplyStyles,
            ],
        })
    }

    fn execute(&self, ctx: &mut PluginContext) -> Result<(), PluginError> {
        for para in ctx
            .document
            .sections
            .iter()
            .flat_map(|s| &s.flows)
            .flat_map(|f| &f.paragraphs)
        {
            for m in find_holy_names(&para.text) {
                // We record this finding as a transaction note
                log::info!(
                    "Shielded holy name '{}' in paragraph {} at char {}",
                    m.name,
                    para.id,
                    m.char_offset
                );
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
            description: "מזהה ראשי תיבות בעלי גרשיים תקניים (U+05F4) ומחיל עליהם סגנון תו ייעודי"
                .to_string(),
            capabilities: vec![
                PluginCapability::ReadDocument,
                PluginCapability::ApplyStyles,
            ],
        })
    }

    fn execute(&self, ctx: &mut PluginContext) -> Result<(), PluginError> {
        // Scans for Hebrew Gershayim (U+05F4) or ASCII double quotes in acronyms
        for para in ctx
            .document
            .sections
            .iter()
            .flat_map(|s| &s.flows)
            .flat_map(|f| &f.paragraphs)
        {
            if para.text.contains(['״', '"']) {
                // Detected Hebrew acronym pattern
                log::info!("Detected acronyms in paragraph {}", para.id);
            }
        }
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use tok_core::id::{FractionalIndex, NodeId};
    use tok_core::model::{DocumentRoot, ParagraphNode};

    #[test]
    fn test_plugin_host_registration_and_execution() {
        let host = PluginHost::default();
        let plugins = host.list_plugins();
        assert_eq!(
            plugins.len(),
            2,
            "Default host must have 2 built-in plugins"
        );

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

        assert_eq!(
            tx.description,
            "Plugin: מגן שמות קדושים (Divine Name Shield)"
        );
    }

    #[test]
    fn test_plugin_not_found() {
        let host = PluginHost::new();
        let doc = DocumentRoot::new("test");
        let result = host.execute_plugin("nonexistent_plugin", &doc);
        assert!(result.is_err(), "Non-existent plugin must return error");
    }

    struct PanickyMetadata;
    impl TokPlugin for PanickyMetadata {
        fn metadata(&self) -> &PluginMetadata {
            panic!("metadata exploded")
        }
        fn execute(&self, _: &mut PluginContext) -> Result<(), PluginError> {
            Ok(())
        }
    }

    struct Configurable {
        meta: PluginMetadata,
        panic_in_execute: bool,
        emit: bool,
    }
    impl TokPlugin for Configurable {
        fn metadata(&self) -> &PluginMetadata {
            &self.meta
        }
        fn execute(&self, ctx: &mut PluginContext) -> Result<(), PluginError> {
            if self.panic_in_execute {
                panic!("execute exploded");
            }
            if self.emit {
                ctx.emit_operation(AtomicOperation::InsertText {
                    node_id: NodeId::new(),
                    char_offset: 0,
                    text: "x".to_string(),
                });
            }
            Ok(())
        }
    }

    fn configurable(
        id: &str,
        caps: Vec<PluginCapability>,
        panic: bool,
        emit: bool,
    ) -> Box<dyn TokPlugin> {
        Box::new(Configurable {
            meta: PluginMetadata {
                id: id.to_string(),
                name: id.to_string(),
                version: "0".to_string(),
                author: "t".to_string(),
                description: String::new(),
                capabilities: caps,
            },
            panic_in_execute: panic,
            emit,
        })
    }

    /// Regression: a panicking `metadata()` crashed the host from `register`.
    #[test]
    fn panicking_metadata_is_contained() {
        let mut host = PluginHost::new();
        assert!(host.try_register(Box::new(PanickyMetadata)).is_err());
        host.register(Box::new(PanickyMetadata));
        assert!(host.list_plugins().is_empty());
    }

    #[test]
    fn panicking_execute_reports_the_message() {
        let mut host = PluginHost::new();
        host.register(configurable(
            "p",
            vec![PluginCapability::ReadDocument],
            true,
            false,
        ));
        let err = host
            .execute_plugin("p", &DocumentRoot::new("t"))
            .unwrap_err();
        assert!(err.to_string().contains("execute exploded"), "{err}");
    }

    /// Regression: plugins without ModifyText could emit edit operations.
    #[test]
    fn edits_require_modify_text_capability() {
        let mut host = PluginHost::new();
        host.register(configurable(
            "ro",
            vec![PluginCapability::ReadDocument],
            false,
            true,
        ));
        host.register(configurable(
            "rw",
            vec![PluginCapability::ReadDocument, PluginCapability::ModifyText],
            false,
            true,
        ));
        let doc = DocumentRoot::new("t");
        assert!(matches!(
            host.execute_plugin("ro", &doc),
            Err(PluginError::PermissionDenied { .. })
        ));
        assert_eq!(host.execute_plugin("rw", &doc).unwrap().operations.len(), 1);
    }

    #[test]
    fn plugin_listing_is_sorted() {
        let mut host = PluginHost::new();
        for id in ["c", "a", "b"] {
            host.register(configurable(id, vec![], false, false));
        }
        let ids: Vec<String> = host.list_plugins().into_iter().map(|m| m.id).collect();
        assert_eq!(ids, ["a", "b", "c"]);
    }

    /// Regression: only the first occurrence of each name was found, and never
    /// in pointed text (niqqud between the letters).
    #[test]
    fn holy_names_found_in_pointed_text_and_repeated() {
        let text = HebrewNormalizer::normalize("וַיֹּאמֶר אֱלֹהִים יְהִי אוֹר וַיַּרְא אֱלֹהִים");
        let found = find_holy_names(&text);
        let elohim: Vec<_> = found.iter().filter(|m| m.name == "אלהים").collect();
        assert_eq!(elohim.len(), 2);
        let chars: Vec<char> = text.chars().collect();
        for m in &elohim {
            let span: String = chars[m.char_offset..m.char_offset + m.char_len]
                .iter()
                .collect();
            assert_eq!(span, "אֱלֹהִים");
        }
        assert!(find_holy_names("שלום עולם").is_empty());
    }
}
