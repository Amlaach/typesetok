import {
  SelectionMode,
  DocumentSettings,
  TextFrameData,
  TypographySettings
} from '../types';
import { renderIcon, IconName } from '../icons';
import { t, i18n } from '../i18n';

/**
 * Parses a scrubber field such as "11.5 pt", "-3 מ"מ" or "12,5". Returns null when no
 * number is present. (parseInt used to truncate 11.5pt to 11 on every edit/drag.)
 */
export function parseScrubberValue(text: string): number | null {
  const m = String(text).replace(',', '.').match(/-?\d+(?:\.\d+)?/);
  if (!m) return null;
  const v = parseFloat(m[0]);
  return Number.isFinite(v) ? v : null;
}

/** Clamps to [min, max] and rounds to one decimal place. */
export function clampScrubberValue(v: number, min: number, max: number): number {
  return Math.round(Math.max(min, Math.min(max, v)) * 10) / 10;
}

export function formatScrubberValue(v: number, unit: string): string {
  return `${Math.round(v * 10) / 10} ${unit}`;
}

export interface InspectorCallbacks {
  onDocumentChange: (settings: Partial<DocumentSettings>) => void;
  onFrameChange: (geometry: Partial<TextFrameData>) => void;
  onTypographyChange: (typo: Partial<TypographySettings>) => void;
  onSyncStyleToken: () => void;
  onNormalizeNiqqud: () => void;
  onAlignFrames: (alignType: string) => void;
}

export class ContextualInspector {
  public element: HTMLElement;
  private mode: SelectionMode = 'zero';
  private callbacks: InspectorCallbacks;

  private documentSettings: DocumentSettings = {
    title: 'מסכת ברכות — מהדורת מופת',
    pageSize: '17x24',
    pageWidthMm: 170,
    pageHeightMm: 240,
    marginTopMm: 18,
    marginBottomMm: 22,
    marginInsideMm: 20,
    marginOutsideMm: 15,
    columns: 2,
    columnGapMm: 5,
    baselineGridPt: 13,
    baselineOffsetPt: 48,
    gematriaFormat: 'talmudic',
    preflightStatus: 'clean'
  };

  private selectedFrame: TextFrameData = {
    id: 'frame-gemara-1',
    xMm: 35,
    yMm: 45,
    widthMm: 100,
    heightMm: 140,
    rotationDeg: 0,
    flowId: 'gemara',
    columns: 1,
    columnGapMm: 0,
    insetTopMm: 3,
    insetBottomMm: 3,
    insetRightMm: 4,
    insetLeftMm: 4,
    verticalAlign: 'top',
    nextFrameId: 'frame-gemara-2',
    text: 'מאימתי קורין את שמע בערבית...'
  };

  private typographySettings: TypographySettings = {
    fontFamily: 'וילנא (Vilna)',
    fontSizePt: 15,
    fontWeight: 'bold',
    lineHeightPt: 19,
    paragraphSpacingPt: 8,
    firstLineIndentMm: 0,
    alignment: 'justify',
    styleTokenId: 'gemara-main',
    styleTokenName: 'גמרא ראשי',
    isOverride: false,
    justification: {
      tier1WordSpacingMin: 85,
      tier1WordSpacingMax: 125,
      tier2OheltaremEnabled: true,
      tier2OheltaremMaxStretch: 120,
      tier2OheltaremLetters: ['א', 'ה', 'ל', 'ת', 'ר', 'ם'],
      tier3MicroTrackingRange: 2
    },
    knuthPlassEnabled: true,
    normalizeNiqqud: true,
    shieldDivineNames: true,
    keepLinesTogether: 2
  };

  constructor(callbacks: InspectorCallbacks) {
    this.callbacks = callbacks;
    this.element = document.createElement('aside');
    this.element.className = 'tok-inspector-bar';
    this.element.dir = i18n.getDirection();
    this.element.setAttribute('aria-label', t('inspAriaLabel'));
    this.element.style.width = 'var(--tok-inspector-width)';
    this.element.style.minWidth = 'var(--tok-inspector-width)';
    this.element.style.background = 'var(--tok-bg-surface-1)';
    // Border on the side facing the canvas in both directions (was always the right edge).
    this.element.style.borderInlineStart = '1px solid var(--tok-border-subtle)';
    this.element.style.display = 'flex';
    this.element.style.flexDirection = 'column';
    this.element.style.overflowY = 'auto';
    this.element.style.userSelect = 'none';

    i18n.onChange(() => {
      this.element.dir = i18n.getDirection();
      this.element.setAttribute('aria-label', t('inspAriaLabel'));
      this.render();
    });

    this.render();
  }

  public setMode(mode: SelectionMode, frameData?: Partial<TextFrameData>, typoData?: Partial<TypographySettings>): void {
    this.mode = mode;
    if (frameData) Object.assign(this.selectedFrame, frameData);
    if (typoData) Object.assign(this.typographySettings, typoData);
    this.render();
  }

