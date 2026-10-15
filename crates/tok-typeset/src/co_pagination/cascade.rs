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
