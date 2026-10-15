//! Multi-Stream Co-Pagination & Active Synchronization Module.
//!
//! Provides production-grade layout mathematics, active anchor synchronization,
//! multi-page co-pagination with automatic overflow splitting, and non-blocking
//! background worker execution for Talmud, Mikraot Gedolot, and academic commentaries.

pub mod cascade;
pub mod engine;
pub mod height_balance;
pub mod sync;
pub mod template;
pub mod worker;

pub use cascade::{
    AnchorCascadeEngine, CascadeLayoutResult, CascadeNodeInput, CascadeReason, CascadeViolation,
    CascadedNodeEvent,
};
pub use engine::{
    calculate_typographic_split, CoPaginatedChunk, CoPaginatedCommentary, CoPaginatedPage,
    CoPaginationDocument, CoPaginationEngine, CoPaginationResult,
};
pub use height_balance::{
    BalanceTargetMode, ColumnBalanceReport, HeightBalanceConfig, SharedColumnHeightBalancer,
};
pub use sync::{
    ActiveSyncResult, ActiveSynchronizer, AnchorKey, AnchorPoint, SyncRemedy, SynchronizerConfig,
};
pub use template::{ColumnAllocation, SpreadMathematics, TemplateConfig, TemplateKind};
pub use worker::{CancellationToken, NonBlockingPaginator, PaginationEvent};

