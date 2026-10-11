use crate::numbering::{NumberingScheme, NumberingScope};
use crate::outline::HierarchyLevel;
use serde::{Deserialize, Serialize};

/// Target spread side for alternating running headers.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Default, Serialize, Deserialize)]
pub enum HeaderSpreadSide {
    #[default]
    Both,
    Recto, // Right-hand page in Hebrew (verso in LTR)
    Verso, // Left-hand page in Hebrew (recto in LTR)
}

/// Dynamic content extraction rule for running headers.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub enum HeaderExtractionRule {
    /// Fixed static text (e.g. "ספר משנה תורה").
    Static(String),
    /// Current document title.
    DocumentTitle,
    /// Current section / chapter title.
    CurrentSectionTitle,
    /// Highest-level ancestor outline title matching a specific hierarchy level.
    OutlineLevelTitle(HierarchyLevel),
    /// Content of the first marker/anchor occurring on the current page (e.g. "סימן י״א").
    FirstMarkerOnPage,
    /// Content of the last marker/anchor occurring on the current page.
    LastMarkerOnPage,
    /// Range formatted from first to last marker on page (e.g. "סימן י״א – י״ג").
    FirstAndLastMarkerRange { separator: String },
}

impl Default for HeaderExtractionRule {
    fn default() -> Self {
        HeaderExtractionRule::CurrentSectionTitle
    }
}

/// Positioning of the folio (page number) within the header/footer band.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Default, Serialize, Deserialize)]
pub enum HeaderFolioPosition {
    /// Outside margin (facing away from spine: right on recto, left on verso).
    #[default]
    OuterMargin,
    /// Inside spine gutter.
    InnerSpine,
    /// Centered horizontally.
    Centered,
    /// Omitted from running header band.
    Omit,
}

/// Complete running header configuration for facing pages in a book.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct RunningHeaderConfig {
    pub recto_rule: HeaderExtractionRule,
    pub verso_rule: HeaderExtractionRule,
    pub recto_folio: HeaderFolioPosition,
    pub verso_folio: HeaderFolioPosition,
    pub numbering_scheme: NumberingScheme,
    pub style_id: String,
    pub suppress_on_first_page_of_section: bool,
    pub height_pt: f32,
}

impl Default for RunningHeaderConfig {
    fn default() -> Self {
        Self {
            recto_rule: HeaderExtractionRule::CurrentSectionTitle,
            verso_rule: HeaderExtractionRule::DocumentTitle,
            recto_folio: HeaderFolioPosition::OuterMargin,
            verso_folio: HeaderFolioPosition::OuterMargin,
            numbering_scheme: NumberingScheme::HebrewGematria(crate::numbering::GematriaPunctuation::StandardPunctuation),
            style_id: "default-header".to_string(),
            suppress_on_first_page_of_section: true,
            height_pt: 18.0,
        }
    }
}

/// Apparatus and footnote configuration for large multi-stream books.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct FootnoteApparatusConfig {
    pub numbering_scheme: NumberingScheme,
    pub scope: NumberingScope,
    pub continuous_numbering: bool,
    pub separator_rule_width_pt: f32,
    pub space_above_pt: f32,
    pub max_band_height_ratio: f32,
}

impl Default for FootnoteApparatusConfig {
    fn default() -> Self {
        Self {
            numbering_scheme: NumberingScheme::HebrewGematria(crate::numbering::GematriaPunctuation::StandardPunctuation),
            scope: NumberingScope::PerPage,
            continuous_numbering: false,
            separator_rule_width_pt: 0.5,
            space_above_pt: 8.0,
            max_band_height_ratio: 0.35, // Footnotes may occupy up to 35% of page
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_running_header_config_defaults() {
        let config = RunningHeaderConfig::default();
        assert!(config.suppress_on_first_page_of_section);
        assert_eq!(config.recto_folio, HeaderFolioPosition::OuterMargin);
        assert_eq!(config.verso_folio, HeaderFolioPosition::OuterMargin);
        assert_eq!(config.height_pt, 18.0);
    }

    #[test]
    fn test_apparatus_config_serialization() {
        let apparatus = FootnoteApparatusConfig {
            numbering_scheme: NumberingScheme::Arabic,
            scope: NumberingScope::PerSection,
            continuous_numbering: true,
            separator_rule_width_pt: 1.0,
            space_above_pt: 10.0,
            max_band_height_ratio: 0.40,
        };
        let json = serde_json::to_string(&apparatus).unwrap();
        let loaded: FootnoteApparatusConfig = serde_json::from_str(&json).unwrap();
        assert_eq!(loaded.max_band_height_ratio, 0.40);
        assert_eq!(loaded.scope, NumberingScope::PerSection);
    }
}
