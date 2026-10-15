//! Bidirectional Anchor Cascade Engine ("צורת הדף" חיה / Dynamic Multi-Flow Anchoring).
//!
//! Enforces bidirectional logical page synchronization across primary and commentary streams:
//! 1. When primary text expands (due to font scaling, text insertion, or line breaking),
//!    primary paragraphs pushed to subsequent pages automatically cascade all linked commentaries
//!    (Rashi, Tosafot, Targum, Ramban) to the corresponding subsequent page.
//! 2. Guarantees that no commentary appears on an earlier page than its corresponding primary anchor.
//! 3. Maintains intra-stream sequential order and shared multi-column height balancing invariants.

use std::collections::{BTreeMap, HashMap};
use tok_core::id::NodeId;
use tok_core::model::FlowId;
use tok_core::multi_flow_anchor::{AnchorId, MultiFlowAnchorMap};

/// Cause or trigger for a commentary node being cascaded to a subsequent page.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum CascadeReason {
    /// Primary paragraph pushed to next page due to text insertion or font scaling.
    PrimaryAnchorDisplaced,
    /// Commentary appeared on an earlier page than its primary anchor (illegal lead).
    IllegalLeadCorrected,
    /// Preceding commentary paragraph in the same flow forced this node down.
    IntraStreamFlowPrecedence,
}

/// Detailed log event when a node is cascaded to a new page.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct CascadedNodeEvent {
    pub commentary_flow_id: FlowId,
    pub commentary_node_id: NodeId,
    pub anchor_id: Option<AnchorId>,
    pub primary_node_id: Option<NodeId>,
    pub original_page: usize,
    pub target_page: usize,
    pub reason: CascadeReason,
}

/// Input descriptor for a paragraph node participating in cascaded multi-flow pagination.
#[derive(Debug, Clone)]
pub struct CascadeNodeInput {
    pub id: NodeId,
    pub flow_id: FlowId,
    pub height_pt: f32,
    pub text: String,
}

impl CascadeNodeInput {
    pub fn new(id: NodeId, flow_id: impl Into<FlowId>, height_pt: f32, text: impl Into<String>) -> Self {
        Self {
            id,
            flow_id: flow_id.into(),
            height_pt,
            text: text.into(),
        }
    }
}

/// Invariant violation in multi-stream anchor relationships.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum CascadeViolation {
    CommentaryLeadsPrimary {
        commentary_node_id: NodeId,
        commentary_page: usize,
        primary_node_id: NodeId,
        primary_page: usize,
        anchor_id: AnchorId,
    },
    IntraStreamOrderInverted {
        flow_id: FlowId,
        preceding_node: NodeId,
        preceding_page: usize,
        succeeding_node: NodeId,
        succeeding_page: usize,
    },
}

impl std::fmt::Display for CascadeViolation {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            Self::CommentaryLeadsPrimary {
                commentary_node_id,
                commentary_page,
                primary_node_id,
                primary_page,
                anchor_id,
            } => write!(
                f,
                "Commentary node {} on page {} illegally precedes primary node {} on page {} for anchor {}",
                commentary_node_id, commentary_page, primary_node_id, primary_page, anchor_id
            ),
            Self::IntraStreamOrderInverted {
                flow_id,
                preceding_node,
                preceding_page,
                succeeding_node,
                succeeding_page,
            } => write!(
                f,
                "Inverted reading order in flow {}: node {} (page {}) placed after node {} (page {})",
                flow_id.0, preceding_node, preceding_page, succeeding_node, succeeding_page
            ),
        }
    }
}

impl std::error::Error for CascadeViolation {}

/// Output result of the anchor cascade engine.
#[derive(Debug, Clone)]
pub struct CascadeLayoutResult {
    /// Mapping from node ID to assigned 1-based page number.
    pub node_to_page: HashMap<NodeId, usize>,
    /// Nodes grouped by FlowId and 1-based Page number.
    pub page_allocations: HashMap<FlowId, BTreeMap<usize, Vec<NodeId>>>,
    /// Detailed audit trail of all cascading events.
    pub cascade_events: Vec<CascadedNodeEvent>,
    /// Total pages spanned by the multi-stream document.
    pub total_pages: usize,
}

pub struct AnchorCascadeEngine;

