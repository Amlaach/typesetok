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

use std::fmt;

#[derive(Debug)]
pub enum IpcError {
    Serialization(serde_json::Error),
    MessageTooLarge,
    PayloadTooLarge,
    InvalidLength,
}

impl fmt::Display for IpcError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Self::Serialization(e) => write!(f, "Serialization error: {}", e),
            Self::MessageTooLarge => write!(f, "Message exceeds MAX_MESSAGE_SIZE"),
            Self::PayloadTooLarge => write!(f, "Payload length exceeds u32::MAX"),
            Self::InvalidLength => write!(f, "Invalid message length or incomplete payload"),
        }
    }
}

impl std::error::Error for IpcError {}

impl From<serde_json::Error> for IpcError {
    fn from(e: serde_json::Error) -> Self {
        Self::Serialization(e)
    }
}

pub const MAX_MESSAGE_SIZE: u32 = 64 * 1024 * 1024;

/// Binary message framing (4-byte length prefix + payload).
pub struct MessageFramer;

impl MessageFramer {
    pub fn encode_command(cmd: &IpcCommand) -> Result<Vec<u8>, IpcError> {
        let payload = serde_json::to_vec(cmd)?;
        if payload.len() > u32::MAX as usize {
            return Err(IpcError::PayloadTooLarge);
        }
        let len = payload.len() as u32;
        if len > MAX_MESSAGE_SIZE {
            return Err(IpcError::MessageTooLarge);
        }
        let mut framed = Vec::with_capacity(4 + payload.len());
        framed.extend_from_slice(&len.to_le_bytes());
        framed.extend_from_slice(&payload);
        Ok(framed)
    }

    pub fn decode_command(bytes: &[u8]) -> Result<IpcCommand, IpcError> {
        if bytes.len() < 4 {
            return Err(IpcError::InvalidLength);
        }
        let mut len_bytes = [0u8; 4];
        len_bytes.copy_from_slice(&bytes[0..4]);
        let len = u32::from_le_bytes(len_bytes);
        if len > MAX_MESSAGE_SIZE {
            return Err(IpcError::MessageTooLarge);
        }
        if bytes.len() - 4 < len as usize {
            return Err(IpcError::InvalidLength);
        }
        Ok(serde_json::from_slice(&bytes[4..4 + len as usize])?)
    }

    pub fn encode_event(evt: &IpcEvent) -> Result<Vec<u8>, IpcError> {
        let payload = serde_json::to_vec(evt)?;
        if payload.len() > u32::MAX as usize {
            return Err(IpcError::PayloadTooLarge);
        }
        let len = payload.len() as u32;
        if len > MAX_MESSAGE_SIZE {
            return Err(IpcError::MessageTooLarge);
        }
        let mut framed = Vec::with_capacity(4 + payload.len());
        framed.extend_from_slice(&len.to_le_bytes());
        framed.extend_from_slice(&payload);
        Ok(framed)
    }

    pub fn decode_event(bytes: &[u8]) -> Result<IpcEvent, IpcError> {
        if bytes.len() < 4 {
            return Err(IpcError::InvalidLength);
        }
        let mut len_bytes = [0u8; 4];
        len_bytes.copy_from_slice(&bytes[0..4]);
        let len = u32::from_le_bytes(len_bytes);
        if len > MAX_MESSAGE_SIZE {
            return Err(IpcError::MessageTooLarge);
        }
        if bytes.len() - 4 < len as usize {
            return Err(IpcError::InvalidLength);
        }
        Ok(serde_json::from_slice(&bytes[4..4 + len as usize])?)
    }
}
