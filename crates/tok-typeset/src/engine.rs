//! Central Typesetting Engine for TypesetOK.
//!
//! Orchestrates text shaping, Bidi decomposition, Knuth-Plass line breaking,
//! 3-tier Hebrew justification, and multi-page convergence pagination.

use crate::font::{FontChoice, FontManager, ShapingSession};
use crate::gematria::GematriaEngine;
use crate::geometry::{
    BreakToken, GlyphBox, LineBox, PageLayoutBox, PhysicalRect, TextFrameBox, UNKNOWN_FONT,
};
use crate::hebrew_justify::HebrewJustifier;
use crate::knuth_plass::{KnuthPlassBreaker, LayoutItem};
use crate::shaper::PositionedGlyph;
use rayon::prelude::*;
use std::collections::HashMap;
use tok_core::model::{DocumentRoot, ParagraphNode};
use unicode_bidi::BidiInfo;

const DEFAULT_FONT_FAMILY: &str = "Noto Serif Hebrew";
const DEFAULT_FONT_SIZE_PT: f32 = 11.0;
const DEFAULT_LINE_HEIGHT_PT: f32 = 14.5;
/// Natural inter-word space, in em.
const SPACE_EM: f32 = 0.28;
/// Inter-word glue may stretch to 130% and shrink to 80% (see `hebrew_justify`).
const SPACE_STRETCH: f32 = 0.30;
const SPACE_SHRINK: f32 = 0.20;
const LINE_BREAK_TOLERANCE: f32 = 2.0;

pub struct TypesettingEngineConfig {
    pub page_width_pt: f32,
    pub page_height_pt: f32,
    pub margin_top_pt: f32,
    pub margin_bottom_pt: f32,
    pub margin_inner_pt: f32, // Gutter
    pub margin_outer_pt: f32,
}

impl Default for TypesettingEngineConfig {
    fn default() -> Self {
        // Standard A4 with 25mm margins
        Self {
            page_width_pt: 595.28,
            page_height_pt: 841.89,
            margin_top_pt: 70.87,
            margin_bottom_pt: 56.69,
            margin_inner_pt: 85.04, // 30mm for binding
            margin_outer_pt: 56.69, // 20mm outer
        }
    }
}

pub struct TypesettingEngine {
    config: TypesettingEngineConfig,
    pub font_manager: FontManager,
}

/// Whitespace that separates words. No-break spaces stay inside words.
fn is_break_space(c: char) -> bool {
    c.is_whitespace() && !matches!(c, '\u{00A0}' | '\u{2007}' | '\u{202F}')
}

/// Index of `family` in a line font table, appending it when new.
fn font_slot(fonts: &mut Vec<String>, family: Option<&str>) -> u16 {
    let Some(family) = family else {
        return UNKNOWN_FONT;
    };
    let idx = match fonts.iter().position(|f| f == family) {
        Some(idx) => idx,
        None => {
            fonts.push(family.to_string());
            fonts.len() - 1
        }
    };
    u16::try_from(idx).unwrap_or(UNKNOWN_FONT)
}

/// UAX #9 rule L2 at item granularity: reverses every maximal run at or above
/// each level, from the highest level down to the lowest odd level.
fn visual_order(levels: &[(u8, usize)]) -> Vec<usize> {
    let mut seq = levels.to_vec();
    let max = seq.iter().map(|s| s.0).max().unwrap_or(0);
    let min = seq.iter().map(|s| s.0).min().unwrap_or(0);
    let lowest_odd = min | 1;
    for level in (lowest_odd..=max).rev() {
        let mut k = 0;
        while k < seq.len() {
            if seq[k].0 >= level {
                let start = k;
                while k < seq.len() && seq[k].0 >= level {
                    k += 1;
                }
                seq[start..k].reverse();
            } else {
                k += 1;
            }
        }
    }
    seq.into_iter().map(|s| s.1).collect()
}

/// Per-item data the line breaker does not need to know about.
#[derive(Clone, Copy)]
struct ItemMeta {
    level: u8,
    font: u16,
    /// Byte offset of the item in the paragraph text.
    offset: u32,
}

