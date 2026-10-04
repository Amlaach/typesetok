import {
  SelectionMode,
  DocumentSettings,
  TextFrameData,
  TypographySettings
} from '../types';

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
    this.element.dir = 'rtl';
    this.element.style.width = 'var(--tok-inspector-width)';
    this.element.style.minWidth = 'var(--tok-inspector-width)';
    this.element.style.background = 'var(--tok-bg-surface-1)';
    this.element.style.borderRight = '1px solid var(--tok-border-subtle)';
    this.element.style.display = 'flex';
    this.element.style.flexDirection = 'column';
    this.element.style.overflowY = 'auto';
    this.element.style.userSelect = 'none';

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
    this.element.appendChild(this.createHeader('הגדרות מסמך ועמוד', 'מסמך תורני', '📄'));

    // 1. Page Size Card
    const sizeCard = this.createCard('ממדי עמוד ופורמט');
    const sizeSelect = document.createElement('select');
    sizeSelect.className = 'tok-select';
    sizeSelect.style.width = '100%';
    sizeSelect.style.marginBottom = '8px';

    const presets = [
      { id: '17x24', name: 'ספר קודש סטנדרטי (17×24 ס"מ)', w: 170, h: 240 },
      { id: 'Crown', name: 'פורמט קראון (16.5×23.5 ס"מ)', w: 165, h: 235 },
      { id: 'A4', name: 'פורמט A4 (21×29.7 ס"מ)', w: 210, h: 297 },
      { id: 'B5', name: 'פורמט B5 (17.6×25 ס"מ)', w: 176, h: 250 }
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
    dimRow.appendChild(this.createScrubber('רוחב', this.documentSettings.pageWidthMm, 'מ"מ', 50, 400, (v) => {
      this.documentSettings.pageWidthMm = v;
      this.callbacks.onDocumentChange({ pageWidthMm: v });
    }));
    dimRow.appendChild(this.createScrubber('גובה', this.documentSettings.pageHeightMm, 'מ"מ', 50, 500, (v) => {
      this.documentSettings.pageHeightMm = v;
      this.callbacks.onDocumentChange({ pageHeightMm: v });
    }));
    sizeCard.appendChild(dimRow);
    this.element.appendChild(sizeCard);

    // 2. Graded Margins Card (שוליים מדורגים תורניים)
    const marginCard = this.createCard('שוליים מדורגים (Graded Margins)');
    const mRow1 = document.createElement('div');
    mRow1.style.display = 'flex';
    mRow1.style.gap = '8px';
    mRow1.appendChild(this.createScrubber('עליון', this.documentSettings.marginTopMm, 'מ"מ', 5, 80, (v) => {
      this.documentSettings.marginTopMm = v;
      this.callbacks.onDocumentChange({ marginTopMm: v });
    }));
    mRow1.appendChild(this.createScrubber('תחתון', this.documentSettings.marginBottomMm, 'מ"מ', 5, 80, (v) => {
      this.documentSettings.marginBottomMm = v;
      this.callbacks.onDocumentChange({ marginBottomMm: v });
    }));
    marginCard.appendChild(mRow1);

    const mRow2 = document.createElement('div');
    mRow2.style.display = 'flex';
    mRow2.style.gap = '8px';
    mRow2.appendChild(this.createScrubber('פנימי/שדרה', this.documentSettings.marginInsideMm, 'מ"מ', 5, 80, (v) => {
      this.documentSettings.marginInsideMm = v;
      this.callbacks.onDocumentChange({ marginInsideMm: v });
    }));
    mRow2.appendChild(this.createScrubber('חיצוני', this.documentSettings.marginOutsideMm, 'מ"מ', 5, 80, (v) => {
      this.documentSettings.marginOutsideMm = v;
      this.callbacks.onDocumentChange({ marginOutsideMm: v });
    }));
    marginCard.appendChild(mRow2);
    this.element.appendChild(marginCard);

    // 3. Grid & Baseline Card
    const gridCard = this.createCard('רשת שורות בסיס (Baseline Grid)');
    const gRow = document.createElement('div');
    gRow.style.display = 'flex';
    gRow.style.gap = '8px';
    gRow.appendChild(this.createScrubber('צעד שורה', this.documentSettings.baselineGridPt, 'pt', 8, 30, (v) => {
      this.documentSettings.baselineGridPt = v;
      this.callbacks.onDocumentChange({ baselineGridPt: v });
    }));
    gRow.appendChild(this.createScrubber('היסט עליון', this.documentSettings.baselineOffsetPt, 'pt', 0, 100, (v) => {
      this.documentSettings.baselineOffsetPt = v;
      this.callbacks.onDocumentChange({ baselineOffsetPt: v });
    }));
    gridCard.appendChild(gRow);
    this.element.appendChild(gridCard);

    // 4. Preflight Card (Continuous Preflight)
    const pfCard = this.createCard('קדם-דפוס רציף (Continuous Preflight)');
    pfCard.appendChild(this.createStatusRow('סטטוס ייצור', 'תקין (Ready for Print)', '#10B981'));
    pfCard.appendChild(this.createStatusRow('פרופיל צבע', 'ISO Coated v2 (100% K Black)', '#94A3B8'));
    pfCard.appendChild(this.createStatusRow('טקסט גולש (Overset)', '0 חריגות', '#10B981'));
    pfCard.appendChild(this.createStatusRow('רזולוציית תמונות', '300+ DPI (תקין)', '#10B981'));
    this.element.appendChild(pfCard);
  }

  // =========================================================================
  // State 2: Text Frame Selected (Object Mode)
  // =========================================================================
  private renderTextFrameMode(): void {
    this.element.appendChild(this.createHeader('תיבת טקסט', this.selectedFrame.flowId, '📐'));

    // 1. Geometry & Coordinates with Value Scrubbing
    const geoCard = this.createCard('מיקום וממדים (Geometry)');
    const geoRow1 = document.createElement('div');
    geoRow1.style.display = 'flex';
    geoRow1.style.gap = '8px';
    geoRow1.appendChild(this.createScrubber('מיקום X', this.selectedFrame.xMm, 'מ"מ', 0, 300, (v) => {
      this.selectedFrame.xMm = v;
      this.callbacks.onFrameChange({ xMm: v });
    }));
    geoRow1.appendChild(this.createScrubber('מיקום Y', this.selectedFrame.yMm, 'מ"מ', 0, 400, (v) => {
      this.selectedFrame.yMm = v;
      this.callbacks.onFrameChange({ yMm: v });
    }));
    geoCard.appendChild(geoRow1);

    const geoRow2 = document.createElement('div');
    geoRow2.style.display = 'flex';
    geoRow2.style.gap = '8px';
    geoRow2.appendChild(this.createScrubber('רוחב W', this.selectedFrame.widthMm, 'מ"מ', 10, 300, (v) => {
      this.selectedFrame.widthMm = v;
      this.callbacks.onFrameChange({ widthMm: v });
    }));
    geoRow2.appendChild(this.createScrubber('גובה H', this.selectedFrame.heightMm, 'מ"מ', 10, 400, (v) => {
      this.selectedFrame.heightMm = v;
      this.callbacks.onFrameChange({ heightMm: v });
    }));
    geoCard.appendChild(geoRow2);
    this.element.appendChild(geoCard);

    // 2. Flow & Threading Card
    const flowCard = this.createCard('שיוך תזרים ושרשור');
    const flowSelect = document.createElement('select');
    flowSelect.className = 'tok-select';
    flowSelect.style.width = '100%';
    flowSelect.style.marginBottom = '8px';

    const flows = [
      { id: 'gemara', name: 'גמרא (טקסט מרכזי)' },
      { id: 'rashi', name: 'רש"י (פירוש פנימי)' },
      { id: 'tosafot', name: 'תוספות (פירוש חיצוני)' },
      { id: 'notes', name: 'הערות שוליים וציונים' }
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
    threadInfo.innerHTML = `<span>שרשור תזרים:</span><span style="color:#60A5FA;">-> ${this.selectedFrame.nextFrameId || 'ללא'}</span>`;
    flowCard.appendChild(threadInfo);
    this.element.appendChild(flowCard);

    // 3. Insets & Vertical Alignment Card
    const insetCard = this.createCard('שוליים פנימיים ויישור אנכי');
    const inRow1 = document.createElement('div');
    inRow1.style.display = 'flex';
    inRow1.style.gap = '8px';
    inRow1.appendChild(this.createScrubber('עליון', this.selectedFrame.insetTopMm, 'מ"מ', 0, 30, (v) => {
      this.selectedFrame.insetTopMm = v;
      this.callbacks.onFrameChange({ insetTopMm: v });
    }));
    inRow1.appendChild(this.createScrubber('תחתון', this.selectedFrame.insetBottomMm, 'מ"מ', 0, 30, (v) => {
      this.selectedFrame.insetBottomMm = v;
      this.callbacks.onFrameChange({ insetBottomMm: v });
    }));
    insetCard.appendChild(inRow1);

    const inRow2 = document.createElement('div');
    inRow2.style.display = 'flex';
    inRow2.style.gap = '8px';
    inRow2.appendChild(this.createScrubber('ימין', this.selectedFrame.insetRightMm, 'מ"מ', 0, 30, (v) => {
      this.selectedFrame.insetRightMm = v;
      this.callbacks.onFrameChange({ insetRightMm: v });
    }));
    inRow2.appendChild(this.createScrubber('שמאל', this.selectedFrame.insetLeftMm, 'מ"מ', 0, 30, (v) => {
      this.selectedFrame.insetLeftMm = v;
      this.callbacks.onFrameChange({ insetLeftMm: v });
    }));
    insetCard.appendChild(inRow2);

    // Vertical alignment selector
    const vaLabel = document.createElement('div');
    vaLabel.style.fontSize = '11px';
    vaLabel.style.color = 'var(--tok-text-secondary)';
    vaLabel.style.margin = '8px 0 4px';
    vaLabel.textContent = 'יישור אנכי בתיבה:';
    insetCard.appendChild(vaLabel);

    const vaBtnWrap = document.createElement('div');
    vaBtnWrap.style.display = 'flex';
    vaBtnWrap.style.gap = '4px';

    const vaOptions: { id: 'top' | 'center' | 'bottom' | 'justify'; label: string }[] = [
      { id: 'top', label: 'עליון' },
      { id: 'center', label: 'מרכז' },
      { id: 'bottom', label: 'תחתון' },
      { id: 'justify', label: 'מלא' }
    ];

    for (const opt of vaOptions) {
      const btn = document.createElement('button');
      btn.className = 'tok-btn';
      btn.style.flex = '1';
      btn.style.fontSize = '11px';
      btn.textContent = opt.label;
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
    this.element.appendChild(this.createHeader('טיפוגרפיה ועריכה', this.typographySettings.styleTokenName, '🔤'));

    // 1. Style Token Card & Override Sync
    const styleCard = this.createCard('טוקן סגנון פסקה');
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
      overrideBadge.textContent = 'שינוי מקומי (+)';
      tokenRow.appendChild(overrideBadge);
    }
    styleCard.appendChild(tokenRow);

    const syncBtn = document.createElement('button');
    syncBtn.className = 'tok-btn tok-btn-primary';
    syncBtn.style.width = '100%';
    syncBtn.style.fontSize = '11px';
    syncBtn.innerHTML = `<span>🔄</span><span>עדכן סגנון גלובלי מהשינוי הנוכחי</span>`;
    syncBtn.addEventListener('click', () => {
      this.typographySettings.isOverride = false;
      this.callbacks.onSyncStyleToken();
      this.render();
    });
    styleCard.appendChild(syncBtn);
    this.element.appendChild(styleCard);

    // 2. Character & Font Settings
    const fontCard = this.createCard('גופן ומרווחים');
    const fontSelect = document.createElement('select');
    fontSelect.className = 'tok-select';
    fontSelect.style.width = '100%';
    fontSelect.style.marginBottom = '8px';

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
    fRow1.appendChild(this.createScrubber('גודל גופן', this.typographySettings.fontSizePt, 'pt', 6, 72, (v) => {
      this.typographySettings.fontSizePt = v;
      this.typographySettings.isOverride = true;
      this.callbacks.onTypographyChange({ fontSizePt: v, isOverride: true });
    }));
    fRow1.appendChild(this.createScrubber('רווח שורות', this.typographySettings.lineHeightPt, 'pt', 8, 90, (v) => {
      this.typographySettings.lineHeightPt = v;
      this.typographySettings.isOverride = true;
      this.callbacks.onTypographyChange({ lineHeightPt: v, isOverride: true });
    }));
    fontCard.appendChild(fRow1);
    this.element.appendChild(fontCard);

    // 3. Three-Tier Hebrew Justification Controls (Section 15)
    const justCard = this.createCard('יישור עברי תלת-שלבי (3-Tier)');
    
    // Tier 1: Word Spacing
    const t1Header = document.createElement('div');
    t1Header.style.fontSize = '11px';
    t1Header.style.fontWeight = 'bold';
    t1Header.style.color = '#93C5FD';
    t1Header.style.margin = '4px 0';
    t1Header.textContent = 'שכבה 1: רווחי מילים (80%–130%)';
    justCard.appendChild(t1Header);

    const t1Row = document.createElement('div');
    t1Row.style.display = 'flex';
    t1Row.style.gap = '8px';
    t1Row.appendChild(this.createScrubber('מינימום', this.typographySettings.justification.tier1WordSpacingMin, '%', 60, 100, (v) => {
      this.typographySettings.justification.tier1WordSpacingMin = v;
      this.callbacks.onTypographyChange({ justification: this.typographySettings.justification });
    }));
    t1Row.appendChild(this.createScrubber('מקסימום', this.typographySettings.justification.tier1WordSpacingMax, '%', 100, 160, (v) => {
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
    t2Header.textContent = 'שכבה 2: מתיחת אותיות אהלתר"ם';
    justCard.appendChild(t2Header);

    const t2ToggleRow = document.createElement('div');
    t2ToggleRow.style.display = 'flex';
    t2ToggleRow.style.alignItems = 'center';
    t2ToggleRow.style.justifyContent = 'space-between';
    t2ToggleRow.style.marginBottom = '6px';

    const t2Label = document.createElement('span');
    t2Label.style.fontSize = '11px';
    t2Label.textContent = 'הפעל מתיחת אותיות:';
    t2ToggleRow.appendChild(t2Label);

    const t2Switch = document.createElement('input');
    t2Switch.type = 'checkbox';
    t2Switch.checked = this.typographySettings.justification.tier2OheltaremEnabled;
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

    justCard.appendChild(this.createScrubber('מקסימום מתיחה', this.typographySettings.justification.tier2OheltaremMaxStretch, '%', 100, 180, (v) => {
      this.typographySettings.justification.tier2OheltaremMaxStretch = v;
      this.callbacks.onTypographyChange({ justification: this.typographySettings.justification });
    }));

    // Tier 3: Micro-Tracking
    const t3Header = document.createElement('div');
    t3Header.style.fontSize = '11px';
    t3Header.style.fontWeight = 'bold';
    t3Header.style.color = '#86EFAC';
    t3Header.style.margin = '10px 0 4px';
    t3Header.textContent = 'שכבה 3: מיקרו-טרקינג (±2%)';
    justCard.appendChild(t3Header);

    justCard.appendChild(this.createScrubber('טווח מיקרו-טרקינג', this.typographySettings.justification.tier3MicroTrackingRange, '%', 0, 5, (v) => {
      this.typographySettings.justification.tier3MicroTrackingRange = v;
      this.callbacks.onTypographyChange({ justification: this.typographySettings.justification });
    }));

    this.element.appendChild(justCard);

    // 4. Sacred Typography & Niqqud Card
    const sacredCard = this.createCard('ניקוד, טעמים ושמות קדושים');
    const normBtn = document.createElement('button');
    normBtn.className = 'tok-btn tok-btn-primary';
    normBtn.style.width = '100%';
    normBtn.style.marginBottom = '8px';
    normBtn.innerHTML = `<span>✨</span><span>נרמל רצף תווי ניקוד (ת"י 6100)</span>`;
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
    divineLabel.textContent = 'מגן שמות קדושים (איסור שבירה):';
    divineRow.appendChild(divineLabel);

    const divineSwitch = document.createElement('input');
    divineSwitch.type = 'checkbox';
    divineSwitch.checked = this.typographySettings.shieldDivineNames;
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
    this.element.appendChild(this.createHeader('מסגרת תמונה ועיטור', 'תמונה', '🖼️'));

    const imgCard = this.createCard('התאמת תמונה (Fitting)');
    const fitSelect = document.createElement('select');
    fitSelect.className = 'tok-select';
    fitSelect.style.width = '100%';
    fitSelect.style.marginBottom = '8px';

    const fits = ['התאם פרופורציונלית', 'מלא מסגרת לחלוטין', 'התאם מסגרת לתוכן'];
    for (const f of fits) {
      const opt = document.createElement('option');
      opt.textContent = f;
      fitSelect.appendChild(opt);
    }
    imgCard.appendChild(fitSelect);

    imgCard.appendChild(this.createStatusRow('רזולוציה אפקטיבית', '300 DPI (תקין)', '#10B981'));
    imgCard.appendChild(this.createStatusRow('מרחב צבע', 'CMYK Coated', '#94A3B8'));
    imgCard.appendChild(this.createStatusRow('דחיפת טקסט (Wrap)', 'סביב מסגרת (4mm)', '#60A5FA'));
    this.element.appendChild(imgCard);
  }

  // =========================================================================
  // State 5: Multi-Selection Mode (Align & Distribute)
  // =========================================================================
  private renderMultiSelectMode(): void {
    this.element.appendChild(this.createHeader('בחירה מרובה', '3 אובייקטים', '📑'));

    const alignCard = this.createCard('יישור ופיזור מהיר (Align & Distribute)');
    const alignRow = document.createElement('div');
    alignRow.style.display = 'grid';
    alignRow.style.gridTemplateColumns = 'repeat(3, 1fr)';
    alignRow.style.gap = '6px';
    alignRow.style.marginBottom = '8px';

    const alignActions = [
      { id: 'right', label: 'ימין ⇥' },
      { id: 'center', label: 'מרכז ⇋' },
      { id: 'left', label: 'שמאל ⇤' },
      { id: 'top', label: 'מעלה ⇪' },
      { id: 'middle', label: 'אמצע ⇕' },
      { id: 'bottom', label: 'מטה ⇩' }
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
    distBtn.textContent = 'פיזור מרווחים שווה אנכית';
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
    lbl.title = 'גרור ימינה/שמאלה לכוונון רציף';
    topRow.appendChild(lbl);

    const inputWrap = document.createElement('div');
    inputWrap.className = 'tok-scrubber-input-wrapper';
    inputWrap.style.position = 'relative';

    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'tok-input tok-input-number tok-scrubber-input';
    input.style.width = '100%';
    input.value = `${initialVal} ${unit}`;

    // Value scrubbing state
    let isDragging = false;
    let startX = 0;
    let startVal = initialVal;

    const onMouseDown = (e: MouseEvent) => {
      isDragging = true;
      startX = e.clientX;
      startVal = parseInt(input.value, 10) || initialVal;
      document.body.style.cursor = 'ew-resize';
      window.addEventListener('mousemove', onMouseMove);
      window.addEventListener('mouseup', onMouseUp);
      e.preventDefault();
    };

    const onMouseMove = (e: MouseEvent) => {
      if (!isDragging) return;
      const dx = startX - e.clientX; // In RTL, moving left increases or right increases
      const delta = Math.round(dx / 3);
      const newVal = Math.max(min, Math.min(max, startVal + delta));
      input.value = `${newVal} ${unit}`;
      onChange(newVal);
    };

    const onMouseUp = () => {
      if (isDragging) {
        isDragging = false;
        document.body.style.cursor = 'default';
        window.removeEventListener('mousemove', onMouseMove);
        window.removeEventListener('mouseup', onMouseUp);
      }
    };

    lbl.addEventListener('mousedown', onMouseDown);

    input.addEventListener('change', () => {
      const parsed = parseInt(input.value, 10);
      if (!isNaN(parsed)) {
        const clamped = Math.max(min, Math.min(max, parsed));
        input.value = `${clamped} ${unit}`;
        onChange(clamped);
      }
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

  private createHeader(title: string, subtitle: string, icon: string): HTMLElement {
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
    iconSpan.textContent = icon;
    iconSpan.style.fontSize = '16px';
    right.appendChild(iconSpan);

    const textWrap = document.createElement('div');
    const t = document.createElement('div');
    t.style.fontWeight = 'bold';
    t.style.fontSize = '13px';
    t.textContent = title;
    textWrap.appendChild(t);

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
