//! Pre-paginated HTML & CSS Projection Compiler.
//!
//! Enforces:
//! - Mandatory `.tok-page` and `.tok-line` isolation rules with `!important` flags (Section 9.6).
//! - Named page definitions (@page :right, @page :left, @page chapter-first) for Vivliostyle.
//! - RTL spread progression.

use tok_typeset::geometry::PageLayoutBox;

pub struct HtmlProjectionCompiler;

impl HtmlProjectionCompiler {
    /// Generates the standard CSS stylesheet for Pre-paginated display in Vivliostyle.
    pub fn generate_stylesheet(page_width_mm: f32, page_height_mm: f32) -> String {
        format!(
            r#"/* TypesetOK Pre-Pagination Stylesheet */
@page {{
  size: {width:.1}mm {height:.1}mm;
  marks: crop cross;
  bleed: 3mm;
}}

@page :right {{
  margin-top: 25mm;
  margin-bottom: 20mm;
  margin-right: 20mm;
  margin-left: 30mm;
}}

@page :left {{
  margin-top: 25mm;
  margin-bottom: 20mm;
  margin-right: 30mm;
  margin-left: 20mm;
}}

@page chapter-first {{
  margin-top: 55mm;
  margin-bottom: 20mm;
  margin-right: 20mm;
  margin-left: 30mm;
}}

body {{
  margin: 0;
  padding: 0;
  direction: rtl;
  font-family: "David CLM", "Times New Roman", serif;
}}

/* Mandatory Isolation Rule: tok-page */
div.tok-page {{
  width: {width:.1}mm !important;
  height: {height:.1}mm !important;
  box-sizing: border-box !important;
  position: relative !important;
  overflow: hidden !important;
  break-inside: avoid !important;
  page-break-inside: avoid !important;
  contain: paint layout !important;
}}

/* Mandatory Isolation Rule: tok-line */
div.tok-line {{
  white-space: nowrap !important;
  overflow: visible !important;
  display: block !important;
  contain: layout style !important;
  margin: 0 !important;
  padding: 0 !important;
  border: 0 !important;
  box-sizing: border-box !important;
}}
"#,
            width = page_width_mm,
            height = page_height_mm,
        )
    }

    /// Compiles a list of PageLayoutBoxes into pre-fragmented HTML for Vivliostyle.
    pub fn compile_to_html(pages: &[PageLayoutBox], page_width_mm: f32, page_height_mm: f32) -> String {
        let mut html = String::new();
        html.push_str("<!DOCTYPE html>\n<html dir=\"rtl\" lang=\"he\">\n<head>\n");
        html.push_str("<meta charset=\"utf-8\">\n");
        html.push_str("<title>TypesetOK Document</title>\n");
        html.push_str("<style>\n");
        html.push_str(&Self::generate_stylesheet(page_width_mm, page_height_mm));
        html.push_str("</style>\n</head>\n<body>\n");

        for p in pages {
            let page_class = if p.page_index == 0 {
                "tok-page tok-page-chapter-first"
            } else if p.page_index % 2 == 0 {
                "tok-page tok-page-right"
            } else {
                "tok-page tok-page-left"
            };

            html.push_str(&format!(
                "<div class=\"{}\" data-page-index=\"{}\" data-gematria=\"{}\">\n",
                page_class, p.page_index, p.page_number_gematria
            ));

            for frame in &p.frames {
                html.push_str(&format!(
                    "  <div class=\"tok-frame\" style=\"position: absolute; left: {:.2}pt; top: {:.2}pt; width: {:.2}pt;\">\n",
                    frame.rect.x, frame.rect.y, frame.rect.width
                ));

                for line in &frame.lines {
                    html.push_str(&format!(
                        "    <div class=\"tok-line\" style=\"height: {:.2}pt; line-height: {:.2}pt;\">{}</div>\n",
                        line.height, line.height, html_escape(&line.text)
                    ));
                }

                html.push_str("  </div>\n");
            }

            // Folio (page number) footer
            html.push_str(&format!(
                "  <div class=\"tok-folio\" style=\"position: absolute; bottom: 20pt; width: 100%; text-align: center;\">{}</div>\n",
                p.page_number_gematria
            ));

            html.push_str("</div>\n");
        }

        html.push_str("</body>\n</html>\n");
        html
    }
}

fn html_escape(s: &str) -> String {
    s.replace('&', "&amp;")
        .replace('<', "&lt;")
        .replace('>', "&gt;")
        .replace('"', "&quot;")
}

#[cfg(test)]
mod tests {
    use super::*;
    use tok_typeset::geometry::{LineBox, PhysicalRect, TextFrameBox};

    #[test]
    fn test_html_projection_containment_rules() {
        let frame = TextFrameBox {
            frame_id: "f1".to_string(),
            flow_id: "main".to_string(),
            rect: PhysicalRect::new(50.0, 50.0, 400.0, 600.0),
            lines: vec![LineBox {
                line_index: 0,
                baseline_y: 14.5,
                height: 14.5,
                width: 300.0,
                glyphs: Vec::new(),
                text: "טקסט עברי מעומד".to_string(),
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

        let html = HtmlProjectionCompiler::compile_to_html(&[page], 210.0, 297.0);

        // Verify mandatory CSS rules from section 9.6
        assert!(html.contains("white-space: nowrap !important"));
        assert!(html.contains("contain: layout style !important"));
        assert!(html.contains("break-inside: avoid !important"));
        assert!(html.contains("dir=\"rtl\""));
        assert!(html.contains("tok-page"));
        assert!(html.contains("tok-line"));
    }
}
