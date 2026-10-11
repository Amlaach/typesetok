//! End-to-end integration tests for multi-stream co-pagination, active anchor
//! synchronization, and asynchronous non-blocking pagination worker.

use std::sync::Arc;
use tok_typeset::{
    AnchorKey, CoPaginatedChunk, CoPaginatedCommentary, CoPaginationDocument, NonBlockingPaginator,
    PaginationEvent, SpreadSide, SyncRemedy, SynchronizerConfig, TemplateConfig, TypesettingEngine,
    TypesettingEngineConfig,
};

fn create_engine() -> TypesettingEngine {
    TypesettingEngine::new(TypesettingEngineConfig::default())
}

#[test]
fn test_multi_page_talmud_spread_facing_pages_alternation() {
    let engine = create_engine();
    let template = TemplateConfig::default();
    let sync_config = SynchronizerConfig::default();

    // Create a multi-page document with 4 chunks of Gemara and matching commentaries
    let mut main_chunks = Vec::new();
    let mut rashi_items = Vec::new();
    let mut tosafot_items = Vec::new();

    for i in 1..=4 {
        let anchor_name = format!("anchor_{}", i);
        main_chunks.push(CoPaginatedChunk {
            text: format!(
                "פסקה ראשית מספר {} מאימתי קורין את שמע בערבית משעה שהכהנים נכנסים לאכול בתרומתן עד סוף האשמורה הראשונה",
                i
            ),
            anchors: vec![(AnchorKey(anchor_name.clone()), "קורין".to_string())],
        });

        // Add enough commentary lines to push across multiple pages
        let rashi_text = (0..15)
            .map(|k| format!("רש\"י {} שורה {}: פירוש רש\"י מפורט הדן בדיני תרומה וזמני קריאת שמע של ערבית עד עמוד השחר וחצות לילה", i, k))
            .collect::<Vec<_>>()
            .join(" ");
        rashi_items.push(CoPaginatedCommentary {
            target_anchor: AnchorKey(anchor_name.clone()),
            text: rashi_text,
        });

        let tosafot_text = (0..15)
            .map(|k| format!("תוספות {} שורה {}: פירש הקונטרס דאקרא קאי ותימה דהא תנן לקמן בשחר מברך שתים לפניה", i, k))
            .collect::<Vec<_>>()
            .join(" ");
        tosafot_items.push(CoPaginatedCommentary {
            target_anchor: AnchorKey(anchor_name.clone()),
            text: tosafot_text,
        });
    }

    let doc = CoPaginationDocument {
        main_chunks,
        rashi_items,
        tosafot_items,
    };

    let result = engine.typeset_co_paginated_document(&template, &sync_config, &doc);
    assert!(
        result.pages.len() >= 2,
        "Expected at least 2 pages, got {}",
        result.pages.len()
    );

    // Verify Recto / Verso alternation
    for (idx, page) in result.pages.iter().enumerate() {
        let expected_recto = (idx + 1) % 2 == 1;
        let expected_side = if expected_recto {
            SpreadSide::Recto
        } else {
            SpreadSide::Verso
        };
        assert_eq!(
            page.math.side, expected_side,
            "Page {} recto/verso mismatch",
            page.page_number
        );

        let rashi_col = page
            .math
            .columns
            .iter()
            .find(|c| c.stream_id == "rashi")
            .unwrap();
        let tosafot_col = page
            .math
            .columns
            .iter()
            .find(|c| c.stream_id == "tosafot")
            .unwrap();

        // Recto: inner margin is on left (spine is left for Hebrew), Rashi is inner (left)
        // Verso: inner margin is on right (spine is right for Hebrew), Rashi is inner (right)
        if expected_recto {
            assert_eq!(page.math.margin_left_pt, template.margin_inner_pt);
            assert_eq!(page.math.margin_right_pt, template.margin_outer_pt);
            assert!(
                rashi_col.x_pt < tosafot_col.x_pt,
                "On Recto, Rashi (inner) must be to the left of Tosafot (outer)"
            );
        } else {
            assert_eq!(page.math.margin_left_pt, template.margin_outer_pt);
            assert_eq!(page.math.margin_right_pt, template.margin_inner_pt);
            assert!(
                tosafot_col.x_pt < rashi_col.x_pt,
                "On Verso, Tosafot (outer) must be to the left of Rashi (inner)"
            );
        }

        // Verify page layout frames
        assert_eq!(
            page.page_layout.frames.len(),
            3,
            "Each page must have 3 flow frames (gemara, rashi, tosafot)"
        );
    }
}

