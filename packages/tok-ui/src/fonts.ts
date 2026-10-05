/**
 * Document fonts that ship with TypesetOK. The UI loads them with @font-face
 * (index.html) and the Rust engine embeds the same glyphs (tok-typeset font.rs),
 * so what is on screen is what is measured and printed.
 */
export const DOCUMENT_FONTS: { family: string; label: string }[] = [
  { family: 'Frank Ruhl Libre', label: 'פרנק רוהל (Frank Ruhl Libre)' },
  { family: 'Noto Rashi Hebrew', label: 'כתב רש"י (Noto Rashi Hebrew)' },
  { family: 'David Libre', label: 'דוד (David Libre)' },
  { family: 'Noto Serif Hebrew', label: 'נוטו סריף, טעמים (Noto Serif Hebrew)' },
];

export const DEFAULT_DOCUMENT_FONT = DOCUMENT_FONTS[0].family;

/** Same values as ParagraphStyle.font_weight in tok-core. */
export const FONT_WEIGHT_REGULAR = 400;
export const FONT_WEIGHT_BOLD = 700;
