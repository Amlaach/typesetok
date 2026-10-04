use crate::error::ModelError;
use crate::id::NodeId;
use crate::model::{DocumentRoot, Flow, FlowId, ParagraphNode};
use crate::normalizer::HebrewNormalizer;
use serde::{Deserialize, Serialize};
use std::collections::VecDeque;

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

/// Byte index of the `char_idx`-th character of `s` (or `s.len()` past the end).
fn char_to_byte(s: &str, char_idx: usize) -> usize {
    s.char_indices()
        .nth(char_idx)
        .map(|(b, _)| b)
        .unwrap_or(s.len())
}

fn find_flow_mut<'a>(
    doc: &'a mut DocumentRoot,
    section_id: &NodeId,
    flow_id: &FlowId,
) -> Result<&'a mut Flow, ModelError> {
    let sec = doc
        .sections
        .iter_mut()
        .find(|s| s.id == *section_id)
        .ok_or_else(|| ModelError::NodeNotFound(section_id.to_string()))?;
    sec.flows
        .iter_mut()
        .find(|f| f.id == *flow_id)
        .ok_or_else(|| ModelError::FlowNotFound(flow_id.0.clone()))
}

impl AtomicOperation {
    /// The syntactic inverse of this operation.
    ///
    /// Prefer [`AtomicOperation::apply_with_inverse`], which returns the inverse
    /// of what was *actually* applied (clamped offsets, the paragraph that was
    /// really removed, ...).
    pub fn invert(&self) -> Self {
        match self {
            AtomicOperation::InsertText {
                node_id,
                char_offset,
                text,
            } => AtomicOperation::DeleteText {
                node_id: *node_id,
                char_offset: *char_offset,
                deleted_text: text.clone(),
            },
            AtomicOperation::DeleteText {
                node_id,
                char_offset,
                deleted_text,
            } => AtomicOperation::InsertText {
                node_id: *node_id,
                char_offset: *char_offset,
                text: deleted_text.clone(),
            },
            AtomicOperation::InsertParagraph {
                section_id,
                flow_id,
                paragraph,
            } => AtomicOperation::DeleteParagraph {
                section_id: *section_id,
                flow_id: flow_id.clone(),
                paragraph: paragraph.clone(),
            },
            AtomicOperation::DeleteParagraph {
                section_id,
                flow_id,
                paragraph,
            } => AtomicOperation::InsertParagraph {
                section_id: *section_id,
                flow_id: flow_id.clone(),
                paragraph: paragraph.clone(),
            },
        }
    }

    pub fn apply(&self, doc: &mut DocumentRoot) -> Result<(), ModelError> {
        self.apply_with_inverse(doc).map(|_| ())
    }

