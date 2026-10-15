//! `tok-ipc` - Zero-Copy Binary IPC Bridge for TypesetOK (TOK).
//!
//! Provides high-speed communication between Electron / TypeScript UI and the Rust Core engine.

pub mod protocol;

pub use protocol::{
    ColumnBalanceIpcReport, DropCapIpcConfig, ExclusionZoneIpcPayload, GlyphGeometry,
    HeightBalanceIpcConfig, HitTestResult, IpcCommand, IpcEvent, LineGeometry, MessageFramer,
    PageGeometryPayload,
};

#[cfg(test)]
mod tests {
    use super::*;
    use tok_core::anchor::TextAnchor;
    use tok_core::id::NodeId;

    #[test]
    fn test_ipc_command_framing() {
        let node_id = NodeId::new();
        let cmd = IpcCommand::InsertText {
            anchor: TextAnchor::start_of(node_id),
            text: "שלום עולם".to_string(),
        };

        let encoded = MessageFramer::encode_command(&cmd).expect("Encoding must succeed");
        assert!(encoded.len() > 4, "Must contain length prefix and payload");

        let decoded = MessageFramer::decode_command(&encoded).expect("Decoding must succeed");
        match decoded {
            IpcCommand::InsertText { anchor, text } => {
                assert_eq!(anchor.node_id, node_id);
                assert_eq!(text, "שלום עולם");
            }
            _ => panic!("Decoded wrong command type"),
        }
    }

    #[test]
    fn test_ipc_event_framing() {
        let evt = IpcEvent::TransactionApplied {
            revision: 42,
            affected_pages: vec![1, 2, 3],
        };

        let encoded = MessageFramer::encode_event(&evt).expect("Encoding must succeed");
        let decoded = MessageFramer::decode_event(&encoded).expect("Decoding must succeed");

        match decoded {
            IpcEvent::TransactionApplied {
                revision,
                affected_pages,
            } => {
                assert_eq!(revision, 42);
                assert_eq!(affected_pages, vec![1, 2, 3]);
            }
            _ => panic!("Decoded wrong event type"),
        }
    }

    #[test]
    fn test_framing_truncated_message() {
        // Claims 255 bytes payload but only 1 byte present
        let bytes = vec![0xFF, 0x00, 0x00, 0x00, 0x01];
        let result = MessageFramer::decode_command(&bytes);
        assert!(result.is_err(), "Truncated message must return error");
    }

    #[test]
    fn test_all_command_delete_range_roundtrip() {
        let start_node = NodeId::new();
        let end_node = start_node;
        let cmd = IpcCommand::DeleteRange {
            start: TextAnchor::start_of(start_node),
            end: TextAnchor::end_of(end_node),
        };
        let encoded = MessageFramer::encode_command(&cmd).expect("Encode must succeed");
        let decoded = MessageFramer::decode_command(&encoded).expect("Decode must succeed");
        match decoded {
            IpcCommand::DeleteRange { start, end } => {
                assert_eq!(start.node_id, start_node);
                assert_eq!(end.node_id, end_node);
            }
            _ => panic!("Decoded wrong command type"),
        }
    }

    #[test]
    fn test_drop_cap_and_polygon_exclusion_ipc_roundtrip() {
        let p_id = NodeId::new();
        let cmd = IpcCommand::ConfigureDropCap {
            paragraph_id: p_id,
            config: DropCapIpcConfig {
                lines: 3,
                characters_count: 5,
                distance_pt: 8.0,
                is_bold: true,
                font_family: Some("Frank Ruhl Libre".to_string()),
                scale_factor: Some(2.8),
            },
        };

        let encoded = MessageFramer::encode_command(&cmd).expect("Encode must succeed");
        let decoded = MessageFramer::decode_command(&encoded).expect("Decode must succeed");
        assert_eq!(cmd, decoded);

        let zone_cmd = IpcCommand::AddExclusionZone {
            frame_id: "frame_gemara".to_string(),
            zone: ExclusionZoneIpcPayload {
                id: "ex_1".to_string(),
                x_pt: 10.0,
                y_pt: 20.0,
                width_pt: 60.0,
                height_pt: 45.0,
                standoff_pt: 6.0,
            },
        };
        let enc_zone = MessageFramer::encode_command(&zone_cmd).expect("Encode must succeed");
        let dec_zone = MessageFramer::decode_command(&enc_zone).expect("Decode must succeed");
        assert_eq!(zone_cmd, dec_zone);
    }

    #[test]
    fn test_multi_flow_anchor_and_height_balancing_ipc_roundtrip() {
        let p_id = NodeId::new();
        let c_id = NodeId::new();
        let link_cmd = IpcCommand::LinkMultiFlowAnchor {
            primary_node_id: p_id,
            commentary_node_id: c_id,
            anchor_id: "anc_dh1".to_string(),
            commentary_flow_id: "rashi".to_string(),
        };
        let enc_link = MessageFramer::encode_command(&link_cmd).expect("Encode link");
        let dec_link = MessageFramer::decode_command(&enc_link).expect("Decode link");
        assert_eq!(link_cmd, dec_link);

        let cascade_evt = IpcEvent::AnchorCascadeTriggered {
            displaced_primary_node: p_id,
            cascaded_commentaries: vec![("rashi".to_string(), c_id, 2)],
        };
        let enc_casc = MessageFramer::encode_event(&cascade_evt).expect("Encode cascade");
        let dec_casc = MessageFramer::decode_event(&enc_casc).expect("Decode cascade");
        assert_eq!(cascade_evt, dec_casc);

        let bal_evt = IpcEvent::ColumnsBalanced {
            page_index: 1,
            balanced_bottom_baseline_pt: 520.0,
            reports: vec![ColumnBalanceIpcReport {
                flow_id: "rashi".to_string(),
                original_bottom_y_pt: 495.0,
                balanced_bottom_y_pt: 520.0,
                spring_injected_pt: 25.0,
            }],
        };
        let enc_bal = MessageFramer::encode_event(&bal_evt).expect("Encode balanced");
        let dec_bal = MessageFramer::decode_event(&enc_bal).expect("Decode balanced");
        assert_eq!(bal_evt, dec_bal);
    }
}
