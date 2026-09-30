//! Central Typesetting Engine for TypesetOK.
//!
//! Orchestrates text shaping, Bidi decomposition, Knuth-Plass line breaking,
//! 3-tier Hebrew justification, and multi-page convergence pagination.

use crate::bidi::BidiEngine;
use crate::gematria::GematriaEngine;
use crate::geometry::{BreakToken, GlyphBox, LineBox, PageLayoutBox, PhysicalRect, TextFrameBox};
use crate::hebrew_justify::HebrewJustifier;
use crate::knuth_plass::{KnuthPlassBreaker, LayoutItem};
use crate::shaper::{PositionedGlyph, TextShaper};
use tok_core::model::{DocumentRoot, ParagraphNode};

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
}

impl TypesettingEngine {
    pub fn new(config: TypesettingEngineConfig) -> Self {
        Self { config }
    }

    /// Typesets a single paragraph into formatted, justified LineBoxes.
    pub fn typeset_paragraph(
        &self,
        paragraph: &ParagraphNode,
        column_width_pt: f32,
        font_size_pt: f32,
        line_height_pt: f32,
    ) -> Vec<LineBox> {
        let text = &paragraph.text;
        if text.trim().is_empty() {
            return Vec::new();
        }

        let is_rtl = BidiEngine::is_paragraph_rtl(text);

        // 1. Break paragraph into words & spaces to build Knuth-Plass stream
        let mut items = Vec::new();
        let words: Vec<&str> = text.split(' ').collect();

        for (i, word) in words.iter().enumerate() {
            if !word.is_empty() {
                let shaped = TextShaper::shape_fallback(word, font_size_pt, is_rtl);
                items.push(LayoutItem::Box {
                    width: shaped.total_width_pt,
                    text: word.to_string(),
                    glyphs: shaped.glyphs,
                });
            }

            if i + 1 < words.len() {
                // Inter-word space glue (base: 0.28 em, stretch: +30%, shrink: -20%)
                let base_space = font_size_pt * 0.28;
                items.push(LayoutItem::Glue {
                    width: base_space,
                    stretch: base_space * 0.30,
                    shrink: base_space * 0.20,
                });
            }
        }

        // Forced break at end of paragraph
        items.push(LayoutItem::Penalty {
            width: 0.0,
            penalty: KnuthPlassBreaker::FORCED_BREAK_PENALTY,
            flagged: false,
        });

        // 2. Run Knuth-Plass global line breaker
        let broken_lines = KnuthPlassBreaker::break_paragraph(&items, column_width_pt, 2.0);

        // 3. Apply 3-Tier Hebrew Justification to each broken line
        let total_lines = broken_lines.len();
        let mut result_lines = Vec::new();

        for (idx, b_line) in broken_lines.into_iter().enumerate() {
            let is_last = idx + 1 == total_lines;

            // Collect all glyphs in this line, inserting space glyphs between boxes
            let mut line_glyphs = Vec::new();
            let mut line_text_parts = Vec::new();

            for item in b_line.items {
                match item {
                    LayoutItem::Box { text, glyphs, .. } => {
                        line_text_parts.push(text);
                        line_glyphs.extend(glyphs);
                    }
                    LayoutItem::Glue { .. } => {
                        // Add space glyph
                        line_glyphs.push(PositionedGlyph {
                            glyph_id: 32,
                            cluster: line_glyphs.len() as u32,
                            x_advance: font_size_pt * 0.28,
                            y_advance: 0.0,
                            x_offset: 0.0,
                            y_offset: 0.0,
                            character: Some(' '),
                        });
                    }
                    _ => {}
                }
            }

            let justified = HebrewJustifier::justify_line(
                line_glyphs,
                column_width_pt,
                font_size_pt,
                is_last,
            );

            // Map PositionedGlyphs to GlyphBoxes
            let mut glyph_boxes = Vec::new();
            let mut current_x = 0.0;
            for g in justified.glyphs {
                glyph_boxes.push(GlyphBox {
                    glyph_id: g.glyph_id,
                    cluster: g.cluster,
                    x: current_x + g.x_offset,
                    y: g.y_offset,
                    width: g.x_advance,
                    height: font_size_pt,
                    character: g.character,
                });
                current_x += g.x_advance;
            }

            result_lines.push(LineBox {
                line_index: idx,
                baseline_y: (idx as f32 + 1.0) * line_height_pt,
                height: line_height_pt,
                width: current_x,
                glyphs: glyph_boxes,
                text: line_text_parts.join(" "),
                is_rtl,
            });
        }

        result_lines
    }