  public getMode(): SelectionMode {
    return this.mode;
  }

  private render(): void {
    this.element.innerHTML = '';

    switch (this.mode) {
      case 'zero':
        this.renderZeroSelection();
        break;
      case 'text-frame':
        this.renderTextFrameMode();
        break;
      case 'text-edit':
        this.renderTextEditMode();
        break;
      case 'image-frame':
        this.renderImageFrameMode();
        break;
      case 'multi':
        this.renderMultiSelectMode();
        break;
    }
  }

  // =========================================================================
  // State 1: Zero Selection (Document Setup & Preflight)
  // =========================================================================
  private renderZeroSelection(): void {
    // Header
    this.element.appendChild(this.createHeader(t('inspDocTitle'), t('inspDocSubtitle'), 'file'));

    // 1. Page Size Card
    const sizeCard = this.createCard(t('inspPageSize'));
    const sizeSelect = document.createElement('select');
    sizeSelect.className = 'tok-select';
    sizeSelect.style.width = '100%';
    sizeSelect.style.marginBottom = '8px';
    sizeSelect.setAttribute('aria-label', t('inspPageSize'));

    const presets = [
      { id: '17x24', name: t('inspPresetSefer'), w: 170, h: 240 },
      { id: 'Crown', name: t('inspPresetCrown'), w: 165, h: 235 },
      { id: 'A4', name: t('inspPresetA4'), w: 210, h: 297 },
      { id: 'B5', name: t('inspPresetB5'), w: 176, h: 250 }
    ];
    for (const p of presets) {
      const opt = document.createElement('option');
      opt.value = p.id;
      opt.textContent = p.name;
      if (p.id === this.documentSettings.pageSize) opt.selected = true;
      sizeSelect.appendChild(opt);
    }
    sizeSelect.addEventListener('change', () => {
      const found = presets.find((p) => p.id === sizeSelect.value);
      if (found) {
        this.documentSettings.pageSize = found.id as any;
        this.documentSettings.pageWidthMm = found.w;
        this.documentSettings.pageHeightMm = found.h;
        this.callbacks.onDocumentChange({
          pageSize: this.documentSettings.pageSize,
          pageWidthMm: found.w,
          pageHeightMm: found.h
        });
        this.render();
      }
    });
    sizeCard.appendChild(sizeSelect);

    // Dimensions display
    const dimRow = document.createElement('div');
    dimRow.style.display = 'flex';
    dimRow.style.gap = '8px';
    dimRow.appendChild(this.createScrubber(t('inspWidth'), this.documentSettings.pageWidthMm, t('unitMm'), 50, 400, (v) => {
      this.documentSettings.pageWidthMm = v;
      this.callbacks.onDocumentChange({ pageWidthMm: v });
    }));
    dimRow.appendChild(this.createScrubber(t('inspHeight'), this.documentSettings.pageHeightMm, t('unitMm'), 50, 500, (v) => {
      this.documentSettings.pageHeightMm = v;
      this.callbacks.onDocumentChange({ pageHeightMm: v });
    }));
    sizeCard.appendChild(dimRow);
    this.element.appendChild(sizeCard);

    // 2. Graded Margins Card (שוליים מדורגים תורניים)
    const marginCard = this.createCard(t('inspGradedMargins'));
    const mRow1 = document.createElement('div');
    mRow1.style.display = 'flex';
    mRow1.style.gap = '8px';
    mRow1.appendChild(this.createScrubber(t('inspTop'), this.documentSettings.marginTopMm, t('unitMm'), 5, 80, (v) => {
      this.documentSettings.marginTopMm = v;
      this.callbacks.onDocumentChange({ marginTopMm: v });
    }));
    mRow1.appendChild(this.createScrubber(t('inspBottom'), this.documentSettings.marginBottomMm, t('unitMm'), 5, 80, (v) => {
      this.documentSettings.marginBottomMm = v;
      this.callbacks.onDocumentChange({ marginBottomMm: v });
    }));
    marginCard.appendChild(mRow1);

    const mRow2 = document.createElement('div');
    mRow2.style.display = 'flex';
    mRow2.style.gap = '8px';
    mRow2.appendChild(this.createScrubber(t('inspInside'), this.documentSettings.marginInsideMm, t('unitMm'), 5, 80, (v) => {
      this.documentSettings.marginInsideMm = v;
      this.callbacks.onDocumentChange({ marginInsideMm: v });
    }));
    mRow2.appendChild(this.createScrubber(t('inspOutside'), this.documentSettings.marginOutsideMm, t('unitMm'), 5, 80, (v) => {
      this.documentSettings.marginOutsideMm = v;
      this.callbacks.onDocumentChange({ marginOutsideMm: v });
    }));
    marginCard.appendChild(mRow2);
    this.element.appendChild(marginCard);

    // 3. Grid & Baseline Card
    const gridCard = this.createCard(t('inspBaselineGrid'));
    const gRow = document.createElement('div');
    gRow.style.display = 'flex';
    gRow.style.gap = '8px';
    gRow.appendChild(this.createScrubber(t('inspLineStep'), this.documentSettings.baselineGridPt, 'pt', 8, 30, (v) => {
      this.documentSettings.baselineGridPt = v;
      this.callbacks.onDocumentChange({ baselineGridPt: v });
    }));
    gRow.appendChild(this.createScrubber(t('inspTopOffset'), this.documentSettings.baselineOffsetPt, 'pt', 0, 100, (v) => {
      this.documentSettings.baselineOffsetPt = v;
      this.callbacks.onDocumentChange({ baselineOffsetPt: v });
    }));
    gridCard.appendChild(gRow);
    this.element.appendChild(gridCard);

    // 4. Preflight Card (Continuous Preflight)
    const pfCard = this.createCard(t('inspPreflight'));
    pfCard.appendChild(this.createStatusRow(t('inspProdStatus'), t('inspReadyForPrint'), '#10B981'));
    pfCard.appendChild(this.createStatusRow(t('inspColorProfile'), 'ISO Coated v2 (100% K Black)', '#94A3B8'));
    pfCard.appendChild(this.createStatusRow(t('inspOverset'), t('inspNoIssues'), '#10B981'));
    pfCard.appendChild(this.createStatusRow(t('inspImageRes'), t('inspImageResOk'), '#10B981'));
    this.element.appendChild(pfCard);
  }

