pub mod anchor;
pub mod dependency;
pub mod error;
pub mod header;
pub mod id;
pub mod model;
pub mod normalizer;
pub mod numbering;
pub mod outline;
pub mod overrides;
pub mod reference;
pub mod spans;
pub mod styles;
pub mod transaction;

pub use anchor::{AnchorBias, SemanticRange, TextAnchor};
pub use dependency::DocumentDependencyTracker;
pub use error::ModelError;
pub use header::{
    FootnoteApparatusConfig, HeaderExtractionRule, HeaderFolioPosition, HeaderSpreadSide,
    RunningHeaderConfig,
};
pub use id::{FractionalIndex, NodeId, Ulid};
pub use model::{
    DocumentMetadata, DocumentModel, DocumentRoot, Flow, FlowId, FlowType, ParagraphNode,
    SectionNode,
};
pub use normalizer::{HebrewMarkCategory, HebrewNormalizer};
pub use numbering::{GematriaPunctuation, NumberingFormatter, NumberingScheme, NumberingScope};
pub use outline::{DocumentHierarchyNode, DocumentOutline, HierarchyLevel};
pub use overrides::LayoutLockOverrides;
pub use reference::{
    CrossReferenceNode, CrossReferenceRegistry, ReferenceKind, ReferenceTarget,
};
pub use spans::{
    insert_range, is_canonical, normalize_spans, remove_range, spans_in_range, TextSpan,
};
pub use styles::{
    AhaltermStretchMode, CharacterFormat, CharacterStyle, Color, ParagraphStyle, Progression,
    StylePatch, TextAlignment,
};
pub use transaction::{AtomicOperation, CompoundTransaction, TransactionStack};
