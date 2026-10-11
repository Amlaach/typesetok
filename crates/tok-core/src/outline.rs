use crate::anchor::TextAnchor;
use crate::id::NodeId;
use serde::{Deserialize, Serialize};

/// Structural level of a division in a hierarchical document or multi-volume book.
#[derive(Debug, Clone, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub enum HierarchyLevel {
    Volume,
    Part,
    Chapter,
    Section,
    Subsection,
    Clause,
    Custom(String),
}

impl HierarchyLevel {
    pub fn default_depth(&self) -> usize {
        match self {
            HierarchyLevel::Volume => 0,
            HierarchyLevel::Part => 1,
            HierarchyLevel::Chapter => 2,
            HierarchyLevel::Section => 3,
            HierarchyLevel::Subsection => 4,
            HierarchyLevel::Clause => 5,
            HierarchyLevel::Custom(_) => 3,
        }
    }
}

/// A node within the hierarchical document outline.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct DocumentHierarchyNode {
    pub id: NodeId,
    pub level: HierarchyLevel,
    pub title: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub number_label: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub section_id: Option<NodeId>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub start_anchor: Option<TextAnchor>,
    #[serde(default)]
    pub children: Vec<DocumentHierarchyNode>,
}

impl DocumentHierarchyNode {
    pub fn new(level: HierarchyLevel, title: impl Into<String>) -> Self {
        Self {
            id: NodeId::new(),
            level,
            title: title.into(),
            number_label: None,
            section_id: None,
            start_anchor: None,
            children: Vec::new(),
        }
    }

    pub fn with_number_label(mut self, label: impl Into<String>) -> Self {
        self.number_label = Some(label.into());
        self
    }

    pub fn with_section_id(mut self, section_id: NodeId) -> Self {
        self.section_id = Some(section_id);
        self
    }

    pub fn with_start_anchor(mut self, anchor: TextAnchor) -> Self {
        self.start_anchor = Some(anchor);
        self
    }

    pub fn add_child(&mut self, child: DocumentHierarchyNode) {
        self.children.push(child);
    }
}

/// Complete hierarchical outline and Table of Contents (TOC) structure of a book.
#[derive(Debug, Clone, PartialEq, Default, Serialize, Deserialize)]
pub struct DocumentOutline {
    #[serde(default)]
    pub root_nodes: Vec<DocumentHierarchyNode>,
}

impl DocumentOutline {
    pub fn new() -> Self {
        Self {
            root_nodes: Vec::new(),
        }
    }

    pub fn add_root_node(&mut self, node: DocumentHierarchyNode) {
        self.root_nodes.push(node);
    }

    /// Finds a node by its unique NodeId anywhere in the hierarchy.
    pub fn find_node(&self, id: NodeId) -> Option<&DocumentHierarchyNode> {
        fn search(nodes: &[DocumentHierarchyNode], id: NodeId) -> Option<&DocumentHierarchyNode> {
            for node in nodes {
                if node.id == id {
                    return Some(node);
                }
                if let Some(found) = search(&node.children, id) {
                    return Some(found);
                }
            }
            None
        }
        search(&self.root_nodes, id)
    }

    /// Finds a mutable reference to a node by its NodeId.
    pub fn find_node_mut(&mut self, id: NodeId) -> Option<&mut DocumentHierarchyNode> {
        fn search(
            nodes: &mut [DocumentHierarchyNode],
            id: NodeId,
        ) -> Option<&mut DocumentHierarchyNode> {
            for node in nodes {
                if node.id == id {
                    return Some(node);
                }
                if let Some(found) = search(&mut node.children, id) {
                    return Some(found);
                }
            }
            None
        }
        search(&mut self.root_nodes, id)
    }

