use serde::{Deserialize, Serialize};
use tok_core::anchor::TextAnchor;
use tok_core::id::NodeId;
use tok_core::transaction::CompoundTransaction;

/// High-speed binary IPC command sent from UI frontend to Rust Core.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(tag = "type", content = "payload")]
pub enum IpcCommand {
    InsertText {
        anchor: TextAnchor,
        text: String,
    },
    DeleteRange {
        start: TextAnchor,
        end: TextAnchor,
    },
    ApplyTransaction {
        transaction: CompoundTransaction,
    },
    QueryGeometry {
        page_index: u32,
    },
    HitTest {
        page_index: u32,
        x_pt: f32,
        y_pt: f32,
    },
    RequestRender {
        format: String, // "pdf" or "html"
        output_path: String,
    },
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct GlyphGeometry {
    pub cluster: u32,
    pub x_pt: f32,
    pub y_pt: f32,
    pub width_pt: f32,
    pub height_pt: f32,
    pub character: Option<char>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct LineGeometry {
    pub line_index: u32,
    pub baseline_y_pt: f32,
    pub height_pt: f32,
    pub text: String,
    pub glyphs: Vec<GlyphGeometry>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct PageGeometryPayload {
    pub page_index: u32,
    pub gematria_number: String,
    pub width_pt: f32,
    pub height_pt: f32,
    pub lines: Vec<LineGeometry>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct HitTestResult {
    pub node_id: NodeId,
    pub char_offset: usize,
    pub visual_x_pt: f32,
    pub visual_y_pt: f32,
    pub line_index: usize,
}

/// High-speed binary IPC event sent from Rust Core to UI frontend.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(tag = "type", content = "payload")]
pub enum IpcEvent {
    TransactionApplied {
        revision: u64,
        affected_pages: Vec<u32>,
    },
    GeometryUpdate {
        page: PageGeometryPayload,
    },
    HitTestResponse(HitTestResult),
    RenderCompleted {
        output_path: String,
        bytes_count: usize,
    },
    Error {
        code: u32,
        message: String,
    },
}

/// Binary message framing (4-byte length prefix + payload).
pub struct MessageFramer;

impl MessageFramer {
    pub fn encode_command(cmd: &IpcCommand) -> Result<Vec<u8>, serde_json::Error> {
        let payload = serde_json::to_vec(cmd)?;
        let len = (payload.len() as u32).to_le_bytes();
        let mut framed = Vec::with_capacity(4 + payload.len());
        framed.extend_from_slice(&len);
        framed.extend_from_slice(&payload);
        Ok(framed)
    }

    pub fn decode_command(bytes: &[u8]) -> Result<IpcCommand, serde_json::Error> {
        if bytes.len() >= 4 {
            serde_json::from_slice(&bytes[4..])
        } else {
            serde_json::from_slice(bytes)
        }
    }

    pub fn encode_event(evt: &IpcEvent) -> Result<Vec<u8>, serde_json::Error> {
        let payload = serde_json::to_vec(evt)?;
        let len = (payload.len() as u32).to_le_bytes();
        let mut framed = Vec::with_capacity(4 + payload.len());
        framed.extend_from_slice(&len);
        framed.extend_from_slice(&payload);
        Ok(framed)
    }

    pub fn decode_event(bytes: &[u8]) -> Result<IpcEvent, serde_json::Error> {
        if bytes.len() >= 4 {
            serde_json::from_slice(&bytes[4..])
        } else {
            serde_json::from_slice(bytes)
        }
    }
}
