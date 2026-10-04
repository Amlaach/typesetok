import { PageDescriptor } from 'tok-viewer';
import { SelectionMode, TextFrameData } from '../types';

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

export interface SpreadCanvasCallbacks {
  onSelectionModeChange: (mode: SelectionMode, frame?: TextFrameData) => void;
  onRequestActionHud: (x: number, y: number, initialValues?: any) => void;
  onDismissActionHud: () => void;
  onPageChange: (pageIndex: number) => void;
}

export class SpreadCanvas {
  public element: HTMLElement;
  private callbacks: SpreadCanvasCallbacks;
  private zoomPercent = 100;
  private showMargins = true;
  private showBaseline = false;
  private activePageIndex = 0;
  private pages: PageDescriptor[] = [];
  private selectedFrameId: string | null = null;
  private innerContainer!: HTMLElement;
  private lastReportedPage = -1;
  private scrollRaf = 0;
  private programmaticScroll = false;
  private scrollSettleTimer = 0;
  private baselineGridPt = 13;

  constructor(callbacks: SpreadCanvasCallbacks) {
    this.callbacks = callbacks;
    this.element = document.createElement('main');
    this.element.className = 'tok-canvas-container';
    this.element.dir = 'rtl';
    this.element.style.flex = '1';
    this.element.style.background = 'var(--tok-bg-canvas)';
    this.element.style.position = 'relative';
    this.element.style.overflow = 'auto';
    this.element.style.display = 'flex';
    this.element.style.flexDirection = 'column';
    // Not `center`: a centered flex item that is wider than the viewport overflows on
    // both sides and the overflow on the start side can never be scrolled into view.
    // The inner container is centered with auto margins instead (see renderContainer).
    this.element.style.alignItems = 'flex-start';
    this.element.style.padding = '30px';

    this.renderContainer();
    this.bindEvents();
  }

