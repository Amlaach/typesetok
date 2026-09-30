use crate::error::ModelError;
use crate::id::NodeId;
use crate::model::{DocumentRoot, FlowId, ParagraphNode};
use crate::normalizer::HebrewNormalizer;
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub enum AtomicOperation {
    InsertText {
        node_id: NodeId,
        char_offset: usize,
        text: String,
    },
    DeleteText {
        node_id: NodeId,
        char_offset: usize,
        deleted_text: String,
    },
    InsertParagraph {
        section_id: NodeId,
        flow_id: FlowId,
        paragraph: ParagraphNode,
    },
    DeleteParagraph {
        section_id: NodeId,
        flow_id: FlowId,
        paragraph: ParagraphNode,
    },
}

impl AtomicOperation {
    pub fn invert(&self) -> Self {
        match self {
            AtomicOperation::InsertText { node_id, char_offset, text } => {
                AtomicOperation::DeleteText {
                    node_id: *node_id,
                    char_offset: *char_offset,
                    deleted_text: text.clone(),
                }
            }
            AtomicOperation::DeleteText { node_id, char_offset, deleted_text } => {
                AtomicOperation::InsertText {
                    node_id: *node_id,
                    char_offset: *char_offset,
                    text: deleted_text.clone(),
                }
            }
            AtomicOperation::InsertParagraph { section_id, flow_id, paragraph } => {
                AtomicOperation::DeleteParagraph {
                    section_id: *section_id,
                    flow_id: flow_id.clone(),
                    paragraph: paragraph.clone(),
                }
            }
            AtomicOperation::DeleteParagraph { section_id, flow_id, paragraph } => {
                AtomicOperation::InsertParagraph {
                    section_id: *section_id,
                    flow_id: flow_id.clone(),
                    paragraph: paragraph.clone(),
                }
            }
        }
    }

    pub fn apply(&self, doc: &mut DocumentRoot) -> Result<(), ModelError> {
        match self {
            AtomicOperation::InsertText { node_id, char_offset, text } => {
                let p = doc.find_paragraph_mut(*node_id)
                    .ok_or_else(|| ModelError::NodeNotFound(node_id.to_string()))?;
                let mut rope = p.rope();
                let norm_text = HebrewNormalizer::normalize(text);
                let offset = (*char_offset).min(rope.len_chars());
                rope.insert(offset, &norm_text);
                p.text = rope.to_string();
                Ok(())
            }
            AtomicOperation::DeleteText { node_id, char_offset, deleted_text } => {
                let p = doc.find_paragraph_mut(*node_id)
                    .ok_or_else(|| ModelError::NodeNotFound(node_id.to_string()))?;
                let mut rope = p.rope();
                let norm_deleted = HebrewNormalizer::normalize(deleted_text);
                let del_len = norm_deleted.chars().count();
                let total_len = rope.len_chars();
                let start = if *char_offset + del_len > total_len {
                    total_len.saturating_sub(del_len)
                } else {
                    *char_offset
                };
                let end = (start + del_len).min(total_len);
                if start < end {
                    rope.remove(start..end);
                    p.text = rope.to_string();
                }
                Ok(())
            }
            AtomicOperation::InsertParagraph { section_id, flow_id, paragraph } => {
                let sec = doc.sections.iter_mut().find(|s| s.id == *section_id)
                    .ok_or_else(|| ModelError::NodeNotFound(section_id.to_string()))?;
                let flow = sec.flows.iter_mut().find(|f| f.id == *flow_id)
                    .ok_or_else(|| ModelError::FlowNotFound(flow_id.0.clone()))?;
                flow.add_paragraph(paragraph.clone());
                Ok(())
            }
            AtomicOperation::DeleteParagraph { section_id, flow_id, paragraph } => {
                let sec = doc.sections.iter_mut().find(|s| s.id == *section_id)
                    .ok_or_else(|| ModelError::NodeNotFound(section_id.to_string()))?;
                let flow = sec.flows.iter_mut().find(|f| f.id == *flow_id)
                    .ok_or_else(|| ModelError::FlowNotFound(flow_id.0.clone()))?;
                flow.paragraphs.retain(|p| p.id != paragraph.id);
                Ok(())
            }
        }
    }
}

/// A compound atomic transaction containing multiple ordered operations.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct CompoundTransaction {
    pub description: String,
    pub operations: Vec<AtomicOperation>,
}

impl CompoundTransaction {
    pub fn new(description: impl Into<String>) -> Self {
        Self {
            description: description.into(),
            operations: Vec::new(),
        }
    }

