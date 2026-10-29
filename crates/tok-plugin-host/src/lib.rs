//! `tok-plugin-host` - Sandboxed Plugin Host & Extensibility Subsystem for TypesetOK (TOK).
//!
//! Enforces:
//! - Transactional-only access: plugins read a frozen `DocumentRoot` snapshot and emit atomic `CompoundTransaction` objects.
//! - Capability checks: emitted operations require [`PluginCapability::ModifyText`].
//! - Panic isolation: a panicking plugin (in `metadata` or `execute`) yields an error, never a host crash.
//! - Built-in typographic plugins for Hebrew prepress (GREP acronym/gershayim/geresh normalization, divine name shielding).

use serde::{Deserialize, Serialize};
use std::collections::BTreeMap;
use std::panic::{catch_unwind, AssertUnwindSafe};
use thiserror::Error;
use tok_core::model::DocumentRoot;
use tok_core::normalizer::HebrewNormalizer;
use tok_core::transaction::{AtomicOperation, CompoundTransaction};

#[derive(Error, Debug, Clone, PartialEq, Eq)]
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

    /// Executes the plugin against `doc` and applies the resulting transaction in-place,
    /// enforcing `ReadDocument` and `ModifyText` capability requirements.
    fn try_on_before_typeset(
        &self,
        doc: &mut DocumentRoot,
    ) -> Result<CompoundTransaction, PluginError> {
        let meta = self.metadata();
        if !meta.capabilities.contains(&PluginCapability::ReadDocument) {
            return Err(PluginError::PermissionDenied {
                plugin_id: meta.id.clone(),
                capability: "ReadDocument".to_string(),
            });
        }
        let tx = {
            let mut ctx = PluginContext::new(doc, format!("Plugin: {}", meta.name));
            self.execute(&mut ctx)?;
            ctx.transaction
        };

        if !tx.operations.is_empty() && !meta.capabilities.contains(&PluginCapability::ModifyText) {
            return Err(PluginError::PermissionDenied {
                plugin_id: meta.id.clone(),
                capability: "ModifyText".to_string(),
            });
        }

        if !tx.operations.is_empty() {
            tx.apply(doc)
                .map_err(|e| PluginError::ExecutionFailed(e.to_string()))?;
        }
        Ok(tx)
    }

    /// Pre-typeset hook that transforms `doc` in-place when required capabilities are granted.
    fn on_before_typeset(&self, doc: &mut DocumentRoot) {
        if let Err(e) = self.try_on_before_typeset(doc) {
            log::warn!("Plugin pre-typeset hook skipped/failed: {}", e);
        }
    }
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
        Self::with_builtin_plugins()
    }
}

impl PluginHost {
    pub fn new() -> Self {
        Self {
            plugins: BTreeMap::new(),
        }
    }