  // =========================================================================
  // State 2: Text Frame Selected (Object Mode)
  // =========================================================================
  private renderTextFrameMode(): void {
    this.element.appendChild(this.createHeader(t('inspTextFrame'), this.selectedFrame.flowId, 'frame'));

    // 1. Geometry & Coordinates with Value Scrubbing
    const geoCard = this.createCard(t('inspGeometry'));
    const geoRow1 = document.createElement('div');
    geoRow1.style.display = 'flex';
    geoRow1.style.gap = '8px';
    geoRow1.appendChild(this.createScrubber(t('inspPosX'), this.selectedFrame.xMm, t('unitMm'), 0, 300, (v) => {
      this.selectedFrame.xMm = v;
      this.callbacks.onFrameChange({ xMm: v });
    }));
    geoRow1.appendChild(this.createScrubber(t('inspPosY'), this.selectedFrame.yMm, t('unitMm'), 0, 400, (v) => {
      this.selectedFrame.yMm = v;
      this.callbacks.onFrameChange({ yMm: v });
    }));
    geoCard.appendChild(geoRow1);

    const geoRow2 = document.createElement('div');
    geoRow2.style.display = 'flex';
    geoRow2.style.gap = '8px';
    geoRow2.appendChild(this.createScrubber(t('inspWidthW'), this.selectedFrame.widthMm, t('unitMm'), 10, 300, (v) => {
      this.selectedFrame.widthMm = v;
      this.callbacks.onFrameChange({ widthMm: v });
    }));
    geoRow2.appendChild(this.createScrubber(t('inspHeightH'), this.selectedFrame.heightMm, t('unitMm'), 10, 400, (v) => {
      this.selectedFrame.heightMm = v;
      this.callbacks.onFrameChange({ heightMm: v });
    }));
    geoCard.appendChild(geoRow2);
    this.element.appendChild(geoCard);

    // 2. Flow & Threading Card
    const flowCard = this.createCard(t('inspFlowThreading'));
    const flowSelect = document.createElement('select');
    flowSelect.className = 'tok-select';
    flowSelect.style.width = '100%';
    flowSelect.style.marginBottom = '8px';
    flowSelect.setAttribute('aria-label', t('inspFlowThreading'));

    const flows = [
      { id: 'gemara', name: t('inspFlowGemara') },
      { id: 'rashi', name: t('inspFlowRashi') },
      { id: 'tosafot', name: t('inspFlowTosafot') },
      { id: 'notes', name: t('inspFlowNotes') }
    ];
    for (const f of flows) {
      const opt = document.createElement('option');
      opt.value = f.id;
      opt.textContent = f.name;
      if (f.id === this.selectedFrame.flowId) opt.selected = true;
      flowSelect.appendChild(opt);
    }
    flowSelect.addEventListener('change', () => {
      this.selectedFrame.flowId = flowSelect.value as any;
      this.callbacks.onFrameChange({ flowId: this.selectedFrame.flowId });
    });
    flowCard.appendChild(flowSelect);

    const threadInfo = document.createElement('div');
    threadInfo.style.fontSize = '11px';
    threadInfo.style.color = 'var(--tok-text-secondary)';
    threadInfo.style.display = 'flex';
    threadInfo.style.justifyContent = 'space-between';
    threadInfo.innerHTML = `<span>${t('inspThreading')}</span><span style="color:#60A5FA;">-> ${this.selectedFrame.nextFrameId || t('inspNone')}</span>`;
    flowCard.appendChild(threadInfo);
    this.element.appendChild(flowCard);

    // 3. Insets & Vertical Alignment Card
    const insetCard = this.createCard(t('inspInsets'));
    const inRow1 = document.createElement('div');
    inRow1.style.display = 'flex';
    inRow1.style.gap = '8px';
    inRow1.appendChild(this.createScrubber(t('inspTop'), this.selectedFrame.insetTopMm, t('unitMm'), 0, 30, (v) => {
      this.selectedFrame.insetTopMm = v;
      this.callbacks.onFrameChange({ insetTopMm: v });
    }));
    inRow1.appendChild(this.createScrubber(t('inspBottom'), this.selectedFrame.insetBottomMm, t('unitMm'), 0, 30, (v) => {
      this.selectedFrame.insetBottomMm = v;
      this.callbacks.onFrameChange({ insetBottomMm: v });
    }));
    insetCard.appendChild(inRow1);

    const inRow2 = document.createElement('div');
    inRow2.style.display = 'flex';
    inRow2.style.gap = '8px';
    const rightInset = this.createScrubber(t('inspRight'), this.selectedFrame.insetRightMm, t('unitMm'), 0, 30, (v) => {
      this.selectedFrame.insetRightMm = v;
      this.callbacks.onFrameChange({ insetRightMm: v });
    });
    const leftInset = this.createScrubber(t('inspLeft'), this.selectedFrame.insetLeftMm, t('unitMm'), 0, 30, (v) => {
      this.selectedFrame.insetLeftMm = v;
      this.callbacks.onFrameChange({ insetLeftMm: v });
    });
    // Keep the physical order (Right field on the right) in both UI directions.
    if (i18n.getDirection() === 'rtl') {
      inRow2.append(rightInset, leftInset);
    } else {
      inRow2.append(leftInset, rightInset);
    }
    insetCard.appendChild(inRow2);

    // Vertical alignment selector
    const vaLabel = document.createElement('div');
    vaLabel.style.fontSize = '11px';
    vaLabel.style.color = 'var(--tok-text-secondary)';
    vaLabel.style.margin = '8px 0 4px';
    vaLabel.textContent = t('inspVAlign');
    insetCard.appendChild(vaLabel);

    const vaBtnWrap = document.createElement('div');
    vaBtnWrap.style.display = 'flex';
    vaBtnWrap.style.gap = '4px';

    const vaOptions: { id: 'top' | 'center' | 'bottom' | 'justify'; label: string }[] = [
      { id: 'top', label: t('inspTop') },
      { id: 'center', label: t('inspCenter') },
      { id: 'bottom', label: t('inspBottom') },
      { id: 'justify', label: t('inspJustify') }
    ];

    for (const opt of vaOptions) {
      const btn = document.createElement('button');
      btn.className = 'tok-btn';
      btn.style.flex = '1';
      btn.style.fontSize = '11px';
      btn.textContent = opt.label;
      btn.setAttribute('aria-pressed', String(this.selectedFrame.verticalAlign === opt.id));
      if (this.selectedFrame.verticalAlign === opt.id) {
        btn.style.background = 'var(--tok-accent-primary)';
        btn.style.color = '#FFFFFF';
      }
      btn.addEventListener('click', () => {
        this.selectedFrame.verticalAlign = opt.id;
        this.callbacks.onFrameChange({ verticalAlign: opt.id });
        this.render();
      });
      vaBtnWrap.appendChild(btn);
    }
    insetCard.appendChild(vaBtnWrap);
    this.element.appendChild(insetCard);
  }

