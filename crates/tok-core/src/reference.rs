use crate::anchor::TextAnchor;
use crate::id::NodeId;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;

/// The kind of value to display for a resolved cross-reference.
#[derive(Debug, Clone, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub enum ReferenceKind {
    /// Renders the target physical page number as Arabic digits (e.g., "42").
    PageNumber,
    /// Renders the target physical page number in Hebrew gematria (e.g., "מ״ב").
    PageGematria,
    /// Renders the title of the target chapter/section/outline node.
    SectionTitle,
    /// Renders the structural numbering label (e.g., "סימן כ״ד", "סעיף ב׳").
    NumberLabel,
    /// Renders custom formatted template with placeholders `{page}`, `{gematria}`, `{title}`.
    CustomTemplate(String),
}

/// An explicit target anchor that can be cited or referenced across the document.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct ReferenceTarget {
    pub key: String,
    pub anchor: TextAnchor,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub label: Option<String>,
}

impl ReferenceTarget {
    pub fn new(key: impl Into<String>, anchor: TextAnchor) -> Self {
        Self {
            key: key.into(),
            anchor,
            label: None,
        }
    }

    pub fn with_label(mut self, label: impl Into<String>) -> Self {
        self.label = Some(label.into());
        self
    }
}

/// A cross-reference placed inside text pointing to a stable reference target.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct CrossReferenceNode {
    pub id: NodeId,
    pub source_anchor: TextAnchor,
    pub target_key: String,
    pub kind: ReferenceKind,
    pub fallback_text: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub cached_resolved_text: Option<String>,
}

impl CrossReferenceNode {
    pub fn new(
        source_anchor: TextAnchor,
        target_key: impl Into<String>,
        kind: ReferenceKind,
        fallback_text: impl Into<String>,
    ) -> Self {
        Self {
            id: NodeId::new(),
            source_anchor,
            target_key: target_key.into(),
            kind,
            fallback_text: fallback_text.into(),
            cached_resolved_text: None,
        }
    }

    pub fn resolve_text(&mut self, text: impl Into<String>) {
        self.cached_resolved_text = Some(text.into());
    }

    pub fn resolved_or_fallback(&self) -> &str {
        self.cached_resolved_text
            .as_deref()
            .unwrap_or(&self.fallback_text)
    }

    /// Formats the resolved reference text given layout output metrics.
    pub fn format_resolved(
        &self,
        page_num: Option<usize>,
        page_gematria: Option<&str>,
        section_title: Option<&str>,
        number_label: Option<&str>,
    ) -> String {
        match &self.kind {
            ReferenceKind::PageNumber => page_num
                .map(|p| p.to_string())
                .unwrap_or_else(|| self.fallback_text.clone()),
            ReferenceKind::PageGematria => page_gematria
                .map(|g| g.to_string())
                .unwrap_or_else(|| self.fallback_text.clone()),
            ReferenceKind::SectionTitle => section_title
                .map(|t| t.to_string())
                .unwrap_or_else(|| self.fallback_text.clone()),
            ReferenceKind::NumberLabel => number_label
                .map(|n| n.to_string())
                .unwrap_or_else(|| self.fallback_text.clone()),
            ReferenceKind::CustomTemplate(tmpl) => {
                let mut out = tmpl.clone();
                if let Some(p) = page_num {
                    out = out.replace("{page}", &p.to_string());
                }
                if let Some(g) = page_gematria {
                    out = out.replace("{gematria}", g);
                }
                if let Some(t) = section_title {
                    out = out.replace("{title}", t);
                }
                if let Some(n) = number_label {
                    out = out.replace("{number}", n);
                }
                out
            }
        }
    }
}

/// Registry of cross-reference targets and references across a book.
#[derive(Debug, Clone, PartialEq, Default, Serialize, Deserialize)]
pub struct CrossReferenceRegistry {
    pub targets: HashMap<String, ReferenceTarget>,
    pub references: Vec<CrossReferenceNode>,
}

impl CrossReferenceRegistry {
    pub fn new() -> Self {
        Self {
            targets: HashMap::new(),
            references: Vec::new(),
        }
    }

    pub fn register_target(&mut self, target: ReferenceTarget) {
        self.targets.insert(target.key.clone(), target);
    }

    pub fn register_reference(&mut self, reference: CrossReferenceNode) {
        self.references.push(reference);
    }

    pub fn get_target(&self, key: &str) -> Option<&ReferenceTarget> {
        self.targets.get(key)
    }

    pub fn references_to_target(&self, target_key: &str) -> Vec<&CrossReferenceNode> {
        self.references
            .iter()
            .filter(|r| r.target_key == target_key)
            .collect()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::id::FractionalIndex;

    #[test]
    fn test_cross_reference_formatting() {
        let node_id = NodeId::new();
        let anchor = TextAnchor::new(node_id, FractionalIndex::new("b"), crate::anchor::AnchorBias::Before);
        let xref = CrossReferenceNode::new(
            anchor.clone(),
            "target-hilchot-tefila",
            ReferenceKind::CustomTemplate("עיין לקמן עמ' {gematria} ({title})".to_string()),
            "עיין לקמן",
        );

        let resolved = xref.format_resolved(
            Some(42),
            Some("מ״ב"),
            Some("הלכות תפילה"),
            Some("סימן כ״ד"),
        );
        assert_eq!(resolved, "עיין לקמן עמ' מ״ב (הלכות תפילה)");

        let p_ref = CrossReferenceNode::new(
            anchor,
            "target-hilchot-tefila",
            ReferenceKind::PageGematria,
            "??",
        );
        assert_eq!(p_ref.format_resolved(Some(42), Some("מ״ב"), None, None), "מ״ב");
    }

    #[test]
    fn test_registry_registration_and_lookup() {
        let mut registry = CrossReferenceRegistry::new();
        let target_node = NodeId::new();
        let target = ReferenceTarget::new(
            "target-pesach",
            TextAnchor::start_of(target_node),
        ).with_label("הלכות פסח");
        registry.register_target(target);

        let source_node = NodeId::new();
        let xref = CrossReferenceNode::new(
            TextAnchor::start_of(source_node),
            "target-pesach",
            ReferenceKind::PageNumber,
            "שם",
        );
        registry.register_reference(xref);

        assert!(registry.get_target("target-pesach").is_some());
        assert_eq!(registry.references_to_target("target-pesach").len(), 1);
        assert_eq!(registry.references_to_target("unknown").len(), 0);
    }
}
