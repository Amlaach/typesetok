//! Deterministic tests for geometric constraint solving across multiple page sizes and column configurations.

use tok_core::FlowId;
use tok_typeset::multi_flow::SpreadSide;
use tok_typeset::solver::{
    ColumnSpec, ColumnWidthDistribution, ConstraintStrength, GeometricConstraintSolver,
    MultiColumnConstraintModel, PageConstraintModel, PageGeometryConfig, SolvedColumnAllocation,
};

/// Common standard book and document page sizes in points (72 pt / inch).
#[derive(Debug, Clone, Copy)]
#[allow(dead_code)]
struct PageSizePreset {
    name: &'static str,
    width_pt: f32,
    height_pt: f32,
    margin_inner_pt: f32,
    margin_outer_pt: f32,
    margin_top_pt: f32,
    margin_bottom_pt: f32,
}

const PRESETS: &[PageSizePreset] = &[
    PageSizePreset {
        name: "ISO A4",
        width_pt: 595.28,
        height_pt: 841.89,
        margin_inner_pt: 40.0,
        margin_outer_pt: 30.0,
        margin_top_pt: 36.0,
        margin_bottom_pt: 36.0,
    },
    PageSizePreset {
        name: "US Letter",
        width_pt: 612.0,
        height_pt: 792.0,
        margin_inner_pt: 45.0,
        margin_outer_pt: 35.0,
        margin_top_pt: 40.0,
        margin_bottom_pt: 40.0,
    },
    PageSizePreset {
        name: "Crown Quarto",
        width_pt: 535.75,
        height_pt: 697.32,
        margin_inner_pt: 38.0,
        margin_outer_pt: 28.0,
        margin_top_pt: 32.0,
        margin_bottom_pt: 32.0,
    },
    PageSizePreset {
        name: "Pocket (12mo)",
        width_pt: 340.0,
        height_pt: 510.0,
        margin_inner_pt: 25.0,
        margin_outer_pt: 20.0,
        margin_top_pt: 24.0,
        margin_bottom_pt: 24.0,
    },
];

fn verify_column_geometry(
    allocs: &[SolvedColumnAllocation],
    content_x: f32,
    content_y: f32,
    content_w: f32,
    content_h: f32,
    gutter: f32,
) {
    let n = allocs.len();
    assert!(n > 0);

    // 1. Overall bounds & alignment
    assert!(
        (allocs[0].rect.x - content_x).abs() < 1e-3,
        "First column left edge mismatch"
    );
    assert!(
        (allocs[n - 1].rect.right() - (content_x + content_w)).abs() < 1e-3,
        "Last column right edge mismatch"
    );

    for (i, a) in allocs.iter().enumerate() {
        assert!(
            (a.rect.y - content_y).abs() < 1e-3,
            "Column {} top alignment mismatch",
            i
        );
        assert!(
            (a.rect.height - content_h).abs() < 1e-3,
            "Column {} height mismatch",
            i
        );
        assert!(a.rect.width > 0.0, "Column {} width must be positive", i);
    }

    // 2. Strict non-overlap and exact gutter spacing
    for i in 0..(n - 1) {
        let left = &allocs[i].rect;
        let right = &allocs[i + 1].rect;
        let actual_gap = right.x - left.right();
        assert!(
            (actual_gap - gutter).abs() < 1e-3,
            "Gutter between col {} and {} must be exactly {}, got {}",
            i,
            i + 1,
            gutter,
            actual_gap
        );
        // Non-overlap condition
        assert!(
            left.right() <= right.x + 1e-4,
            "Columns {} and {} overlap!",
            i,
            i + 1
        );
    }

    // 3. Width conservation
    let total_col_width: f32 = allocs.iter().map(|a| a.rect.width).sum();
    let expected_total_col_width = content_w - (n - 1) as f32 * gutter;
    assert!(
        (total_col_width - expected_total_col_width).abs() < 1e-3,
        "Total columns width mismatch"
    );
}

#[test]
fn test_multi_page_sizes_equal_columns() {
    for preset in PRESETS {
        for &side in &[SpreadSide::Recto, SpreadSide::Verso] {
            for num_cols in 1..=5 {
                let mut solver = GeometricConstraintSolver::new();
                let page_model = PageConstraintModel::new();
                let config = PageGeometryConfig::new(
                    preset.width_pt,
                    preset.height_pt,
                    preset.margin_inner_pt,
                    preset.margin_outer_pt,
                    preset.margin_top_pt,
                    preset.margin_bottom_pt,
                    side,
                );

                page_model.apply(&mut solver, &config).unwrap();
                let content = page_model.get_content_rect(&solver);

                let flow_ids: Vec<FlowId> = (0..num_cols)
                    .map(|i| FlowId::new(format!("col_{}", i)))
                    .collect();
                let col_model = MultiColumnConstraintModel::new(&flow_ids);
                let specs: Vec<ColumnSpec> = flow_ids
                    .iter()
                    .map(|id| ColumnSpec::new(id.clone()))
                    .collect();

                let gutter = 10.0;
                col_model
                    .apply(&mut solver, &page_model, gutter, &specs)
                    .unwrap();

                ColumnWidthDistribution::Equal
                    .apply(
                        &mut solver,
                        &col_model.columns,
                        ConstraintStrength::Required,
                    )
                    .unwrap();

                let allocs = col_model.get_allocations(&solver);
                assert_eq!(allocs.len(), num_cols);

                verify_column_geometry(
                    &allocs,
                    content.x,
                    content.y,
                    content.width,
                    content.height,
                    gutter,
                );

                // All equal
                let first_w = allocs[0].rect.width;
                for a in &allocs {
                    assert!((a.rect.width - first_w).abs() < 1e-3);
                }
            }
        }
    }
}