  public setPages(pages: PageDescriptor[], activeIndex = 0): void {
    this.pages = pages;
    this.activePageIndex = activeIndex;
    this.lastReportedPage = activeIndex;
    this.renderSpreads();
    // After layout, make sure the active page is actually on screen.
    requestAnimationFrame(() => {
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
   * Scrolls only the canvas (element.scrollIntoView also scrolls overflow:hidden
   * ancestors such as the workbench) so that the page is vertically centered (optional)
   * and horizontally fully visible. A spread is wider than the canvas at 100% on common
   * window sizes, so without the horizontal part the requested page could stay cut off.
   */
  private revealPage(pageIndex: number, smooth: boolean, centerVertically: boolean): void {
    const sheet = this.innerContainer.querySelector<HTMLElement>(`.tok-page-sheet[data-page-index="${pageIndex}"]`);
    if (!sheet) return;
    const s = sheet.getBoundingClientRect();
    const c = this.element.getBoundingClientRect();
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
    if (dx || dy) this.element.scrollBy({ left: dx, top: dy, behavior: smooth ? 'smooth' : 'auto' });
  }

  public setZoom(zoom: number): void {
    this.zoomPercent = zoom;
    if (this.innerContainer) {
      // CSS `zoom` (unlike `transform: scale`) changes the layout size, so the scroll
      // area grows/shrinks with the pages and every part of a zoomed page stays reachable.
      this.innerContainer.style.transform = '';
      this.innerContainer.style.setProperty('zoom', String(zoom / 100));
    }
  }

  public getZoom(): number {
    return this.zoomPercent;
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

  private renderContainer(): void {
    this.element.innerHTML = '';
    this.innerContainer = document.createElement('div');
    this.innerContainer.className = 'tok-spreads-wrapper';
    this.innerContainer.style.display = 'flex';
    this.innerContainer.style.flexDirection = 'column';
    this.innerContainer.style.gap = '40px';
    this.innerContainer.style.marginInline = 'auto';
    this.element.appendChild(this.innerContainer);
  }

  private renderSpreads(): void {
    this.innerContainer.innerHTML = '';

    if (this.pages.length === 0) return;

    for (const spread of groupIntoSpreads(this.pages.length)) {
      const spreadRow = document.createElement('div');
      spreadRow.className = 'tok-spread-row';
      spreadRow.style.display = 'flex';
      spreadRow.style.gap = '8px';
      spreadRow.style.position = 'relative';

      // The canvas is dir="rtl", so the first sheet appended lands on the right.
      // The lone first page is a recto and therefore belongs on the left.
      if (spread.length === 1 && isRectoPage(spread[0])) {
        spreadRow.style.justifyContent = 'flex-end';
      }
      for (const pos of spread) {
        spreadRow.appendChild(this.createPageSheet(this.pages[pos], pos));
      }

      this.innerContainer.appendChild(spreadRow);
    }

    this.updateGuides();
  }

  private createPageSheet(page: PageDescriptor, position: number): HTMLElement {
    const isRecto = isRectoPage(position);
    const isRightPage = isRightHandPage(position);
    const sheet = document.createElement('div');
    sheet.className = 'tok-page-sheet';
    sheet.dataset.pageIndex = page.pageIndex.toString();
    sheet.style.width = '480px';
    sheet.style.height = '680px';
    sheet.style.background = '#FFFFFF';
    sheet.style.color = '#111111';
    sheet.style.boxShadow = '0 8px 24px rgba(0,0,0,0.5), 0 1px 3px rgba(0,0,0,0.3)';
    sheet.style.borderRadius = '2px';
    sheet.style.position = 'relative';
    sheet.style.padding = '36px';
    sheet.style.overflow = 'hidden';
    sheet.style.fontFamily = '"Taamey Frank CLM", "David CLM", "Times New Roman", serif';

    // Click on page background clears frame selection (Zero Selection)
    sheet.addEventListener('click', (e) => {
      if (e.target === sheet) {
        this.clearFrameSelection();
        this.callbacks.onSelectionModeChange('zero');
        this.callbacks.onDismissActionHud();
      }
    });

    // 1. Running Header
    const header = document.createElement('div');
    header.style.display = 'flex';
    header.style.justifyContent = 'space-between';
    header.style.borderBottom = '1.5px solid #222222';
    header.style.paddingBottom = '6px';
    header.style.marginBottom = '16px';
    header.style.fontSize = '12px';
    header.style.fontWeight = 'bold';
    header.style.color = '#222222';

    header.innerHTML = `
      <span>מַסֶּכֶת בְּרָכוֹת • פֶּרֶק א׳</span>
      <span style="color:#0A3D62; font-size:13px;">דף ${page.gematriaNumber} ${isRecto ? 'ע״א' : 'ע״ב'}</span>
      <span>מִשְׁנָה א׳</span>
    `;
    sheet.appendChild(header);

    // 2. Talmudic Multi-Flow Layout Grid (Gemara in Center, Rashi inside, Tosafot outside)
    const talmudGrid = document.createElement('div');
    talmudGrid.style.display = 'grid';
    talmudGrid.style.gridTemplateColumns = '110px 1fr 110px';
    talmudGrid.style.gap = '12px';
    // Rashi sits on the inner (spine) side and Tosafot on the outer side. The grid is
    // RTL (column 1 is rightmost); the spine is on the left of a right-hand page and
    // on the right of a left-hand page.
    const innerColumn = isRightPage ? '3' : '1';
    const outerColumn = isRightPage ? '1' : '3';
    talmudGrid.style.height = '480px';
    talmudGrid.style.position = 'relative';

    // Rashi Frame (Inner)
    const rashiFrame = this.createInteractiveFrame({
      id: `frame-rashi-${page.pageIndex}`,
      title: 'רש״י',
      flowId: 'rashi',
      fontStyle: 'font-family: "Rashi", serif; font-size: 11px; line-height: 1.45;',
      text: '<b>מֵאֵימָתַי קוֹרִין</b> — מֵאֵיזֶה זְמַן הִיא מִצְוָתָהּ. מִשָּׁעָה שֶׁהַכֹּהֲנִים נִכְנָסִים לֶאֱכֹל בִּתְרוּמָתָן — כֹּהֲנִים שֶׁנִּטְמְאוּ וְטָבְלוּ וְהֶעֱרִיב שִׁמְשָׁן וְהִגִּיעַ עֵת לֶאֱכֹל בְּטָהֳרָה.'
    });
    rashiFrame.style.gridRow = '1';
    rashiFrame.style.gridColumn = innerColumn;
    talmudGrid.appendChild(rashiFrame);

    // Gemara Main Frame (Center)
    const gemaraFrame = this.createInteractiveFrame({
      id: `frame-gemara-${page.pageIndex}`,
      title: 'גמרא ראשי',
      flowId: 'gemara',
      fontStyle: 'font-family: "Vilna", "Taamey Frank CLM", serif; font-size: 14.5px; line-height: 1.6; font-weight: bold;',
      text: '<div style="text-align:center; font-size:16px; margin-bottom:8px; border-bottom:1px dotted #888; padding-bottom:4px;">מֵאֵימָתַי קוֹרִין אֶת שְׁמַע בְּעַרְבִית?</div>מִשָּׁעָה שֶׁהַכֹּהֲנִים נִכְנָסִים לֶאֱכֹל בִּתְרוּמָתָן, עַד סוֹף הָאַשְׁמוּרָה הָרִאשׁוֹנָה, דִּבְרֵי רַבִּי אֱלִיעֶזֶר. וַחֲכָמִים אוֹמְרִים: עַד חֲצוֹת. רַבָּן גַּמְלִיאֵל אוֹמֵר: עַד שֶׁיַּעֲלֶה עַמּוּד הַשָּׁחַר. מַעֲשֶׂה שֶׁבָּאוּ בָנָיו מִבֵּית הַמִּשְׁתֶּה, אָמְרוּ לוֹ: לֹא קָרִינוּ אֶת שְׁמַע! אָמַר לָהֶם: אִם לֹא עָלָה עַמּוּד הַשָּׁחַר, חַיָּבִין אַתֶּם לִקְרוֹת.'
    });
    gemaraFrame.style.gridRow = '1';
    gemaraFrame.style.gridColumn = '2';
    talmudGrid.appendChild(gemaraFrame);

    // Tosafot Frame (Outer)
    const tosafotFrame = this.createInteractiveFrame({
      id: `frame-tosafot-${page.pageIndex}`,
      title: 'תוספות',
      flowId: 'tosafot',
      fontStyle: 'font-family: "Rashi", serif; font-size: 11px; line-height: 1.45;',
      text: '<b>מֵאֵימָתַי קוֹרִין</b> — תֵּימַהּ דְּלָא תָּנֵי זְמַן קְרִיאַת שְׁמַע שֶׁל שַׁחֲרִית בְּרֵישָׁא כְּדִכְתִיב בְּשָׁכְבְּךָ וּבְקוּמֶךָ. וְיֵשׁ לוֹמַר דִּסְמַךְ אַקְּרָא דִּכְתִיב וַיְהִי עֶרֶב וַיְהִי בֹקֶר יוֹם אֶחָד.'
    });
    tosafotFrame.style.gridRow = '1';
    tosafotFrame.style.gridColumn = outerColumn;
    talmudGrid.appendChild(tosafotFrame);

    sheet.appendChild(talmudGrid);

    // 3. Footnotes Commentary Frame (Bottom)
    const footnotesFrame = this.createInteractiveFrame({
      id: `frame-notes-${page.pageIndex}`,
      title: 'עין משפט ותורה אור',
      flowId: 'notes',
      fontStyle: 'font-size: 10px; line-height: 1.4; border-top: 1px solid #777; padding-top: 6px; color: #444;',
      text: '<b>עין משפט:</b> א מיימון פ״א מהלכות ק״ש הל׳ ט סמ״ג עשין י״ח טוש״ע או״ח סימן רל״ה סעיף ג.'
    });
    footnotesFrame.style.position = 'absolute';
    footnotesFrame.style.bottom = '36px';
    footnotesFrame.style.left = '36px';
    footnotesFrame.style.right = '36px';
    footnotesFrame.style.height = '40px';
    sheet.appendChild(footnotesFrame);

    // 4. Running Footer
    const footer = document.createElement('div');
    footer.style.position = 'absolute';
    footer.style.bottom = '12px';
    footer.style.left = '0';
    footer.style.right = '0';
    footer.style.textAlign = 'center';
    footer.style.fontSize = '11px';
    footer.style.color = '#777777';
    footer.style.fontWeight = 'bold';
    footer.textContent = `- ${page.gematriaNumber} -`;
    sheet.appendChild(footer);

    // Visual Guides Layer
    const guidesLayer = document.createElement('div');
    guidesLayer.className = 'tok-guides-layer';
    guidesLayer.style.position = 'absolute';
    guidesLayer.style.top = '0';
    guidesLayer.style.left = '0';
    guidesLayer.style.right = '0';
    guidesLayer.style.bottom = '0';
    guidesLayer.style.pointerEvents = 'none';

    // Margin Guides Rectangle
    const marginGuide = document.createElement('div');
    marginGuide.className = 'tok-guide-margin-rect';
    marginGuide.style.position = 'absolute';
    marginGuide.style.top = '36px';
    marginGuide.style.left = '36px';
    marginGuide.style.right = '36px';
    marginGuide.style.bottom = '36px';
    marginGuide.style.border = '1px dashed var(--tok-guide-margin)';
    marginGuide.style.opacity = '0.5';
    guidesLayer.appendChild(marginGuide);

    // Baseline Grid (hidden until toggled on)
    const baselineGuide = document.createElement('div');
    baselineGuide.className = 'tok-guide-baseline';
    baselineGuide.style.position = 'absolute';
    baselineGuide.style.top = '36px';
    baselineGuide.style.left = '36px';
    baselineGuide.style.right = '36px';
    baselineGuide.style.bottom = '36px';
    guidesLayer.appendChild(baselineGuide);

    sheet.appendChild(guidesLayer);

    return sheet;
  }

  private createInteractiveFrame(params: {
    id: string;
    title: string;
    flowId: 'gemara' | 'rashi' | 'tosafot' | 'notes';
    fontStyle: string;
    text: string;
  }): HTMLElement {
    const frame = document.createElement('div');
    frame.className = 'tok-interactive-frame';
    frame.dataset.frameId = params.id;
    frame.dataset.flowId = params.flowId;
    frame.style.position = 'relative';
    frame.style.cursor = 'text';
    frame.style.textAlign = 'justify';
    frame.style.setProperty('text-justify', 'inter-word');
    frame.style.borderRadius = '2px';
    frame.style.padding = '4px';
    frame.style.transition = 'box-shadow 0.15s ease';
    // <body> is `user-select: none`; frame text must stay selectable, otherwise
    // getSelection() is always empty below and the Action HUD can never open.
    frame.style.userSelect = 'text';
    frame.style.setProperty('-webkit-user-select', 'text');

    frame.innerHTML = `
      <div style="${params.fontStyle}">
        ${params.text}
      </div>
    `;

    // Click frame
    frame.addEventListener('click', (e) => {
      e.stopPropagation();
      this.selectFrame(frame, params);

      // Check if text is selected
      const sel = window.getSelection();
      if (sel && sel.toString().trim().length > 0) {
        // Trigger Action HUD above mouse
        this.callbacks.onSelectionModeChange('text-edit');
        this.callbacks.onRequestActionHud(e.clientX, e.clientY, {
          size: params.flowId === 'gemara' ? 15 : 11,
          bold: params.flowId === 'gemara',
          align: 'justify',
          style: params.flowId
        });
      } else {
        // Trigger Frame Selected mode
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

  private selectFrame(frame: HTMLElement, params: any): void {
    this.clearFrameSelection();
    this.selectedFrameId = params.id;

    frame.style.outline = '1.5px solid var(--tok-selection-frame)';
    frame.style.background = 'rgba(59, 130, 246, 0.05)';

    // Add 12px hit handles at corners
    const handlePositions = ['top-left', 'top-right', 'bottom-left', 'bottom-right'];
    for (const pos of handlePositions) {
      const handle = document.createElement('div');
      handle.className = 'tok-resize-handle';
      handle.style.position = 'absolute';
      handle.style.width = '8px';
      handle.style.height = '8px';
      handle.style.background = '#FFFFFF';
      handle.style.border = '1.5px solid var(--tok-selection-frame)';
      handle.style.borderRadius = '1px';
      handle.style.zIndex = '10';

      if (pos === 'top-left') {
        handle.style.top = '-4px';
        handle.style.left = '-4px';
        handle.style.cursor = 'nwse-resize';
      } else if (pos === 'top-right') {
        handle.style.top = '-4px';
        handle.style.right = '-4px';
        handle.style.cursor = 'nesw-resize';
      } else if (pos === 'bottom-left') {
        handle.style.bottom = '-4px';
        handle.style.left = '-4px';
        handle.style.cursor = 'nesw-resize';
      } else if (pos === 'bottom-right') {
        handle.style.bottom = '-4px';
        handle.style.right = '-4px';
        handle.style.cursor = 'nwse-resize';
      }

      frame.appendChild(handle);
    }
  }

  private clearFrameSelection(): void {
    const frames = this.innerContainer.querySelectorAll<HTMLElement>('.tok-interactive-frame');
    frames.forEach((f) => {
      f.style.outline = 'none';
      f.style.background = 'transparent';
      const handles = f.querySelectorAll('.tok-resize-handle');
      handles.forEach((h) => h.remove());
    });
    this.selectedFrameId = null;
  }

  private updateGuides(): void {
    const marginGuides = this.innerContainer.querySelectorAll<HTMLElement>('.tok-guide-margin-rect');
    marginGuides.forEach((g) => {
      g.style.display = this.showMargins ? 'block' : 'none';
    });

    const stepPx = (this.baselineGridPt * 96) / 72;
    const line = 'var(--tok-guide-baseline)';
    const baselineGuides = this.innerContainer.querySelectorAll<HTMLElement>('.tok-guide-baseline');
    baselineGuides.forEach((g) => {
      g.style.display = this.showBaseline ? 'block' : 'none';
      g.style.backgroundImage =
        `repeating-linear-gradient(to bottom, transparent 0, transparent ${stepPx - 1}px, ${line} ${stepPx - 1}px, ${line} ${stepPx}px)`;
    });
  }

  /** Index (PageDescriptor.pageIndex) of the page sheet closest to the viewport's vertical center. */
  private findCenteredPage(): number | null {
    const sheets = this.innerContainer.querySelectorAll<HTMLElement>('.tok-page-sheet[data-page-index]');
    if (sheets.length === 0) return null;
    const box = this.element.getBoundingClientRect();
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
    // Canvas background click clears selection
    this.element.addEventListener('click', (e) => {
      if (e.target === this.element) {
        this.clearFrameSelection();
        this.callbacks.onSelectionModeChange('zero');
        this.callbacks.onDismissActionHud();
      }
    });

    // Report the page under the viewport center so the status bar and page list follow scrolling.
    this.element.addEventListener('scroll', () => {
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