  // =========================================================================
  // State 3: Text Edit Mode (Typography, 3-Tier Hebrew Justification, Niqqud)
  // =========================================================================
  private renderTextEditMode(): void {
    this.element.appendChild(this.createHeader(t('inspTypography'), this.typographySettings.styleTokenName, 'typography'));

    // 1. Style Token Card & Override Sync
    const styleCard = this.createCard(t('inspStyleToken'));
    const tokenRow = document.createElement('div');
    tokenRow.style.display = 'flex';
    tokenRow.style.alignItems = 'center';
    tokenRow.style.justifyContent = 'space-between';
    tokenRow.style.marginBottom = '8px';

    const tokenName = document.createElement('span');
    tokenName.style.fontSize = '13px';
    tokenName.style.fontWeight = 'bold';
    tokenName.style.color = '#60A5FA';
    tokenName.textContent = this.typographySettings.styleTokenName;
    tokenRow.appendChild(tokenName);

    if (this.typographySettings.isOverride) {
      const overrideBadge = document.createElement('span');
      overrideBadge.style.fontSize = '10px';
      overrideBadge.style.padding = '2px 6px';
      overrideBadge.style.borderRadius = '4px';
      overrideBadge.style.background = '#F59E0B';
      overrideBadge.style.color = '#000000';
      overrideBadge.style.fontWeight = 'bold';
      overrideBadge.textContent = t('inspLocalOverride');
      tokenRow.appendChild(overrideBadge);
    }
    styleCard.appendChild(tokenRow);

    const syncBtn = document.createElement('button');
    syncBtn.className = 'tok-btn tok-btn-primary';
    syncBtn.style.width = '100%';
    syncBtn.style.fontSize = '11px';
    syncBtn.style.display = 'flex';
    syncBtn.style.alignItems = 'center';
    syncBtn.style.justifyContent = 'center';
    syncBtn.style.gap = '6px';
    syncBtn.innerHTML = `${renderIcon('refresh', 13)}<span>${t('inspSyncStyle')}</span>`;
    syncBtn.addEventListener('click', () => {
      this.typographySettings.isOverride = false;
      this.callbacks.onSyncStyleToken();
      this.render();
    });
    styleCard.appendChild(syncBtn);
    this.element.appendChild(styleCard);

    // 2. Character & Font Settings
    const fontCard = this.createCard(t('inspFontSpacing'));
    const fontSelect = document.createElement('select');
    fontSelect.className = 'tok-select';
    fontSelect.style.width = '100%';
    fontSelect.style.marginBottom = '8px';
    fontSelect.setAttribute('aria-label', t('hudFont'));

    const fonts = ['וילנא (Vilna)', 'טעמי פרנק (Taamey Frank)', 'דוד (David CLM)', 'כתב רש"י (Rashi)'];
    for (const f of fonts) {
      const opt = document.createElement('option');
      opt.value = f;
      opt.textContent = f;
      if (f.startsWith(this.typographySettings.fontFamily.slice(0, 4))) opt.selected = true;
      fontSelect.appendChild(opt);
    }
    fontSelect.addEventListener('change', () => {
      this.typographySettings.fontFamily = fontSelect.value;
      this.typographySettings.isOverride = true;
      this.callbacks.onTypographyChange({ fontFamily: fontSelect.value, isOverride: true });
      this.render();
    });
    fontCard.appendChild(fontSelect);

    const fRow1 = document.createElement('div');
    fRow1.style.display = 'flex';
    fRow1.style.gap = '8px';
    fRow1.appendChild(this.createScrubber(t('inspFontSize'), this.typographySettings.fontSizePt, 'pt', 6, 72, (v) => {
      this.typographySettings.fontSizePt = v;
      this.typographySettings.isOverride = true;
      this.callbacks.onTypographyChange({ fontSizePt: v, isOverride: true });
    }));
    fRow1.appendChild(this.createScrubber(t('inspLeading'), this.typographySettings.lineHeightPt, 'pt', 8, 90, (v) => {
      this.typographySettings.lineHeightPt = v;
      this.typographySettings.isOverride = true;
      this.callbacks.onTypographyChange({ lineHeightPt: v, isOverride: true });
    }));
    fontCard.appendChild(fRow1);
    this.element.appendChild(fontCard);

    // 3. Three-Tier Hebrew Justification Controls (Section 15)
    const justCard = this.createCard(t('inspJustify3'));
    
    // Tier 1: Word Spacing
    const t1Header = document.createElement('div');
    t1Header.style.fontSize = '11px';
    t1Header.style.fontWeight = 'bold';
    t1Header.style.color = '#93C5FD';
    t1Header.style.margin = '4px 0';
    t1Header.textContent = t('inspTier1');
    justCard.appendChild(t1Header);

    const t1Row = document.createElement('div');
    t1Row.style.display = 'flex';
    t1Row.style.gap = '8px';
    t1Row.appendChild(this.createScrubber(t('inspMin'), this.typographySettings.justification.tier1WordSpacingMin, '%', 60, 100, (v) => {
      this.typographySettings.justification.tier1WordSpacingMin = v;
      this.callbacks.onTypographyChange({ justification: this.typographySettings.justification });
    }));
    t1Row.appendChild(this.createScrubber(t('inspMax'), this.typographySettings.justification.tier1WordSpacingMax, '%', 100, 160, (v) => {
      this.typographySettings.justification.tier1WordSpacingMax = v;
      this.callbacks.onTypographyChange({ justification: this.typographySettings.justification });
    }));
    justCard.appendChild(t1Row);

    // Tier 2: Oheltarem letter elongation
    const t2Header = document.createElement('div');
    t2Header.style.fontSize = '11px';
    t2Header.style.fontWeight = 'bold';
    t2Header.style.color = '#FDE047';
    t2Header.style.margin = '10px 0 4px';
    t2Header.textContent = t('inspTier2');
    justCard.appendChild(t2Header);

    const t2ToggleRow = document.createElement('div');
    t2ToggleRow.style.display = 'flex';
    t2ToggleRow.style.alignItems = 'center';
    t2ToggleRow.style.justifyContent = 'space-between';
    t2ToggleRow.style.marginBottom = '6px';

    const t2Label = document.createElement('span');
    t2Label.style.fontSize = '11px';
    t2Label.textContent = t('inspEnableStretch');
    t2ToggleRow.appendChild(t2Label);

    const t2Switch = document.createElement('input');
    t2Switch.type = 'checkbox';
    t2Switch.checked = this.typographySettings.justification.tier2OheltaremEnabled;
    t2Switch.setAttribute('aria-label', t('inspEnableStretch'));
    t2Switch.addEventListener('change', () => {
      this.typographySettings.justification.tier2OheltaremEnabled = t2Switch.checked;
      this.callbacks.onTypographyChange({ justification: this.typographySettings.justification });
    });
    t2ToggleRow.appendChild(t2Switch);
    justCard.appendChild(t2ToggleRow);

    const letterBoxes = document.createElement('div');
    letterBoxes.style.display = 'flex';
    letterBoxes.style.gap = '4px';
    letterBoxes.style.marginBottom = '8px';

    const oheltaremLetters = ['א', 'ה', 'ל', 'ת', 'ר', 'ם'];
    for (const l of oheltaremLetters) {
      const lBtn = document.createElement('button');
      lBtn.className = 'tok-btn';
      lBtn.textContent = l;
      lBtn.style.padding = '2px 8px';
      lBtn.style.fontSize = '12px';
      lBtn.style.fontWeight = 'bold';
      const isSelected = this.typographySettings.justification.tier2OheltaremLetters.includes(l);
      lBtn.style.background = isSelected ? 'var(--tok-accent-primary)' : 'var(--tok-bg-surface-2)';
      lBtn.style.color = isSelected ? '#FFFFFF' : 'var(--tok-text-secondary)';
      lBtn.setAttribute('aria-pressed', String(isSelected));
      lBtn.addEventListener('click', () => {
        const arr = this.typographySettings.justification.tier2OheltaremLetters;
        const idx = arr.indexOf(l);
        if (idx >= 0) arr.splice(idx, 1);
        else arr.push(l);
        this.render();
        this.callbacks.onTypographyChange({ justification: this.typographySettings.justification });
      });
      letterBoxes.appendChild(lBtn);
    }
    justCard.appendChild(letterBoxes);

    justCard.appendChild(this.createScrubber(t('inspMaxStretch'), this.typographySettings.justification.tier2OheltaremMaxStretch, '%', 100, 180, (v) => {
      this.typographySettings.justification.tier2OheltaremMaxStretch = v;
      this.callbacks.onTypographyChange({ justification: this.typographySettings.justification });
    }));

    // Tier 3: Micro-Tracking
    const t3Header = document.createElement('div');
    t3Header.style.fontSize = '11px';
    t3Header.style.fontWeight = 'bold';
    t3Header.style.color = '#86EFAC';
    t3Header.style.margin = '10px 0 4px';
    t3Header.textContent = t('inspTier3');
    justCard.appendChild(t3Header);

    justCard.appendChild(this.createScrubber(t('inspTrackingRange'), this.typographySettings.justification.tier3MicroTrackingRange, '%', 0, 5, (v) => {
      this.typographySettings.justification.tier3MicroTrackingRange = v;
      this.callbacks.onTypographyChange({ justification: this.typographySettings.justification });
    }));

    this.element.appendChild(justCard);

    // 4. Sacred Typography & Niqqud Card
    const sacredCard = this.createCard(t('inspSacred'));
    const normBtn = document.createElement('button');
    normBtn.className = 'tok-btn tok-btn-primary';
    normBtn.style.width = '100%';
    normBtn.style.marginBottom = '8px';
    normBtn.style.display = 'flex';
    normBtn.style.alignItems = 'center';
    normBtn.style.justifyContent = 'center';
    normBtn.style.gap = '6px';
    normBtn.innerHTML = `${renderIcon('sparkle', 13)}<span>${t('inspNormalize')}</span>`;
    normBtn.addEventListener('click', () => {
      this.callbacks.onNormalizeNiqqud();
    });
    sacredCard.appendChild(normBtn);

    const divineRow = document.createElement('div');
    divineRow.style.display = 'flex';
    divineRow.style.alignItems = 'center';
    divineRow.style.justifyContent = 'space-between';

    const divineLabel = document.createElement('span');
    divineLabel.style.fontSize = '11px';
    divineLabel.textContent = t('inspDivineShield');
    divineRow.appendChild(divineLabel);

    const divineSwitch = document.createElement('input');
    divineSwitch.type = 'checkbox';
    divineSwitch.checked = this.typographySettings.shieldDivineNames;
    divineSwitch.setAttribute('aria-label', t('inspDivineShield'));
    divineSwitch.addEventListener('change', () => {
      this.typographySettings.shieldDivineNames = divineSwitch.checked;
      this.callbacks.onTypographyChange({ shieldDivineNames: divineSwitch.checked });
    });
    divineRow.appendChild(divineSwitch);
    sacredCard.appendChild(divineRow);

    this.element.appendChild(sacredCard);
  }