#[test]
fn test_multi_page_sizes_talmud_and_mikraot_proportions() {
    for preset in PRESETS {
        for &side in &[SpreadSide::Recto, SpreadSide::Verso] {
            // 3-stream Talmud: 40% Main, 28% Rashi, 32% Tosafot
            {
                let mut solver = GeometricConstraintSolver::new();
                let page_model = PageConstraintModel::new();
                let config = PageGeometryConfig::new(
                    preset.width_pt,
                    preset.height_pt,
                    preset.margin_inner_pt,
                    preset.margin_outer_pt,
                    preset.margin_top_pt,
                    preset.margin_bottom_pt,
                    side,
                );

                page_model.apply(&mut solver, &config).unwrap();
                let content = page_model.get_content_rect(&solver);

                let flows = vec![
                    FlowId::new("rashi"),
                    FlowId::new("main"),
                    FlowId::new("tosafot"),
                ];
                let col_model = MultiColumnConstraintModel::new(&flows);
                let specs = vec![
                    ColumnSpec::new(FlowId::new("rashi")),
                    ColumnSpec::new(FlowId::new("main")),
                    ColumnSpec::new(FlowId::new("tosafot")),
                ];

                let gutter = 12.0;
                col_model
                    .apply(&mut solver, &page_model, gutter, &specs)
                    .unwrap();

                let ratios = vec![0.28, 0.40, 0.32];
                ColumnWidthDistribution::Proportional(ratios)
                    .apply(
                        &mut solver,
                        &col_model.columns,
                        ConstraintStrength::Required,
                    )
                    .unwrap();

                let allocs = col_model.get_allocations(&solver);
                verify_column_geometry(
                    &allocs,
                    content.x,
                    content.y,
                    content.width,
                    content.height,
                    gutter,
                );

                let avail_w = content.width - 2.0 * gutter;
                assert!((allocs[0].rect.width - avail_w * 0.28).abs() < 1e-2);
                assert!((allocs[1].rect.width - avail_w * 0.40).abs() < 1e-2);
                assert!((allocs[2].rect.width - avail_w * 0.32).abs() < 1e-2);
            }

            // 4-stream Mikraot Gedolot: 36%, 24%, 22%, 18%
            {
                let mut solver = GeometricConstraintSolver::new();
                let page_model = PageConstraintModel::new();
                let config = PageGeometryConfig::new(
                    preset.width_pt,
                    preset.height_pt,
                    preset.margin_inner_pt,
                    preset.margin_outer_pt,
                    preset.margin_top_pt,
                    preset.margin_bottom_pt,
                    side,
                );

                page_model.apply(&mut solver, &config).unwrap();
                let content = page_model.get_content_rect(&solver);

                let flows = vec![
                    FlowId::new("c1"),
                    FlowId::new("c2"),
                    FlowId::new("c3"),
                    FlowId::new("c4"),
                ];
                let col_model = MultiColumnConstraintModel::new(&flows);
                let specs: Vec<_> = flows.iter().map(|f| ColumnSpec::new(f.clone())).collect();

                let gutter = 8.0;
                col_model
                    .apply(&mut solver, &page_model, gutter, &specs)
                    .unwrap();

                let ratios = vec![0.36, 0.24, 0.22, 0.18];
                ColumnWidthDistribution::Proportional(ratios)
                    .apply(
                        &mut solver,
                        &col_model.columns,
                        ConstraintStrength::Required,
                    )
                    .unwrap();

                let allocs = col_model.get_allocations(&solver);
                verify_column_geometry(
                    &allocs,
                    content.x,
                    content.y,
                    content.width,
                    content.height,
                    gutter,
                );
            }
        }
    }
}

#[test]
fn test_overconstrained_layout_detection() {
    let mut solver = GeometricConstraintSolver::new();
    let page_model = PageConstraintModel::new();
    // Pocket page: 340 pt width, margins 25 + 20 = 45 -> content_width = 295 pt
    let config = PageGeometryConfig::new(340.0, 510.0, 25.0, 20.0, 24.0, 24.0, SpreadSide::Recto);
    page_model.apply(&mut solver, &config).unwrap();

    let flows = vec![FlowId::new("col1"), FlowId::new("col2")];
    let col_model = MultiColumnConstraintModel::new(&flows);

    // Each column requires at least 200 pt + 10 pt gutter = 410 pt > 295 pt!
    let specs = vec![
        ColumnSpec::new(FlowId::new("col1")).with_min_width(200.0),
        ColumnSpec::new(FlowId::new("col2")).with_min_width(200.0),
    ];

    let result = col_model.apply(&mut solver, &page_model, 10.0, &specs);
    assert!(
        result.is_err(),
        "Overconstrained columns must fail constraint satisfaction"
    );
}
