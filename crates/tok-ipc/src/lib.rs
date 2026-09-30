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
            IpcEvent::TransactionApplied { revision, affected_pages } => {
                assert_eq!(revision, 42);
                assert_eq!(affected_pages, vec![1, 2, 3]);
            }
            _ => panic!("Decoded wrong event type"),
        }
    }
}