impl TypesettingEngine {
    pub fn new(config: TypesettingEngineConfig) -> Self {
        Self {
            config,
            font_manager: FontManager::default(),
        }
    }

    pub fn with_font_manager(config: TypesettingEngineConfig, font_manager: FontManager) -> Self {
        Self {
            config,
            font_manager,
        }
    }

    /// Typesets a single paragraph into formatted, justified LineBoxes using default font.
    pub fn typeset_paragraph(
        &self,
        paragraph: &ParagraphNode,
        column_width_pt: f32,
        font_size_pt: f32,
        line_height_pt: f32,
    ) -> Vec<LineBox> {
        self.typeset_paragraph_with_font(
            paragraph,
            DEFAULT_FONT_FAMILY,
            column_width_pt,
            font_size_pt,
            line_height_pt,
        )
    }

    /// Typesets a single paragraph into formatted, justified LineBoxes with a specified font family.
    ///
    /// Line baselines are relative to the top of the paragraph. Glyphs are in
    /// visual order; RTL lines that do not fill the measure are right-aligned.
    pub fn typeset_paragraph_with_font(
        &self,
        paragraph: &ParagraphNode,
        font_family: &str,
        column_width_pt: f32,
        font_size_pt: f32,
        line_height_pt: f32,
    ) -> Vec<LineBox> {
        let session = self.font_manager.session(font_family);
        Self::typeset_with_session(
            &session,
            paragraph,
            column_width_pt,
            font_size_pt,
            line_height_pt,
        )
    }

