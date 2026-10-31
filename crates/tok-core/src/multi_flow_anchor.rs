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

        self.commentary_to_anchor
            .insert(comm_node, anchor_id.clone());

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
    pub fn get_commentaries_for_primary_node(
        &self,
        primary_node_id: NodeId,
    ) -> Vec<&CommentaryLink> {
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
    pub fn get_anchor_for_commentary(
        &self,
        commentary_node_id: NodeId,
    ) -> Option<&AnchorDefinition> {
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

    /// Automatically synthesizes bidirectional anchor dependencies between a primary flow
    /// and commentary flows by extracting Dibur HaMatchil (DH) textual cues or sequential links.
    pub fn synthesize_or_default(
        primary_flow: &crate::model::Flow,
        commentary_flows: &[&crate::model::Flow],
    ) -> Self {
        let mut map = Self::new();
        if primary_flow.paragraphs.is_empty() {
            return map;
        }

        fn extract_hebrew_words(s: &str) -> Vec<String> {
            s.chars()
                .filter(|c| {
                    let u = *c as u32;
                    (0x05D0..=0x05EA).contains(&u) || c.is_whitespace()
                })
                .collect::<String>()
                .split_whitespace()
                .map(|w| w.to_string())
                .collect()
        }

        fn extract_cue(text: &str) -> Option<String> {
            // Check for <b>...</b> or <strong>...</strong>
            if let Some(start) = text.find("<b>") {
                if let Some(end) = text[start + 3..].find("</b>") {
                    let inside = &text[start + 3..start + 3 + end];
                    let words = extract_hebrew_words(inside);
                    if !words.is_empty() {
                        return Some(words.join(" "));
                    }
                }
            }
            if let Some(start) = text.find("<strong>") {
                if let Some(end) = text[start + 8..].find("</strong>") {
                    let inside = &text[start + 8..start + 8 + end];
                    let words = extract_hebrew_words(inside);
                    if !words.is_empty() {
                        return Some(words.join(" "));
                    }
                }
            }
            // Check before colon, dash, em-dash, or period
            for delim in [':', '-', '—', '.'] {
                if let Some(pos) = text.find(delim) {
                    let prefix = &text[..pos];
                    let words = extract_hebrew_words(prefix);
                    if !words.is_empty() && words.len() <= 6 {
                        return Some(words.join(" "));
                    }
                }
            }
            // Fallback to first 3 words
            let words = extract_hebrew_words(text);
            if words.len() >= 2 {
                Some(words[..words.len().min(3)].join(" "))
            } else if !words.is_empty() {
                Some(words[0].clone())
            } else {
                None
            }
        }

        let primary_cleaned: Vec<(NodeId, Vec<String>)> = primary_flow
            .paragraphs
            .iter()
            .map(|p| (p.id, extract_hebrew_words(&p.text)))
            .collect();

        for comm_flow in commentary_flows {
            for (c_idx, c_para) in comm_flow.paragraphs.iter().enumerate() {
                let cue_opt = extract_cue(&c_para.text);
                let mut matched_primary_id = None;

                if let Some(ref cue) = cue_opt {
                    let cue_words: Vec<&str> = cue.split_whitespace().collect();
                    for (p_id, p_words) in &primary_cleaned {
                        let p_strs: Vec<&str> = p_words.iter().map(|s| s.as_str()).collect();
                        let is_match = p_strs
                            .windows(cue_words.len())
                            .any(|w| w == cue_words.as_slice())
                            || (cue_words.len() > 1
                                && p_strs
                                    .windows(cue_words.len() - 1)
                                    .any(|w| w == &cue_words[..cue_words.len() - 1]))
                            || (!cue_words.is_empty() && p_strs.iter().any(|w| *w == cue_words[0]));

                        if is_match {
                            matched_primary_id = Some(*p_id);
                            break;
                        }
                    }
                }

                if let Some(target_primary_id) = matched_primary_id {
                    let anchor_id = AnchorId::new(format!("anc_{}_{}", comm_flow.id.0, c_para.id));
                    let anchor_def = AnchorDefinition::new(
                        anchor_id.clone(),
                        primary_flow.id.clone(),
                        target_primary_id,
                        TextAnchor::start_of(target_primary_id),
                    )
                    .with_label(cue_opt.unwrap_or_else(|| format!("anchor_{}", c_idx)));

                    map.register_anchor(anchor_def);
                    map.link_commentary(
                        CommentaryLink::new(comm_flow.id.clone(), c_para.id, anchor_id)
                            .with_priority(c_idx as u32),
                    );
                }
            }
        }

        map
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::anchor::AnchorBias;
    use crate::id::FractionalIndex;
    use crate::model::DocumentRoot;

    #[test]
    fn test_multi_flow_anchor_registration_and_bidirectional_lookup() {
        let mut map = MultiFlowAnchorMap::new();

        let p1 = NodeId::new();
        let r1 = NodeId::new();
        let t1 = NodeId::new();
        let t2 = NodeId::new();

        let a1 = AnchorId::new("anchor_berakhot_2a_1");
        let def = AnchorDefinition::new(
            a1.clone(),
            FlowId::new("gemara"),
            p1,
            TextAnchor::new(p1, FractionalIndex::initial(), AnchorBias::Before),
        )
        .with_label("ד\"ה מאימתי");

        map.register_anchor(def.clone());

        // Link Rashi
        map.link_commentary(
            CommentaryLink::new(FlowId::new("rashi"), r1, a1.clone()).with_priority(0),
        );
        // Link Tosafot item 1
        map.link_commentary(
            CommentaryLink::new(FlowId::new("tosafot"), t1, a1.clone()).with_priority(1),
        );
        // Link Tosafot item 2
        map.link_commentary(
            CommentaryLink::new(FlowId::new("tosafot"), t2, a1.clone()).with_priority(2),
        );

        // 1. Verify anchor retrieval
        assert_eq!(map.get_anchor(&a1), Some(&def));

        // 2. Verify commentaries for anchor
        let comms = map.get_commentaries_for_anchor(&a1);
        assert_eq!(comms.len(), 3);
        assert_eq!(comms[0].commentary_node_id, r1);
        assert_eq!(comms[1].commentary_node_id, t1);
        assert_eq!(comms[2].commentary_node_id, t2);

        // 3. Verify commentaries for primary node
        let p_comms = map.get_commentaries_for_primary_node(p1);
        assert_eq!(p_comms.len(), 3);

        // 4. Verify reverse lookups (commentary -> anchor and primary node)
        assert_eq!(map.get_anchor_for_commentary(r1), Some(&def));
        assert_eq!(map.get_primary_node_for_commentary(t1), Some(p1));
        assert_eq!(map.get_primary_node_for_commentary(t2), Some(p1));
    }

    #[test]
    fn test_detect_cascading_commentaries() {
        let mut map = MultiFlowAnchorMap::new();

        let p1 = NodeId::new();
        let p2 = NodeId::new();

        let r1 = NodeId::new();
        let t1 = NodeId::new();
        let r2 = NodeId::new();
        let t2 = NodeId::new();

        let a1 = AnchorId::new("a1");
        let a2 = AnchorId::new("a2");

        map.register_anchor(AnchorDefinition::new(
            a1.clone(),
            FlowId::new("gemara"),
            p1,
            TextAnchor::start_of(p1),
        ));
        map.register_anchor(AnchorDefinition::new(
            a2.clone(),
            FlowId::new("gemara"),
            p2,
            TextAnchor::start_of(p2),
        ));

        map.link_commentary(CommentaryLink::new(FlowId::new("rashi"), r1, a1.clone()));
        map.link_commentary(CommentaryLink::new(FlowId::new("tosafot"), t1, a1.clone()));

        map.link_commentary(CommentaryLink::new(FlowId::new("rashi"), r2, a2.clone()));
        map.link_commentary(CommentaryLink::new(FlowId::new("tosafot"), t2, a2.clone()));

        // Case A: Only P2 is moved forward (e.g. pushed to next page due to edits in P1)
        let cascade_p2 = map.detect_cascading_commentaries(&[p2]);
        assert_eq!(cascade_p2.len(), 2);
        assert_eq!(cascade_p2[0], (FlowId::new("rashi"), r2));
        assert_eq!(cascade_p2[1], (FlowId::new("tosafot"), t2));

        // Case B: Both P1 and P2 moved
        let cascade_both = map.detect_cascading_commentaries(&[p1, p2]);
        assert_eq!(cascade_both.len(), 4);
        assert_eq!(cascade_both[0], (FlowId::new("rashi"), r1));
        assert_eq!(cascade_both[1], (FlowId::new("tosafot"), t1));
        assert_eq!(cascade_both[2], (FlowId::new("rashi"), r2));
        assert_eq!(cascade_both[3], (FlowId::new("tosafot"), t2));
    }

    #[test]
    fn test_reindex_nodes_preserves_anchor_integrity() {
        let mut map = MultiFlowAnchorMap::new();

        let p_old = NodeId::new();
        let r_old = NodeId::new();
        let a1 = AnchorId::new("a1");

        map.register_anchor(AnchorDefinition::new(
            a1.clone(),
            FlowId::new("main"),
            p_old,
            TextAnchor::start_of(p_old),
        ));
        map.link_commentary(CommentaryLink::new(FlowId::new("rashi"), r_old, a1.clone()));

        // Create new IDs
        let p_new = NodeId::new();
        let r_new = NodeId::new();

        let mut id_map = HashMap::new();
        id_map.insert(p_old, p_new);
        id_map.insert(r_old, r_new);

        map.reindex_nodes(&id_map);

        // Verification after reindex
        assert_eq!(map.get_anchor(&a1).unwrap().primary_node_id, p_new);
        assert_eq!(map.get_primary_node_for_commentary(r_new), Some(p_new));
        assert_eq!(
            map.get_commentaries_for_primary_node(p_new)[0].commentary_node_id,
            r_new
        );
    }

    #[test]
    fn test_remove_anchor_and_unlink_commentary() {
        let mut map = MultiFlowAnchorMap::new();
        let p = NodeId::new();
        let r = NodeId::new();
        let a = AnchorId::new("a");

        map.register_anchor(AnchorDefinition::new(
            a.clone(),
            FlowId::new("main"),
            p,
            TextAnchor::start_of(p),
        ));
        map.link_commentary(CommentaryLink::new(FlowId::new("rashi"), r, a.clone()));

        assert_eq!(map.get_primary_node_for_commentary(r), Some(p));

        // 1. Unlink commentary
        map.unlink_commentary(r);
        assert_eq!(map.get_primary_node_for_commentary(r), None);
        assert!(map.get_commentaries_for_anchor(&a).is_empty());
        assert!(map.get_anchor(&a).is_some());

        // 2. Remove anchor
        map.remove_anchor(&a);
        assert!(map.get_anchor(&a).is_none());
        assert!(map.get_commentaries_for_primary_node(p).is_empty());
    }

    #[test]
    fn test_serialization_roundtrip_with_document_root_and_section_node() {
        let mut doc = DocumentRoot::new("תלמוד עם קישורים רב-פלגיים");
        let p = NodeId::new();
        let r = NodeId::new();
        let a = AnchorId::new("a1");

        let mut anchor_map = MultiFlowAnchorMap::new();
        anchor_map.register_anchor(AnchorDefinition::new(
            a.clone(),
            FlowId::new("main"),
            p,
            TextAnchor::start_of(p),
        ));
        anchor_map.link_commentary(CommentaryLink::new(FlowId::new("rashi"), r, a.clone()));

        doc.sections[0].anchors = anchor_map.clone();
        doc.multi_flow_anchors = Some(anchor_map);

        let json = serde_json::to_string_pretty(&doc).unwrap();
        let deserialized: DocumentRoot = serde_json::from_str(&json).unwrap();

        assert_eq!(doc.sections[0].anchors, deserialized.sections[0].anchors);
        assert_eq!(doc.multi_flow_anchors, deserialized.multi_flow_anchors);
    }

    #[test]
    fn test_synthesize_or_default_with_dibur_hamatchil() {
        use crate::model::{Flow, FlowType, ParagraphNode};

        let mut primary_flow = Flow::new(FlowId::new("gemara"), FlowType::Main);
        let p1 = ParagraphNode::new(
            FractionalIndex::initial(),
            "gemara",
            "מֵאֵימָתַי קוֹרִין אֶת שְׁמַע בְּעַרְבִית? מִשָּׁעָה שֶׁהַכֹּהֲנִים נִכְנָסִים לֶאֱכֹל בִּתְרוּמָתָן.",
        );
        let p2 = ParagraphNode::new(
            FractionalIndex::new("a1"),
            "gemara",
            "תַּנָּא הֵיכָא קָאֵי דְּקָתָנֵי מֵאֵימָתַי? וְתוּ, מַאי שְׁנָא דְּתָנֵי בְּעַרְבִית בְּרֵישָׁא?",
        );
        let p1_id = p1.id;
        let p2_id = p2.id;
        primary_flow.paragraphs.push(p1);
        primary_flow.paragraphs.push(p2);

        let mut rashi_flow = Flow::new(FlowId::new("rashi"), FlowType::CommentA);
        let r1 = ParagraphNode::new(
            FractionalIndex::initial(),
            "rashi",
            "<b>מֵאֵימָתַי קוֹרִין</b> - תַּנָּא אַקְּרָא קָאֵי דִּכְתִיב בְּשָׁכְבְּךָ וּבְקוּמֶךָ.",
        );
        let r2 = ParagraphNode::new(
            FractionalIndex::new("a1"),
            "rashi",
            "<b>דְּקָתָנֵי מֵאֵימָתַי</b> - מִכְּלָל דִּפְשִׁיטָא לֵיהּ דְּחוֹבָה הִיא.",
        );
        let r1_id = r1.id;
        let r2_id = r2.id;
        rashi_flow.paragraphs.push(r1);
        rashi_flow.paragraphs.push(r2);

        let synthesized = MultiFlowAnchorMap::synthesize_or_default(&primary_flow, &[&rashi_flow]);

        assert_eq!(
            synthesized.get_primary_node_for_commentary(r1_id),
            Some(p1_id)
        );
        assert_eq!(
            synthesized.get_primary_node_for_commentary(r2_id),
            Some(p2_id)
        );
    }
}