    /// Creates a `PluginHost` pre-registered with all built-in standard typographic plugins.
    pub fn with_builtin_plugins() -> Self {
        let mut host = Self::new();
        host.register(Box::new(DivineNameShieldPlugin));
        host.register(Box::new(HebrewGrepAcronymPlugin));
        host
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

    /// Runs all registered plugins in deterministic ID order and applies their emitted
    /// transactions to `doc`, returning the applied transactions or the first error.
    pub fn try_run_before_typeset(
        &self,
        doc: &mut DocumentRoot,
    ) -> Result<Vec<CompoundTransaction>, PluginError> {
        let ids: Vec<String> = self.plugins.keys().cloned().collect();
        let mut applied = Vec::with_capacity(ids.len());
        for id in ids {
            let tx = self.execute_plugin(&id, doc)?;
            if !tx.operations.is_empty() {
                tx.apply(doc)
                    .map_err(|e| PluginError::ExecutionFailed(e.to_string()))?;
            }
            applied.push(tx);
        }
        Ok(applied)
    }

    /// Runs all registered plugins on `doc` before typesetting.
    pub fn run_before_typeset(&self, doc: &mut DocumentRoot) -> Vec<CompoundTransaction> {
        let ids: Vec<String> = self.plugins.keys().cloned().collect();
        let mut applied = Vec::with_capacity(ids.len());
        for id in ids {
            match self.execute_plugin(&id, doc) {
                Ok(tx) => {
                    if !tx.operations.is_empty() {
                        if let Err(e) = tx.apply(doc) {
                            log::error!("Failed to apply transaction from plugin '{}': {}", id, e);
                            continue;
                        }
                    }
                    applied.push(tx);
                }
                Err(e) => {
                    log::warn!("Plugin '{}' failed during run_before_typeset: {}", id, e);
                }
            }
        }
        applied
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

/// Sacred stems that may appear in hyphenated orthographic forms (e.g. `א-להים`, `י-ה-ו-ה`).
const SACRED_HYPHENATED_STEMS: &[&str] = &[
    "יהוה",
    "יה",
    "אלהים",
    "אלוהים",
    "אלהינו",
    "אלוהינו",
    "אלהי",
    "אלוהי",
    "אלוה",
    "אל",
    "אדני",
    "שדי",
    "צבאות",
    "אהיה",
];

/// Multi-word sacred compounds whose separating space must be a non-breaking space (`\u{00A0}`).
const SACRED_COMPOUND_PAIRS: &[(&str, &str)] = &[
    ("אל", "שדי"),
    ("אל", "עליון"),
    ("יהוה", "צבאות"),
    ("אדני", "צבאות"),
    ("אלהי", "צבאות"),
    ("אלוהי", "צבאות"),
    ("אלהים", "צבאות"),
    ("אלוהים", "צבאות"),
    ("אדני", "יהוה"),
    ("יהוה", "אלהים"),
    ("יהוה", "אלוהים"),
    ("יהוה", "אלהינו"),
    ("יהוה", "אלוהינו"),
];

const HEBREW_PREFIX_LETTERS: &[char] = &['ב', 'כ', 'ל', 'מ', 'ש', 'ה', 'ו'];

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
        .filter(|(_, c)| HebrewNormalizer::mark_category(*c).is_none() && *c != '\u{2060}')
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

fn matches_sacred_stem_with_optional_prefix(bare: &str, stems: &[&str]) -> bool {
    if stems.contains(&bare) {
        return true;
    }
    let mut chars = bare.chars();
    if let Some(first) = chars.next() {
        if HEBREW_PREFIX_LETTERS.contains(&first) {
            let rest = chars.as_str();
            if stems.contains(&rest) {
                return true;
            }
            let mut chars2 = rest.chars();
            if let Some(second) = chars2.next() {
                if HEBREW_PREFIX_LETTERS.contains(&second) && stems.contains(&chars2.as_str()) {
                    return true;
                }
            }
        }
    }
    false
}

fn is_hyphenated_sacred_token(token: &str) -> bool {
    if !token.contains(['-', '־']) {
        return false;
    }
    // Check for hyphenated abbreviated divine name forms like ב-ה', ל-ה', ב-ה׳
    let stripped_joiners: String = token
        .chars()
        .filter(|&c| HebrewNormalizer::mark_category(c).is_none() && c != '\u{2060}')
        .collect();
    if let Some(prefix_part) = stripped_joiners
        .strip_suffix("-ה'")
        .or_else(|| stripped_joiners.strip_suffix("־ה'"))
        .or_else(|| stripped_joiners.strip_suffix("-ה׳"))
        .or_else(|| stripped_joiners.strip_suffix("־ה׳"))
    {
        if !prefix_part.is_empty()
            && prefix_part
                .chars()
                .all(|c| HEBREW_PREFIX_LETTERS.contains(&c))
        {
            return true;
        }
    }

    // Extract only Hebrew base letters
    let bare_letters: String = token
        .chars()
        .filter(|&c| HebrewNormalizer::is_hebrew_letter(c))
        .collect();
    // Ensure there are no non-Hebrew letters/digits in the token
    let all_valid_chars = token.chars().all(|c| {
        HebrewNormalizer::is_hebrew_letter(c)
            || HebrewNormalizer::mark_category(c).is_some()
            || matches!(c, '-' | '־' | '\u{2060}')
    });
    if !all_valid_chars || bare_letters.is_empty() {
        return false;
    }

    matches_sacred_stem_with_optional_prefix(&bare_letters, SACRED_HYPHENATED_STEMS)
}

fn shield_hyphens_in_token(token: &str) -> String {
    // Strip existing Word Joiners (\u{2060}) immediately adjacent to '-' or '־' first
    // so that repeated calls are strictly idempotent.
    let chars: Vec<char> = token.chars().collect();
    let mut cleaned = Vec::with_capacity(chars.len());
    for (idx, &ch) in chars.iter().enumerate() {
        if ch == '\u{2060}' {
            let prev_is_hyphen = idx > 0 && matches!(chars[idx - 1], '-' | '־');
            let next_is_hyphen = idx + 1 < chars.len() && matches!(chars[idx + 1], '-' | '־');
            if prev_is_hyphen || next_is_hyphen {
                continue;
            }
        }
        cleaned.push(ch);
    }

    let mut out = String::with_capacity(token.len() + 8);
    for ch in cleaned {
        if matches!(ch, '-' | '־') {
            out.push('\u{2060}');
            out.push(ch);
            out.push('\u{2060}');
        } else {
            out.push(ch);
        }
    }
    out
}

fn bare_hebrew_letters_of_word(word: &str) -> Option<String> {
    let mut letters = String::new();
    for c in word.chars() {
        if HebrewNormalizer::is_hebrew_letter(c) {
            letters.push(c);
        } else if HebrewNormalizer::mark_category(c).is_some() || c == '\u{2060}' {
            continue;
        } else {
            return None;
        }
    }
    if letters.is_empty() {
        None
    } else {
        Some(letters)
    }
}

fn is_sacred_compound_pair(word1: &str, word2: &str) -> bool {
    let (Some(bare1), Some(bare2)) = (
        bare_hebrew_letters_of_word(word1),
        bare_hebrew_letters_of_word(word2),
    ) else {
        return false;
    };

    for &(expected1, expected2) in SACRED_COMPOUND_PAIRS {
        if bare2 == expected2 && matches_sacred_stem_with_optional_prefix(&bare1, &[expected1]) {
            return true;
        }
    }
    false
}

/// Protects sacred Hebrew names in `text` from line-break and hyphenation splits:
/// - Wraps hyphens in sacred hyphenated forms (e.g. `א-להים`, `י-ה-ו-ה`) with Word Joiners (`\u{2060}-\u{2060}`).
/// - Replaces regular spaces inside multi-word sacred compounds (e.g. `אל שדי`, `יהוה צבאות`) with Non-Breaking Spaces (`\u{00A0}`).
///
/// Strictly idempotent: `shield_sacred_names(&shield_sacred_names(s)) == shield_sacred_names(s)`.
pub fn shield_sacred_names(text: &str) -> String {
    let chars: Vec<char> = text.chars().collect();
    let is_token_char = |c: char| {
        HebrewNormalizer::is_hebrew_letter(c)
            || HebrewNormalizer::mark_category(c).is_some()
            || matches!(c, '-' | '־' | '\u{2060}' | '\'' | '׳')
    };

    // Tokenize into alternating (is_token, String) segments
    let mut segments: Vec<(bool, String)> = Vec::new();
    let mut i = 0;
    while i < chars.len() {
        let is_tok = is_token_char(chars[i]);
        let start = i;
        while i < chars.len() && is_token_char(chars[i]) == is_tok {
            i += 1;
        }
        let seg: String = chars[start..i].iter().collect();
        segments.push((is_tok, seg));
    }

    // Pass 1: Protect hyphenated sacred tokens with Word Joiners (\u{2060})
    for (is_tok, seg) in &mut segments {
        if *is_tok && is_hyphenated_sacred_token(seg) {
            *seg = shield_hyphens_in_token(seg);
        }
    }

    // Pass 2: Replace single ASCII space ' ' between multi-word sacred compounds with NBSP (\u{00A0})
    let len = segments.len();
    for idx in 0..len {
        if !segments[idx].0
            && segments[idx].1 == " "
            && idx > 0
            && idx + 1 < len
            && segments[idx - 1].0
            && segments[idx + 1].0
            && is_sacred_compound_pair(&segments[idx - 1].1, &segments[idx + 1].1)
        {
            segments[idx].1 = "\u{00A0}".to_string();
        }
    }

    let mut out = String::with_capacity(text.len() + 8);
    for (_, seg) in segments {
        out.push_str(&seg);
    }
    out
}

/// Converts ASCII double quotes `"` inside Hebrew acronyms into canonical Hebrew Gershayim `״` (`\u{05F4}`),
/// and ASCII single quotes `'` after 1 or 2 Hebrew letters at a word boundary into canonical Hebrew Geresh `׳` (`\u{05F3}`).
///
/// Strictly idempotent and preserves English text and quotation marks unchanged.
pub fn convert_hebrew_acronyms(text: &str) -> String {
    let chars: Vec<char> = text.chars().collect();
    let mut out = String::with_capacity(text.len() + 4);

    let is_heb_letter = HebrewNormalizer::is_hebrew_letter;
    let is_mark_or_joiner =
        |c: char| HebrewNormalizer::mark_category(c).is_some() || c == '\u{2060}';

    for (i, &ch) in chars.iter().enumerate() {
        if ch == '"' {
            // Check preceding base character (skipping combining marks and word joiners)
            let mut prev_idx = i;
            let mut prev_is_heb = false;
            while prev_idx > 0 {
                prev_idx -= 1;
                let p = chars[prev_idx];
                if is_mark_or_joiner(p) {
                    continue;
                }
                prev_is_heb = is_heb_letter(p);
                break;
            }

            // Check following base character (skipping word joiners)
            let mut next_idx = i + 1;
            let mut next_is_heb = false;
            while next_idx < chars.len() {
                let n = chars[next_idx];
                if n == '\u{2060}' {
                    next_idx += 1;
                    continue;
                }
                next_is_heb = is_heb_letter(n);
                break;
            }

            if prev_is_heb && next_is_heb {
                out.push('\u{05F4}'); // ״ Hebrew Punctuation Gershayim
                continue;
            }
        } else if ch == '\'' {
            // Must be at end-of-word boundary
            let at_word_end = if i + 1 >= chars.len() {
                true
            } else {
                let next_c = chars[i + 1];
                !is_heb_letter(next_c)
                    && !is_mark_or_joiner(next_c)
                    && !next_c.is_ascii_alphanumeric()
            };

            if at_word_end {
                let mut k = i;
                let mut heb_count = 0usize;
                let mut valid_start = true;
                while k > 0 {
                    let prev_c = chars[k - 1];
                    if is_mark_or_joiner(prev_c) {
                        k -= 1;
                        continue;
                    } else if is_heb_letter(prev_c) {
                        heb_count += 1;
                        k -= 1;
                        if heb_count > 2 {
                            valid_start = false;
                            break;
                        }
                    } else {
                        if prev_c.is_ascii_alphanumeric() || matches!(prev_c, '\'' | '׳') {
                            valid_start = false;
                        }
                        break;
                    }
                }

                if valid_start && (heb_count == 1 || heb_count == 2) {
                    out.push('\u{05F3}'); // ׳ Hebrew Punctuation Geresh
                    continue;
                }
            }
        }

        out.push(ch);
    }

    out
}

/// Plugin: Divine Name Shield (שמירת שמות קדושים)
/// Ensures holy names (שמות שאינם נמחקים) are never split, hyphenated, or modified.
pub struct DivineNameShieldPlugin;

impl DivineNameShieldPlugin {
    pub fn on_before_typeset(&self, doc: &mut DocumentRoot) {
        TokPlugin::on_before_typeset(self, doc);
    }
}

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
                PluginCapability::ModifyText,
                PluginCapability::ApplyStyles,
                PluginCapability::PrePressFilter,
            ],
        })
    }

    fn execute(&self, ctx: &mut PluginContext) -> Result<(), PluginError> {
        let can_modify = self
            .metadata()
            .capabilities
            .contains(&PluginCapability::ModifyText);

        for para in ctx
            .document
            .sections
            .iter()
            .flat_map(|s| &s.flows)
            .flat_map(|f| &f.paragraphs)
        {
            for m in find_holy_names(&para.text) {
                log::info!(
                    "Shielded holy name '{}' in paragraph {} at char {}",
                    m.name,
                    para.id,
                    m.char_offset
                );
            }

            let shielded = shield_sacred_names(&para.text);
            if shielded != para.text {
                if !can_modify {
                    return Err(PluginError::PermissionDenied {
                        plugin_id: self.metadata().id.clone(),
                        capability: "ModifyText".to_string(),
                    });
                }
                ctx.emit_operation(AtomicOperation::DeleteText {
                    node_id: para.id,
                    char_offset: 0,
                    deleted_text: para.text.clone(),
                    deleted_spans: para.spans.clone(),
                });
                ctx.emit_operation(AtomicOperation::InsertFormattedText {
                    node_id: para.id,
                    char_offset: 0,
                    text: shielded,
                    spans: para.spans.clone(),
                });
            }
        }
        Ok(())
    }
}

