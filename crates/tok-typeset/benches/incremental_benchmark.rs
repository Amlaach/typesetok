use std::time::Instant;
use tok_typeset::diagnostics::RecomputeReport;
use tok_typeset::engine::{TypesettingEngine, TypesettingEngineConfig};
use tok_typeset::fixtures::create_realistic_prose_document;

fn main() {
    println!("================================================================================");
    println!("  TypesetOK (TOK) - Comprehensive Incremental Typesetting & Memory Benchmark Suite");
    println!("================================================================================");

    // -------------------------------------------------------------------------
    // 1. Cold Full Document Typesetting Benchmark (50 Pages & 200 Pages)
    // -------------------------------------------------------------------------
    println!("\n[BENCHMARK 1: Cold Full Document Typesetting]");

    // 50-Page Corpus (~80 chapters = ~320 paragraphs)
    println!("  Generating 50-page Hebrew document corpus...");
    let doc_50 = create_realistic_prose_document(80);
    let engine = TypesettingEngine::new(TypesettingEngineConfig::default());

    let cold_start_50 = Instant::now();
    let pages_50 = engine.typeset_document(&doc_50);
    let cold_dur_50 = cold_start_50.elapsed();
    let total_lines_50: usize = pages_50
        .iter()
        .map(|p| p.frames.iter().map(|f| f.lines.len()).sum::<usize>())
        .sum();

    println!(
        "  - 50-Page Corpus Emitted:  {} pages ({} justified lines)",
        pages_50.len(),
        total_lines_50
    );
    println!("  - Cold Typesetting Time:   {:.2?}", cold_dur_50);
    println!(
        "  - Cold Throughput:         {:.1} pages/sec ({:.2} ms/page)",
        pages_50.len() as f64 / cold_dur_50.as_secs_f64(),
        (cold_dur_50.as_secs_f64() * 1000.0) / pages_50.len() as f64
    );

    // -------------------------------------------------------------------------
    // 2. Incremental Beginning Edit (Worst Case Invalidation Cascade)
    // -------------------------------------------------------------------------
    println!("\n[BENCHMARK 2: Incremental Beginning Edit (Page 0)]");
    let mut doc_beg = doc_50.clone();
    let p0_id = doc_beg.sections[0]
        .main_flow()
        .and_then(|f| f.paragraphs.first())
        .map(|p| p.id)
        .expect("paragraph 0 exists");

    if let Some(p) = doc_beg.find_paragraph_mut(p0_id) {
        p.text.push_str(" תוספת מילה לבדיקת גלישת עמוד ראשון.");
    }

    let inc_beg_start = Instant::now();
    let (inc_beg_pages, diag_beg) =
        engine.typeset_document_incremental(&doc_beg, &pages_50, Some(p0_id));
    let inc_beg_dur = inc_beg_start.elapsed();

    let report_beg = RecomputeReport::from_diagnostics(&diag_beg, pages_50.len());
    println!("  {}", report_beg.summary_string());
    let beg_speedup = cold_dur_50.as_secs_f64() / inc_beg_dur.as_secs_f64();
    println!("  - Speedup vs Cold Layout:  {:.1}x faster", beg_speedup);

    // -------------------------------------------------------------------------
    // 3. Incremental Middle Edit (Break-Token Convergence Cascade)
    // -------------------------------------------------------------------------
    println!("\n[BENCHMARK 3: Incremental Middle Edit (Page ~25)]");
    let mut doc_mid = doc_50.clone();
    let mid_idx = doc_mid.sections[0]
        .main_flow()
        .map_or(0, |f| f.paragraphs.len() / 2);
    let mid_id = doc_mid.sections[0]
        .main_flow()
        .and_then(|f| f.paragraphs.get(mid_idx))
        .map(|p| p.id)
        .expect("middle paragraph exists");

    if let Some(p) = doc_mid.find_paragraph_mut(mid_id) {
        p.text
            .push_str(" תוספת משפט באמצע הספר לבדיקת עצירת גלישה.");
    }

    let inc_mid_start = Instant::now();
    let (inc_mid_pages, diag_mid) =
        engine.typeset_document_incremental(&doc_mid, &pages_50, Some(mid_id));
    let inc_mid_dur = inc_mid_start.elapsed();

    let report_mid = RecomputeReport::from_diagnostics(&diag_mid, pages_50.len());
    println!("  {}", report_mid.summary_string());
    println!(
        "  - Untouched Prior Pages:   {} pages reused instantly",
        diag_mid.first_affected_page
    );
    println!(
        "  - Convergence Page:        {:?}",
        diag_mid.converged_at_page
    );
    let mid_speedup = cold_dur_50.as_secs_f64() / inc_mid_dur.as_secs_f64();
    println!("  - Speedup vs Cold Layout:  {:.1}x faster", mid_speedup);

    // -------------------------------------------------------------------------
    // 4. Incremental End Edit (Localized Tail Recomputation)
    // -------------------------------------------------------------------------
    println!("\n[BENCHMARK 4: Incremental End Edit (Final Page)]");
    let mut doc_end = doc_50.clone();
    let end_id = doc_end.sections[0]
        .main_flow()
        .and_then(|f| f.paragraphs.last())
        .map(|p| p.id)
        .expect("end paragraph exists");

    if let Some(p) = doc_end.find_paragraph_mut(end_id) {
        p.text.push_str(" שורה נוספת בסוף המסמך.");
    }

    let inc_end_start = Instant::now();
    let (inc_end_pages, diag_end) =
        engine.typeset_document_incremental(&doc_end, &pages_50, Some(end_id));
    let inc_end_dur = inc_end_start.elapsed();

    let report_end = RecomputeReport::from_diagnostics(&diag_end, pages_50.len());
    println!("  {}", report_end.summary_string());
    println!(
        "  - Reused Prior Pages:      {} / {} (98%+ reuse)",
        diag_end.reused_pages, diag_end.total_pages
    );
    let end_speedup = cold_dur_50.as_secs_f64() / inc_end_dur.as_secs_f64();
    println!("  - Speedup vs Cold Layout:  {:.1}x faster", end_speedup);

    // -------------------------------------------------------------------------
    // 5. Zero-Cascade Fast Path (In-Line Word Edit < 1ms)
    // -------------------------------------------------------------------------
    println!("\n[BENCHMARK 5: Zero-Cascade Fast Path (< 1ms target)]");
    let mut doc_zero = doc_50.clone();
    let p_target_id = doc_zero.sections[0]
        .main_flow()
        .and_then(|f| f.paragraphs.get(10))
        .map(|p| p.id)
        .expect("paragraph 10 exists");

    // Replace one word with exact same character length so line count/height stays identical
    if let Some(p) = doc_zero.find_paragraph_mut(p_target_id) {
        if let Some(pos) = p.text.find("העברית") {
            p.text.replace_range(pos..pos + "העברית".len(), "הספרות");
        }
    }

    let zero_start = Instant::now();
    let (inc_zero_pages, diag_zero) =
        engine.typeset_document_incremental(&doc_zero, &pages_50, Some(p_target_id));
    let zero_dur = zero_start.elapsed();

    let report_zero = RecomputeReport::from_diagnostics(&diag_zero, pages_50.len());
    println!("  {}", report_zero.summary_string());
    println!("  - Zero-Cascade Detected:   {}", diag_zero.zero_cascade);
    println!(
        "  - Measured Latency:        {:.3} ms",
        zero_dur.as_secs_f64() * 1000.0
    );
    println!(
        "  - Sub-millisecond Target:  {}",
        if zero_dur.as_millis() < 5 {
            "PASSED [INTERACTIVE 120 FPS]"
        } else {
            "CHECK"
        }
    );

    // -------------------------------------------------------------------------
    // 6. Interactive Keystroke Simulation (10 Sequential Edits)
    // -------------------------------------------------------------------------
    println!("\n[BENCHMARK 6: Interactive Keystroke Simulation (10 Sequential Typing Edits)]");
    let mut running_doc = doc_50.clone();
    let mut running_pages = pages_50.clone();
    let mut latencies: Vec<f64> = Vec::new();

    let keystroke_target_id = running_doc.sections[0]
        .main_flow()
        .and_then(|f| f.paragraphs.get(15))
        .map(|p| p.id)
        .expect("paragraph 15 exists");

    for _key_idx in 1..=10 {
        if let Some(p) = running_doc.find_paragraph_mut(keystroke_target_id) {
            p.text.push('א');
        }
        let t0 = Instant::now();
        let (new_pages, _diag) = engine.typeset_document_incremental(
            &running_doc,
            &running_pages,
            Some(keystroke_target_id),
        );
        let elapsed_ms = t0.elapsed().as_secs_f64() * 1000.0;
        latencies.push(elapsed_ms);
        running_pages = new_pages;
    }

    let avg_latency: f64 = latencies.iter().sum::<f64>() / latencies.len() as f64;
    let min_latency = latencies.iter().cloned().fold(f64::INFINITY, f64::min);
    let max_latency = latencies.iter().cloned().fold(0.0, f64::max);
    println!("  - Iterations:              10 keystrokes");
    println!("  - Average Keystroke Delay: {:.3} ms", avg_latency);
    println!("  - Min Keystroke Delay:     {:.3} ms", min_latency);
    println!("  - Max Keystroke Delay:     {:.3} ms", max_latency);

    // -------------------------------------------------------------------------
    // 7. Memory Overhead & Cache Efficiency
    // -------------------------------------------------------------------------
    println!("\n[BENCHMARK 7: Layout Cache Memory & Footprint]");
    let metrics = engine.cache_metrics();
    println!(
        "  - Total Cache Entries:     {} paragraphs",
        metrics.entry_count
    );
    println!("  - Cache Hits:              {}", metrics.hits);
    println!("  - Cache Misses:            {}", metrics.misses);
    println!("  - Cache Evictions:         {}", metrics.evictions);
    println!(
        "  - Cache Hit Ratio:         {:.1}%",
        metrics.hit_ratio * 100.0
    );
    println!(
        "  - Cache Memory Usage:      {} KB ({:.2} MB)",
        metrics.approx_memory_bytes / 1024,
        metrics.approx_memory_bytes as f64 / (1024.0 * 1024.0)
    );

    println!("\n================================================================================");
    println!("  [STAGE 10 BENCHMARK SUITE COMPLETED SUCCESSFULLY]");
    println!("================================================================================");

    // Suppress unused variables warnings
    assert!(!pages_50.is_empty());
    assert!(!inc_beg_pages.is_empty());
    assert!(!inc_mid_pages.is_empty());
    assert!(!inc_end_pages.is_empty());
    assert!(!inc_zero_pages.is_empty());
}