#[test]
fn test_active_synchronization_spring_remedy() {
    let engine = create_engine();
    let template = TemplateConfig::default();
    let sync_config = SynchronizerConfig {
        max_vertical_spring_pt: 100.0,
        max_tolerable_lag_pt: 14.0,
        grid_step_pt: None, // Continuous spring alignment
    };

    let doc = CoPaginationDocument {
        main_chunks: vec![
            CoPaginatedChunk {
                text: "שורת פתיחה ראשונה ללא עוגנים כדי לייצר מרחק אנכי משמעותי במרכז הדף עבור הגמרא והמשנה".to_string(),
                anchors: vec![],
            },
            CoPaginatedChunk {
                text: "ועכשיו מגיע עוגן ראשון הנמצא בשורה נמוכה יחסית במרכז".to_string(),
                anchors: vec![(AnchorKey("a1".to_string()), "עוגן".to_string())],
            },
        ],
        rashi_items: vec![CoPaginatedCommentary {
            target_anchor: AnchorKey("a1".to_string()),
            text: "עוגן: פירוש רש\"י המתחיל מוקדם".to_string(),
        }],
        tosafot_items: vec![],
    };

    let result = engine.typeset_co_paginated_document(&template, &sync_config, &doc);
    assert!(!result.pages.is_empty());
    let page0 = &result.pages[0];

    // Find sync result for anchor "a1"
    let sync_a1 = page0.sync_results.iter().find(|s| s.anchor_key.0 == "a1");
    assert!(
        sync_a1.is_some(),
        "Anchor a1 must have a synchronization record"
    );

    let s = sync_a1.unwrap();
    match s.remedy {
        SyncRemedy::VerticalSpringApplied { spring_pt } => {
            assert!(spring_pt > 0.0, "Spring pt must be positive");
            // Baseline lag after remedy must be within 1.0 pt
            assert!(
                (s.adjusted_y_pt - s.gemara_y_pt).abs() <= 1.0,
                "Effective commentary baseline must match Gemara anchor baseline within 1.0pt"
            );
        }
        SyncRemedy::TolerableLag { lag_pt } => {
            assert!(lag_pt.abs() <= sync_config.max_tolerable_lag_pt);
        }
        _ => {}
    }
}

#[test]
fn test_commentary_overflow_splits_gemara_and_carries_over() {
    let engine = create_engine();
    let template = TemplateConfig::default();
    let sync_config = SynchronizerConfig::default();

    // Gemara has 2 chunks. Chunk 1 has massive commentary that exceeds page height (content_height = ~770pt)
    let massive_rashi = (0..60)
        .map(|idx| {
            format!(
                "רש\"י שורה {} פירוש ארוך מאוד הגודש וממלא את העמוד לחלוטין",
                idx
            )
        })
        .collect::<Vec<_>>()
        .join(" ");

    let doc = CoPaginationDocument {
        main_chunks: vec![
            CoPaginatedChunk {
                text: "גמרא קטע א מאימתי קורין את שמע בערבית משעה שהכהנים נכנסים לאכול".to_string(),
                anchors: vec![(AnchorKey("k1".to_string()), "קורין".to_string())],
            },
            CoPaginatedChunk {
                text: "גמרא קטע ב תנו רבנן מעשה ברבי אליעזר שהיה מסב בבני ברק".to_string(),
                anchors: vec![(AnchorKey("k2".to_string()), "רבנן".to_string())],
            },
        ],
        rashi_items: vec![
            CoPaginatedCommentary {
                target_anchor: AnchorKey("k1".to_string()),
                text: massive_rashi,
            },
            CoPaginatedCommentary {
                target_anchor: AnchorKey("k2".to_string()),
                text: "רבנן: פירוש קצר על קטע ב".to_string(),
            },
        ],
        tosafot_items: vec![],
    };

    let result = engine.typeset_co_paginated_document(&template, &sync_config, &doc);

    // Multi-page splitting must have carried over chunk 2 and subsequent commentary to page 2
    assert!(
        result.pages.len() >= 2,
        "Overflowing commentary must force multi-page split"
    );
    assert!(result.total_gemara_lines > 0);
    assert!(result.total_rashi_lines > 30);
}

