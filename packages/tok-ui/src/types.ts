export type SelectionMode = 
  | 'zero' 
  | 'text-frame' 
  | 'text-edit' 
  | 'image-frame' 
  | 'multi';

export type ViewMode = 'canvas' | 'story' | 'split';

export interface DocumentSettings {
  title: string;
  pageSize: '17x24' | 'A4' | 'B5' | 'Crown';
  pageWidthMm: number;
  pageHeightMm: number;
  marginTopMm: number;
  marginBottomMm: number;
  marginInsideMm: number; // Inside spine margin in Hebrew RTL
  marginOutsideMm: number;
  columns: number;
  columnGapMm: number;
  baselineGridPt: number;
  baselineOffsetPt: number;
  gematriaFormat: 'standard' | 'with-geresh' | 'talmudic';
  preflightStatus: 'clean' | 'warning' | 'error';
}

export interface FrameGeometry {
  id: string;
  xMm: number;
  yMm: number;
  widthMm: number;
  heightMm: number;
  rotationDeg: number;
}

export interface TextFrameData extends FrameGeometry {
  flowId: 'gemara' | 'rashi' | 'tosafot' | 'notes';
  columns: number;
  columnGapMm: number;
  insetTopMm: number;
  insetBottomMm: number;
  insetRightMm: number;
  insetLeftMm: number;
  verticalAlign: 'top' | 'center' | 'bottom' | 'justify';
  nextFrameId?: string;
  text: string;
}

export interface HebrewJustificationSettings {
  tier1WordSpacingMin: number; // e.g. 80%
  tier1WordSpacingMax: number; // e.g. 130%
  tier2OheltaremEnabled: boolean;
  tier2OheltaremMaxStretch: number; // e.g. 120%
  tier2OheltaremLetters: string[]; // ['א', 'ה', 'ל', 'ת', 'ר', 'ם']
  tier3MicroTrackingRange: number; // ±2%
}

export interface TypographySettings {
  fontFamily: string;
  fontSizePt: number;
  fontWeight: 'normal' | 'bold' | '600' | '700';
  font_weight?: number;
  lineHeightPt: number;
  paragraphSpacingPt: number;
  firstLineIndentMm: number;
  alignment: 'right' | 'center' | 'left' | 'justify';
  styleTokenId: string;
  styleTokenName: string;
  isOverride: boolean;
  justification: HebrewJustificationSettings;
  knuthPlassEnabled: boolean;
  normalizeNiqqud: boolean;
  shieldDivineNames: boolean;
  keepLinesTogether: number; // Orphans/widows minimum lines
}

export interface MultiFlowItem {
  id: 'gemara' | 'rashi' | 'tosafot' | 'notes';
  name: string;
  color: string;
  role: string;
  wordCount: number;
  isActive: boolean;
}

export interface StyleToken {
  id: string;
  name: string;
  fontFamily: string;
  fontSizePt: number;
  fontWeight: string;
  font_weight?: number;
  flowId: string;
}

export interface PageThumbnailItem {
  pageIndex: number;
  gematria: string;
  label: string;
  // Right-hand page of its spread. In an RTL-bound book the right page is the verso
  // (ע"ב); use isRightHandPage()/isRectoPage() from components/SpreadCanvas to derive it.
  isSpreadRight: boolean;
}