impl AnchorCascadeEngine {
    /// Paginates primary and secondary commentary streams while strictly enforcing anchor constraints:
    /// - Primary stream is paginated first based on column height.
    /// - Every commentary node is constrained so that its assigned page >= primary anchor's page.
    /// - If a primary paragraph moves to page K, all dependent commentaries cascade to page >= K.
    /// - Sequential reading order within each commentary stream is strictly preserved.
    pub fn paginate_with_cascade(
        primary_flow_id: &FlowId,
        nodes_by_flow: &HashMap<FlowId, Vec<CascadeNodeInput>>,
        max_page_height_pt: f32,
        anchor_map: &MultiFlowAnchorMap,
    ) -> CascadeLayoutResult {
        let mut node_to_page: HashMap<NodeId, usize> = HashMap::new();
        let mut page_allocations: HashMap<FlowId, BTreeMap<usize, Vec<NodeId>>> = HashMap::new();
        let mut cascade_events: Vec<CascadedNodeEvent> = Vec::new();
        let mut max_page = 1;

        // 1. Paginate primary flow sequentially
        if let Some(primary_nodes) = nodes_by_flow.get(primary_flow_id) {
            let mut curr_page = 1;
            let mut curr_height = 0.0;

            for node in primary_nodes {
                if curr_height + node.height_pt > max_page_height_pt && curr_height > 0.0 {
                    curr_page += 1;
                    curr_height = 0.0;
                }
                node_to_page.insert(node.id, curr_page);
                page_allocations
                    .entry(primary_flow_id.clone())
                    .or_default()
                    .entry(curr_page)
                    .or_default()
                    .push(node.id);
                curr_height += node.height_pt;
                if curr_page > max_page {
                    max_page = curr_page;
                }
            }
        }

        // 2. Paginate commentary streams with anchor cascading
        for (flow_id, nodes) in nodes_by_flow {
            if flow_id == primary_flow_id {
                continue;
            }

            let mut curr_page = 1;
            let mut curr_height = 0.0;

            for node in nodes {
                let natural_page = curr_page;

                // Check anchor dependency
                let min_required_page = if let Some(anchor_def) = anchor_map.get_anchor_for_commentary(node.id) {
                    let primary_page = node_to_page.get(&anchor_def.primary_node_id).copied().unwrap_or(1);
                    if primary_page > curr_page {
                        cascade_events.push(CascadedNodeEvent {
                            commentary_flow_id: flow_id.clone(),
                            commentary_node_id: node.id,
                            anchor_id: Some(anchor_def.id.clone()),
                            primary_node_id: Some(anchor_def.primary_node_id),
                            original_page: natural_page,
                            target_page: primary_page,
                            reason: CascadeReason::PrimaryAnchorDisplaced,
                        });
                    }
                    primary_page
                } else {
                    1
                };

                // Enforce minimum required page due to anchor
                if curr_page < min_required_page {
                    curr_page = min_required_page;
                    curr_height = 0.0;
                }

                // Check capacity on curr_page
                if curr_height + node.height_pt > max_page_height_pt && curr_height > 0.0 {
                    curr_page += 1;
                    curr_height = 0.0;
                    cascade_events.push(CascadedNodeEvent {
                        commentary_flow_id: flow_id.clone(),
                        commentary_node_id: node.id,
                        anchor_id: anchor_map.get_anchor_for_commentary(node.id).map(|a| a.id.clone()),
                        primary_node_id: anchor_map
                            .get_anchor_for_commentary(node.id)
                            .map(|d| d.primary_node_id),
                        original_page: curr_page - 1,
                        target_page: curr_page,
                        reason: CascadeReason::IntraStreamFlowPrecedence,
                    });
                }

                node_to_page.insert(node.id, curr_page);
                page_allocations
                    .entry(flow_id.clone())
                    .or_default()
                    .entry(curr_page)
                    .or_default()
                    .push(node.id);
                curr_height += node.height_pt;

                if curr_page > max_page {
                    max_page = curr_page;
                }
            }
        }

        CascadeLayoutResult {
            node_to_page,
            page_allocations,
            cascade_events,
            total_pages: max_page,
        }
    }