  // =========================================================================
  // State 4: Image Frame Mode
  // =========================================================================
  private renderImageFrameMode(): void {
    this.element.appendChild(this.createHeader(t('inspImageFrame'), t('inspImage'), 'image'));

    const imgCard = this.createCard(t('inspFitting'));
    const fitSelect = document.createElement('select');
    fitSelect.className = 'tok-select';
    fitSelect.style.width = '100%';
    fitSelect.style.marginBottom = '8px';
    fitSelect.setAttribute('aria-label', t('inspFitting'));

    const fits = [t('inspFitProportional'), t('inspFitFill'), t('inspFitFrame')];
    for (const f of fits) {
      const opt = document.createElement('option');
      opt.textContent = f;
      fitSelect.appendChild(opt);
    }
    imgCard.appendChild(fitSelect);

    imgCard.appendChild(this.createStatusRow(t('inspEffRes'), t('inspEffResOk'), '#10B981'));
    imgCard.appendChild(this.createStatusRow(t('inspColorSpace'), 'CMYK Coated', '#94A3B8'));
    imgCard.appendChild(this.createStatusRow(t('inspWrap'), t('inspWrapAround'), '#60A5FA'));
    this.element.appendChild(imgCard);
  }

  // =========================================================================
  // State 5: Multi-Selection Mode (Align & Distribute)
  // =========================================================================
  private renderMultiSelectMode(): void {
    this.element.appendChild(this.createHeader(t('inspMulti'), t('inspMultiCount'), 'layers'));

    const alignCard = this.createCard(t('inspAlignDist'));
    const alignRow = document.createElement('div');
    alignRow.style.display = 'grid';
    alignRow.style.gridTemplateColumns = 'repeat(3, 1fr)';
    alignRow.style.gap = '6px';
    alignRow.style.marginBottom = '8px';

    const alignActions = [
      { id: 'right', label: t('inspAlignRight') },
      { id: 'center', label: t('inspAlignCenter') },
      { id: 'left', label: t('inspAlignLeft') },
      { id: 'top', label: t('inspAlignTop') },
      { id: 'middle', label: t('inspAlignMiddle') },
      { id: 'bottom', label: t('inspAlignBottom') }
    ];

    for (const a of alignActions) {
      const btn = document.createElement('button');
      btn.className = 'tok-btn';
      btn.textContent = a.label;
      btn.style.fontSize = '11px';
      btn.addEventListener('click', () => this.callbacks.onAlignFrames(a.id));
      alignRow.appendChild(btn);
    }
    alignCard.appendChild(alignRow);

    const distBtn = document.createElement('button');
    distBtn.className = 'tok-btn tok-btn-primary';
    distBtn.style.width = '100%';
    distBtn.textContent = t('inspDistribute');
    distBtn.addEventListener('click', () => this.callbacks.onAlignFrames('distribute-vertical'));
    alignCard.appendChild(distBtn);

    this.element.appendChild(alignCard);
  }