    pub fn push(&mut self, op: AtomicOperation) {
        self.operations.push(op);
    }

    pub fn invert(&self) -> Self {
        let inverted_ops: Vec<AtomicOperation> = self
            .operations
            .iter()
            .rev()
            .map(|op| op.invert())
            .collect();

        Self {
            description: format!("Undo: {}", self.description),
            operations: inverted_ops,
        }
    }

    pub fn apply(&self, doc: &mut DocumentRoot) -> Result<(), ModelError> {
        for op in &self.operations {
            op.apply(doc)?;
        }
        Ok(())
    }
}

/// Robust Undo/Redo stack for the document.
#[derive(Debug, Clone, Default)]
pub struct TransactionStack {
    undo_stack: Vec<CompoundTransaction>,
    redo_stack: Vec<CompoundTransaction>,
    max_history: usize,
}

impl TransactionStack {
    pub fn new(max_history: usize) -> Self {
        Self {
            undo_stack: Vec::new(),
            redo_stack: Vec::new(),
            max_history,
        }
    }

    pub fn can_undo(&self) -> bool {
        !self.undo_stack.is_empty()
    }

    pub fn can_redo(&self) -> bool {
        !self.redo_stack.is_empty()
    }

    pub fn apply(&mut self, tx: CompoundTransaction, doc: &mut DocumentRoot) -> Result<(), ModelError> {
        tx.apply(doc)?;
        let inverse = tx.invert();
        self.undo_stack.push(inverse);
        if self.undo_stack.len() > self.max_history && self.max_history > 0 {
            self.undo_stack.remove(0);
        }
        self.redo_stack.clear();
        Ok(())
    }

    pub fn undo(&mut self, doc: &mut DocumentRoot) -> Result<(), ModelError> {
        let inverse = self.undo_stack.pop().ok_or(ModelError::UndoStackEmpty)?;
        inverse.apply(doc)?;
        let redo_tx = inverse.invert();
        self.redo_stack.push(redo_tx);
        Ok(())
    }

    pub fn redo(&mut self, doc: &mut DocumentRoot) -> Result<(), ModelError> {
        let redo_tx = self.redo_stack.pop().ok_or(ModelError::RedoStackEmpty)?;
        redo_tx.apply(doc)?;
        let inverse = redo_tx.invert();
        self.undo_stack.push(inverse);
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::id::FractionalIndex;

    #[test]
    fn test_transaction_apply_and_undo_redo() {
        let mut doc = DocumentRoot::new("ספר בדיקה");
        let sec_id = doc.sections[0].id;

        let p1 = ParagraphNode::new(FractionalIndex::initial(), "default-body", "בראשית ברא אלהים");
        let p1_id = p1.id;

        let mut tx1 = CompoundTransaction::new("הוספת פסקה");
        tx1.push(AtomicOperation::InsertParagraph {
            section_id: sec_id,
            flow_id: FlowId::main(),
            paragraph: p1,
        });

        let mut stack = TransactionStack::new(100);
        stack.apply(tx1, &mut doc).unwrap();

        assert_eq!(doc.sections[0].flows[0].paragraphs.len(), 1);
        assert_eq!(doc.find_paragraph(p1_id).unwrap().text, "בראשית ברא אלהים");

        // Insert text
        let mut tx2 = CompoundTransaction::new("הוספת מילים");
        tx2.push(AtomicOperation::InsertText {
            node_id: p1_id,
            char_offset: 17,
            text: " את השמים ואת הארץ".to_string(),
        });
        stack.apply(tx2, &mut doc).unwrap();

        assert_eq!(
            doc.find_paragraph(p1_id).unwrap().text,
            "בראשית ברא אלהים את השמים ואת הארץ"
        );

        // Undo text insert
        stack.undo(&mut doc).unwrap();
        assert_eq!(doc.find_paragraph(p1_id).unwrap().text, "בראשית ברא אלהים");

        // Redo text insert
        stack.redo(&mut doc).unwrap();
        assert_eq!(
            doc.find_paragraph(p1_id).unwrap().text,
            "בראשית ברא אלהים את השמים ואת הארץ"
        );

        // Undo both
        stack.undo(&mut doc).unwrap();
        stack.undo(&mut doc).unwrap();
        assert_eq!(doc.sections[0].flows[0].paragraphs.len(), 0);

        // Redo paragraph creation
        stack.redo(&mut doc).unwrap();
        assert_eq!(doc.sections[0].flows[0].paragraphs.len(), 1);
    }
}