#[test]
fn test_async_paginator_incremental_streaming_and_cancellation() {
    let engine = Arc::new(create_engine());
    let template = TemplateConfig::default();
    let sync_config = SynchronizerConfig::default();

    // 1. Verify incremental streaming
    let doc = CoPaginationDocument {
        main_chunks: vec![CoPaginatedChunk {
            text: "משנה ראשונה ברכות פרק ראשון".to_string(),
            anchors: vec![(AnchorKey("m1".to_string()), "משנה".to_string())],
        }],
        rashi_items: vec![CoPaginatedCommentary {
            target_anchor: AnchorKey("m1".to_string()),
            text: "רש\"י על המשנה".to_string(),
        }],
        tosafot_items: vec![],
    };

    let (rx, _token) = NonBlockingPaginator::paginate_async(
        template.clone(),
        sync_config.clone(),
        doc.clone(),
        engine.clone(),
    );

    let mut streamed_pages = Vec::new();
    let mut got_finished = false;

    while let Ok(event) = rx.recv() {
        match event {
            PaginationEvent::PageReady(page) => {
                streamed_pages.push(page.page_number);
            }
            PaginationEvent::Finished(res) => {
                got_finished = true;
                assert_eq!(res.pages.len(), streamed_pages.len());
            }
            _ => {}
        }
    }

    assert!(!streamed_pages.is_empty(), "Must stream pages");
    assert!(got_finished, "Must signal finished");

    // 2. Verify cancellation
    let (rx2, token2) = NonBlockingPaginator::paginate_async(template, sync_config, doc, engine);
    // Cancel immediately
    token2.cancel();

    let mut got_cancelled = false;
    while let Ok(event) = rx2.recv() {
        if let PaginationEvent::Cancelled = event {
            got_cancelled = true;
            break;
        }
    }
    assert!(got_cancelled, "Worker must acknowledge cancellation token");
}

#[test]
fn test_multi_stream_co_pagination_defect_prevention_no_orphans_or_widows() {
    let engine = create_engine();
    let template = TemplateConfig {
        page_width_pt: 595.0,
        page_height_pt: 350.0, // Constrained height to force cross-page transitions
        margin_inner_pt: 30.0,
        margin_outer_pt: 24.0,
        margin_top_pt: 24.0,
        margin_bottom_pt: 24.0,
        gutter_pt: 10.0,
        main_line_height: 18.0,
        commentary_line_height: 13.5,
        ..Default::default()
    };
    let sync_config = SynchronizerConfig::default();

    // 4 Gemara chunks and substantial Rashi commentary designed to overflow across spreads
    let mut main_chunks = Vec::new();
    let mut rashi_items = Vec::new();

    for i in 1..=4 {
        let anchor = format!("anc_{}", i);
        main_chunks.push(CoPaginatedChunk {
            text: format!(
                "פסקה ראשית מספר {} מאימתי קורין את שמע בערבית משעה שהכהנים נכנסים לאכול בתרומתן ועד סוף האשמורה",
                i
            ),
            anchors: vec![(AnchorKey(anchor.clone()), "קורין".to_string())],
        });

        let rashi_text = (0..18)
            .map(|k| format!("רש\"י {} אות {}: ביאור רחב ועמוק על דברי הגמרא", i, k))
            .collect::<Vec<_>>()
            .join(" ");
        rashi_items.push(CoPaginatedCommentary {
            target_anchor: AnchorKey(anchor),
            text: rashi_text,
        });
    }

    let doc = CoPaginationDocument {
        main_chunks,
        rashi_items,
        tosafot_items: Vec::new(),
    };

    let result = engine.typeset_co_paginated_document(&template, &sync_config, &doc);
    assert!(
        result.pages.len() >= 3,
        "Expected at least 3 pages with constrained height, got {}",
        result.pages.len()
    );

    for page in &result.pages {
        // Geometric validity: frame coordinates inside page
        for frame in &page.page_layout.frames {
            assert!(frame.rect.x >= 0.0);
            assert!(frame.rect.y >= 0.0);
            assert!(frame.rect.x + frame.rect.width <= template.page_width_pt + 0.1);
            assert!(frame.rect.y + frame.rect.height <= template.page_height_pt + 0.1);
        }

        // Defect prevention: orphan and widow protection
        if page.rashi_lines_count > 0 {
            assert!(
                page.rashi_lines_count >= 2,
                "Page {} Rashi lines count ({}) violates orphan/widow constraint (min 2 lines)",
                page.page_number,
                page.rashi_lines_count
            );
        }
        if page.gemara_lines_count > 0 {
            assert!(
                page.gemara_lines_count >= 2,
                "Page {} Gemara lines count ({}) violates orphan/widow constraint (min 2 lines)",
                page.page_number,
                page.gemara_lines_count
            );
        }
    }
}