/// Plugin: Hebrew GREP Acronym & Citation Styler (עיצוב ראשי תיבות וציוני מקורות)
/// Automatically normalizes ASCII quotes in Hebrew acronyms (`רמב"ם` -> `רמב״ם`)
/// and abbreviations (`ר'` -> `ר׳`) into canonical Unicode Gershayim/Geresh.
pub struct HebrewGrepAcronymPlugin;

/// A capability-configured instance of [`HebrewGrepAcronymPlugin`].
pub struct ConfiguredHebrewGrepAcronymPlugin {
    meta: PluginMetadata,
}

impl HebrewGrepAcronymPlugin {
    /// Creates a [`ConfiguredHebrewGrepAcronymPlugin`] with an explicit capability set.
    pub fn with_capabilities(
        capabilities: Vec<PluginCapability>,
    ) -> ConfiguredHebrewGrepAcronymPlugin {
        let mut meta = TokPlugin::metadata(&HebrewGrepAcronymPlugin).clone();
        meta.capabilities = capabilities;
        ConfiguredHebrewGrepAcronymPlugin { meta }
    }

    /// Creates a restricted instance without [`PluginCapability::ModifyText`].
    pub fn without_modify_text() -> ConfiguredHebrewGrepAcronymPlugin {
        Self::with_capabilities(vec![
            PluginCapability::ReadDocument,
            PluginCapability::ApplyStyles,
        ])
    }

