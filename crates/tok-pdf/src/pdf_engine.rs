//! Native Pre-Press ISO PDF/X-1a and PDF/X-4 Generation Engine.
//!
//! Replaces browser print-to-PDF by emitting bit-perfect ISO 15930 PDF/X
//! directly from Rust with DeviceCMYK, OutputIntents, page boxes,
//! and TrueType/OpenType font subsetting (Type 0 / CIDFont Type 2).

use crate::boxes::PrePressPageBoxes;
use crate::font_subsetter::FontSubsetter;
use crate::tounicode::ToUnicodeCMap;
use pdf_writer::types::{CidFontType, FontFlags, OutputIntentSubtype, SystemInfo};
use pdf_writer::{Content, Finish, Name, Pdf, Rect, Ref, Str, TextStr};
use std::collections::HashSet;
use tok_typeset::geometry::PageLayoutBox;

pub enum PdfXStandard {
    PdfX1a2001,
    PdfX4,
}

pub struct PdfExportOptions {
    pub standard: PdfXStandard,
    pub title: String,
    pub author: String,
    pub bleed_pt: f32, // default 3mm = 8.504 pt
    pub slug_pt: f32,  // default 10mm = 28.346 pt
    pub draw_crop_marks: bool,
    pub custom_font_data: Option<Vec<u8>>,
}

impl Default for PdfExportOptions {
    fn default() -> Self {
        Self {
            standard: PdfXStandard::PdfX1a2001,
            title: "מסמך מעומד".to_string(),
            author: "TypesetOK".to_string(),
            bleed_pt: 8.504,
            slug_pt: 28.346,
            draw_crop_marks: true,
            custom_font_data: None,
        }
    }
}

pub struct PdfPrePressEngine;