#[test]
fn test_multi_stream_co_pagination_anchor_continuity_and_flow_conservation() {
    let engine = create_engine();
    let template = TemplateConfig::default();
    let sync_config = SynchronizerConfig::default();

    let mut main_chunks = Vec::new();
    let mut rashi_items = Vec::new();
    let mut tosafot_items = Vec::new();

    for i in 1..=3 {
        let a1 = format!("anchor_{}_a", i);
        let a2 = format!("anchor_{}_b", i);

        main_chunks.push(CoPaginatedChunk {
            text: format!(
                "קטע גמרא מספר {} דיבור א קורין את שמע ועוד דיבור ב תפלת השחר עד חצות",
                i
            ),
            anchors: vec![
                (AnchorKey(a1.clone()), "קורין".to_string()),
                (AnchorKey(a2.clone()), "תפלת".to_string()),
            ],
        });

        rashi_items.push(CoPaginatedCommentary {
            target_anchor: AnchorKey(a1.clone()),
            text: format!("רש\"י א עבור קטע {}", i),
        });
        rashi_items.push(CoPaginatedCommentary {
            target_anchor: AnchorKey(a2.clone()),
            text: format!("רש\"י ב עבור קטע {}", i),
        });

        tosafot_items.push(CoPaginatedCommentary {
            target_anchor: AnchorKey(a1),
            text: format!("תוספות א עבור קטע {}", i),
        });
        tosafot_items.push(CoPaginatedCommentary {
            target_anchor: AnchorKey(a2),
            text: format!("תוספות ב עבור קטע {}", i),
        });
    }

    let doc = CoPaginationDocument {
        main_chunks,
        rashi_items,
        tosafot_items,
    };

    let result = engine.typeset_co_paginated_document(&template, &sync_config, &doc);
    assert!(!result.pages.is_empty());
    assert_eq!(result.total_gemara_lines, result.pages.iter().map(|p| p.gemara_lines_count).sum::<usize>());
    assert_eq!(result.total_rashi_lines, result.pages.iter().map(|p| p.rashi_lines_count).sum::<usize>());
    assert_eq!(result.total_tosafot_lines, result.pages.iter().map(|p| p.tosafot_lines_count).sum::<usize>());
}

