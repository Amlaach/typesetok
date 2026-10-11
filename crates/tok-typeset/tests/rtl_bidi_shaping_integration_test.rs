//! Comprehensive RTL and Bidirectional Text Integration Suite
//!
//! Validates:
//! - UAX #9 Bidirectional algorithm decomposition and paragraph direction detection
//! - Mixed Hebrew / Latin text shaping and visual glyph positioning
//! - RTL punctuation, brackets, colons, and hyphens embedding
//! - Hebrew niqqud and cantillation (ta'amim) cluster integrity
//! - Three-tier Hebrew justification (Space expansion -> Ahalterm stretching -> Micro-tracking)
//! - Recto / Verso alternating page geometry and column symmetry

use tok_core::id::FractionalIndex;
use tok_core::model::{DocumentRoot, ParagraphNode};
use tok_typeset::bidi::BidiEngine;
use tok_typeset::engine::{TypesettingEngine, TypesettingEngineConfig};
use tok_typeset::hebrew_justify::{HebrewJustifier, JustificationTier};
use tok_typeset::multi_flow::{FlowGeometrySpec, FlowPlacementRole, MultiFlowSolver, SpreadSide};
use tok_typeset::solver::page_model::{PageConstraintModel, PageGeometryConfig};
use tok_typeset::solver::GeometricConstraintSolver;
use tok_typeset::PositionedGlyph;

fn build_doc_with_paragraph(text: &str) -> DocumentRoot {
    let mut doc = DocumentRoot::new("RTL Test Document");
    let flow = doc.sections[0].main_flow_mut().unwrap();
    flow.add_paragraph(ParagraphNode::new(
        FractionalIndex::new("a001"),
        "default",
        text,
    ));
    doc
}

#[test]
fn test_rtl_paragraph_detection_and_shaping() {
    let hebrew_text = "שלום עליכם עולם התורה והספרות";
    let english_text = "Hello world of typography and layout";

    assert!(BidiEngine::is_paragraph_rtl(hebrew_text));
    assert!(!BidiEngine::is_paragraph_rtl(english_text));

    let engine = TypesettingEngine::new(TypesettingEngineConfig::default());
    let doc = build_doc_with_paragraph(hebrew_text);

    let pages = engine.typeset_document(&doc);
    assert!(!pages.is_empty(), "Typesetting should produce at least one page");

    let page = &pages[0];
    assert!(!page.frames.is_empty(), "Page must contain frames");
    let frame = &page.frames[0];
    assert!(!frame.lines.is_empty(), "Frame must contain lines");
    let line = &frame.lines[0];
    assert!(line.is_rtl, "Hebrew line must be marked RTL");
    assert!(!line.glyphs.is_empty(), "Line must contain positioned glyphs");

    // All glyph boxes should have finite, positive widths and non-negative coordinates
    for glyph in &line.glyphs {
        assert!(glyph.width > 0.0, "Glyph width must be positive: {:?}", glyph);
        assert!(glyph.x.is_finite(), "Glyph x must be finite");
        assert!(glyph.y.is_finite(), "Glyph y must be finite");
    }
}

#[test]
fn test_bidirectional_mixed_hebrew_latin_runs_and_visual_order() {
    let mixed_text = "ספר TypesetOK לעימוד";
    let runs = BidiEngine::resolve_runs(mixed_text, true);

    // Expect at least 3 runs: RTL (ספר ), LTR (TypesetOK), RTL ( לעימוד)
    assert!(runs.len() >= 3, "Mixed text must decompose into at least 3 runs, got {}", runs.len());
    assert!(runs[0].is_rtl, "First run ('ספר ') should be RTL");

    let latin_run = runs.iter().find(|r| !r.is_rtl).expect("Must have an LTR run");
    assert_eq!(latin_run.text.trim(), "TypesetOK");

    let engine = TypesettingEngine::new(TypesettingEngineConfig::default());
    let doc = build_doc_with_paragraph(mixed_text);

    let pages = engine.typeset_document(&doc);
    let line = &pages[0].frames[0].lines[0];

    // Find Latin glyphs in the line
    let latin_chars: Vec<char> = line
        .glyphs
        .iter()
        .filter_map(|g| g.character)
        .filter(|c| c.is_ascii_alphabetic())
        .collect();
    let latin_string: String = latin_chars.into_iter().collect();
    assert_eq!(latin_string, "TypesetOK", "Latin characters within LTR run must preserve left-to-right visual order");
}