impl PdfPrePressEngine {
    /// Generates a complete, compliant PDF/X document from typeset page layout boxes.
    pub fn export_pdf(pages: &[PageLayoutBox], options: &PdfExportOptions) -> Vec<u8> {
        let mut pdf = Pdf::new();

        // Allocate IDs
        let mut next_id = 1;
        let mut alloc = || {
            let id = Ref::new(next_id);
            next_id += 1;
            id
        };

        let catalog_id = alloc();
        let pages_id = alloc();
        let info_id = alloc();
        let type0_font_id = alloc();
        let cid_font_id = alloc();
        let descriptor_id = alloc();
        let font_file_id = alloc();
        let tounicode_id = alloc();

        // 1. Info dictionary with PDF/X conformance tag
        let mut info = pdf.document_info(info_id);
        info.title(TextStr(&options.title));
        info.author(TextStr(&options.author));
        info.creator(TextStr("TypesetOK Native Pre-Press Engine 2026"));
        match options.standard {
            PdfXStandard::PdfX1a2001 => {
                info.pair(Name(b"GTS_PDFXVersion"), TextStr("PDF/X-1a:2001"));
            }
            PdfXStandard::PdfX4 => {
                info.pair(Name(b"GTS_PDFXVersion"), TextStr("PDF/X-4"));
            }
        }
        info.finish();

        // 2. Collect used glyphs and characters across all pages
        let dummy_page;
        let iter_pages: &[PageLayoutBox] = if pages.is_empty() {
            dummy_page = [PageLayoutBox {
                page_index: 0,
                page_number_gematria: String::new(),
                dimensions: tok_typeset::geometry::PhysicalRect::a4_portrait(),
                frames: Vec::new(),
                break_token: None,
            }];
            &dummy_page
        } else {
            pages
        };

        let raw_font = options
            .custom_font_data
            .as_deref()
            .unwrap_or(tok_typeset::font::EMBEDDED_NOTO_SERIF_HEBREW);

        let parsed_face = ttf_parser::Face::parse(raw_font, 0).ok();

        let mut glyph_char_pairs = Vec::new();
        let mut seen_glyphs = HashSet::new();

        for p_box in iter_pages {
            for frame in &p_box.frames {
                for line in &frame.lines {
                    if !line.glyphs.is_empty() {
                        for g in &line.glyphs {
                            let gid = g.glyph_id as u16;
                            if gid > 0 && seen_glyphs.insert(gid) {
                                glyph_char_pairs.push((gid, g.character));
                            }
                        }
                    } else if let Some(face) = parsed_face.as_ref() {
                        // Fallback: map text characters to glyph indices
                        for ch in line.text.chars() {
                            if let Some(gid) = face.glyph_index(ch) {
                                if gid.0 > 0 && seen_glyphs.insert(gid.0) {
                                    glyph_char_pairs.push((gid.0, Some(ch)));
                                }
                            }
                        }
                    }
                }
            }
        }

        // 3. Perform TrueType Subsetting & Generate Metrics / ToUnicode CMap
        let subset_result = FontSubsetter::create_subset(raw_font, &glyph_char_pairs)
            .expect("Font subsetting must succeed for embedded font");

        // 4. Write FontFile2 Stream
        let mut font_stream = pdf.stream(font_file_id, &subset_result.subset_bytes);
        font_stream.pair(Name(b"Length1"), subset_result.subset_bytes.len() as i32);
        font_stream.finish();

        // 5. Write FontDescriptor
        let mut descriptor = pdf.font_descriptor(descriptor_id);
        descriptor.name(Name(subset_result.font_name.as_bytes()));
        descriptor.flags(FontFlags::SYMBOLIC);
        descriptor.bbox(Rect::new(
            subset_result.bbox_1000[0],
            subset_result.bbox_1000[1],
            subset_result.bbox_1000[2],
            subset_result.bbox_1000[3],
        ));
        descriptor.italic_angle(subset_result.italic_angle);
        descriptor.ascent(subset_result.ascender_1000);
        descriptor.descent(subset_result.descender_1000);
        descriptor.cap_height(subset_result.cap_height_1000);
        descriptor.stem_v(80.0);
        descriptor.font_file2(font_file_id);
        descriptor.finish();

        // 6. Write CIDFont (Descendant Font)
        let mut cid_font = pdf.cid_font(cid_font_id);
        cid_font.subtype(CidFontType::Type2);
        cid_font.base_font(Name(subset_result.font_name.as_bytes()));
        cid_font.system_info(SystemInfo {
            registry: Str(b"Adobe"),
            ordering: Str(b"Identity"),
            supplement: 0,
        });
        cid_font.font_descriptor(descriptor_id);
        cid_font.default_width(1000.0);

        let mut widths = cid_font.widths();
        widths.consecutive(0, subset_result.cid_widths_1000.clone());
        widths.finish();

        cid_font.cid_to_gid_map_predefined(Name(b"Identity"));
        cid_font.finish();

        // 7. Write /ToUnicode CMap Stream
        let cmap_bytes = ToUnicodeCMap::generate(&subset_result.to_unicode_map);
        pdf.stream(tounicode_id, &cmap_bytes);

        // 8. Write Type 0 Font
        let mut type0 = pdf.type0_font(type0_font_id);
        type0.base_font(Name(subset_result.font_name.as_bytes()));
        type0.encoding_predefined(Name(b"Identity-H"));
        type0.descendant_font(cid_font_id);
        type0.to_unicode(tounicode_id);
        type0.finish();

        // 9. Pages and Content Streams
        let mut page_ids = Vec::new();

        for p_box in iter_pages {
            let page_id = alloc();
            let content_id = alloc();
            page_ids.push(page_id);

            let page_boxes = PrePressPageBoxes::new(
                p_box.dimensions.width,
                p_box.dimensions.height,
                options.bleed_pt,
                options.slug_pt,
            );

            // Build page content stream
            let mut content = Content::new();

            // Draw crop marks in the slug
            if options.draw_crop_marks {
                page_boxes.draw_crop_marks(&mut content);
            }

            // Set fill color to pure DeviceCMYK black (0 0 0 1 k)
            content.set_fill_cmyk(0.0, 0.0, 0.0, 1.0);

            // Origin offset by slug_pt to align inside TrimBox
            let origin_x = page_boxes.trim_box[0];
            let origin_y = page_boxes.trim_box[1];
            let page_h = p_box.dimensions.height;

            // Render text frames
            for frame in &p_box.frames {
                for line in &frame.lines {
                    let base_y = origin_y + (page_h - (frame.rect.y + line.baseline_y));

                    if !line.glyphs.is_empty() {
                        // Position each glyph precisely according to OpenType / Knuth-Plass layout
                        for g in &line.glyphs {
                            if let Some(&cid) = subset_result.gid_to_cid.get(&(g.glyph_id as u16)) {
                                let cid_bytes = cid.to_be_bytes();
                                let gx = origin_x + frame.rect.x + g.x;
                                let gy = base_y + g.y;

                                content.begin_text();
                                content.set_font(Name(b"F1"), g.height);
                                content.set_text_matrix([1.0, 0.0, 0.0, 1.0, gx, gy]);
                                content.show(Str(&cid_bytes));
                                content.end_text();
                            }
                        }
                    } else if let Some(face) = parsed_face.as_ref() {
                        // Fallback line rendering
                        let text_x = origin_x + frame.rect.x;
                        let mut cid_bytes = Vec::new();
                        for ch in line.text.chars() {
                            if let Some(gid) = face.glyph_index(ch) {
                                let cid =
                                    subset_result.gid_to_cid.get(&gid.0).copied().unwrap_or(0);
                                cid_bytes.extend_from_slice(&cid.to_be_bytes());
                            }
                        }

                        content.begin_text();
                        content.set_font(Name(b"F1"), line.height);
                        content.set_text_matrix([1.0, 0.0, 0.0, 1.0, text_x, base_y]);
                        content.show(Str(&cid_bytes));
                        content.end_text();
                    }
                }
            }

            pdf.stream(content_id, &content.finish());

            // Write Page object
            let mut page = pdf.page(page_id);
            page.parent(pages_id);
            page.media_box(Rect::new(
                page_boxes.media_box[0],
                page_boxes.media_box[1],
                page_boxes.media_box[2],
                page_boxes.media_box[3],
            ));
            page.bleed_box(Rect::new(
                page_boxes.bleed_box[0],
                page_boxes.bleed_box[1],
                page_boxes.bleed_box[2],
                page_boxes.bleed_box[3],
            ));
            page.trim_box(Rect::new(
                page_boxes.trim_box[0],
                page_boxes.trim_box[1],
                page_boxes.trim_box[2],
                page_boxes.trim_box[3],
            ));
            page.crop_box(Rect::new(
                page_boxes.crop_box[0],
                page_boxes.crop_box[1],
                page_boxes.crop_box[2],
                page_boxes.crop_box[3],
            ));

            let mut resources = page.resources();
            let mut fonts = resources.fonts();
            fonts.pair(Name(b"F1"), type0_font_id);
            fonts.finish();
            resources.finish();

            page.contents(content_id);
            page.finish();
        }

        // 10. Pages tree
        let mut pages_node = pdf.pages(pages_id);
        pages_node.count(page_ids.len() as i32);
        pages_node.kids(page_ids.iter().copied());
        pages_node.finish();

        // 11. Catalog with OutputIntent (FOGRA39 for PDF/X)
        let mut catalog = pdf.catalog(catalog_id);
        catalog.pages(pages_id);
        let mut catalog_intents = catalog.output_intents();
        let mut intent = catalog_intents.push();
        intent.subtype(OutputIntentSubtype::PDFX);
        intent.output_condition_identifier(TextStr("FOGRA39"));
        intent.info(TextStr("Coated FOGRA39 (ISO 12647-2:2004)"));
        intent.registry_name(TextStr("http://www.color.org"));
        intent.finish();
        catalog_intents.finish();
        catalog.finish();

        pdf.finish()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use tok_typeset::geometry::{LineBox, PhysicalRect, TextFrameBox};

    #[test]
    fn test_pdf_export_structure() {
        let frame = TextFrameBox {
            frame_id: "frame_1".to_string(),
            flow_id: "main".to_string(),
            rect: PhysicalRect::new(50.0, 50.0, 400.0, 600.0),
            lines: vec![LineBox {
                line_index: 0,
                paragraph_id: None,
                baseline_y: 20.0,
                height: 14.5,
                width: 300.0,
                glyphs: Vec::new(),
                text: "שלום עולם".to_string(),
                is_rtl: true,
            }],
        };

        let page = PageLayoutBox {
            page_index: 0,
            page_number_gematria: "א׳".to_string(),
            dimensions: PhysicalRect::a4_portrait(),
            frames: vec![frame],
            break_token: None,
        };

        let bytes = PdfPrePressEngine::export_pdf(&[page], &PdfExportOptions::default());

        assert!(!bytes.is_empty());
        let s = String::from_utf8_lossy(&bytes);
        assert!(s.contains("%PDF-1."));
        assert!(s.contains("GTS_PDFX"));
        assert!(s.contains("/TrimBox"));
        assert!(s.contains("/BleedBox"));
        assert!(s.contains("FOGRA39"));
        assert!(s.contains("/Type0"), "Must embed Type 0 font");
        assert!(s.contains("/CIDFontType2"), "Must embed CIDFont Type 2");
        assert!(s.contains("/FontDescriptor"), "Must embed FontDescriptor");
        assert!(s.contains("/Identity-H"), "Must use Identity-H encoding");
    }

    #[test]
    fn test_pdf_export_with_typeset_glyphs() {
        use tok_core::id::FractionalIndex;
        use tok_core::model::ParagraphNode;
        use tok_typeset::engine::{TypesettingEngine, TypesettingEngineConfig};

        let engine = TypesettingEngine::new(TypesettingEngineConfig::default());
        let para = ParagraphNode::new(
            FractionalIndex::initial(),
            "default-body",
            "מֵאֵימָתַי קוֹרִין אֶת שְׁמַע בְּעַרְבִית?",
        );
        let lines = engine.typeset_paragraph(&para, 400.0, 12.0, 16.0);
        assert!(!lines.is_empty());
        assert!(!lines[0].glyphs.is_empty());

        let frame = TextFrameBox {
            frame_id: "frame_1".to_string(),
            flow_id: "main".to_string(),
            rect: PhysicalRect::new(50.0, 50.0, 400.0, 600.0),
            lines,
        };

        let page = PageLayoutBox {
            page_index: 0,
            page_number_gematria: "א׳".to_string(),
            dimensions: PhysicalRect::a4_portrait(),
            frames: vec![frame],
            break_token: None,
        };

        let bytes = PdfPrePressEngine::export_pdf(&[page], &PdfExportOptions::default());
        assert!(!bytes.is_empty());
        let s = String::from_utf8_lossy(&bytes);
        assert!(s.contains("/CIDToGIDMap"));
        assert!(s.contains("/ToUnicode"));
    }
}
