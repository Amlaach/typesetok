//! Bidirectional Multi-Flow Anchor Registry ("צורת הדף" חיה).
//!
//! Models bidirectional logical anchoring between primary text nodes (Gemara / Mikra)
//! and secondary commentary nodes (Rashi, Tosafot, Targum, Ramban).
//!
//! Invariants:
//! - Guarantees O(1) bidirectional lookup between primary anchor and commentary nodes.
//! - Enables automatic cascading: if a primary paragraph moves to a subsequent page,
//!   all anchored commentary paragraphs automatically cascade with it.
//! - Re-indexing support maintains anchor integrity across document edits and node re-identification.

use crate::anchor::TextAnchor;
use crate::id::NodeId;
use crate::model::FlowId;
use serde::{Deserialize, Serialize};
use std::collections::{BTreeMap, HashMap};

/// Unique identifier for an anchor link point in multi-stream layouts.
#[derive(Debug, Clone, PartialEq, Eq, PartialOrd, Ord, Hash, Serialize, Deserialize)]
pub struct AnchorId(pub String);

impl AnchorId {
    pub fn new(id: impl Into<String>) -> Self {
        Self(id.into())
    }

    pub fn as_str(&self) -> &str {
        &self.0
    }
}

impl<T: Into<String>> From<T> for AnchorId {
    fn from(s: T) -> Self {
        Self(s.into())
    }
}

impl std::fmt::Display for AnchorId {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "{}", self.0)
    }
}

/// Definition of an anchor point anchored to a primary text location.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct AnchorDefinition {
    pub id: AnchorId,
    pub primary_flow_id: FlowId,
    pub primary_node_id: NodeId,
    pub primary_anchor: TextAnchor,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub label: Option<String>,
}

impl AnchorDefinition {
    pub fn new(
        id: impl Into<AnchorId>,
        primary_flow_id: FlowId,
        primary_node_id: NodeId,
        primary_anchor: TextAnchor,
    ) -> Self {
        Self {
            id: id.into(),
            primary_flow_id,
            primary_node_id,
            primary_anchor,
            label: None,
        }
    }

    pub fn with_label(mut self, label: impl Into<String>) -> Self {
        self.label = Some(label.into());
        self
    }
}

/// A logical link connecting a commentary paragraph to a primary anchor.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct CommentaryLink {
    pub commentary_flow_id: FlowId,
    pub commentary_node_id: NodeId,
    pub anchor_id: AnchorId,
    #[serde(default)]
    pub priority: u32,
}

impl CommentaryLink {
    pub fn new(
        commentary_flow_id: FlowId,
        commentary_node_id: NodeId,
        anchor_id: impl Into<AnchorId>,
    ) -> Self {
        Self {
            commentary_flow_id,
            commentary_node_id,
            anchor_id: anchor_id.into(),
            priority: 0,
        }
    }

    pub fn with_priority(mut self, priority: u32) -> Self {
        self.priority = priority;
        self
    }
}

/// Bidirectional multi-stream anchor registry enabling O(1) lookups and cascade detection.
#[derive(Debug, Clone, Default, PartialEq, Eq, Serialize, Deserialize)]
pub struct MultiFlowAnchorMap {
    /// Anchor definitions indexed by AnchorId
    pub anchors: BTreeMap<AnchorId, AnchorDefinition>,
    /// Primary paragraph NodeId -> list of AnchorIds within that paragraph
    pub primary_node_to_anchors: BTreeMap<NodeId, Vec<AnchorId>>,
    /// AnchorId -> linked commentaries (ordered by priority)
    pub anchor_to_commentaries: BTreeMap<AnchorId, Vec<CommentaryLink>>,
    /// Commentary paragraph NodeId -> AnchorId
    pub commentary_to_anchor: BTreeMap<NodeId, AnchorId>,
}

impl MultiFlowAnchorMap {
    pub fn new() -> Self {
        Self::default()
    }

    /// Registers a primary anchor point in the map.
    pub fn register_anchor(&mut self, anchor: AnchorDefinition) {
        let node_id = anchor.primary_node_id;
        let id = anchor.id.clone();
        self.anchors.insert(id.clone(), anchor);

        let list = self.primary_node_to_anchors.entry(node_id).or_default();
        if !list.contains(&id) {
            list.push(id);
        }
    }

    /// Links a commentary node to an existing anchor.
    pub fn link_commentary(&mut self, link: CommentaryLink) {
        let comm_node = link.commentary_node_id;
        let anchor_id = link.anchor_id.clone();

        self.commentary_to_anchor.insert(comm_node, anchor_id.clone());

        let comm_list = self.anchor_to_commentaries.entry(anchor_id).or_default();
        // Remove prior link for same commentary node if exists
        comm_list.retain(|c| c.commentary_node_id != comm_node);
        comm_list.push(link);
        comm_list.sort_by_key(|c| c.priority);
    }