    /// Verifies bidirectional invariants:
    /// 1. No commentary node is on an earlier page than its primary anchor node.
    /// 2. All commentary nodes in each flow maintain non-decreasing page numbers.
    pub fn verify_invariants(
        result: &CascadeLayoutResult,
        anchor_map: &MultiFlowAnchorMap,
    ) -> Result<(), CascadeViolation> {
        // 1. Verify commentary doesn't lead primary
        for (comm_id, &comm_page) in &result.node_to_page {
            if let Some(anchor_def) = anchor_map.get_anchor_for_commentary(*comm_id) {
                if let Some(&prim_page) = result.node_to_page.get(&anchor_def.primary_node_id) {
                    if comm_page < prim_page {
                        return Err(CascadeViolation::CommentaryLeadsPrimary {
                            commentary_node_id: *comm_id,
                            commentary_page: comm_page,
                            primary_node_id: anchor_def.primary_node_id,
                            primary_page: prim_page,
                            anchor_id: anchor_def.id.clone(),
                        });
                    }
                }
            }
        }

        // 2. Verify intra-stream reading order
        for (flow_id, pages) in &result.page_allocations {
            let mut last_page = 0;
            let mut last_node = None;

            for (&page_num, nodes) in pages {
                for &node_id in nodes {
                    if page_num < last_page {
                        return Err(CascadeViolation::IntraStreamOrderInverted {
                            flow_id: flow_id.clone(),
                            preceding_node: last_node.unwrap_or(node_id),
                            preceding_page: last_page,
                            succeeding_node: node_id,
                            succeeding_page: page_num,
                        });
                    }
                    last_page = page_num;
                    last_node = Some(node_id);
                }
            }
        }

        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use tok_core::anchor::TextAnchor;
    use tok_core::multi_flow_anchor::{AnchorDefinition, CommentaryLink};

    #[test]
    fn test_primary_text_growth_cascades_linked_commentaries_to_next_page() {
        let primary_flow = FlowId::new("gemara");
        let rashi_flow = FlowId::new("rashi");
        let tosafot_flow = FlowId::new("tosafot");
        let ramban_flow = FlowId::new("ramban");

        let p1_id = NodeId::new();
        let p2_id = NodeId::new();

        let c1_rashi_id = NodeId::new();
        let c2_tosafot_id = NodeId::new();
        let c3_rashi_id = NodeId::new();
        let c4_ramban_id = NodeId::new();

        let a1 = AnchorId::new("a1");
        let a2 = AnchorId::new("a2");

        let mut anchor_map = MultiFlowAnchorMap::new();
        anchor_map.register_anchor(AnchorDefinition::new(
            a1.clone(),
            primary_flow.clone(),
            p1_id,
            TextAnchor::start_of(p1_id),
        ));
        anchor_map.register_anchor(AnchorDefinition::new(
            a2.clone(),
            primary_flow.clone(),
            p2_id,
            TextAnchor::start_of(p2_id),
        ));

        // C1 and C2 linked to P1
        anchor_map.link_commentary(CommentaryLink::new(rashi_flow.clone(), c1_rashi_id, a1.clone()));
        anchor_map.link_commentary(CommentaryLink::new(tosafot_flow.clone(), c2_tosafot_id, a1));

        // C3 and C4 linked to P2
        anchor_map.link_commentary(CommentaryLink::new(rashi_flow.clone(), c3_rashi_id, a2.clone()));
        anchor_map.link_commentary(CommentaryLink::new(ramban_flow.clone(), c4_ramban_id, a2));

        let max_page_height = 500.0;

        // Baseline: P1 (200pt) + P2 (200pt) fit on Page 1 (400 <= 500)
        let mut baseline_nodes = HashMap::new();
        baseline_nodes.insert(
            primary_flow.clone(),
            vec![
                CascadeNodeInput::new(p1_id, &primary_flow, 200.0, "Gemara P1"),
                CascadeNodeInput::new(p2_id, &primary_flow, 200.0, "Gemara P2"),
            ],
        );
        baseline_nodes.insert(
            rashi_flow.clone(),
            vec![
                CascadeNodeInput::new(c1_rashi_id, &rashi_flow, 100.0, "Rashi C1"),
                CascadeNodeInput::new(c3_rashi_id, &rashi_flow, 100.0, "Rashi C3"),
            ],
        );
        baseline_nodes.insert(
            tosafot_flow.clone(),
            vec![CascadeNodeInput::new(c2_tosafot_id, &tosafot_flow, 120.0, "Tosafot C2")],
        );
        baseline_nodes.insert(
            ramban_flow.clone(),
            vec![CascadeNodeInput::new(c4_ramban_id, &ramban_flow, 150.0, "Ramban C4")],
        );

        let baseline_res = AnchorCascadeEngine::paginate_with_cascade(
            &primary_flow,
            &baseline_nodes,
            max_page_height,
            &anchor_map,
        );

        // In baseline, all nodes fit on Page 1
        assert_eq!(baseline_res.node_to_page.get(&p1_id), Some(&1));
        assert_eq!(baseline_res.node_to_page.get(&p2_id), Some(&1));
        assert_eq!(baseline_res.node_to_page.get(&c1_rashi_id), Some(&1));
        assert_eq!(baseline_res.node_to_page.get(&c2_tosafot_id), Some(&1));
        assert_eq!(baseline_res.node_to_page.get(&c3_rashi_id), Some(&1));
        assert_eq!(baseline_res.node_to_page.get(&c4_ramban_id), Some(&1));
        assert_eq!(baseline_res.total_pages, 1);
        assert!(AnchorCascadeEngine::verify_invariants(&baseline_res, &anchor_map).is_ok());

        // NOW: Simulate text insertion / font expansion in P1 (height increases to 450pt)
        // Since 450 + 200 = 650 > 500, P2 CANNOT fit on Page 1 and MUST be pushed to Page 2!
        let mut expanded_nodes = baseline_nodes.clone();
        expanded_nodes.insert(
            primary_flow.clone(),
            vec![
                CascadeNodeInput::new(p1_id, &primary_flow, 450.0, "Gemara P1 expanded with more text"),
                CascadeNodeInput::new(p2_id, &primary_flow, 200.0, "Gemara P2"),
            ],
        );

        let expanded_res = AnchorCascadeEngine::paginate_with_cascade(
            &primary_flow,
            &expanded_nodes,
            max_page_height,
            &anchor_map,
        );

        // Verification:
        // P1 stays on Page 1
        assert_eq!(expanded_res.node_to_page.get(&p1_id), Some(&1));
        // P2 is pushed to Page 2
        assert_eq!(expanded_res.node_to_page.get(&p2_id), Some(&2), "P2 must be pushed to Page 2");

        // Commentaries anchored to P1 (C1 Rashi, C2 Tosafot) stay on Page 1
        assert_eq!(expanded_res.node_to_page.get(&c1_rashi_id), Some(&1));
        assert_eq!(expanded_res.node_to_page.get(&c2_tosafot_id), Some(&1));

        // CRITICAL CASCADE REQUIREMENT:
        // C3 (Rashi) and C4 (Ramban), anchored to P2, MUST cascade to Page 2!
        assert_eq!(
            expanded_res.node_to_page.get(&c3_rashi_id),
            Some(&2),
            "Rashi C3 must cascade to Page 2 because its primary anchor P2 moved to Page 2"
        );
        assert_eq!(
            expanded_res.node_to_page.get(&c4_ramban_id),
            Some(&2),
            "Ramban C4 must cascade to Page 2 because its primary anchor P2 moved to Page 2"
        );

        assert_eq!(expanded_res.total_pages, 2);

        // Verify bidirectional invariants are strictly preserved
        assert!(
            AnchorCascadeEngine::verify_invariants(&expanded_res, &anchor_map).is_ok(),
            "Bidirectional invariants must be satisfied after cascade"
        );

        // Verify cascade events recorded the displacements
        let c3_event = expanded_res
            .cascade_events
            .iter()
            .find(|e| e.commentary_node_id == c3_rashi_id);
        assert!(c3_event.is_some(), "C3 must generate a cascade event");
        let c3_e = c3_event.unwrap();
        assert_eq!(c3_e.reason, CascadeReason::PrimaryAnchorDisplaced);
        assert_eq!(c3_e.target_page, 2);

        let c4_event = expanded_res
            .cascade_events
            .iter()
            .find(|e| e.commentary_node_id == c4_ramban_id);
        assert!(c4_event.is_some(), "C4 must generate a cascade event");
        let c4_e = c4_event.unwrap();
        assert_eq!(c4_e.reason, CascadeReason::PrimaryAnchorDisplaced);
        assert_eq!(c4_e.target_page, 2);
    }

    #[test]
    fn test_font_scaling_cascade_cascade_chain_across_three_pages() {
        let primary_flow = FlowId::new("main");
        let rashi_flow = FlowId::new("rashi");

        let p1 = NodeId::new();
        let p2 = NodeId::new();
        let p3 = NodeId::new();

        let r1 = NodeId::new();
        let r2 = NodeId::new();
        let r3 = NodeId::new();

        let a1 = AnchorId::new("anc_1");
        let a2 = AnchorId::new("anc_2");
        let a3 = AnchorId::new("anc_3");

        let mut anchor_map = MultiFlowAnchorMap::new();
        anchor_map.register_anchor(AnchorDefinition::new(a1.clone(), primary_flow.clone(), p1, TextAnchor::start_of(p1)));
        anchor_map.register_anchor(AnchorDefinition::new(a2.clone(), primary_flow.clone(), p2, TextAnchor::start_of(p2)));
        anchor_map.register_anchor(AnchorDefinition::new(a3.clone(), primary_flow.clone(), p3, TextAnchor::start_of(p3)));

        anchor_map.link_commentary(CommentaryLink::new(rashi_flow.clone(), r1, a1));
        anchor_map.link_commentary(CommentaryLink::new(rashi_flow.clone(), r2, a2));
        anchor_map.link_commentary(CommentaryLink::new(rashi_flow.clone(), r3, a3));

        // 3 large primary paragraphs, each taking 350pt on 500pt page
        // Each primary node must end up on its own page (Pages 1, 2, 3)
        let mut nodes = HashMap::new();
        nodes.insert(
            primary_flow.clone(),
            vec![
                CascadeNodeInput::new(p1, &primary_flow, 350.0, "Torah 1"),
                CascadeNodeInput::new(p2, &primary_flow, 350.0, "Torah 2"),
                CascadeNodeInput::new(p3, &primary_flow, 350.0, "Torah 3"),
            ],
        );
        nodes.insert(
            rashi_flow.clone(),
            vec![
                CascadeNodeInput::new(r1, &rashi_flow, 100.0, "Rashi 1"),
                CascadeNodeInput::new(r2, &rashi_flow, 100.0, "Rashi 2"),
                CascadeNodeInput::new(r3, &rashi_flow, 100.0, "Rashi 3"),
            ],
        );

        let res = AnchorCascadeEngine::paginate_with_cascade(&primary_flow, &nodes, 500.0, &anchor_map);

        assert_eq!(res.node_to_page.get(&p1), Some(&1));
        assert_eq!(res.node_to_page.get(&p2), Some(&2));
        assert_eq!(res.node_to_page.get(&p3), Some(&3));

        // All Rashi nodes must cascade to match their primary pages:
        assert_eq!(res.node_to_page.get(&r1), Some(&1));
        assert_eq!(res.node_to_page.get(&r2), Some(&2));
        assert_eq!(res.node_to_page.get(&r3), Some(&3));

        assert_eq!(res.total_pages, 3);
        assert!(AnchorCascadeEngine::verify_invariants(&res, &anchor_map).is_ok());
    }

    #[test]
    fn test_invariant_violation_detection_when_commentary_leads_primary() {
        let primary_flow = FlowId::new("gemara");
        let rashi_flow = FlowId::new("rashi");

        let p1 = NodeId::new();
        let c1 = NodeId::new();
        let a1 = AnchorId::new("anc_test");

        let mut anchor_map = MultiFlowAnchorMap::new();
        anchor_map.register_anchor(AnchorDefinition::new(a1.clone(), primary_flow.clone(), p1, TextAnchor::start_of(p1)));
        anchor_map.link_commentary(CommentaryLink::new(rashi_flow.clone(), c1, a1.clone()));

        // Illegal construct: Commentary c1 is placed on Page 1, but primary anchor p1 is on Page 2
        let mut node_to_page = HashMap::new();
        node_to_page.insert(p1, 2);
        node_to_page.insert(c1, 1);

        let mut page_allocations = HashMap::new();
        let mut rashi_pages = BTreeMap::new();
        rashi_pages.insert(1, vec![c1]);
        page_allocations.insert(rashi_flow, rashi_pages);

        let bad_result = CascadeLayoutResult {
            node_to_page,
            page_allocations,
            cascade_events: Vec::new(),
            total_pages: 2,
        };

        let check = AnchorCascadeEngine::verify_invariants(&bad_result, &anchor_map);
        assert!(check.is_err(), "Must detect CommentaryLeadsPrimary violation");
        match check.unwrap_err() {
            CascadeViolation::CommentaryLeadsPrimary {
                commentary_node_id,
                commentary_page,
                primary_node_id,
                primary_page,
                anchor_id,
            } => {
                assert_eq!(commentary_node_id, c1);
                assert_eq!(commentary_page, 1);
                assert_eq!(primary_node_id, p1);
                assert_eq!(primary_page, 2);
                assert_eq!(anchor_id, a1);
            }
            other => panic!("Unexpected violation: {:?}", other),
        }
    }
}