    pub fn on_before_typeset(&self, doc: &mut DocumentRoot) {
        TokPlugin::on_before_typeset(self, doc);
    }

    pub fn on_before_typeset_with_capabilities(
        &self,
        doc: &mut DocumentRoot,
        capabilities: Vec<PluginCapability>,
    ) -> Result<CompoundTransaction, PluginError> {
        let configured = Self::with_capabilities(capabilities);
        TokPlugin::try_on_before_typeset(&configured, doc)
    }
}

impl ConfiguredHebrewGrepAcronymPlugin {
    pub fn on_before_typeset(
        &self,
        doc: &mut DocumentRoot,
    ) -> Result<CompoundTransaction, PluginError> {
        TokPlugin::try_on_before_typeset(self, doc)
    }
}

impl TokPlugin for ConfiguredHebrewGrepAcronymPlugin {
    fn metadata(&self) -> &PluginMetadata {
        &self.meta
    }

    fn execute(&self, ctx: &mut PluginContext) -> Result<(), PluginError> {
        execute_hebrew_grep_acronym(&self.meta, ctx)
    }
}

fn execute_hebrew_grep_acronym(
    meta: &PluginMetadata,
    ctx: &mut PluginContext,
) -> Result<(), PluginError> {
    let can_modify = meta.capabilities.contains(&PluginCapability::ModifyText);

    for para in ctx
        .document
        .sections
        .iter()
        .flat_map(|s| &s.flows)
        .flat_map(|f| &f.paragraphs)
    {
        if para.text.contains(['״', '"', '׳', '\'']) {
            log::info!("Detected acronyms/abbreviations in paragraph {}", para.id);
        }

        let converted = convert_hebrew_acronyms(&para.text);
        if converted != para.text {
            if !can_modify {
                return Err(PluginError::PermissionDenied {
                    plugin_id: meta.id.clone(),
                    capability: "ModifyText".to_string(),
                });
            }
            ctx.emit_operation(AtomicOperation::DeleteText {
                node_id: para.id,
                char_offset: 0,
                deleted_text: para.text.clone(),
                deleted_spans: para.spans.clone(),
            });
            ctx.emit_operation(AtomicOperation::InsertFormattedText {
                node_id: para.id,
                char_offset: 0,
                text: converted,
                spans: para.spans.clone(),
            });
        }
    }
    Ok(())
}

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
                PluginCapability::ModifyText,
                PluginCapability::ApplyStyles,
            ],
        })
    }

    fn execute(&self, ctx: &mut PluginContext) -> Result<(), PluginError> {
        execute_hebrew_grep_acronym(self.metadata(), ctx)
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

    #[test]
    fn divine_name_shield_protects_sacred_names_and_is_idempotent() {
        let mut doc = DocumentRoot::new("בדיקת שמות קדושים");
        doc.sections[0]
            .main_flow_mut()
            .unwrap()
            .paragraphs
            .push(ParagraphNode::new(
                FractionalIndex::initial(),
                "normal",
                "אמר אל שדי כי א-להים וכן י-ה-ו-ה בבית-ספר רגיל",
            ));

        let plugin = DivineNameShieldPlugin;
        plugin.on_before_typeset(&mut doc);

        let after_once = doc.sections[0].main_flow().unwrap().paragraphs[0]
            .text
            .clone();
        assert_eq!(
            after_once,
            "אמר אל\u{00A0}שדי כי א\u{2060}-\u{2060}להים וכן י\u{2060}-\u{2060}ה\u{2060}-\u{2060}ו\u{2060}-\u{2060}ה בבית-ספר רגיל"
        );

        // Idempotence: f(f(x)) == f(x)
        plugin.on_before_typeset(&mut doc);
        let after_twice = &doc.sections[0].main_flow().unwrap().paragraphs[0].text;
        assert_eq!(
            after_twice, &after_once,
            "DivineNameShieldPlugin must be idempotent"
        );
    }

    #[test]
    fn hebrew_grep_acronym_converts_quotes_is_idempotent_and_preserves_english() {
        let mut doc = DocumentRoot::new("בדיקת ראשי תיבות");
        doc.sections[0].main_flow_mut().unwrap().paragraphs.push(
            ParagraphNode::new(
                FractionalIndex::initial(),
                "normal",
                "דברי ר' משה בן מימון (רמב\"ם) בש\"ס ובתנ\"ך אצל אדמו\"ר ה' מס' ברכות, and \"English\" don't change.",
            ),
        );

        let plugin = HebrewGrepAcronymPlugin;
        plugin.on_before_typeset(&mut doc);

        let after_once = doc.sections[0].main_flow().unwrap().paragraphs[0]
            .text
            .clone();
        assert_eq!(
            after_once,
            "דברי ר׳ משה בן מימון (רמב״ם) בש״ס ובתנ״ך אצל אדמו״ר ה׳ מס׳ ברכות, and \"English\" don't change."
        );

        // Idempotence: f(f(x)) == f(x)
        plugin.on_before_typeset(&mut doc);
        let after_twice = &doc.sections[0].main_flow().unwrap().paragraphs[0].text;
        assert_eq!(
            after_twice, &after_once,
            "HebrewGrepAcronymPlugin must be idempotent"
        );
    }

    #[test]
    fn hebrew_grep_acronym_refuses_execution_without_modify_text_capability() {
        let mut doc = DocumentRoot::new("בדיקת הרשאות");
        doc.sections[0]
            .main_flow_mut()
            .unwrap()
            .paragraphs
            .push(ParagraphNode::new(
                FractionalIndex::initial(),
                "normal",
                "פסק הרמב\"ם ודברי ר' עקיבא",
            ));

        let restricted = HebrewGrepAcronymPlugin::without_modify_text();
        let err = restricted
            .on_before_typeset(&mut doc)
            .expect_err("Execution without ModifyText capability must fail");
        assert_eq!(
            err,
            PluginError::PermissionDenied {
                plugin_id: "tok.builtin.hebrew-grep-acronym".to_string(),
                capability: "ModifyText".to_string(),
            }
        );

        // Document text must remain untouched
        assert_eq!(
            doc.sections[0].main_flow().unwrap().paragraphs[0].text,
            "פסק הרמב\"ם ודברי ר' עקיבא"
        );

        // Also verify via PluginHost::execute_plugin
        let mut host = PluginHost::new();
        host.register(Box::new(HebrewGrepAcronymPlugin::without_modify_text()));
        assert!(matches!(
            host.execute_plugin("tok.builtin.hebrew-grep-acronym", &doc),
            Err(PluginError::PermissionDenied { capability, .. }) if capability == "ModifyText"
        ));
    }

    #[test]
    fn property_builtin_plugins_idempotence_across_corpus() {
        let samples = [
            "אל שדי א-להים י-ה-ו-ה יהוה צבאות",
            "רמב\"ם ש\"ס תנ\"ך אדמו\"ר ה' ר' מס'",
            "בְּרֵאשִׁית בָּרָא א-לֹהִים וְאָמַר רַשִׁ\"י וְר' יְהוּדָה",
            "Plain English with \"quotes\" and 'apostrophes' don't change",
            "",
        ];

        for sample in samples {
            let s1 = shield_sacred_names(sample);
            let s2 = shield_sacred_names(&s1);
            assert_eq!(
                s1, s2,
                "shield_sacred_names idempotence failed on {sample:?}"
            );

            let a1 = convert_hebrew_acronyms(sample);
            let a2 = convert_hebrew_acronyms(&a1);
            assert_eq!(
                a1, a2,
                "convert_hebrew_acronyms idempotence failed on {sample:?}"
            );
        }

        // Combined host run_before_typeset idempotence
        let host = PluginHost::with_builtin_plugins();
        let mut doc = DocumentRoot::new("בדיקה משולבת");
        for sample in samples {
            doc.sections[0]
                .main_flow_mut()
                .unwrap()
                .paragraphs
                .push(ParagraphNode::new(
                    FractionalIndex::initial(),
                    "normal",
                    sample,
                ));
        }

        host.run_before_typeset(&mut doc);
        let snapshot_after_first = doc.clone();
        host.run_before_typeset(&mut doc);
        assert_eq!(
            doc, snapshot_after_first,
            "PluginHost::run_before_typeset must be idempotent"
        );
    }
}