    fn typeset_with_session(
        session: &ShapingSession<'_>,
        paragraph: &ParagraphNode,
        column_width_pt: f32,
        font_size_pt: f32,
        line_height_pt: f32,
    ) -> Vec<LineBox> {
        let text = paragraph.text.as_str();
        if text.trim().is_empty() || !column_width_pt.is_finite() || column_width_pt <= 0.0 {
            return Vec::new();
        }
        let font_size = if font_size_pt.is_finite() && font_size_pt > 0.0 {
            font_size_pt
        } else {
            DEFAULT_FONT_SIZE_PT
        };
        let line_height = if line_height_pt.is_finite() && line_height_pt > 0.0 {
            line_height_pt
        } else {
            font_size * 1.3
        };

        // 1. Resolve bidi levels once for the whole paragraph.
        let bidi = BidiInfo::new(text, None);
        let is_rtl = bidi.paragraphs.first().is_some_and(|p| p.level.is_rtl());
        let level_at = |byte: usize| -> u8 {
            bidi.levels
                .get(byte)
                .map(|l| l.number())
                .unwrap_or(u8::from(is_rtl))
        };

        // 2. Build the Knuth-Plass stream: words split into same-level runs,
        //    each shaped in its own direction, separated by glue.
        let mut fonts: Vec<String> = Vec::new();
        let space_choice = if session.family_of(FontChoice::Primary).is_some() {
            FontChoice::Primary
        } else {
            FontChoice::Fallback
        };
        let space_font = font_slot(&mut fonts, session.family_of(space_choice));
        let space_gid = session.space_glyph_id().unwrap_or(3);
        let base_space = font_size * SPACE_EM;

        let mut items: Vec<LayoutItem> = Vec::new();
        let mut meta: Vec<ItemMeta> = Vec::new();
        let mut word_start: Option<usize> = None;
        let mut gap_offset: Option<usize> = None;

        let mut push_word = |start: usize, end: usize, gap: Option<usize>| {
            if let Some(gap) = gap {
                items.push(LayoutItem::Glue {
                    width: base_space,
                    stretch: base_space * SPACE_STRETCH,
                    shrink: base_space * SPACE_SHRINK,
                });
                meta.push(ItemMeta {
                    level: level_at(gap),
                    font: space_font,
                    offset: gap as u32,
                });
            }
            let mut run_start = start;
            let word = &text[start..end];
            let boundaries = word
                .char_indices()
                .map(|(i, _)| start + i)
                .skip(1)
                .filter(|&b| level_at(b) != level_at(b - 1))
                .chain(std::iter::once(end));
            for run_end in boundaries {
                let level = level_at(run_start);
                let (mut run, choice) =
                    session.shape(&text[run_start..run_end], font_size, level % 2 == 1);
                for g in &mut run.glyphs {
                    g.cluster += run_start as u32;
                }
                items.push(LayoutItem::Box {
                    width: run.total_width_pt,
                    text: text[run_start..run_end].to_string(),
                    glyphs: run.glyphs,
                });
                meta.push(ItemMeta {
                    level,
                    font: font_slot(&mut fonts, session.family_of(choice)),
                    offset: run_start as u32,
                });
                run_start = run_end;
            }
        };

        for (i, c) in text.char_indices() {
            if is_break_space(c) {
                if let Some(start) = word_start.take() {
                    push_word(start, i, gap_offset.take());
                    gap_offset = Some(i);
                }
            } else if word_start.is_none() {
                word_start = Some(i);
            }
        }
        if let Some(start) = word_start {
            push_word(start, text.len(), gap_offset);
        }

        // Forced break at end of paragraph
        items.push(LayoutItem::Penalty {
            width: 0.0,
            penalty: KnuthPlassBreaker::FORCED_BREAK_PENALTY,
            flagged: false,
        });
        meta.push(ItemMeta {
            level: u8::from(is_rtl),
            font: space_font,
            offset: text.len() as u32,
        });

        // 3. Run Knuth-Plass global line breaker
        let spans =
            KnuthPlassBreaker::break_paragraph_spans(&items, column_width_pt, LINE_BREAK_TOLERANCE);

        // 4. Reorder, justify and position each line.
        let total_lines = spans.len();
        let mut result_lines = Vec::with_capacity(total_lines);

        for (idx, span) in spans.into_iter().enumerate() {
            let is_last = idx + 1 == total_lines;
            let logical: Vec<(u8, usize)> = (span.start..span.end)
                .filter(|&i| !matches!(items[i], LayoutItem::Penalty { .. }))
                .map(|i| (meta[i].level, i))
                .collect();

            let mut line_text = String::new();
            for &(_, i) in &logical {
                match &items[i] {
                    LayoutItem::Box { text, .. } => line_text.push_str(text),
                    LayoutItem::Glue { .. } => line_text.push(' '),
                    LayoutItem::Penalty { .. } => {}
                }
            }

            let mut line_glyphs: Vec<PositionedGlyph> = Vec::new();
            let mut glyph_fonts: Vec<u16> = Vec::new();
            for i in visual_order(&logical) {
                match &items[i] {
                    LayoutItem::Box { glyphs, .. } => {
                        line_glyphs.extend(glyphs.iter().cloned());
                        glyph_fonts.extend(std::iter::repeat_n(meta[i].font, glyphs.len()));
                    }
                    LayoutItem::Glue { .. } => {
                        line_glyphs.push(PositionedGlyph {
                            glyph_id: space_gid,
                            cluster: meta[i].offset,
                            x_advance: base_space,
                            y_advance: 0.0,
                            x_offset: 0.0,
                            y_offset: 0.0,
                            character: Some(' '),
                        });
                        glyph_fonts.push(meta[i].font);
                    }
                    LayoutItem::Penalty { .. } => {}
                }
            }

            let justified =
                HebrewJustifier::justify_line(line_glyphs, column_width_pt, font_size, is_last);

            let line_width: f32 = justified.glyphs.iter().map(|g| g.x_advance).sum();
            // RTL lines start at the right edge of the column.
            let mut current_x = if is_rtl {
                column_width_pt - line_width
            } else {
                0.0
            };
            let glyph_boxes: Vec<GlyphBox> = justified
                .glyphs
                .into_iter()
                .zip(glyph_fonts)
                .map(|(g, font_index)| {
                    let b = GlyphBox {
                        glyph_id: g.glyph_id,
                        cluster: g.cluster,
                        x: current_x + g.x_offset,
                        y: g.y_offset,
                        width: g.x_advance,
                        height: font_size,
                        character: g.character,
                        font_index,
                    };
                    current_x += g.x_advance;
                    b
                })
                .collect();

            result_lines.push(LineBox {
                line_index: idx,
                paragraph_id: Some(paragraph.id),
                baseline_y: (idx as f32 + 1.0) * line_height,
                height: line_height,
                width: line_width,
                glyphs: glyph_boxes,
                text: line_text,
                is_rtl,
                fonts: fonts.clone(),
            });
        }

        result_lines
    }

