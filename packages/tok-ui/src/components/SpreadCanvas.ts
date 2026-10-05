import { PageDescriptor } from 'tok-viewer';
import { SelectionMode, TextFrameData } from '../types';
import { t, tf, i18n } from '../i18n';
import { el, iconButton, button } from '../ui';

/**
 * Spread geometry for a right-to-left bound book.
 *
 * The first page (index 0) is a recto and stands alone; after it pages pair up as
 * (1,2), (3,4), ... In an RTL book the recto (front of the leaf, amud aleph) is the
 * LEFT page of an open spread and the verso (amud bet) is the RIGHT page, so:
 *   - even index -> recto, ע״א, left side
 *   - odd index  -> verso, ע״ב, right side
 * These helpers are the single source of truth for the canvas and the page list.
 */
export function isRectoPage(pageIndex: number): boolean {
  return pageIndex % 2 === 0;
}

export function isRightHandPage(pageIndex: number): boolean {
  return !isRectoPage(pageIndex);
}

/** Groups page positions into spreads, each listed right-to-left: [[0], [1, 2], [3, 4], ...]. */
export function groupIntoSpreads(pageCount: number): number[][] {
  const spreads: number[][] = [];
  if (pageCount <= 0) return spreads;
  spreads.push([0]);
  for (let i = 1; i < pageCount; i += 2) {
    spreads.push(i + 1 < pageCount ? [i, i + 1] : [i]);
  }
  return spreads;
}

/** Page sheet size in CSS px (17×24 cm proportions). */
export const PAGE_WIDTH_PX = 480;
export const PAGE_HEIGHT_PX = 678;
export const MIN_ZOOM = 25;
export const MAX_ZOOM = 400;

/** Zoom (percent) at which a full spread fits the visible canvas area. */
export function fitZoom(viewportWidth: number, viewportHeight: number): number {
  const z = Math.min((viewportWidth - 80) / (2 * PAGE_WIDTH_PX), (viewportHeight - 136) / PAGE_HEIGHT_PX) * 100;
  if (!Number.isFinite(z)) return 100;
  return Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, Math.floor(z)));
}

// Sample text (Bavli Berakhot 2a, with Rashi and Tosafot), shown until the engine
// provides the laid-out pages.
const GEMARA_TEXT =
  '<b>מתני׳</b> מאימתי קורין את שמע בערבית? משעה שהכהנים נכנסים לאכול בתרומתן, עד סוף האשמורה הראשונה, דברי רבי אליעזר. וחכמים אומרים: עד חצות. רבן גמליאל אומר: עד שיעלה עמוד השחר. ' +
  '<b>גמ׳</b> תנא היכא קאי דקתני מאימתי? ותו, מאי שנא דתני בערבית ברישא? לתני דשחרית ברישא! תנא אקרא קאי, דכתיב: ״בשכבך ובקומך״, והכי קתני: זמן קריאת שמע דשכיבה אימת? משעה שהכהנים נכנסין לאכול בתרומתן. ' +
  'ואי בעית אימא: יליף מברייתו של עולם, דכתיב: ״ויהי ערב ויהי בקר יום אחד״. אי הכי, סיפא דקתני: בשחר מברך שתים לפניה ואחת לאחריה, ובערב מברך שתים לפניה ושתים לאחריה, לתני דערבית ברישא! ' +
  'תנא פתח בערבית והדר תני בשחרית, עד דקאי בשחרית פריש מילי דשחרית, והדר פריש מילי דערבית. <b>אמר מר:</b> משעה שהכהנים נכנסים לאכול בתרומתן. מכדי, כהנים אימת קא אכלי תרומה? משעת צאת הכוכבים. לתני משעת צאת הכוכבים!';