    /// Retrieves an anchor definition by its ID.
    pub fn get_anchor(&self, anchor_id: &AnchorId) -> Option<&AnchorDefinition> {
        self.anchors.get(anchor_id)
    }

    /// Retrieves all commentary links associated with a given anchor ID.
    pub fn get_commentaries_for_anchor(&self, anchor_id: &AnchorId) -> &[CommentaryLink] {
        self.anchor_to_commentaries
            .get(anchor_id)
            .map(|v| v.as_slice())
            .unwrap_or(&[])
    }

    /// Retrieves all commentary links associated with any anchor in the given primary paragraph node.
    pub fn get_commentaries_for_primary_node(&self, primary_node_id: NodeId) -> Vec<&CommentaryLink> {
        let mut results = Vec::new();
        if let Some(anchor_ids) = self.primary_node_to_anchors.get(&primary_node_id) {
            for aid in anchor_ids {
                if let Some(links) = self.anchor_to_commentaries.get(aid) {
                    for link in links {
                        results.push(link);
                    }
                }
            }
        }
        results
    }

    /// Retrieves the anchor definition linked to a specific commentary paragraph node.
    pub fn get_anchor_for_commentary(&self, commentary_node_id: NodeId) -> Option<&AnchorDefinition> {
        let aid = self.commentary_to_anchor.get(&commentary_node_id)?;
        self.anchors.get(aid)
    }

    /// Retrieves the primary node ID linked to a specific commentary paragraph node.
    pub fn get_primary_node_for_commentary(&self, commentary_node_id: NodeId) -> Option<NodeId> {
        let anchor = self.get_anchor_for_commentary(commentary_node_id)?;
        Some(anchor.primary_node_id)
    }

    /// Detects all commentary nodes that must cascade when the specified primary nodes move.
    ///
    /// Preserves natural reading order and deduplicates commentary nodes.
    pub fn detect_cascading_commentaries(
        &self,
        moved_primary_node_ids: &[NodeId],
    ) -> Vec<(FlowId, NodeId)> {
        let mut seen = std::collections::HashSet::new();
        let mut cascading = Vec::new();

        for &p_id in moved_primary_node_ids {
            for link in self.get_commentaries_for_primary_node(p_id) {
                if seen.insert(link.commentary_node_id) {
                    cascading.push((link.commentary_flow_id.clone(), link.commentary_node_id));
                }
            }
        }

        cascading
    }

    /// Removes an anchor and all its associated commentary links.
    pub fn remove_anchor(&mut self, anchor_id: &AnchorId) {
        if let Some(def) = self.anchors.remove(anchor_id) {
            if let Some(list) = self.primary_node_to_anchors.get_mut(&def.primary_node_id) {
                list.retain(|id| id != anchor_id);
                if list.is_empty() {
                    self.primary_node_to_anchors.remove(&def.primary_node_id);
                }
            }
        }

        if let Some(links) = self.anchor_to_commentaries.remove(anchor_id) {
            for link in links {
                self.commentary_to_anchor.remove(&link.commentary_node_id);
            }
        }
    }

    /// Unlinks a specific commentary node.
    pub fn unlink_commentary(&mut self, commentary_node_id: NodeId) {
        if let Some(anchor_id) = self.commentary_to_anchor.remove(&commentary_node_id) {
            if let Some(links) = self.anchor_to_commentaries.get_mut(&anchor_id) {
                links.retain(|l| l.commentary_node_id != commentary_node_id);
                if links.is_empty() {
                    self.anchor_to_commentaries.remove(&anchor_id);
                }
            }
        }
    }

    /// Re-indexes all internal NodeId references when nodes are mapped during document restructuring.
    pub fn reindex_nodes(&mut self, id_map: &HashMap<NodeId, NodeId>) {
        // Update anchor primary_node_ids
        for anchor in self.anchors.values_mut() {
            if let Some(&new_id) = id_map.get(&anchor.primary_node_id) {
                anchor.primary_node_id = new_id;
                anchor.primary_anchor.node_id = new_id;
            }
        }

        // Rebuild primary_node_to_anchors
        let mut new_primary_map = BTreeMap::new();
        for (node_id, anchor_ids) in &self.primary_node_to_anchors {
            let target_node = id_map.get(node_id).copied().unwrap_or(*node_id);
            new_primary_map.insert(target_node, anchor_ids.clone());
        }
        self.primary_node_to_anchors = new_primary_map;

        // Update commentary links
        for links in self.anchor_to_commentaries.values_mut() {
            for link in links.iter_mut() {
                if let Some(&new_id) = id_map.get(&link.commentary_node_id) {
                    link.commentary_node_id = new_id;
                }
            }
        }

        // Rebuild commentary_to_anchor
        let mut new_comm_map = BTreeMap::new();
        for (comm_id, anchor_id) in &self.commentary_to_anchor {
            let target_comm = id_map.get(comm_id).copied().unwrap_or(*comm_id);
            new_comm_map.insert(target_comm, anchor_id.clone());
        }
        self.commentary_to_anchor = new_comm_map;
    }
}
