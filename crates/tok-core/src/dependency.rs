use crate::id::NodeId;
use serde::{Deserialize, Serialize};
use std::collections::{BTreeSet, HashMap, HashSet};

/// Bidirectional dependency tracker between document content nodes and physical pages.
///
/// Keeps track of which paragraphs/nodes are rendered on which pages, which anchors
/// resolve to which pages, and which pages are dirtied by incremental editing operations.
#[derive(Debug, Clone, PartialEq, Default, Serialize, Deserialize)]
pub struct DocumentDependencyTracker {
    /// Monotonically increasing revision generation counter.
    pub revision: u64,

    /// Maps each NodeId to the set of page indices (0-based) where its lines are placed.
    pub node_to_pages: HashMap<NodeId, BTreeSet<usize>>,

    /// Maps each page index (0-based) to the set of NodeIds present on that page.
    pub page_to_nodes: HashMap<usize, BTreeSet<NodeId>>,

    /// Maps cross-reference anchor keys to their currently resolved page index.
    pub anchor_to_page: HashMap<String, usize>,

    /// Set of NodeIds modified since last layout computation.
    pub dirty_nodes: HashSet<NodeId>,

    /// Set of page indices dirtied and requiring re-breaking or recomposition.
    pub dirty_pages: BTreeSet<usize>,
}

impl DocumentDependencyTracker {
    pub fn new() -> Self {
        Self::default()
    }

    /// Records that `node_id` has text/lines rendered on `page_index`.
    pub fn record_placement(&mut self, node_id: NodeId, page_index: usize) {
        self.node_to_pages
            .entry(node_id)
            .or_default()
            .insert(page_index);

        self.page_to_nodes
            .entry(page_index)
            .or_default()
            .insert(node_id);
    }

    /// Records the resolved physical page for a named anchor key.
    pub fn record_anchor_page(&mut self, anchor_key: impl Into<String>, page_index: usize) {
        self.anchor_to_page.insert(anchor_key.into(), page_index);
    }

    /// Marks a node as dirty (edited, added, or deleted) and dirties all pages where
    /// it was previously rendered, along with all downstream pages from the earliest affected page.
    pub fn mark_node_dirty(&mut self, node_id: NodeId) {
        self.dirty_nodes.insert(node_id);
        if let Some(pages) = self.node_to_pages.get(&node_id) {
            for &p in pages {
                self.dirty_pages.insert(p);
            }
        }
    }

    /// Explicitly marks a page as dirty.
    pub fn mark_page_dirty(&mut self, page_index: usize) {
        self.dirty_pages.insert(page_index);
    }

    /// Returns the lowest page index currently marked dirty, if any.
    pub fn earliest_dirty_page(&self) -> Option<usize> {
        self.dirty_pages.iter().copied().next()
    }

    /// Queries all pages where lines of `node_id` appear.
    pub fn pages_for_node(&self, node_id: NodeId) -> Option<&BTreeSet<usize>> {
        self.node_to_pages.get(&node_id)
    }

    /// Queries all nodes present on a given page.
    pub fn nodes_on_page(&self, page_index: usize) -> Option<&BTreeSet<NodeId>> {
        self.page_to_nodes.get(&page_index)
    }

    /// Queries the page where an anchor was resolved.
    pub fn page_for_anchor(&self, key: &str) -> Option<usize> {
        self.anchor_to_page.get(key).copied()
    }

    /// Advances the revision counter and returns the new revision.
    pub fn advance_revision(&mut self) -> u64 {
        self.revision = self.revision.saturating_add(1);
        self.revision
    }

    /// Clears the dirty sets after successful incremental recomputation.
    pub fn clean_after_recompute(&mut self) {
        self.dirty_nodes.clear();
        self.dirty_pages.clear();
    }

    /// Resets all placement mappings (e.g., when completely rebuilding layout).
    pub fn clear_placements(&mut self) {
        self.node_to_pages.clear();
        self.page_to_nodes.clear();
        self.anchor_to_page.clear();
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_record_placement_and_query() {
        let mut tracker = DocumentDependencyTracker::new();
        let p1 = NodeId::new();
        let p2 = NodeId::new();

        tracker.record_placement(p1, 0);
        tracker.record_placement(p1, 1); // Spanning across page break
        tracker.record_placement(p2, 1);

        assert_eq!(tracker.pages_for_node(p1).unwrap().len(), 2);
        assert_eq!(tracker.nodes_on_page(1).unwrap().len(), 2);
        assert_eq!(tracker.nodes_on_page(0).unwrap().len(), 1);

        tracker.record_anchor_page("ch-1", 0);
        assert_eq!(tracker.page_for_anchor("ch-1"), Some(0));
    }

    #[test]
    fn test_mark_node_dirty_dirties_pages() {
        let mut tracker = DocumentDependencyTracker::new();
        let p1 = NodeId::new();
        let p2 = NodeId::new();

        tracker.record_placement(p1, 4);
        tracker.record_placement(p2, 7);

        tracker.mark_node_dirty(p1);
        assert_eq!(tracker.earliest_dirty_page(), Some(4));
        assert!(tracker.dirty_pages.contains(&4));
        assert!(!tracker.dirty_pages.contains(&7));

        tracker.clean_after_recompute();
        assert!(tracker.dirty_nodes.is_empty());
        assert!(tracker.dirty_pages.is_empty());
    }
}
