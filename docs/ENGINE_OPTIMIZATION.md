# Headless engine optimization and optional agent tools

Based on upstream `TypesetOK/typesetok` commit
`1c0ff958560bbce61a178ee620717b036ccc159f`. No frontend, Electron, npm,
desktop packaging or release changes are included in the upstream PR.

## Native Rust hot path

The previous line breaker rescanned all items between each pair of candidate
breakpoints. Prefix sums replace those scans with constant-time range queries.
With N items and B reachable break candidates, metric work changes from
O(B² N) worst case to O(N + B²), with three O(N) prefix arrays.
The DP and emergency fallback policies remain otherwise unchanged. In particular,
this does not fix all existing leading/trailing glue or discretionary penalty
semantics in the native breaker. Invalid nonfinite metrics/tolerance are rejected.
Prefix accumulation uses f64 and returns f32; floating-point boundary cases may
choose different breaks from the previous f32 summation order.

Rustybuzz reports UTF-8 byte clusters. Character extraction previously indexed a
Unicode scalar vector with those byte offsets, corrupting Hebrew/non-ASCII mapping.
It now slices at a checked byte offset, removes that allocation, and gives the
fallback shaper the same byte-offset convention. Clusters remain local to each
shaped run; this change does not claim paragraph-wide cluster offsets or full BiDi
integration in the existing fallback paragraph pipeline.

## Reproducible benchmark

```sh
CARGO_TARGET_DIR=target cargo run --release -p tok-typeset --example benchmark_line_break
```

Local Linux x86_64, rustc 1.99.0, median of five runs per corpus, same input and
release profile for upstream code and optimized code. The example source was
added unchanged to upstream for the baseline measurement.

| Words | Lines (both versions) | Before ms | After ms |
| ---: | ---: | ---: | ---: |
| 128 | 16 | 0.210 | 0.018 |
| 256 | 32 | 2.065 | 0.070 |
| 512 | 64 | 21.593 | 0.224 |
| 1024 | 128 | 223.405 | 1.021 |

This is a synthetic line-break benchmark, not an end-to-end desktop, pagination
or rendering speed claim. Timing is informative, not a CI threshold.

## Optional Function Calling adapter

See [the adapter guide](../tools/typesetting-agent/README.md). It provides font
inspection, shaped-run measurement, dictionary hyphenation, bounded global
paragraph optimization, polygon text slots, and literal-text PDF export.
Each tool has a callable implementation, matching JSON Schema, input limits,
and tests. Python/native dependencies are opt-in and separate from desktop/Cargo.

The adapter is intentionally not wired into Electron or `.tok` editing. The host
registers fonts, handles BiDi segmentation and maps geometry/break plans back to
its document model. PDF export uses Typst's layout, not the native Rust renderer
or the separate optimized slot plan. PDF/X and printer preflight are not provided.

Validation: 56 Rust unit tests, 14 Python tests (including exhaustive partition
comparison for 81 small paragraphs), rustfmt and workspace Clippy with warnings
as errors. Python PDF tests verify embedded fonts and ToUnicode for PDF 1.7 and
PDF/A-2b, and literal handling of text that resembles executable markup.