    /// Typesets an entire DocumentRoot into multi-page layout boxes.
    pub fn typeset_document(&self, doc: &DocumentRoot) -> Vec<PageLayoutBox> {
        let content_width = self.config.page_width_pt - self.config.margin_inner_pt - self.config.margin_outer_pt;
        let content_height = self.config.page_height_pt - self.config.margin_top_pt - self.config.margin_bottom_pt;

        let mut pages = Vec::new();
        let mut current_page_lines = Vec::new();
        let mut current_height = 0.0;
        let font_size_pt = 11.0;
        let line_height_pt = 14.5;

        for (sec_idx, sec) in doc.sections.iter().enumerate() {
            if let Some(main_flow) = sec.main_flow() {
                for (p_idx, p) in main_flow.paragraphs.iter().enumerate() {
                    let p_lines = self.typeset_paragraph(p, content_width, font_size_pt, line_height_pt);

                    for line in p_lines {
                        if current_height + line.height > content_height && !current_page_lines.is_empty() {
                            // Page is full: commit page
                            let page_num = pages.len() + 1;
                            let frame = TextFrameBox {
                                frame_id: format!("frame_{}", page_num),
                                flow_id: "main".to_string(),
                                rect: PhysicalRect::new(
                                    self.config.margin_inner_pt,
                                    self.config.margin_top_pt,
                                    content_width,
                                    current_height,
                                ),
                                lines: current_page_lines,
                            };

                            pages.push(PageLayoutBox {
                                page_index: page_num - 1,
                                page_number_gematria: GematriaEngine::to_hebrew_numeral(page_num),
                                dimensions: PhysicalRect::new(
                                    0.0,
                                    0.0,
                                    self.config.page_width_pt,
                                    self.config.page_height_pt,
                                ),
                                frames: vec![frame],
                                break_token: Some(BreakToken {
                                    section_index: sec_idx,
                                    paragraph_index: p_idx,
                                    char_offset: 0,
                                }),
                            });

                            current_page_lines = Vec::new();
                            current_height = 0.0;
                        }

                        current_height += line.height;
                        current_page_lines.push(line);
                    }
                }
            }
        }

        // Flush final page
        if !current_page_lines.is_empty() {
            let page_num = pages.len() + 1;
            let frame = TextFrameBox {
                frame_id: format!("frame_{}", page_num),
                flow_id: "main".to_string(),
                rect: PhysicalRect::new(
                    self.config.margin_inner_pt,
                    self.config.margin_top_pt,
                    content_width,
                    current_height,
                ),
                lines: current_page_lines,
            };

            pages.push(PageLayoutBox {
                page_index: page_num - 1,
                page_number_gematria: GematriaEngine::to_hebrew_numeral(page_num),
                dimensions: PhysicalRect::new(
                    0.0,
                    0.0,
                    self.config.page_width_pt,
                    self.config.page_height_pt,
                ),
                frames: vec![frame],
                break_token: None,
            });
        }

        pages
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use tok_core::id::FractionalIndex;

    #[test]
    fn test_typesetting_document_pages() {
        let mut doc = DocumentRoot::new("ספר בדיקה לעימוד");
        let flow = doc.sections[0].main_flow_mut().unwrap();

        // Add 5 long Hebrew paragraphs
        for i in 0..5 {
            let text = "בְּרֵאשִׁית בָּרָא אֱלֹהִים אֵת הַשָּׁמַיִם וְאֵת הָאָרֶץ. \
                        וְהָאָרֶץ הָיְתָה תֹהוּ וָבֹהוּ וְחֹשֶׁךְ עַל פְּנֵי תְהוֹם וְרוּחַ אֱלֹהִים מְרַחֶפֶת עַל פְּנֵי הַמָּיִם. \
                        וַיֹּאמֶר אֱלֹהִים יְהִי אוֹר וַיְהִי אוֹר. וַיַּרְא אֱלֹהִים אֶת הָאוֹר כִּי טוֹב וַיַּבְדֵּל אֱלֹהִים בֵּין הָאוֹר וּבֵין הַחֹשֶׁךְ.";
            let p = ParagraphNode::new(FractionalIndex::new(format!("p{}", i)), "default-body", text);
            flow.add_paragraph(p);
        }

        let engine = TypesettingEngine::new(TypesettingEngineConfig::default());
        let pages = engine.typeset_document(&doc);

        assert!(!pages.is_empty());
        assert_eq!(pages[0].page_number_gematria, format!("א{}", crate::gematria::HEBREW_GERESH));
        assert!(!pages[0].frames[0].lines.is_empty());
    }
}
