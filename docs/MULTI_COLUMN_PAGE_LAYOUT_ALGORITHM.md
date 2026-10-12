# Multi-Column Page Layout Engine Refactoring & Algorithmic Architecture

## 1. Executive Summary & Problem Description
Traditional three-column desktop publishing layouts previously rendered Hebrew Talmudic/Rabbinic folios as rigid, parallel columns with uniform top baselines and simplistic footnote placement. 

In traditional Hebrew typography (exemplified by the Vilna Talmud and classic Mikraot Gedolot), content does not occupy static independent columns. Instead, the page requires an adaptive, dynamic multi-column structure featuring a primary centered column (Gemara / biblical core) surrounded by adaptive wrapping side columns (Inner and Outer commentary envelopes like Rashi and Tosafot).

This document details the architectural refactoring and algorithmic mechanisms implemented to satisfy the complex layout engine specifications.

---

## 2. Core Architectural & Algorithmic Rules

### Rule 1: Top Offset and Adaptive Wrapping Structure
1. **Top Offset Strategy:**
   * Outer envelope columns (Inner Envelope and Outer Envelope) initialize strictly at the top of the page frame (starting at line 1).
2. **Header Shift:**
   * The first 4 lines of the page layout consist exclusively of the two outer envelope columns (`HEADER_SHIFT_LINES = 4`, `HEADER_OFFSET_PX = 72px`).
   * A dedicated header shift spacer (`.tok-header-shift-spacer`) reserves lines 1–4 across the central region, preventing early center column protrusion.
3. **Center Column Insertion:**
   * The primary/center column begins exactly at line 5 (`data-start-line="5"`), positioned centrally between the two wrapping envelope columns.
4. **Dynamic Visual Weight & Adaptive Slanted Boundaries:**
   * The center column is granted higher typographic hierarchy and visual weight (14px font, bold weight, elevated line-height, subtle accent backing).
   * Outer envelope columns adaptively wrap around the center column. When commentary overflow occurs, adaptive step-like and slanted wrapping boundaries (`.tok-adaptive-step-boundary`, `.tok-slanted-boundary`) with geometric polygon clipping (`clip-path: polygon(...)`) form under the center column to seamlessly continue commentary streams according to historical Tzurat HaDaf traditions.

---

### Rule 2: Strict Bottom Alignment (Equal Baseline Justification)
1. **Uniform Grid Ending Baseline:**
   * The bottom boundary of the page body (excluding lower footnote/periphery notes) terminates at an identical horizontal Y-axis baseline across all active columns (`.tok-uniform-grid-baseline`, `.tok-baseline-terminator`).
2. **Balanced Distribution Algorithm (`calculateEqualBaselineDistribution`):**
   * Implemented in `FlowPaginator.calculateEqualBaselineDistribution(activeColCount, paraCounts, targetBodyHeightPx)`.
   * For 1, 2, or 3 active columns, the algorithm calculates proportional inter-paragraph vertical spacing (`rightSpacingPx`, `centerSpacingPx`, `leftSpacingPx`) to justify all columns downward to an identical baseline termination without visual rag.
   * Flex containers utilize `margin-top: auto` on baseline terminators to guarantee pixel-accurate Y-axis synchronization across columns.

---

### Rule 3: Column Separation & Missing Content Expansion
1. **Boundary Integrity & Strict Text Isolation:**
   * Columns enforce strict layout containment (`contain: layout style; isolation: isolate; overflow: hidden;`).
   * No text, inline spans, or decoration elements bleed or cross into adjacent column regions.
2. **Fallback Expansion Mechanism:**
   * When an outer envelope column has no content on a page, the engine activates fallback horizontal expansion (`.tok-col-expanded-fallback`, `data-fallback-expanded="true"`):
     * If Right column is absent and Left is present: Left outer envelope expands horizontally into `2.1fr 1.65fr`.
     * If Left column is absent and Right is present: Right outer envelope expands horizontally into `1.65fr 2.1fr`.
     * If both envelope columns are absent: Center column expands to full width `1fr`.
   * Expanded frames display contextual indicators and maintain full baseline justification.

---

## 3. Server Resilience & Environment Rectification
* Corrected server listen port to `3000` to prevent collision with container port `8080` (which previously triggered `EADDRINUSE` and dev server crashes during pre-warming).
* Replaced Express 5 incompatible wildcard route `app.get('*', ...)` with standard SPA fallback middleware `app.use((req, res) => res.sendFile(...))`.
* Added global `uncaughtException` and `unhandledRejection` guards ensuring continuous server uptime.

---

## 4. Test Suite Verification
All 172 tests across all 56 test suites pass with zero errors:
* `test/geometric_fidelity.test.mjs`: 8/8 passed
* `test/outcome_validation.test.mjs`: 6/6 passed
* `test/story_editor.test.mjs`: 15/15 passed
* `test/milestone_features.test.mjs`: 14/14 passed
* `test/importer.test.mjs` & `test/lifecycle_flow.test.mjs`: 26/26 passed
* `test/phase3_integration.test.mjs`: 13/13 passed
* `test/frontend.test.mjs`: 90/90 passed
* **Total: 172/172 passed, 0 failures, 0 skipped.**