const RASHI_TEXT =
  '<b>מאימתי. קורין את שמע בערבית</b> משעה שהכהנים נכנסים לאכול בתרומתן: כהנים שנטמאו וטבלו והעריב שמשן והגיע עתם לאכול בתרומה. <b>עד סוף האשמורה הראשונה</b> שליש הלילה כדמפרש בגמרא, ומשם ואילך לא מקרי זמן שכיבה ולא קרינן ביה בשכבך, ומקמי הכי נמי לאו זמן שכיבה, לפיכך הקורא קודם לכן לא יצא ידי חובתו. ' +
  '<b>אם כן למה קורין אותה בבית הכנסת</b> כדי לעמוד בתפלה מתוך דברי תורה, והכי תניא בברייתא בברכות ירושלמי, ולפיכך חובה עלינו לקרותה משתחשך, ובקריאת פרשה ראשונה שאדם קורא על מטתו יצא. <b>עד שיעלה עמוד השחר</b> שכל הלילה קרוי זמן שכיבה. ' +
  '<b>הקטר חלבים ואברים</b> של קרבנות שנזרק דמן ביום. <b>מצותן</b> להעלות כל הלילה, ואינן נפסלים בלינה עד שיעלה עמוד השחר והן למטה מן המזבח, דכתיב לא ילין לבקר. <b>חלבים</b> של כל קרבנות. <b>אברים</b> של עולה. ' +
  '<b>וכל הנאכלים ליום אחד</b> כגון חטאת ואשם וכבשי עצרת ומנחות ותודה. <b>מצותן</b> זמן אכילתן עד שיעלה עמוד השחר, והוא מביאן להיות נותר, דכתיב בתודה לא יניח ממנו עד בקר, וכלן מתודה ילפינן. ' +
  '<b>אם כן למה אמרו חכמים עד חצות</b> בקריאת שמע ובאכילת קדשים. <b>כדי להרחיק את האדם מן העבירה</b> ואסרום באכילה קודם זמנן כדי שלא יבא לאכלן לאחר עמוד השחר ויתחייב כרת.';
const TOSAFOT_TEXT =
  '<b>מאימתי קורין את שמע בערבית.</b> פירש רש״י, ואנן היכי קרינן מבעוד יום ואין אנו ממתינין לצאת הכוכבים, כדמפרש בגמרא. ועל כן פירש שקריאת שמע שעל המטה עיקר, והוא לאחר צאת הכוכבים, כדאמר בירושלמי: אם קרא קודם לכן לא יצא. ' +
  'ואם כן למה אנו מתפללין קריאת שמע בבית הכנסת? כדי לעמוד בתפלה מתוך דברי תורה. תימה לפירושו, והלא אין העולם רגילין לקרות סמוך לשכיבה אלא פרשה ראשונה, ואם כן שלש פרשיות היה לו לקרות. ' +
  'ועוד קשה, דצריך לברך בקריאת שמע שתים לפניה ושתים לאחריה בערבית. ועוד, דאותה קריאת שמע סמוך למטה אינה אלא בשביל המזיקין, כדאמר בסמוך, ואם תלמיד חכם הוא אינו צריך. ' +
  'ועוד קשה, דאם כן פסקינן כרבי יהושע בן לוי דאמר תפלות באמצע תקנום, כלומר באמצע בין שני קריאת שמע, ואנן קיימא לן כרבי יוחנן דאמר לקמן: איזהו בן העולם הבא? זה הסומך גאולה של ערבית לתפלה. ' +
  '<b>לכן פירש רבינו תם</b>, דאדרבה קריאת שמע של בית הכנסת עיקר, ואנו שקורין מבעוד יום סבירא לן כרבי יהודה דאמר בפרק תפלת השחר, דזמן תפלת מנחה עד פלג המנחה, ומיד כשיכלה זמן המנחה מתחיל זמן ערבית.';
const NOTES_TEXT = '<b>עין משפט:</b> א מיימון פ״א מהלכות ק״ש הל׳ ט סמ״ג עשין י״ח טוש״ע או״ח סימן רל״ה סעיף ג.';

type FlowId = 'gemara' | 'rashi' | 'tosafot' | 'notes';

interface FrameParams {
  id: string;
  title: string;
  flowId: FlowId;
  className: string;
  label?: string;
  text: string;
}