#[test]
fn test_rtl_punctuation_and_paired_brackets() {
    let text_with_brackets = "משנה (בבא קמא א:א) - שור שנגח.";
    let runs = BidiEngine::resolve_runs(text_with_brackets, true);

    // Entire sentence should be dominated by RTL embedding
    assert!(!runs.is_empty());
    assert!(runs[0].is_rtl, "Initial run must be RTL");

    let engine = TypesettingEngine::new(TypesettingEngineConfig::default());
    let doc = build_doc_with_paragraph(text_with_brackets);

    let pages = engine.typeset_document(&doc);
    let line = &pages[0].frames[0].lines[0];
    assert!(line.is_rtl);
    assert!(!line.glyphs.is_empty());

    // Characters like '(' and ')' and '.' should all be mapped
    let chars: Vec<char> = line.glyphs.iter().filter_map(|g| g.character).collect();
    assert!(chars.contains(&'('), "Must contain opening parenthesis");
    assert!(chars.contains(&')'), "Must contain closing parenthesis");
    assert!(chars.contains(&':'), "Must contain colon");
    assert!(chars.contains(&'.'), "Must contain period");
}

#[test]
fn test_hebrew_niqqud_and_taamim_handling() {
    // Genesis 1:1 with Niqqud and Ta'amim (cantillation marks)
    let verses = "בְּרֵאשִׁ֖ית בָּרָ֣א אֱלֹהִ֑ים אֵ֥ת הַשָּׁמַ֖יִם וְאֵ֥ת הָאָֽרֶץ׃";

    let engine = TypesettingEngine::new(TypesettingEngineConfig::default());
    let doc = build_doc_with_paragraph(verses);

    let pages = engine.typeset_document(&doc);
    assert!(!pages.is_empty());
    let line = &pages[0].frames[0].lines[0];
    assert!(line.is_rtl);
    assert!(line.glyphs.len() > 10, "Glyphs must be shaped including base letters and marks");

    // Ensure all glyph positions are finite and non-negative advances
    for g in &line.glyphs {
        assert!(g.width >= 0.0, "Glyph advance must be non-negative");
        assert!(g.x.is_finite());
        assert!(g.y.is_finite());
    }
}

#[test]
fn test_ahalterm_three_tier_justification() {
    // Letters 'א', 'ה', 'ל', 'ת', 'ר', 'ם' are stretchable in traditional Hebrew typesetting
    let ahalterm_chars = ['א', 'ה', 'ל', 'ת', 'ר', 'ם'];
    for &ch in &ahalterm_chars {
        assert!(HebrewJustifier::is_ahalterm_letter(ch), "Letter {} must be an ahalterm candidate", ch);
    }
    assert!(!HebrewJustifier::is_ahalterm_letter('ב'));
    assert!(!HebrewJustifier::is_ahalterm_letter('ג'));

    // Create a mock line of glyphs
    let create_glyphs = |words: &[&str]| -> Vec<PositionedGlyph> {
        let mut glyphs = Vec::new();
        for (w_idx, word) in words.iter().enumerate() {
            if w_idx > 0 {
                glyphs.push(PositionedGlyph {
                    glyph_id: 3,
                    cluster: 0,
                    x_advance: 10.0, // Space width
                    y_advance: 0.0,
                    x_offset: 0.0,
                    y_offset: 0.0,
                    character: Some(' '),
                });
            }
            for ch in word.chars() {
                glyphs.push(PositionedGlyph {
                    glyph_id: 10,
                    cluster: 0,
                    x_advance: 12.0,
                    y_advance: 0.0,
                    x_offset: 0.0,
                    y_offset: 0.0,
                    character: Some(ch),
                });
            }
        }
        glyphs
    };

    // Case 1: Small deficit handled by Tier 1 (Word spacing, within 130%)
    let glyphs1 = create_glyphs(&["שלום", "עולם"]); // 8 chars * 12 = 96, 1 space * 10 = 10 -> total 106.
    let target1 = 108.0; // Deficit = 2.0 (space scales from 10 to 12 = 120%, <= 130%)
    let res1 = HebrewJustifier::justify_line(glyphs1, target1, 12.0, false);
    assert_eq!(res1.tier_used, JustificationTier::Tier1WordSpacing);

    // Case 2: Large deficit beyond 130% space ratio -> triggers Tier 2 Ahalterm
    // "אברהם" has letters 'א', 'ר', 'ה', 'ם' (4 ahalterm letters!)
    let glyphs2 = create_glyphs(&["אברהם", "משה"]);
    let current_w: f32 = glyphs2.iter().map(|g| g.x_advance).sum();
    let target2 = current_w + 35.0; // Needs 35pt more, space alone (10pt) maxes at 13pt (+3pt). Remaining 32pt goes to ahalterm.
    let res2 = HebrewJustifier::justify_line(glyphs2, target2, 12.0, false);
    assert_eq!(res2.tier_used, JustificationTier::Tier2AhaltermStretch);
    assert!(res2.stretch_per_ahalterm_pt > 0.0, "Must have stretched ahalterm letters");

    // Case 3: No ahalterm letters and deficit exceeds Tier 1 -> triggers Tier 3 Micro-tracking
    // "בגו" and "זחט" contain no ahalterm letters ('ד' and 'ך' are ahalterm, but 'ב','ג','ו','ז','ח','ט' are not)
    let glyphs3 = create_glyphs(&["בגו", "זחט"]);
    let current_w3: f32 = glyphs3.iter().map(|g| g.x_advance).sum();
    let target3 = current_w3 + 4.0; // Exceeds Tier 1 space limit (+3.0 max for 10pt space)
    let res3 = HebrewJustifier::justify_line(glyphs3, target3, 12.0, false);
    assert_eq!(res3.tier_used, JustificationTier::Tier3MicroTracking);
    assert!(res3.micro_tracking_pt > 0.0, "Must have applied micro-tracking");
}