    /// Applies the operation and returns the operation that exactly undoes it.
    ///
    /// On error the document is left unchanged.
    pub fn apply_with_inverse(&self, doc: &mut DocumentRoot) -> Result<Self, ModelError> {
        match self {
            AtomicOperation::InsertText {
                node_id,
                char_offset,
                text,
            } => {
                let p = doc
                    .find_paragraph_mut(*node_id)
                    .ok_or_else(|| ModelError::NodeNotFound(node_id.to_string()))?;
                let norm_text = HebrewNormalizer::normalize(text);
                // Offsets past the end append (historical behaviour); the
                // inverse records where the text really went.
                let offset = (*char_offset).min(p.text.chars().count());
                let byte = char_to_byte(&p.text, offset);
                p.text.insert_str(byte, &norm_text);
                Ok(AtomicOperation::DeleteText {
                    node_id: *node_id,
                    char_offset: offset,
                    deleted_text: norm_text,
                })
            }
            AtomicOperation::DeleteText {
                node_id,
                char_offset,
                deleted_text,
            } => {
                let p = doc
                    .find_paragraph_mut(*node_id)
                    .ok_or_else(|| ModelError::NodeNotFound(node_id.to_string()))?;
                let norm_deleted = HebrewNormalizer::normalize(deleted_text);
                let del_len = norm_deleted.chars().count();
                let total_len = p.text.chars().count();
                if del_len > total_len {
                    return Err(ModelError::InvalidTransaction(format!(
                        "cannot delete {} characters from a paragraph of {}",
                        del_len, total_len
                    )));
                }
                let start = (*char_offset).min(total_len - del_len);
                let start_byte = char_to_byte(&p.text, start);
                let end_byte = start_byte + norm_deleted.len();
                // Never delete text other than the text the operation names:
                // otherwise undo would "restore" something that was never there.
                if p.text.get(start_byte..end_byte) != Some(norm_deleted.as_str()) {
                    return Err(ModelError::InvalidTransaction(format!(
                        "text at offset {} of paragraph {} does not match the text to delete",
                        start, node_id
                    )));
                }
                p.text.replace_range(start_byte..end_byte, "");
                Ok(AtomicOperation::InsertText {
                    node_id: *node_id,
                    char_offset: start,
                    text: norm_deleted,
                })
            }
            AtomicOperation::InsertParagraph {
                section_id,
                flow_id,
                paragraph,
            } => {
                if doc.find_paragraph(paragraph.id).is_some() {
                    return Err(ModelError::InvalidTransaction(format!(
                        "paragraph {} already exists",
                        paragraph.id
                    )));
                }
                let flow = find_flow_mut(doc, section_id, flow_id)?;
                flow.add_paragraph(paragraph.clone());
                Ok(AtomicOperation::DeleteParagraph {
                    section_id: *section_id,
                    flow_id: flow_id.clone(),
                    paragraph: paragraph.clone(),
                })
            }
            AtomicOperation::DeleteParagraph {
                section_id,
                flow_id,
                paragraph,
            } => {
                let flow = find_flow_mut(doc, section_id, flow_id)?;
                let pos = flow
                    .paragraphs
                    .iter()
                    .position(|p| p.id == paragraph.id)
                    .ok_or_else(|| ModelError::NodeNotFound(paragraph.id.to_string()))?;
                // Undo must restore the paragraph as it was in the document,
                // not the (possibly stale) copy carried by the operation.
                let removed = flow.paragraphs.remove(pos);
                Ok(AtomicOperation::InsertParagraph {
                    section_id: *section_id,
                    flow_id: flow_id.clone(),
                    paragraph: removed,
                })
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

const UNDO_PREFIX: &str = "Undo: ";

fn inverse_description(description: &str) -> String {
    match description.strip_prefix(UNDO_PREFIX) {
        Some(original) => original.to_string(),
        None => format!("{}{}", UNDO_PREFIX, description),
    }
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
        let inverted_ops: Vec<AtomicOperation> =
            self.operations.iter().rev().map(|op| op.invert()).collect();

        Self {
            description: format!("{}{}", UNDO_PREFIX, self.description),
            operations: inverted_ops,
        }
    }

    /// Applies all operations atomically. If operation N fails, rolls back
    /// operations 0..N-1 by applying their exact inverses in reverse order.
    pub fn apply(&self, doc: &mut DocumentRoot) -> Result<(), ModelError> {
        self.apply_recording(doc).map(|_| ())
    }

    /// Applies all operations atomically and returns the transaction that
    /// exactly undoes them. On error the document is restored and nothing is
    /// returned.
    pub fn apply_recording(&self, doc: &mut DocumentRoot) -> Result<Self, ModelError> {
        let mut inverses = Vec::with_capacity(self.operations.len());
        for op in &self.operations {
            match op.apply_with_inverse(doc) {
                Ok(inverse) => inverses.push(inverse),
                Err(e) => {
                    for inverse in inverses.iter().rev() {
                        if let Err(rollback_err) = inverse.apply(doc) {
                            // Exact inverses of applied operations cannot fail
                            // on the state they produced; report loudly if they do.
                            log::error!(
                                "rollback of '{}' failed: {}",
                                self.description,
                                rollback_err
                            );
                        }
                    }
                    return Err(e);
                }
            }
        }
        inverses.reverse();
        Ok(Self {
            description: inverse_description(&self.description),
            operations: inverses,
        })
    }
}

/// Robust Undo/Redo stack for the document.
#[derive(Debug, Clone, Default)]
pub struct TransactionStack {
    undo_stack: VecDeque<CompoundTransaction>,
    redo_stack: VecDeque<CompoundTransaction>,
    /// Maximum number of undo entries. 0 = unlimited.
    max_history: usize,
}

impl TransactionStack {
    pub fn new(max_history: usize) -> Self {
        Self {
            undo_stack: VecDeque::new(),
            redo_stack: VecDeque::new(),
            max_history,
        }
    }

    pub fn can_undo(&self) -> bool {
        !self.undo_stack.is_empty()
    }

    pub fn can_redo(&self) -> bool {
        !self.redo_stack.is_empty()
    }

    fn push_undo(&mut self, inverse: CompoundTransaction) {
        self.undo_stack.push_back(inverse);
        // Evict oldest entries when exceeding max_history (0 = unlimited)
        if self.max_history > 0 && self.undo_stack.len() > self.max_history {
            self.undo_stack.pop_front();
        }
    }

    pub fn apply(
        &mut self,
        tx: CompoundTransaction,
        doc: &mut DocumentRoot,
    ) -> Result<(), ModelError> {
        let inverse = tx.apply_recording(doc)?;
        if !tx.operations.is_empty() {
            self.push_undo(inverse);
            self.redo_stack.clear();
        }
        Ok(())
    }

    /// Undo the last transaction. The entry stays on the stack if undo fails.
    pub fn undo(&mut self, doc: &mut DocumentRoot) -> Result<(), ModelError> {
        let inverse = self
            .undo_stack
            .pop_back()
            .ok_or(ModelError::UndoStackEmpty)?;
        match inverse.apply_recording(doc) {
            Ok(redo_tx) => {
                self.redo_stack.push_back(redo_tx);
                Ok(())
            }
            Err(e) => {
                self.undo_stack.push_back(inverse);
                Err(e)
            }
        }
    }

    /// Redo the last undone transaction. The entry stays on the stack if redo fails.
    pub fn redo(&mut self, doc: &mut DocumentRoot) -> Result<(), ModelError> {
        let redo_tx = self
            .redo_stack
            .pop_back()
            .ok_or(ModelError::RedoStackEmpty)?;
        match redo_tx.apply_recording(doc) {
            Ok(inverse) => {
                self.push_undo(inverse);
                Ok(())
            }
            Err(e) => {
                self.redo_stack.push_back(redo_tx);
                Err(e)
            }
        }
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

        let p1 = ParagraphNode::new(
            FractionalIndex::initial(),
            "default-body",
            "בראשית ברא אלהים",
        );
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

    #[test]
    fn test_transaction_undo_empty_stack() {
        let mut root = DocumentRoot::new("test");
        let mut stack = TransactionStack::new(100);
        let result = stack.undo(&mut root);
        assert!(result.is_err(), "Undo on empty stack must return error");
    }

    #[test]
    fn test_transaction_redo_empty_stack() {
        let mut root = DocumentRoot::new("test");
        let mut stack = TransactionStack::new(100);
        let result = stack.redo(&mut root);
        assert!(result.is_err(), "Redo on empty stack must return error");
    }

    fn doc_with_paragraph(text: &str) -> (DocumentRoot, NodeId, NodeId) {
        let mut doc = DocumentRoot::new("test");
        let sec_id = doc.sections[0].id;
        let p = ParagraphNode::new(FractionalIndex::initial(), "default-body", text);
        let pid = p.id;
        doc.sections[0].main_flow_mut().unwrap().add_paragraph(p);
        (doc, sec_id, pid)
    }

    /// Regression: deleting a paragraph that is not in the flow used to
    /// succeed, and undoing it then inserted a phantom paragraph.
    #[test]
    fn delete_missing_paragraph_is_an_error() {
        let (mut doc, sec_id, _) = doc_with_paragraph("שלום");
        let before = doc.clone();
        let ghost = ParagraphNode::new(FractionalIndex::new("z"), "default-body", "רוח");
        let mut tx = CompoundTransaction::new("delete ghost");
        tx.push(AtomicOperation::DeleteParagraph {
            section_id: sec_id,
            flow_id: FlowId::main(),
            paragraph: ghost,
        });
        let mut stack = TransactionStack::new(10);
        assert!(stack.apply(tx, &mut doc).is_err());
        assert_eq!(doc, before);
        assert!(!stack.can_undo());
    }

    /// Regression: undo restored the paragraph copy carried by the operation
    /// instead of the paragraph that was actually deleted.
    #[test]
    fn undo_delete_paragraph_restores_actual_content() {
        let (mut doc, sec_id, pid) = doc_with_paragraph("הנוסח האמיתי");
        let before = doc.clone();
        let mut stale = doc.find_paragraph(pid).unwrap().clone();
        stale.text = "נוסח ישן".to_string();
        let mut tx = CompoundTransaction::new("delete");
        tx.push(AtomicOperation::DeleteParagraph {
            section_id: sec_id,
            flow_id: FlowId::main(),
            paragraph: stale,
        });
        let mut stack = TransactionStack::new(10);
        stack.apply(tx, &mut doc).unwrap();
        assert!(doc.find_paragraph(pid).is_none());
        stack.undo(&mut doc).unwrap();
        assert_eq!(doc, before);
        stack.redo(&mut doc).unwrap();
        assert!(doc.find_paragraph(pid).is_none());
    }

    /// Regression: DeleteText removed whatever happened to be at the offset,
    /// and undo then inserted the (different) text named by the operation.
    #[test]
    fn delete_text_must_match_document() {
        let (mut doc, _, pid) = doc_with_paragraph("אבגדה");
        let before = doc.clone();
        let mut tx = CompoundTransaction::new("bad delete");
        tx.push(AtomicOperation::DeleteText {
            node_id: pid,
            char_offset: 1,
            deleted_text: "XY".to_string(),
        });
        assert!(tx.apply(&mut doc).is_err());
        assert_eq!(doc, before);

        let mut too_long = CompoundTransaction::new("too long");
        too_long.push(AtomicOperation::DeleteText {
            node_id: pid,
            char_offset: 0,
            deleted_text: "אבגדהוז".to_string(),
        });
        assert!(too_long.apply(&mut doc).is_err());
        assert_eq!(doc, before);
    }

    #[test]
    fn duplicate_paragraph_insert_is_rejected() {
        let (mut doc, sec_id, pid) = doc_with_paragraph("אחד");
        let dup = doc.find_paragraph(pid).unwrap().clone();
        let mut tx = CompoundTransaction::new("dup");
        tx.push(AtomicOperation::InsertParagraph {
            section_id: sec_id,
            flow_id: FlowId::main(),
            paragraph: dup,
        });
        assert!(tx.apply(&mut doc).is_err());
        assert_eq!(doc.sections[0].flows[0].paragraphs.len(), 1);
    }

    #[test]
    fn failed_transaction_rolls_back_every_step() {
        let (mut doc, sec_id, pid) = doc_with_paragraph("שלום עולם");
        let before = doc.clone();
        let mut tx = CompoundTransaction::new("partial");
        tx.push(AtomicOperation::InsertText {
            node_id: pid,
            char_offset: 0,
            text: "א".to_string(),
        });
        tx.push(AtomicOperation::DeleteText {
            node_id: pid,
            char_offset: 1,
            deleted_text: "שלום".to_string(),
        });
        tx.push(AtomicOperation::InsertParagraph {
            section_id: sec_id,
            flow_id: FlowId::main(),
            paragraph: ParagraphNode::new(FractionalIndex::new("n"), "x", "חדש"),
        });
        tx.push(AtomicOperation::InsertText {
            node_id: NodeId::new(),
            char_offset: 0,
            text: "fails".to_string(),
        });
        assert!(tx.apply(&mut doc).is_err());
        assert_eq!(doc, before);
    }

    #[test]
    fn clamped_insert_undoes_cleanly() {
        let (mut doc, _, pid) = doc_with_paragraph("אב");
        let before = doc.clone();
        let mut tx = CompoundTransaction::new("append");
        tx.push(AtomicOperation::InsertText {
            node_id: pid,
            char_offset: 999,
            text: "גד".to_string(),
        });
        let mut stack = TransactionStack::new(0);
        stack.apply(tx, &mut doc).unwrap();
        assert_eq!(doc.find_paragraph(pid).unwrap().text, "אבגד");
        stack.undo(&mut doc).unwrap();
        assert_eq!(doc, before);
        stack.redo(&mut doc).unwrap();
        assert_eq!(doc.find_paragraph(pid).unwrap().text, "אבגד");
    }

    #[test]
    fn undo_redo_descriptions_do_not_accumulate() {
        let (mut doc, _, pid) = doc_with_paragraph("אב");
        let mut tx = CompoundTransaction::new("typing");
        tx.push(AtomicOperation::InsertText {
            node_id: pid,
            char_offset: 0,
            text: "ג".to_string(),
        });
        let inverse = tx.apply_recording(&mut doc).unwrap();
        assert_eq!(inverse.description, "Undo: typing");
        let redo = inverse.apply_recording(&mut doc).unwrap();
        assert_eq!(redo.description, "typing");
    }

    #[test]
    fn history_limit_evicts_oldest() {
        let (mut doc, _, pid) = doc_with_paragraph("");
        let mut stack = TransactionStack::new(2);
        for ch in ["א", "ב", "ג"] {
            let mut tx = CompoundTransaction::new(ch);
            tx.push(AtomicOperation::InsertText {
                node_id: pid,
                char_offset: usize::MAX,
                text: ch.to_string(),
            });
            stack.apply(tx, &mut doc).unwrap();
        }
        stack.undo(&mut doc).unwrap();
        stack.undo(&mut doc).unwrap();
        assert!(stack.undo(&mut doc).is_err());
        assert_eq!(doc.find_paragraph(pid).unwrap().text, "א");
    }
}