export interface SpreadCanvasCallbacks {
  onSelectionModeChange: (mode: SelectionMode, frame?: TextFrameData) => void;
  onRequestActionHud: (x: number, y: number, initialValues?: any) => void;
  onDismissActionHud: () => void;
  onPageChange: (pageIndex: number) => void;
  /** The zoom changed from the canvas's own controls. */
  onZoomChange?: (zoomPercent: number) => void;
}

export class SpreadCanvas {
  /** Outer shell (scroll area + floating zoom control). */
  public element: HTMLElement;
  private scroller: HTMLElement;
  private callbacks: SpreadCanvasCallbacks;
  private zoomPercent = 100;
  private hasAutoFitted = false;
  private showMargins = true;
  private showBaseline = false;
  private activePageIndex = 0;
  private pages: PageDescriptor[] = [];
  private selectedFrameId: string | null = null;
  private innerContainer!: HTMLElement;
  /** Takes the scaled size of the pages so the scroll area matches what is drawn. */
  private zoomBox!: HTMLElement;
  private zoomPill!: HTMLElement;
  private zoomValue!: HTMLButtonElement;
  private lastReportedPage = -1;
  private scrollRaf = 0;
  private programmaticScroll = false;
  private scrollSettleTimer = 0;
  private baselineGridPt = 13;

  constructor(callbacks: SpreadCanvasCallbacks) {
    this.callbacks = callbacks;
    this.element = el('div', 'tok-canvas-shell');
    this.scroller = el('main', 'tok-canvas-container', { dir: 'rtl', tabindex: '-1' });
    this.element.appendChild(this.scroller);

    this.renderContainer();
    this.renderZoomPill();
    this.bindEvents();

    i18n.onChange(() => {
      this.scroller.setAttribute('aria-label', t('canvasAria'));
      this.renderZoomPill();
      if (this.pages.length) this.renderSpreads();
    });
  }

  public setPages(pages: PageDescriptor[], activeIndex = 0): void {
    this.pages = pages;
    this.activePageIndex = activeIndex;
    this.lastReportedPage = activeIndex;
    this.renderSpreads();
    // After layout: fit the first spread to the window once, then reveal the active page.
    requestAnimationFrame(() => {
      if (!this.hasAutoFitted && this.scroller.clientWidth > 0) {
        this.hasAutoFitted = true;
        this.fitToWindow();
      }
      if (!this.programmaticScroll) this.revealPage(this.activePageIndex, false, false);
    });
  }

  public scrollToPage(pageIndex: number): void {
    this.activePageIndex = pageIndex;
    // While the smooth scroll runs, the pages it passes must not be reported; the
    // target is reported right away and tracking resumes once scrolling settles.
    this.programmaticScroll = true;
    this.armScrollSettle();
    if (this.lastReportedPage !== pageIndex) {
      this.lastReportedPage = pageIndex;
      this.callbacks.onPageChange(pageIndex);
    }
    this.revealPage(pageIndex, true, true);
  }

  private armScrollSettle(): void {
    if (this.scrollSettleTimer) clearTimeout(this.scrollSettleTimer);
    this.scrollSettleTimer = window.setTimeout(() => {
      this.scrollSettleTimer = 0;
      this.programmaticScroll = false;
    }, 200);
  }

  /**
   * Scrolls only the canvas so that the page is vertically centered (optional) and
   * horizontally fully visible.
   */
  private revealPage(pageIndex: number, smooth: boolean, centerVertically: boolean): void {
    const sheet = this.innerContainer.querySelector<HTMLElement>(`.tok-page-sheet[data-page-index="${pageIndex}"]`);
    if (!sheet) return;
    const s = sheet.getBoundingClientRect();
    const c = this.scroller.getBoundingClientRect();
    const margin = 16;
    let dx = 0;
    if (s.width + 2 * margin >= c.width) {
      dx = s.left + s.width / 2 - (c.left + c.width / 2);
    } else if (s.left < c.left + margin) {
      dx = s.left - (c.left + margin);
    } else if (s.right > c.right - margin) {
      dx = s.right - (c.right - margin);
    }
    let dy = 0;
    if (centerVertically) {
      dy = s.top + s.height / 2 - (c.top + c.height / 2);
    } else if (s.top < c.top) {
      dy = s.top - c.top - margin;
    } else if (s.bottom > c.bottom) {
      dy = Math.min(s.bottom - c.bottom + margin, s.top - c.top - margin);
    }
    if (dx || dy) this.scroller.scrollBy({ left: dx, top: dy, behavior: smooth ? 'smooth' : 'auto' });
  }

