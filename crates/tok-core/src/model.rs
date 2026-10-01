use crate::error::ModelError;
use crate::id::{FractionalIndex, NodeId};
use crate::normalizer::HebrewNormalizer;
use crate::styles::{CharacterStyle, ParagraphStyle, Progression, StylePatch};
use ropey::Rope;
use serde::{Deserialize, Serialize};
use std::sync::Arc;

#[derive(Debug, Clone, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub struct FlowId(pub String);

impl FlowId {
    pub fn main() -> Self {
        Self("main".to_string())
    }

    pub fn new(id: impl Into<String>) -> Self {
        Self(id.into())
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum FlowType {
    Main,
    CommentA,
    CommentB,
    Footnote,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct ParagraphNode {
    pub id: NodeId,
    pub index: FractionalIndex,
    pub style_id: String,
    pub text: String,
    pub style_patches: Vec<StylePatch>,
}

impl ParagraphNode {
    pub fn new(index: FractionalIndex, style_id: impl Into<String>, text: &str) -> Self {
        let normalized = HebrewNormalizer::normalize(text);
        Self {
            id: NodeId::new(),
            index,
            style_id: style_id.into(),
            text: normalized,
            style_patches: Vec::new(),
        }
    }

    pub fn rope(&self) -> Rope {
        Rope::from_str(&self.text)
    }
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct Flow {
    pub id: FlowId,
    pub flow_type: FlowType,
    pub paragraphs: Vec<ParagraphNode>,
}

impl Flow {
    pub fn new(id: FlowId, flow_type: FlowType) -> Self {
        Self {
            id,
            flow_type,
            paragraphs: Vec::new(),
        }
    }

    pub fn add_paragraph(&mut self, p: ParagraphNode) {
        self.paragraphs.push(p);
        self.paragraphs.sort_by(|a, b| a.index.cmp(&b.index));
    }
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct SectionNode {
    pub id: NodeId,
    pub name: String,
    pub page_style: String,
    pub flows: Vec<Flow>,
}

impl SectionNode {
    pub fn new(name: impl Into<String>, page_style: impl Into<String>) -> Self {
        let main_flow = Flow::new(FlowId::main(), FlowType::Main);
        Self {
            id: NodeId::new(),
            name: name.into(),
            page_style: page_style.into(),
            flows: vec![main_flow],
        }
    }

    pub fn main_flow_mut(&mut self) -> Option<&mut Flow> {
        self.flows.iter_mut().find(|f| f.id == FlowId::main())
    }

    pub fn main_flow(&self) -> Option<&Flow> {
        self.flows.iter().find(|f| f.id == FlowId::main())
    }
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct DocumentMetadata {
    pub title: String,
    pub author: String,
    pub progression: Progression,
    pub primary_language: String,
    pub schema_version: String,
}

impl Default for DocumentMetadata {
    fn default() -> Self {
        Self {
            title: "מסמך חדש".to_string(),
            author: "מחבר".to_string(),
            progression: Progression::Rtl,
            primary_language: "he".to_string(),
            schema_version: "1.0".to_string(),
        }
    }
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct DocumentRoot {
    pub id: NodeId,
    pub metadata: DocumentMetadata,
    pub paragraph_styles: Vec<ParagraphStyle>,
    pub character_styles: Vec<CharacterStyle>,
    pub sections: Vec<SectionNode>,
}

impl DocumentRoot {
    pub fn new(title: impl Into<String>) -> Self {
        let mut root = Self {
            id: NodeId::new(),
            metadata: DocumentMetadata {
                title: title.into(),
                ..Default::default()
            },
            paragraph_styles: vec![ParagraphStyle::default()],
            character_styles: Vec::new(),
            sections: Vec::new(),
        };

        // Add a default first section
        let default_section = SectionNode::new("שער ראשון", "chapter-first");
        root.sections.push(default_section);
        root
    }

    pub fn find_paragraph(&self, id: NodeId) -> Option<&ParagraphNode> {
        for sec in &self.sections {
            for flow in &sec.flows {
                for p in &flow.paragraphs {
                    if p.id == id {
                        return Some(p);
                    }
                }
            }
        }
        None
    }

    pub fn find_paragraph_mut(&mut self, id: NodeId) -> Option<&mut ParagraphNode> {
        for sec in &mut self.sections {
            for flow in &mut sec.flows {
                for p in &mut flow.paragraphs {
                    if p.id == id {
                        return Some(p);
                    }
                }
            }
        }
        None
    }

    pub fn to_json(&self) -> Result<String, ModelError> {
        serde_json::to_string_pretty(self).map_err(|e| ModelError::SerializationError(e.to_string()))
    }

    pub fn from_json(json_str: &str) -> Result<Self, ModelError> {
        serde_json::from_str(json_str).map_err(|e| ModelError::SerializationError(e.to_string()))
    }
}

/// The document model wrapper that handles snapshots and concurrency.
#[derive(Debug, Clone)]
pub struct DocumentModel {
    root: Arc<DocumentRoot>,
}

impl DocumentModel {
    pub fn new(root: DocumentRoot) -> Self {
        Self {
            root: Arc::new(root),
        }
    }

    pub fn snapshot(&self) -> Arc<DocumentRoot> {
        Arc::clone(&self.root)
    }

    pub fn update_root(&mut self, new_root: DocumentRoot) {
        self.root = Arc::new(new_root);
    }

    pub fn root(&self) -> &DocumentRoot {
        &self.root
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::id::FractionalIndex;

    #[test]
    fn test_add_paragraph_maintains_order() {
        let mut flow = Flow::new(FlowId::main(), FlowType::Main);
        let p3 = ParagraphNode::new(FractionalIndex::new("p"), "normal", "third");
        let p1 = ParagraphNode::new(FractionalIndex::new("b"), "normal", "first");
        let p2 = ParagraphNode::new(FractionalIndex::new("m"), "normal", "second");
        
        // Add in shuffled order
        flow.add_paragraph(p3);
        flow.add_paragraph(p1);
        flow.add_paragraph(p2);
        
        // They should be sorted by index
        assert_eq!(flow.paragraphs[0].text, "first");
        assert_eq!(flow.paragraphs[1].text, "second");
        assert_eq!(flow.paragraphs[2].text, "third");
    }
    
    #[test]
    fn test_document_to_json_and_back() {
        let mut root = DocumentRoot::new("Test Doc");
        let sec = &mut root.sections[0];
        let flow = sec.main_flow_mut().unwrap();
        flow.add_paragraph(ParagraphNode::new(
            FractionalIndex::initial(),
            "normal",
            "Hello World",
        ));
        
        let json = root.to_json().expect("Serialization must succeed");
        let loaded = DocumentRoot::from_json(&json).expect("Deserialization must succeed");
        assert_eq!(loaded.metadata.title, "Test Doc");
        assert_eq!(loaded.sections[0].main_flow().unwrap().paragraphs.len(), 1);
    }
}
