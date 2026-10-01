//! `tok-ipc` - Zero-Copy Binary IPC Bridge for TypesetOK (TOK).
//!
//! Provides high-speed communication between Electron / TypeScript UI and the Rust Core engine.

pub mod protocol;

pub use protocol::{
    GlyphGeometry, HitTestResult, IpcCommand, IpcEvent, LineGeometry, MessageFramer,
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
}