  public setZoom(zoom: number): void {
    this.zoomPercent = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, Math.round(zoom)));
    if (this.innerContainer) {
      // transform: scale (not CSS `zoom`): Chromium before v128 (Electron 29) reports
      // wrong element positions inside a `zoom`ed box, which sent "go to page" and the
      // current-page tracking to the wrong page whenever the zoom was not 100%.
      // The zoom box gets the scaled size so the whole page stays scrollable.
      this.innerContainer.style.transform = `scale(${this.zoomPercent / 100})`;
      this.updateZoomBox();
    }
    if (this.zoomValue) {
      this.zoomValue.textContent = `${this.zoomPercent}%`;
      this.zoomValue.setAttribute('aria-label', `${t('statusZoom')} ${this.zoomPercent}% · ${t('canvasZoomReset')}`);
    }
  }

  public getZoom(): number {
    return this.zoomPercent;
  }

  /** Zooms so one full spread fits the visible area. */
  public fitToWindow(): void {
    this.applyUserZoom(fitZoom(this.scroller.clientWidth, this.scroller.clientHeight));
  }

  private applyUserZoom(z: number): void {
    this.setZoom(z);
    this.callbacks.onZoomChange?.(this.zoomPercent);
    requestAnimationFrame(() => this.revealPage(this.activePageIndex, false, true));
  }

  public setBaselineGrid(pt: number): void {
    if (!(pt > 0)) return;
    this.baselineGridPt = pt;
    this.updateGuides();
  }

  public toggleMarginsGuide(): void {
    this.showMargins = !this.showMargins;
    this.updateGuides();
  }

  public toggleBaselineGuide(): void {
    this.showBaseline = !this.showBaseline;
    this.updateGuides();
  }

  public getGuides(): { margins: boolean; baseline: boolean } {
    return { margins: this.showMargins, baseline: this.showBaseline };
  }

  private renderContainer(): void {
    this.scroller.innerHTML = '';
    this.scroller.setAttribute('aria-label', t('canvasAria'));
    this.zoomBox = el('div', 'tok-zoom-box');
    this.innerContainer = el('div', 'tok-spreads-wrapper');
    this.zoomBox.appendChild(this.innerContainer);
    this.scroller.appendChild(this.zoomBox);
  }

  /** offsetWidth/Height are the unscaled layout size (transforms don't change them). */
  private updateZoomBox(): void {
    const z = this.zoomPercent / 100;
    this.zoomBox.style.width = `${this.innerContainer.offsetWidth * z}px`;
    this.zoomBox.style.height = `${this.innerContainer.offsetHeight * z}px`;
  }

  private renderZoomPill(): void {
    this.zoomPill?.remove();
    const pill = el('div', 'tok-zoom-pill', { role: 'group', 'aria-label': t('statusZoom') });
    pill.appendChild(button(t('canvasFit'), {
      className: 'tok-btn tok-btn-ghost tok-btn-sm',
      icon: 'fit',
      iconSize: 15,
      onClick: () => this.fitToWindow()
    }));
    pill.appendChild(el('span', 'tok-divider-v', { 'aria-hidden': 'true', style: 'height:18px;margin:0 4px' }));
    pill.appendChild(iconButton('minus', t('canvasZoomOut'), () => this.applyUserZoom(this.zoomPercent - 10), { size: 16 }));
    this.zoomValue = el('button', 'tok-zoom-value', { type: 'button', title: t('canvasZoomReset') }, `${this.zoomPercent}%`);
    this.zoomValue.addEventListener('click', () => this.applyUserZoom(100));
    pill.appendChild(this.zoomValue);
    pill.appendChild(iconButton('plus', t('canvasZoomIn'), () => this.applyUserZoom(this.zoomPercent + 10), { size: 16 }));
    this.zoomPill = pill;
    this.element.appendChild(pill);
    this.setZoom(this.zoomPercent);
  }

  private renderSpreads(): void {
    this.innerContainer.innerHTML = '';
    if (this.pages.length === 0) return;

    for (const spread of groupIntoSpreads(this.pages.length)) {
      const spreadRow = el('div', spread.length === 1 ? 'tok-spread-row tok-single' : 'tok-spread-row');
      // The canvas is dir="rtl", so the first sheet appended lands on the right.
      // The lone first page is a recto and therefore belongs on the left.
      if (spread.length === 1 && isRectoPage(spread[0])) {
        spreadRow.style.justifyContent = 'flex-end';
        spreadRow.style.width = `${2 * PAGE_WIDTH_PX}px`;
      }
      for (const pos of spread) {
        spreadRow.appendChild(this.createPageSheet(this.pages[pos], pos));
      }
      this.innerContainer.appendChild(spreadRow);
    }

    this.updateZoomBox();
    this.updateGuides();
  }

  private createPageSheet(page: PageDescriptor, position: number): HTMLElement {
    const isRecto = isRectoPage(position);
    const isRightPage = isRightHandPage(position);
    const amud = isRecto ? 'ע״א' : 'ע״ב';
    const sheet = el('article', 'tok-page-sheet', { 'data-page-index': page.pageIndex, 'aria-label': `${tf('structurePageLabel', { g: page.gematriaNumber })} ${amud}` });

    // Click on page background clears frame selection (zero selection).
    sheet.addEventListener('click', (e) => {
      if (e.target === sheet) {
        this.clearFrameSelection();
        this.callbacks.onSelectionModeChange('zero');
        this.callbacks.onDismissActionHud();
      }
    });

    // Shading along the spine (the inner edge).
    const spine = el('div', 'tok-page-spine', { 'aria-hidden': 'true' });
    spine.style[isRightPage ? 'left' : 'right'] = '0';
    spine.style.background = `linear-gradient(to ${isRightPage ? 'left' : 'right'}, rgba(40,30,10,.10), rgba(40,30,10,0))`;
    sheet.appendChild(spine);

    // 1. Running head: page number on the outer corner.
    const head = el('div', 'tok-page-head');
    const pageNo = el('span', undefined, undefined, `דף ${page.gematriaNumber} ${amud}`);
    const chapter = el('strong', undefined, undefined, t('pageHeadChapter'));
    const tractate = el('span', undefined, undefined, t('pageHeadTractate'));
    if (isRightPage) head.append(pageNo, chapter, tractate);
    else head.append(tractate, chapter, pageNo);
    sheet.appendChild(head);

    // 2. Talmud layout: Gemara in the center, Rashi on the inner (spine) side, Tosafot
    // on the outer side, Rashi widening under the Gemara (the "L"). The grid is RTL, so
    // its first column is the rightmost one; a right-hand page's spine is on its left.
    const grid = el('div', 'tok-talmud-grid');
    grid.style.gridTemplateAreas = isRightPage ? "'out gem in' 'out wide wide'" : "'in gem out' 'wide wide out'";

    const tosafot = this.createInteractiveFrame({ id: `frame-tosafot-${page.pageIndex}`, title: 'תוספות', flowId: 'tosafot', className: 'tok-frame-comm', label: 'תוספות', text: TOSAFOT_TEXT });
    tosafot.style.gridArea = 'out';
    const gemara = this.createInteractiveFrame({ id: `frame-gemara-${page.pageIndex}`, title: 'גמרא ראשי', flowId: 'gemara', className: 'tok-frame-gemara', text: GEMARA_TEXT });
    gemara.style.gridArea = 'gem';
    const rashi = this.createInteractiveFrame({ id: `frame-rashi-${page.pageIndex}`, title: 'רש״י', flowId: 'rashi', className: 'tok-frame-comm', label: 'רש״י', text: RASHI_TEXT });
    rashi.style.gridArea = 'in';
    const rashiWide = this.createInteractiveFrame({ id: `frame-rashi-cont-${page.pageIndex}`, title: 'רש״י', flowId: 'rashi', className: 'tok-frame-comm', text: RASHI_TEXT.slice(RASHI_TEXT.indexOf('<b>הקטר')) });
    rashiWide.style.gridArea = 'wide';
    grid.append(tosafot, gemara, rashi, rashiWide);
    sheet.appendChild(grid);

    // 3. Footnotes / references at the bottom.
    const notes = this.createInteractiveFrame({ id: `frame-notes-${page.pageIndex}`, title: 'עין משפט ותורה אור', flowId: 'notes', className: 'tok-frame-notes', text: NOTES_TEXT });
    notes.style.flex = 'none';
    sheet.appendChild(notes);

    // 4. Running foot.
    sheet.appendChild(el('div', 'tok-page-foot', { 'aria-hidden': 'true' }, `- ${page.gematriaNumber} -`));

    // Guides (margin rectangle, baseline grid).
    const guides = el('div', 'tok-guides-layer', { 'aria-hidden': 'true' });
    const marginGuide = el('div', 'tok-guide-margin-rect');
    marginGuide.style.inset = '36px 38px 40px';
    guides.appendChild(marginGuide);
    const baseline = el('div', 'tok-guide-baseline');
    baseline.style.inset = '36px 38px 40px';
    guides.appendChild(baseline);
    sheet.appendChild(guides);

    return sheet;
  }

  private createInteractiveFrame(params: FrameParams): HTMLElement {
    const frame = el('div', 'tok-interactive-frame', { 'data-frame-id': params.id, 'data-flow-id': params.flowId });
    const inner = el('div', `tok-frame-text ${params.className}`);
    // Sample text is static markup from this file (never user input).
    inner.innerHTML = (params.label ? `<div class="tok-frame-label">${params.label}</div>` : '') + params.text;
    frame.appendChild(inner);

    frame.addEventListener('click', (e) => {
      e.stopPropagation();
      this.selectFrame(frame, params);

      const sel = window.getSelection();
      if (sel && sel.toString().trim().length > 0) {
        // Text selected: floating text toolbar + text-edit inspector.
        this.callbacks.onSelectionModeChange('text-edit');
        this.callbacks.onRequestActionHud(e.clientX, e.clientY, {
          size: params.flowId === 'gemara' ? 15 : 11,
          bold: params.flowId === 'gemara',
          align: 'justify',
          style: params.flowId
        });
      } else {
        this.callbacks.onSelectionModeChange('text-frame', {
          id: params.id,
          xMm: 35,
          yMm: 45,
          widthMm: 110,
          heightMm: 240,
          rotationDeg: 0,
          flowId: params.flowId,
          columns: 1,
          columnGapMm: 0,
          insetTopMm: 3,
          insetBottomMm: 3,
          insetRightMm: 4,
          insetLeftMm: 4,
          verticalAlign: 'top',
          text: params.text
        });
      }
    });

    return frame;
  }

  private selectFrame(frame: HTMLElement, params: FrameParams): void {
    this.clearFrameSelection();
    this.selectedFrameId = params.id;
    frame.classList.add('tok-selected');
    frame.appendChild(el('span', 'tok-frame-tag', { 'aria-hidden': 'true' }, params.title));

    // Corner handles
    const corners: [string, string, string][] = [
      ['top', 'left', 'nwse-resize'],
      ['top', 'right', 'nesw-resize'],
      ['bottom', 'left', 'nesw-resize'],
      ['bottom', 'right', 'nwse-resize']
    ];
    for (const [v, h, cursor] of corners) {
      const handle = el('div', 'tok-resize-handle');
      handle.style[v as 'top' | 'bottom'] = '-7px';
      handle.style[h as 'left' | 'right'] = '-7px';
      handle.style.cursor = cursor;
      frame.appendChild(handle);
    }
  }

  private clearFrameSelection(): void {
    this.innerContainer.querySelectorAll<HTMLElement>('.tok-interactive-frame.tok-selected').forEach((f) => {
      f.classList.remove('tok-selected');
      f.querySelectorAll('.tok-resize-handle, .tok-frame-tag').forEach((h) => h.remove());
    });
    this.selectedFrameId = null;
  }

  private updateGuides(): void {
    this.innerContainer.querySelectorAll<HTMLElement>('.tok-guide-margin-rect').forEach((g) => {
      g.style.display = this.showMargins ? 'block' : 'none';
    });

    const stepPx = (this.baselineGridPt * 96) / 72;
    const line = 'var(--tok-guide-baseline)';
    this.innerContainer.querySelectorAll<HTMLElement>('.tok-guide-baseline').forEach((g) => {
      g.style.display = this.showBaseline ? 'block' : 'none';
      g.style.backgroundImage =
        `repeating-linear-gradient(to bottom, transparent 0, transparent ${stepPx - 1}px, ${line} ${stepPx - 1}px, ${line} ${stepPx}px)`;
    });
  }

  /** Index (PageDescriptor.pageIndex) of the page sheet closest to the viewport's vertical center. */
  private findCenteredPage(): number | null {
    const sheets = this.innerContainer.querySelectorAll<HTMLElement>('.tok-page-sheet[data-page-index]');
    if (sheets.length === 0) return null;
    const box = this.scroller.getBoundingClientRect();
    const centerY = box.top + box.height / 2;
    let best: number | null = null;
    let bestDist = Infinity;
    sheets.forEach((sheet) => {
      const r = sheet.getBoundingClientRect();
      const dist = centerY < r.top ? r.top - centerY : centerY > r.bottom ? centerY - r.bottom : 0;
      const idx = parseInt(sheet.dataset.pageIndex as string, 10);
      // Both pages of a spread share a row: keep the current page if it is one of
      // them, otherwise the first (right-hand) one wins the tie.
      if (dist < bestDist || (dist === bestDist && idx === this.activePageIndex)) {
        bestDist = dist;
        best = idx;
      }
    });
    return best;
  }

  private bindEvents(): void {
    // Canvas background click clears selection.
    this.scroller.addEventListener('click', (e) => {
      if (e.target === this.scroller || e.target === this.innerContainer || e.target === this.zoomBox) {
        this.clearFrameSelection();
        this.callbacks.onSelectionModeChange('zero');
        this.callbacks.onDismissActionHud();
      }
    });

    // Ctrl + wheel zooms the pages (supports mouse wheel discrete steps and trackpad continuous pinch).
    this.scroller.addEventListener('wheel', (e) => {
      if (!e.ctrlKey) return;
      e.preventDefault();
      let delta = 0;
      if (Math.abs(e.deltaY) < 25) {
        delta = e.deltaY < 0 ? 2 : -2;
      } else {
        delta = e.deltaY < 0 ? 10 : -10;
      }
      this.applyUserZoom(this.zoomPercent + delta);
    }, { passive: false });

    // Report the page under the viewport center so the status bar and page list follow scrolling.
    this.scroller.addEventListener('scroll', () => {
      if (this.programmaticScroll) {
        this.armScrollSettle();
        return;
      }
      if (this.scrollRaf) return;
      this.scrollRaf = requestAnimationFrame(() => {
        this.scrollRaf = 0;
        const page = this.findCenteredPage();
        if (page === null || page === this.lastReportedPage) return;
        this.lastReportedPage = page;
        this.activePageIndex = page;
        this.callbacks.onPageChange(page);
      });
    }, { passive: true });
  }
}
