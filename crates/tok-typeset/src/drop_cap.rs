//! Hebrew Drop Cap and Opening Word Shaper ("חלון במילת פתיחה").
//!
//! Shapes large, bold opening words (including Niqqud and Ta'amim),
//! calculates their exact visual bounding box, and synthesizes the
//! rectangular/polygonal exclusion zone around them.

use crate::font::{FontManager, DEFAULT_FAMILY};
use crate::geometry::{GlyphBox, PhysicalRect};
use crate::polygon::ExclusionZone;
use tok_core::styles::{DropCapConfig, FONT_WEIGHT_BOLD};

/// Layout and geometry result for an opening word / drop cap window.
#[derive(Debug, Clone, PartialEq)]
pub struct DropCapLayout {
    /// Opening text extracted (e.g. "בְּרֵאשִׁית", "מֵאֵימָתַי").
    pub text: String,
    /// Remainder of the paragraph text following the opening word.
    pub remaining_text: String,
    /// Positioned glyphs of the drop cap word within the window.
    pub glyphs: Vec<GlyphBox>,
    /// Calculated font size in points used for the drop cap.
    pub font_size_pt: f32,
    /// Bounding rectangle of the window (in frame coordinates).
    pub window_rect: PhysicalRect,
    /// Geometric exclusion zone used to notch indented body lines.
    pub exclusion: ExclusionZone,
}

pub struct HebrewDropCapShaper;

impl HebrewDropCapShaper {
    /// Splits paragraph text into the opening word/letters and the remaining body text.
    pub fn split_opening_text(text: &str, config: &DropCapConfig) -> (String, String) {
        let trimmed = text.trim_start();
        if trimmed.is_empty() {
            return (String::new(), String::new());
        }

        if config.whole_word {
            // Find first whitespace separator
            if let Some(pos) = trimmed.find(|c: char| c.is_whitespace()) {
                let opening = trimmed[..pos].trim().to_string();
                let remaining = trimmed[pos..].trim_start().to_string();
                (opening, remaining)
            } else {
                (trimmed.to_string(), String::new())
            }
        } else {
            // Take `characters_count` base letters along with any following combining marks (Niqqud/Ta'amim)
            let mut count = 0;
            let mut split_pos = trimmed.len();

            let chars: Vec<(usize, char)> = trimmed.char_indices().collect();
            for (idx, &(byte_offset, c)) in chars.iter().enumerate() {
                // If it's a base Hebrew letter or alphanumeric
                let is_combining = ('\u{0591}'..='\u{05BD}').contains(&c)
                    || ('\u{05BF}'..='\u{05C7}').contains(&c);

                if !is_combining && !c.is_whitespace() {
                    count += 1;
                    if count > config.characters_count {
                        split_pos = byte_offset;
                        break;
                    }
                }
                // Also break on whitespace
                if c.is_whitespace() && count > 0 {
                    split_pos = byte_offset;
                    break;
                }
                if idx == chars.len() - 1 {
                    split_pos = trimmed.len();
                }
            }

            let opening = trimmed[..split_pos].trim().to_string();
            let remaining = trimmed[split_pos..].trim_start().to_string();
            (opening, remaining)
        }
    }