    fn new_page(
        &self,
        page_num: usize,
        content_width: f32,
        content_height: f32,
        lines: Vec<LineBox>,
        break_token: Option<BreakToken>,
    ) -> PageLayoutBox {
        let frame = TextFrameBox {
            frame_id: format!("frame_{}", page_num),
            flow_id: "main".to_string(),
            rect: PhysicalRect::new(
                self.config.margin_inner_pt,
                self.config.margin_top_pt,
                content_width,
                content_height,
            ),
            lines,
        };
        PageLayoutBox {
            page_index: page_num - 1,
            page_number_gematria: GematriaEngine::to_hebrew_numeral(page_num),
            dimensions: PhysicalRect::new(
                0.0,
                0.0,
                self.config.page_width_pt,
                self.config.page_height_pt,
            ),
            frames: vec![frame],
            break_token,
        }
    }

    /// Typesets an entire DocumentRoot into multi-page layout boxes.
    pub fn typeset_document(&self, doc: &DocumentRoot) -> Vec<PageLayoutBox> {
        let content_width =
            self.config.page_width_pt - self.config.margin_inner_pt - self.config.margin_outer_pt;
        let content_height =
            self.config.page_height_pt - self.config.margin_top_pt - self.config.margin_bottom_pt;

        // Paragraphs are laid out independently, so break them in parallel;
        // results come back in document order, keeping output deterministic.
        let jobs: Vec<(usize, usize, &ParagraphNode)> = doc
            .sections
            .iter()
            .enumerate()
            .filter_map(|(sec_idx, sec)| sec.main_flow().map(|flow| (sec_idx, flow)))
            .flat_map(|(sec_idx, flow)| {
                flow.paragraphs
                    .iter()
                    .enumerate()
                    .map(move |(p_idx, p)| (sec_idx, p_idx, p))
            })
            .collect();

        let laid_out: Vec<Vec<LineBox>> = jobs
            .par_iter()
            .map_init(
                // Fonts are parsed once per family and worker, not per paragraph.
                HashMap::<&str, ShapingSession<'_>>::new,
                |sessions, &(_, _, p)| {
                    let (font_family, font_size, line_height) = doc
                        .paragraph_styles
                        .iter()
                        .find(|s| s.id == p.style_id)
                        .map(|style| {
                            (
                                style.font_family.as_str(),
                                style.font_size_pt,
                                style.line_height_pt,
                            )
                        })
                        .unwrap_or((
                            DEFAULT_FONT_FAMILY,
                            DEFAULT_FONT_SIZE_PT,
                            DEFAULT_LINE_HEIGHT_PT,
                        ));
                    let session = sessions
                        .entry(font_family)
                        .or_insert_with(|| self.font_manager.session(font_family));
                    Self::typeset_with_session(session, p, content_width, font_size, line_height)
                },
            )
            .collect();

        let mut pages = Vec::new();
        let mut current_page_lines = Vec::new();
        let mut current_height = 0.0;
        let mut prev_space_after: f32 = 0.0;
        let mut prev_section_idx: Option<usize> = None;

        for (&(sec_idx, p_idx, p), p_lines) in jobs.iter().zip(laid_out) {
            // Reset margin collapsing on section boundaries
            if prev_section_idx != Some(sec_idx) {
                prev_section_idx = Some(sec_idx);
                prev_space_after = 0.0;
            }

            let (space_before, space_after) = doc
                .paragraph_styles
                .iter()
                .find(|s| s.id == p.style_id)
                .map(|style| (style.space_before_pt.max(0.0), style.space_after_pt.max(0.0)))
                .unwrap_or((0.0, 0.0));

            if p_lines.is_empty() {
                // Empty paragraph collapses its own margins with adjacent margins
                prev_space_after = prev_space_after.max(space_before).max(space_after);
                continue;
            }

            let mut is_first_line = true;
            for mut line in p_lines {
                let margin = if is_first_line && !current_page_lines.is_empty() {
                    prev_space_after.max(space_before)
                } else {
                    0.0
                };

                if current_height + margin + line.height > content_height
                    && !current_page_lines.is_empty()
                {
                    // Page is full: commit page
                    let page = self.new_page(
                        pages.len() + 1,
                        content_width,
                        current_height,
                        std::mem::take(&mut current_page_lines),
                        Some(BreakToken {
                            section_index: sec_idx,
                            paragraph_index: p_idx,
                            // Glyph clusters are byte offsets; the token
                            // counts characters.
                            char_offset: line
                                .glyphs
                                .iter()
                                .map(|g| g.cluster as usize)
                                .min()
                                .and_then(|byte| p.text.get(..byte))
                                .map_or(0, |s| s.chars().count()),
                        }),
                    );
                    pages.push(page);
                    current_height = 0.0;
                    // Top-of-page margin collapses to 0.0
                }

                let margin_to_apply = if is_first_line && !current_page_lines.is_empty() {
                    prev_space_after.max(space_before)
                } else {
                    0.0
                };

                current_height += margin_to_apply;
                line.baseline_y = current_height + line.height;
                line.line_index = current_page_lines.len();
                current_height += line.height;
                current_page_lines.push(line);
                is_first_line = false;
            }

            prev_space_after = space_after;
        }

        // Flush final page
        if !current_page_lines.is_empty() {
            let page = self.new_page(
                pages.len() + 1,
                content_width,
                current_height,
                current_page_lines,
                None,
            );
            pages.push(page);
        }

        pages
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use tok_core::id::FractionalIndex;

    fn engine() -> TypesettingEngine {
        TypesettingEngine::new(TypesettingEngineConfig::default())
    }

    fn para(text: &str) -> ParagraphNode {
        ParagraphNode::new(FractionalIndex::initial(), "default-body", text)
    }

    /// Base characters of a line, left to right (marks skipped).
    fn visual_chars(line: &LineBox) -> String {
        line.glyphs
            .iter()
            .filter(|g| g.width > 0.0)
            .filter_map(|g| g.character)
            .collect()
    }

    #[test]
    fn test_typesetting_document_pages() {
        let mut doc = DocumentRoot::new("ספר בדיקה לעימוד");
        let flow = doc.sections[0].main_flow_mut().unwrap();

        // Add 5 long Hebrew paragraphs
        for i in 0..5 {
            let text = "בְּרֵאשִׁית בָּרָא אֱלֹהִים אֵת הַשָּׁמַיִם וְאֵת הָאָרֶץ. \
                        וְהָאָרֶץ הָיְתָה תֹהוּ וָבֹהוּ וְחֹשֶׁךְ עַל פְּנֵי תְהוֹם וְרוּחַ אֱלֹהִים מְרַחֶפֶת עַל פְּנֵי הַמָּיִם. \
                        וַיֹּאמֶר אֱלֹהִים יְהִי אוֹר וַיְהִי אוֹר. וַיַּרְא אֱלֹהִים אֶת הָאוֹר כִּי טוֹב וַיַּבְדֵּל אֱלֹהִים בֵּין הָאוֹר וּבֵין הַחֹשֶׁךְ.";
            let p = ParagraphNode::new(
                FractionalIndex::new(format!("p{}", i)),
                "default-body",
                text,
            );
            flow.add_paragraph(p);
        }

        let pages = engine().typeset_document(&doc);

        assert!(!pages.is_empty());
        assert_eq!(
            pages[0].page_number_gematria,
            format!("א{}", crate::gematria::HEBREW_GERESH)
        );
        assert!(!pages[0].frames[0].lines.is_empty());
    }

    /// Regression: from the second line of a paragraph on, the paragraph-relative
    /// baseline was added to the page height that already included the earlier
    /// lines, so lines overlapped or left gaps.
    #[test]
    fn baselines_advance_by_one_line_height() {
        let mut doc = DocumentRoot::new("t");
        doc.paragraph_styles[0].space_before_pt = 0.0;
        doc.paragraph_styles[0].space_after_pt = 0.0;
        let flow = doc.sections[0].main_flow_mut().unwrap();
        let long = "מֵאֵימָתַי קוֹרִין אֶת שְׁמַע בְּעַרְבִית מִשָּׁעָה שֶׁהַכֹּהֲנִים נִכְנָסִים לֶאֱכֹל בִּתְרוּמָתָן עַד סוֹף הָאַשְׁמוּרָה הָרִאשׁוֹנָה דִּבְרֵי רַבִּי אֱלִיעֶזֶר וַחֲכָמִים אוֹמְרִים עַד חֲצוֹת ".repeat(6);
        for i in 0..40 {
            flow.add_paragraph(ParagraphNode::new(
                FractionalIndex::new(format!("p{:03}", i)),
                "default-body",
                &long,
            ));
        }
        let pages = engine().typeset_document(&doc);
        assert!(pages.len() > 1);
        for page in &pages {
            let frame = &page.frames[0];
            let mut expected = 0.0;
            for (i, line) in frame.lines.iter().enumerate() {
                expected += line.height;
                assert!(
                    (line.baseline_y - expected).abs() < 1e-3,
                    "page {} line {}: baseline {} expected {}",
                    page.page_index,
                    i,
                    line.baseline_y,
                    expected
                );
                assert_eq!(line.line_index, i);
            }
            assert!(expected <= frame.rect.height + 1e-3);
        }
    }

    /// Regression: words of an RTL paragraph were laid out left to right.
    #[test]
    fn rtl_words_are_in_visual_order() {
        let lines = engine().typeset_paragraph(&para("אב גד"), 300.0, 12.0, 16.0);
        assert_eq!(lines.len(), 1);
        assert_eq!(visual_chars(&lines[0]), "דג בא");
        assert_eq!(lines[0].text, "אב גד");
    }

    /// Regression: Latin words and numbers inside Hebrew were shaped
    /// right-to-left, i.e. printed backwards.
    #[test]
    fn embedded_ltr_runs_keep_their_direction() {
        let lines = engine().typeset_paragraph(&para("שלום abc עולם"), 400.0, 12.0, 16.0);
        assert_eq!(visual_chars(&lines[0]), "םלוע abc םולש");
        let lines = engine().typeset_paragraph(&para("שנת 2026 היא"), 400.0, 12.0, 16.0);
        assert_eq!(visual_chars(&lines[0]), "איה 2026 תנש");
        let lines = engine().typeset_paragraph(&para("ב-2026"), 400.0, 12.0, 16.0);
        assert_eq!(visual_chars(&lines[0]), "2026-ב");
        // LTR paragraph with a Hebrew word.
        let lines = engine().typeset_paragraph(&para("see שלום now"), 400.0, 12.0, 16.0);
        assert!(!lines[0].is_rtl);
        assert_eq!(visual_chars(&lines[0]), "see םולש now");
    }

    #[test]
    fn rtl_short_lines_are_right_aligned_and_lines_never_start_with_space() {
        let text = "מֵאֵימָתַי קוֹרִין אֶת שְׁמַע בְּעַרְבִית? מִשָּׁעָה שֶׁהַכֹּהֲנִים נִכְנָסִים לֶאֱכֹל בִּתְרוּמָתָן, עַד סוֹף הָאַשְׁמוּרָה הָרִאשׁוֹנָה, דִּבְרֵי רַבִּי אֱלִיעֶזֶר.";
        let lines = engine().typeset_paragraph(&para(text), 200.0, 11.0, 14.5);
        assert!(lines.len() > 2);
        for line in &lines {
            let first = line.glyphs.first().unwrap();
            let last = line.glyphs.last().unwrap();
            assert_ne!(first.character, Some(' '), "line {:?}", line.text);
            assert_ne!(last.character, Some(' '), "line {:?}", line.text);
            let (_, right) = line.horizontal_extent();
            assert!((right - 200.0).abs() < 0.5, "right edge {right}");
        }
        for line in &lines[..lines.len() - 1] {
            let (left, _) = line.horizontal_extent();
            assert!(left.abs() < 0.5, "justified line starts at {left}");
            assert!((line.width - 200.0).abs() < 0.5);
        }
        let last = lines.last().unwrap();
        assert!(last.horizontal_extent().0 > 1.0, "last line must be ragged");
    }

    /// Regression: glyph ids came from whichever font shaped the word (e.g.
    /// David Libre for a word with '?'), with nothing recording that font.
    #[test]
    fn every_glyph_records_the_font_it_belongs_to() {
        let engine = engine();
        let text = "שלום עולם? Typeset 2026";
        for family in ["Noto Serif Hebrew", "David CLM"] {
            let lines = engine.typeset_paragraph_with_font(&para(text), family, 400.0, 12.0, 16.0);
            for line in &lines {
                for g in &line.glyphs {
                    let name = line.font_of(g).expect("glyph without font");
                    let font = engine.font_manager.get_font(name).unwrap();
                    let face = ttf_parser::Face::parse(&font.raw_bytes, 0).unwrap();
                    let ch = g.character.unwrap();
                    if ch.is_alphanumeric() || ch == '?' || ch == ' ' {
                        assert_eq!(
                            face.glyph_index(ch).map(|id| u32::from(id.0)),
                            Some(g.glyph_id),
                            "{ch:?} in {name}"
                        );
                    }
                }
            }
        }
    }

    #[test]
    fn clusters_are_paragraph_byte_offsets() {
        let text = "אָב גד  abc";
        let lines = engine().typeset_paragraph(&para(text), 400.0, 12.0, 16.0);
        let p = para(text);
        for g in &lines[0].glyphs {
            // The cluster starts at the glyph's grapheme; marks share it.
            let grapheme: String = p.text[g.cluster as usize..].chars().take(2).collect();
            assert!(
                grapheme.contains(g.character.unwrap()),
                "{:?} not at cluster {}",
                g.character,
                g.cluster
            );
        }
    }

    #[test]
    fn whitespace_runs_collapse_and_nbsp_binds() {
        let lines = engine().typeset_paragraph(&para("  אב \t\n גד  "), 300.0, 12.0, 16.0);
        assert_eq!(lines.len(), 1);
        assert_eq!(lines[0].text, "אב גד");
        let lines = engine().typeset_paragraph(&para("אב\u{00A0}גד"), 300.0, 12.0, 16.0);
        assert_eq!(lines[0].text, "אב\u{00A0}גד");
    }

    #[test]
    fn degenerate_inputs_do_not_panic() {
        let e = engine();
        assert!(e.typeset_paragraph(&para(""), 300.0, 12.0, 16.0).is_empty());
        assert!(e
            .typeset_paragraph(&para("   "), 300.0, 12.0, 16.0)
            .is_empty());
        assert!(e.typeset_paragraph(&para("אב"), 0.0, 12.0, 16.0).is_empty());
        assert!(e
            .typeset_paragraph(&para("אב"), f32::NAN, 12.0, 16.0)
            .is_empty());
        let lines = e.typeset_paragraph(&para("אב גד"), 300.0, f32::NAN, -1.0);
        assert_eq!(lines.len(), 1);
        assert!(lines[0].height > 0.0);
        // A single word wider than the column still gets laid out.
        let lines = e.typeset_paragraph(&para(&"א".repeat(200)), 50.0, 12.0, 16.0);
        assert_eq!(lines.len(), 1);
        assert!(lines[0].width > 50.0);
    }

    #[test]
    fn visual_order_follows_uax9_l2() {
        let order = visual_order(&[(1, 0), (1, 1), (2, 2), (2, 3), (1, 4)]);
        assert_eq!(order, vec![4, 2, 3, 1, 0]);
        let order = visual_order(&[(0, 0), (1, 1), (1, 2), (0, 3)]);
        assert_eq!(order, vec![0, 2, 1, 3]);
        assert!(visual_order(&[]).is_empty());
    }

    #[test]
    fn test_paragraph_space_before_after_margin_collapsing() {
        use tok_core::styles::ParagraphStyle;

        let mut doc = DocumentRoot::new("test");
        let s1 = ParagraphStyle {
            id: "s1".to_string(),
            line_height_pt: 14.0,
            space_before_pt: 0.0,
            space_after_pt: 10.0,
            ..ParagraphStyle::default()
        };
        let s2 = ParagraphStyle {
            id: "s2".to_string(),
            line_height_pt: 14.0,
            space_before_pt: 6.0,
            space_after_pt: 4.0,
            ..ParagraphStyle::default()
        };
        let s3 = ParagraphStyle {
            id: "s3".to_string(),
            line_height_pt: 14.0,
            space_before_pt: 15.0,
            space_after_pt: 0.0,
            ..ParagraphStyle::default()
        };
        doc.paragraph_styles = vec![s1, s2, s3];

        let flow = doc.sections[0].main_flow_mut().unwrap();
        flow.add_paragraph(ParagraphNode::new(FractionalIndex::new("p1"), "s1", "פסקה אחת"));
        flow.add_paragraph(ParagraphNode::new(FractionalIndex::new("p2"), "s2", "פסקה שתיים"));
        flow.add_paragraph(ParagraphNode::new(FractionalIndex::new("p3"), "s3", "פסקה שלוש"));

        let pages = engine().typeset_document(&doc);
        assert_eq!(pages.len(), 1);
        let lines = &pages[0].frames[0].lines;
        assert_eq!(lines.len(), 3);

        // Top of page: space_before collapses to 0.0
        assert_eq!(lines[0].baseline_y, 14.0);

        // Collapsed margin between s1.after (10.0) and s2.before (6.0) is 10.0.max(6.0) = 10.0
        // baseline = 14.0 + 10.0 + 14.0 = 38.0
        assert_eq!(lines[1].baseline_y, 38.0);

        // Collapsed margin between s2.after (4.0) and s3.before (15.0) is 4.0.max(15.0) = 15.0
        // baseline = 38.0 + 15.0 + 14.0 = 67.0
        assert_eq!(lines[2].baseline_y, 67.0);
    }

    #[test]
    fn test_margin_collapsing_at_page_boundary() {
        use tok_core::styles::ParagraphStyle;

        let mut doc = DocumentRoot::new("boundary");
        let style = ParagraphStyle {
            id: "styled".to_string(),
            line_height_pt: 14.0,
            space_before_pt: 30.0,
            space_after_pt: 30.0,
            ..ParagraphStyle::default()
        };
        doc.paragraph_styles = vec![style];

        let flow = doc.sections[0].main_flow_mut().unwrap();
        flow.add_paragraph(ParagraphNode::new(FractionalIndex::new("p1"), "styled", "פסקה ראשונה בעמוד"));

        let pages = engine().typeset_document(&doc);
        assert_eq!(pages.len(), 1);
        let lines = &pages[0].frames[0].lines;
        // Top of page: space_before must collapse to 0.0
        assert_eq!(lines[0].baseline_y, 14.0);
    }

    #[test]
    fn test_empty_paragraph_collapses_margins() {
        use tok_core::styles::ParagraphStyle;

        let mut doc = DocumentRoot::new("empty_test");
        let s1 = ParagraphStyle {
            id: "s1".to_string(),
            line_height_pt: 14.0,
            space_before_pt: 0.0,
            space_after_pt: 5.0,
            ..ParagraphStyle::default()
        };
        let s_empty = ParagraphStyle {
            id: "s_empty".to_string(),
            line_height_pt: 14.0,
            space_before_pt: 12.0,
            space_after_pt: 8.0,
            ..ParagraphStyle::default()
        };
        let s2 = ParagraphStyle {
            id: "s2".to_string(),
            line_height_pt: 14.0,
            space_before_pt: 6.0,
            space_after_pt: 0.0,
            ..ParagraphStyle::default()
        };
        doc.paragraph_styles = vec![s1, s_empty, s2];

        let flow = doc.sections[0].main_flow_mut().unwrap();
        flow.add_paragraph(ParagraphNode::new(FractionalIndex::new("p01"), "s1", "פסקה ראשונה"));
        flow.add_paragraph(ParagraphNode::new(FractionalIndex::new("p02"), "s_empty", ""));
        flow.add_paragraph(ParagraphNode::new(FractionalIndex::new("p03"), "s2", "פסקה שנייה"));

        let pages = engine().typeset_document(&doc);
        let lines = &pages[0].frames[0].lines;
        assert_eq!(lines.len(), 2);
        assert_eq!(lines[0].baseline_y, 14.0);
        // Margins collapsed: 5.0.max(12.0).max(8.0).max(6.0) = 12.0
        // baseline = 14.0 + 12.0 + 14.0 = 40.0
        assert_eq!(lines[1].baseline_y, 40.0);
    }
}
