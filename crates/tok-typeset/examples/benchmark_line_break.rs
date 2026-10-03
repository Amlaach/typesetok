//! Run with: cargo run --release -p tok-typeset --example benchmark_line_break
use std::hint::black_box;
use std::time::Instant;
use tok_typeset::{KnuthPlassBreaker, LayoutItem};
fn main() {
    for words in [128, 256, 512, 1024] {
        let mut items = Vec::with_capacity(words * 2);
        for i in 0..words {
            items.push(LayoutItem::Box {
                width: 20.0 + (i % 11) as f32,
                text: "word".into(),
                glyphs: vec![],
            });
            items.push(LayoutItem::Glue {
                width: 4.0,
                stretch: 2.0,
                shrink: 1.0,
            });
        }
        let mut elapsed = Vec::new();
        let mut count = 0;
        for _ in 0..5 {
            let start = Instant::now();
            let lines = KnuthPlassBreaker::break_paragraph(black_box(&items), 240.0, 2.0);
            count = black_box(lines.len());
            elapsed.push(start.elapsed().as_secs_f64() * 1000.0);
        }
        elapsed.sort_by(f64::total_cmp);
        println!("words={words} lines={count} median_ms={:.3}", elapsed[2]);
    }
}