#[test]
fn test_realistic_talmud_co_pagination_determinism_across_runs() {
    let engine = create_engine();
    let template = TemplateConfig::default();
    let sync_config = SynchronizerConfig::default();
    let doc = tok_typeset::fixtures::create_realistic_talmud_co_pagination_doc();

    let baseline = engine.typeset_co_paginated_document(&template, &sync_config, &doc);
    assert!(!baseline.pages.is_empty(), "Realistic Talmud doc must produce pages");

    for run_idx in 1..=4 {
        let current = engine.typeset_co_paginated_document(&template, &sync_config, &doc);
        assert_eq!(
            baseline.pages.len(),
            current.pages.len(),
            "Run {} page count differs from baseline",
            run_idx
        );
        assert_eq!(baseline.total_gemara_lines, current.total_gemara_lines);
        assert_eq!(baseline.total_rashi_lines, current.total_rashi_lines);
        assert_eq!(baseline.total_tosafot_lines, current.total_tosafot_lines);

        for (p_idx, (b_page, c_page)) in baseline.pages.iter().zip(&current.pages).enumerate() {
            assert_eq!(b_page.page_number, c_page.page_number);
            assert_eq!(b_page.math.side, c_page.math.side);
            assert_eq!(b_page.gemara_lines_count, c_page.gemara_lines_count);
            assert_eq!(b_page.rashi_lines_count, c_page.rashi_lines_count);
            assert_eq!(b_page.tosafot_lines_count, c_page.tosafot_lines_count);

            assert_eq!(b_page.page_layout.frames.len(), c_page.page_layout.frames.len());
            for (f_idx, (b_f, c_f)) in b_page.page_layout.frames.iter().zip(&c_page.page_layout.frames).enumerate() {
                assert_eq!(b_f.flow_id, c_f.flow_id);
                assert!(
                    (b_f.rect.x - c_f.rect.x).abs() < 1e-4,
                    "Page {} Frame {} X differs between runs", p_idx, f_idx
                );
                assert!(
                    (b_f.rect.y - c_f.rect.y).abs() < 1e-4,
                    "Page {} Frame {} Y differs between runs", p_idx, f_idx
                );
                assert!(
                    (b_f.rect.width - c_f.rect.width).abs() < 1e-4,
                    "Page {} Frame {} Width differs between runs", p_idx, f_idx
                );
                assert!(
                    (b_f.rect.height - c_f.rect.height).abs() < 1e-4,
                    "Page {} Frame {} Height differs between runs", p_idx, f_idx
                );
                assert_eq!(b_f.lines.len(), c_f.lines.len());
            }
        }
    }
}

#[test]
fn test_realistic_talmud_co_pagination_no_frame_overlaps_and_bounds_validity() {
    let engine = create_engine();
    let template = TemplateConfig::default();
    let sync_config = SynchronizerConfig::default();
    let doc = tok_typeset::fixtures::create_realistic_talmud_co_pagination_doc();

    let result = engine.typeset_co_paginated_document(&template, &sync_config, &doc);
    assert!(!result.pages.is_empty());

    let eps = 1e-2;
    for page in &result.pages {
        let frames = &page.page_layout.frames;

        // 1. All frames must be within page bounds
        for frame in frames {
            assert!(frame.rect.x >= -eps, "Frame X must be non-negative: {:?}", frame.rect);
            assert!(frame.rect.y >= -eps, "Frame Y must be non-negative: {:?}", frame.rect);
            assert!(
                frame.rect.x + frame.rect.width <= template.page_width_pt + eps,
                "Frame must not exceed page width: {:?}", frame.rect
            );
            assert!(
                frame.rect.y + frame.rect.height <= template.page_height_pt + eps,
                "Frame must not exceed page height: {:?}", frame.rect
            );
        }

        // 2. No two frames on the same page should overlap
        for i in 0..frames.len() {
            for j in (i + 1)..frames.len() {
                let fa = &frames[i].rect;
                let fb = &frames[j].rect;
                let overlaps = fa.x + eps < fb.x + fb.width
                    && fb.x + eps < fa.x + fa.width
                    && fa.y + eps < fb.y + fb.height
                    && fb.y + eps < fa.y + fa.height;
                assert!(
                    !overlaps,
                    "Page {} frames '{}' ({:?}) and '{}' ({:?}) overlap!",
                    page.page_number, frames[i].flow_id, fa, frames[j].flow_id, fb
                );
            }
        }
    }

    // 3. Flow line conservation
    assert_eq!(result.total_gemara_lines, result.pages.iter().map(|p| p.gemara_lines_count).sum::<usize>());
    assert_eq!(result.total_rashi_lines, result.pages.iter().map(|p| p.rashi_lines_count).sum::<usize>());
    assert_eq!(result.total_tosafot_lines, result.pages.iter().map(|p| p.tosafot_lines_count).sum::<usize>());
}