    /// Collects all nodes in pre-order depth-first traversal with their nesting depth.
    pub fn flatten_in_order(&self) -> Vec<(&DocumentHierarchyNode, usize)> {
        let mut list = Vec::new();
        fn traverse<'a>(
            nodes: &'a [DocumentHierarchyNode],
            depth: usize,
            out: &mut Vec<(&'a DocumentHierarchyNode, usize)>,
        ) {
            for node in nodes {
                out.push((node, depth));
                traverse(&node.children, depth + 1, out);
            }
        }
        traverse(&self.root_nodes, 0, &mut list);
        list
    }

    /// Finds the ancestor path (from root to parent) for a given node id.
    pub fn ancestor_path(&self, target_id: NodeId) -> Option<Vec<&DocumentHierarchyNode>> {
        fn find<'a>(
            nodes: &'a [DocumentHierarchyNode],
            target_id: NodeId,
            current_path: &mut Vec<&'a DocumentHierarchyNode>,
        ) -> bool {
            for node in nodes {
                current_path.push(node);
                if node.id == target_id {
                    return true;
                }
                if find(&node.children, target_id, current_path) {
                    return true;
                }
                current_path.pop();
            }
            false
        }

        let mut path = Vec::new();
        if find(&self.root_nodes, target_id, &mut path) {
            path.pop(); // Remove the target itself, keeping ancestors
            Some(path)
        } else {
            None
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_outline_construction_and_flattening() {
        let mut outline = DocumentOutline::new();

        let mut part1 = DocumentHierarchyNode::new(HierarchyLevel::Part, "חלק ראשון: אורח חיים")
            .with_number_label("חלק א׳");
        let mut chap1 = DocumentHierarchyNode::new(HierarchyLevel::Chapter, "הלכות השכמת הבוקר")
            .with_number_label("סימן א׳");
        let sec1 = DocumentHierarchyNode::new(HierarchyLevel::Section, "יתגבר כארי לעמוד בבוקר")
            .with_number_label("סעיף א׳");
        let sec2 = DocumentHierarchyNode::new(HierarchyLevel::Section, "שויתי ה׳ לנגדי תמיד")
            .with_number_label("סעיף ב׳");

        let chap1_id = chap1.id;
        let sec2_id = sec2.id;

        chap1.add_child(sec1);
        chap1.add_child(sec2);
        part1.add_child(chap1);
        outline.add_root_node(part1);

        assert!(outline.find_node(chap1_id).is_some());
        assert!(outline.find_node(sec2_id).is_some());

        let flattened = outline.flatten_in_order();
        assert_eq!(flattened.len(), 4);
        assert_eq!(flattened[0].0.title, "חלק ראשון: אורח חיים");
        assert_eq!(flattened[0].1, 0);
        assert_eq!(flattened[1].0.title, "הלכות השכמת הבוקר");
        assert_eq!(flattened[1].1, 1);
        assert_eq!(flattened[2].0.title, "יתגבר כארי לעמוד בבוקר");
        assert_eq!(flattened[2].1, 2);
        assert_eq!(flattened[3].0.title, "שויתי ה׳ לנגדי תמיד");
        assert_eq!(flattened[3].1, 2);

        let ancestors = outline.ancestor_path(sec2_id).expect("Should find path");
        assert_eq!(ancestors.len(), 2);
        assert_eq!(ancestors[0].title, "חלק ראשון: אורח חיים");
        assert_eq!(ancestors[1].title, "הלכות השכמת הבוקר");
    }

    #[test]
    fn test_outline_serialization_roundtrip() {
        let mut outline = DocumentOutline::new();
        let node = DocumentHierarchyNode::new(HierarchyLevel::Chapter, "פרק ראשון")
            .with_number_label("א׳");
        outline.add_root_node(node);

        let json = serde_json::to_string(&outline).unwrap();
        let deserialized: DocumentOutline = serde_json::from_str(&json).unwrap();
        assert_eq!(deserialized.root_nodes.len(), 1);
        assert_eq!(deserialized.root_nodes[0].title, "פרק ראשון");
    }
}
