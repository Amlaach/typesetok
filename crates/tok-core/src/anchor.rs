use crate::id::{FractionalIndex, NodeId};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub enum AnchorBias {
    Before,
    After,
}

/// Stable local anchor within a specific node.
/// Avoids global offsets that invalidate upon any edit earlier in the book.
#[derive(Debug, Clone, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub struct TextAnchor {
    pub node_id: NodeId,
    pub offset_key: FractionalIndex,
    pub bias: AnchorBias,
}

impl TextAnchor {
    pub fn new(node_id: NodeId, offset_key: FractionalIndex, bias: AnchorBias) -> Self {
        Self {
            node_id,
            offset_key,
            bias,
        }
    }

    pub fn start_of(node_id: NodeId) -> Self {
        Self {
            node_id,
            offset_key: FractionalIndex::new("a"),
            bias: AnchorBias::Before,
        }
    }

    pub fn end_of(node_id: NodeId) -> Self {
        Self {
            node_id,
            offset_key: FractionalIndex::new("z"),
            bias: AnchorBias::After,
        }
    }
}

/// A semantic range defined by two stable anchors.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct SemanticRange {
    pub start: TextAnchor,
    pub end: TextAnchor,
}

impl SemanticRange {
    pub fn new(start: TextAnchor, end: TextAnchor) -> Self {
        Self { start, end }
    }

    pub fn is_collapsed(&self) -> bool {
        self.start == self.end
    }
}