#[test]
fn test_recto_verso_geometry_and_flow_symmetry() {
    let mut solver = GeometricConstraintSolver::new();
    let page_model = PageConstraintModel::new();

    // 1. Recto page (odd page, page 1)
    let recto_cfg = PageGeometryConfig::new(
        500.0,
        700.0,
        50.0, // inner margin
        20.0, // outer margin
        30.0, // top
        40.0, // bottom
        SpreadSide::Recto,
    );
    assert!(page_model.apply(&mut solver, &recto_cfg).is_ok());
    let recto_content = page_model.get_content_rect(&solver);

    // Recto: inner margin = 50.0 is on the inner side (left or right depending on model convention)
    // Verso: inner margin = 50.0 is on the opposite side
    let mut solver_verso = GeometricConstraintSolver::new();
    let verso_cfg = PageGeometryConfig::new(
        500.0,
        700.0,
        50.0, // inner margin
        20.0, // outer margin
        30.0, // top
        40.0, // bottom
        SpreadSide::Verso,
    );
    assert!(page_model.apply(&mut solver_verso, &verso_cfg).is_ok());
    let verso_content = page_model.get_content_rect(&solver_verso);

    // Both pages must have identical content width and height
    assert_eq!(recto_content.width, verso_content.width, "Content width must be symmetric");
    assert_eq!(recto_content.height, verso_content.height, "Content height must be symmetric");

    // But their horizontal origin x must reflect the inner/outer margin flip
    assert_ne!(recto_content.x, verso_content.x, "Content rect X must mirror between Recto and Verso");
    assert_eq!(recto_content.x + verso_content.x + recto_content.width, 500.0, "Recto and Verso content areas must be horizontally symmetric on the sheet");

    // 2. Talmud multi-flow column symmetry:
    // On Recto, Rashi is placed on the inner side and Tosafot on the outer side.
    // On Verso, they flip positions so Rashi is always facing the book gutter/inner margin!
    let flows = vec![
        FlowGeometrySpec::new(tok_core::FlowId::new("gemara"), 1)
            .with_role(FlowPlacementRole::Primary),
        FlowGeometrySpec::new(tok_core::FlowId::new("rashi"), 2)
            .with_role(FlowPlacementRole::InnerSpine),
        FlowGeometrySpec::new(tok_core::FlowId::new("tosafot"), 3)
            .with_role(FlowPlacementRole::OuterMargin),
    ];
    let recto_layout = MultiFlowSolver::solve_talmud_spread(
        500.0, 700.0, 50.0, 20.0, 30.0, &flows, SpreadSide::Recto,
    );
    let verso_layout = MultiFlowSolver::solve_talmud_spread(
        500.0, 700.0, 50.0, 20.0, 30.0, &flows, SpreadSide::Verso,
    );

    let rashi_id = tok_core::FlowId::new("rashi");
    let tosafot_id = tok_core::FlowId::new("tosafot");

    let rashi_recto = recto_layout.iter().find(|f| f.flow_id == rashi_id).unwrap();
    let rashi_verso = verso_layout.iter().find(|f| f.flow_id == rashi_id).unwrap();

    let tosafot_recto = recto_layout.iter().find(|f| f.flow_id == tosafot_id).unwrap();
    let tosafot_verso = verso_layout.iter().find(|f| f.flow_id == tosafot_id).unwrap();

    // Rashi and Tosafot X positions must flip across the spread
    assert_ne!(rashi_recto.allocated_x_pt, rashi_verso.allocated_x_pt, "Rashi X must differ between Recto and Verso");
    assert_ne!(tosafot_recto.allocated_x_pt, tosafot_verso.allocated_x_pt, "Tosafot X must differ between Recto and Verso");
}