  // =========================================================================
  // Value Scrubber Helper (Figma / Blender Style Direct Drag Manipulation)
  // =========================================================================
  private createScrubber(
    label: string,
    initialVal: number,
    unit: string,
    min: number,
    max: number,
    onChange: (val: number) => void
  ): HTMLElement {
    const wrap = document.createElement('div');
    wrap.className = 'tok-scrubber-field';
    wrap.style.flex = '1';
    wrap.style.display = 'flex';
    wrap.style.flexDirection = 'column';
    wrap.style.alignItems = 'stretch';
    wrap.style.marginBottom = '6px';

    const topRow = document.createElement('div');
    topRow.style.display = 'flex';
    topRow.style.alignItems = 'center';
    topRow.style.justifyContent = 'space-between';

    const lbl = document.createElement('span');
    lbl.className = 'tok-scrubber-label';
    lbl.textContent = label;
    lbl.title = t('inspScrubHint');
    topRow.appendChild(lbl);

    const inputWrap = document.createElement('div');
    inputWrap.className = 'tok-scrubber-input-wrapper';
    inputWrap.style.position = 'relative';

    const input = document.createElement('input');
    input.type = 'text';
    input.inputMode = 'decimal';
    input.className = 'tok-input tok-input-number tok-scrubber-input';
    input.style.width = '100%';
    input.value = formatScrubberValue(initialVal, unit);
    input.setAttribute('aria-label', label);

    // Value scrubbing state
    let isDragging = false;
    let startX = 0;
    let startVal = initialVal;
    let lastVal = initialVal;

    const commit = (v: number) => {
      input.value = formatScrubberValue(v, unit);
      if (v !== lastVal) {
        lastVal = v;
        onChange(v);
      }
    };

    const onMouseDown = (e: MouseEvent) => {
      if (e.button !== 0) return;
      isDragging = true;
      startX = e.clientX;
      startVal = parseScrubberValue(input.value) ?? lastVal;
      document.body.style.cursor = 'ew-resize';
      window.addEventListener('mousemove', onMouseMove);
      window.addEventListener('mouseup', onMouseUp);
      e.preventDefault();
    };

    const onMouseMove = (e: MouseEvent) => {
      if (!isDragging) return;
      // Dragging toward the inline end increases the value: right in LTR, left in RTL.
      const rtl = getComputedStyle(wrap).direction === 'rtl';
      const dx = rtl ? startX - e.clientX : e.clientX - startX;
      const delta = Math.round(dx / 3);
      // Only fire onChange when the value actually changes (mousemove fires per pixel).
      commit(clampScrubberValue(startVal + delta, min, max));
    };

    const onMouseUp = () => {
      if (isDragging) {
        isDragging = false;
        document.body.style.cursor = '';
        window.removeEventListener('mousemove', onMouseMove);
        window.removeEventListener('mouseup', onMouseUp);
      }
    };

    lbl.addEventListener('mousedown', onMouseDown);

    input.addEventListener('change', () => {
      const parsed = parseScrubberValue(input.value);
      if (parsed === null) {
        input.value = formatScrubberValue(lastVal, unit); // restore instead of leaving garbage
        return;
      }
      commit(clampScrubberValue(parsed, min, max));
    });

    // Keyboard stepping: ArrowUp/Down ±1 (Shift: ±10).
    input.addEventListener('keydown', (e) => {
      if (e.key !== 'ArrowUp' && e.key !== 'ArrowDown') return;
      e.preventDefault();
      const step = (e.shiftKey ? 10 : 1) * (e.key === 'ArrowUp' ? 1 : -1);
      commit(clampScrubberValue((parseScrubberValue(input.value) ?? lastVal) + step, min, max));
    });

    inputWrap.appendChild(input);
    wrap.appendChild(topRow);
    wrap.appendChild(inputWrap);

    return wrap;
  }