    /// Shapes the opening word and computes its exact window geometry and exclusion zone.
    pub fn shape_drop_cap(
        text: &str,
        config: &DropCapConfig,
        font_manager: &FontManager,
        column_width_pt: f32,
        line_height_pt: f32,
        is_rtl: bool,
    ) -> Option<DropCapLayout> {
        if !config.enabled || text.trim().is_empty() || column_width_pt <= 0.0 {
            return None;
        }

        let (opening_text, remaining_text) = Self::split_opening_text(text, config);
        if opening_text.is_empty() {
            return None;
        }

        let font_family = config.font_family.as_deref().unwrap_or(DEFAULT_FAMILY);

        let lines_span = config.lines.max(1);
        let window_height = (lines_span as f32) * line_height_pt;

        let font_size = config
            .font_size_pt
            .unwrap_or_else(|| (line_height_pt * (lines_span as f32 - 0.15)).max(16.0));

        // Use bold weight if specified
        let font_face_name =
            font_manager.face_for(font_family, config.font_weight.max(FONT_WEIGHT_BOLD));
        let session = font_manager.session(&font_face_name);

        let (run, _choice) = session.shape(&opening_text, font_size, is_rtl);
        let ink_width = run.total_width_pt;

        let margin = config.margin_pt.max(0.0);
        let window_width = ink_width + margin;

        let (window_x, glyph_start_x) = if is_rtl {
            let win_x = (column_width_pt - window_width).max(0.0);
            let gl_x = win_x + margin; // margin is between window left edge and glyphs
            (win_x, gl_x)
        } else {
            let win_x = 0.0;
            let gl_x = 0.0; // in LTR, glyphs start at 0, margin on right
            (win_x, gl_x)
        };

        let baseline_y = window_height - (line_height_pt * 0.22);

        let mut curr_x = glyph_start_x;
        let glyph_boxes: Vec<GlyphBox> = run
            .glyphs
            .into_iter()
            .map(|g| {
                let gb = GlyphBox {
                    glyph_id: g.glyph_id,
                    cluster: g.cluster,
                    x: curr_x + g.x_offset,
                    y: baseline_y + g.y_offset,
                    width: g.x_advance,
                    height: font_size,
                    character: g.character,
                    font_index: 0,
                };
                curr_x += g.x_advance;
                gb
            })
            .collect();

        let window_rect = PhysicalRect::new(window_x, 0.0, window_width, window_height);
        let exclusion = ExclusionZone::new(window_rect, 0.0);

        Some(DropCapLayout {
            text: opening_text,
            remaining_text,
            glyphs: glyph_boxes,
            font_size_pt: font_size,
            window_rect,
            exclusion,
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_split_opening_text_whole_word() {
        let config = DropCapConfig {
            whole_word: true,
            ..Default::default()
        };

        let (first, rem) =
            HebrewDropCapShaper::split_opening_text("בְּרֵאשִׁ֖ית בָּרָ֣א אֱלֹהִ֑ים אֵ֥ת הַשָּׁמַ֖יִם", &config);
        assert_eq!(first, "בְּרֵאשִׁ֖ית");
        assert_eq!(rem, "בָּרָ֣א אֱלֹהִ֑ים אֵ֥ת הַשָּׁמַ֖יִם");
    }

    #[test]
    fn test_split_opening_text_chars_count_with_niqqud() {
        let config = DropCapConfig {
            whole_word: false,
            characters_count: 2,
            ..Default::default()
        };

        // First 2 base letters: מ and א, keeping their vowels/dagesh attached
        let (first, rem) = HebrewDropCapShaper::split_opening_text("מֵאֵימָתַי קוֹרִין אֶת שְׁמַע", &config);
        assert_eq!(first, "מֵאֵ");
        assert_eq!(rem, "ימָתַי קוֹרִין אֶת שְׁמַע");
    }

    #[test]
    fn test_shape_drop_cap_talmud_opening_word() {
        let fm = FontManager::default();
        let config = DropCapConfig {
            enabled: true,
            lines: 3,
            whole_word: true,
            margin_pt: 7.0,
            ..Default::default()
        };

        let layout = HebrewDropCapShaper::shape_drop_cap(
            "מֵאֵימָתַ֛י קוֹרִין אֶת שְׁמַע בְּעַרְבִית",
            &config,
            &fm,
            350.0,
            16.0,
            true, // RTL
        )
        .expect("Should shape drop cap");

        assert_eq!(layout.text, "מֵאֵימָתַ֛י");
        assert_eq!(layout.remaining_text, "קוֹרִין אֶת שְׁמַע בְּעַרְבִית");
        assert!(!layout.glyphs.is_empty());

        // 3 lines * 16.0 = 48.0 window height
        assert_eq!(layout.window_rect.height, 48.0);
        // Positive ink width + margin
        assert!(layout.window_rect.width > 20.0);
        // RTL positioning: window x starts at 350.0 - window_width
        assert!((layout.window_rect.x + layout.window_rect.width - 350.0).abs() < 1e-2);
        // Exclusion zone bounds match window rect
        assert_eq!(layout.exclusion.rect, layout.window_rect);
    }

    #[test]
    fn test_shape_drop_cap_disabled_returns_none() {
        let fm = FontManager::default();
        let config = DropCapConfig {
            enabled: false,
            ..Default::default()
        };

        let result = HebrewDropCapShaper::shape_drop_cap("בְּרֵאשִׁית", &config, &fm, 300.0, 15.0, true);
        assert!(result.is_none());
    }
}