  private createCard(title: string): HTMLElement {
    const card = document.createElement('div');
    card.className = 'tok-inspector-card';
    const header = document.createElement('div');
    header.className = 'tok-inspector-card-header';
    header.textContent = title;
    card.appendChild(header);
    return card;
  }

  private createHeader(title: string, subtitle: string, icon: IconName): HTMLElement {
    const header = document.createElement('div');
    header.style.padding = '12px 14px';
    header.style.borderBottom = '1px solid var(--tok-border-subtle)';
    header.style.background = 'var(--tok-bg-surface-2)';
    header.style.display = 'flex';
    header.style.alignItems = 'center';
    header.style.justifyContent = 'space-between';

    const right = document.createElement('div');
    right.style.display = 'flex';
    right.style.alignItems = 'center';
    right.style.gap = '8px';

    const iconSpan = document.createElement('span');
    iconSpan.style.display = 'inline-flex';
    iconSpan.style.alignItems = 'center';
    iconSpan.style.justifyContent = 'center';
    iconSpan.style.color = '#60A5FA';
    iconSpan.innerHTML = renderIcon(icon, 16);
    right.appendChild(iconSpan);

    const textWrap = document.createElement('div');
    const titleEl = document.createElement('div');
    titleEl.style.fontWeight = 'bold';
    titleEl.style.fontSize = '13px';
    titleEl.textContent = title;
    textWrap.appendChild(titleEl);

    const s = document.createElement('div');
    s.style.fontSize = '11px';
    s.style.color = 'var(--tok-text-muted)';
    s.textContent = subtitle;
    textWrap.appendChild(s);

    right.appendChild(textWrap);
    header.appendChild(right);

    return header;
  }

  private createStatusRow(label: string, value: string, color: string): HTMLElement {
    const row = document.createElement('div');
    row.style.display = 'flex';
    row.style.alignItems = 'center';
    row.style.justifyContent = 'space-between';
    row.style.padding = '4px 0';
    row.style.fontSize = '11px';

    const lSpan = document.createElement('span');
    lSpan.style.color = 'var(--tok-text-secondary)';
    lSpan.textContent = label;
    row.appendChild(lSpan);

    const vSpan = document.createElement('span');
    vSpan.style.color = color;
    vSpan.style.fontWeight = 'bold';
    vSpan.textContent = value;
    row.appendChild(vSpan);

    return row;
  }
}
