import { PageDescriptor } from 'tok-viewer';
import { SelectionMode, TextFrameData } from '../types';

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
    this.element.style.alignItems = 'center';
    this.element.style.padding = '30px';

    this.renderContainer();
    this.bindEvents();
  }

  public setPages(pages: PageDescriptor[], activeIndex = 0): void {
    this.pages = pages;
    this.activePageIndex = activeIndex;
    this.renderSpreads();
  }

  public scrollToPage(pageIndex: number): void {
    this.activePageIndex = pageIndex;
    const spreadEl = this.innerContainer.querySelector(`[data-page-index="${pageIndex}"]`);
    if (spreadEl) {
      spreadEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }

  public setZoom(zoom: number): void {
    this.zoomPercent = zoom;
    if (this.innerContainer) {
      this.innerContainer.style.transform = `scale(${zoom / 100})`;
      this.innerContainer.style.transformOrigin = 'top center';
    }
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
    this.innerContainer.style.transition = 'transform 0.15s ease-out';
    this.element.appendChild(this.innerContainer);
  }

  private renderSpreads(): void {
    this.innerContainer.innerHTML = '';

    if (this.pages.length === 0) return;

    // Group into spreads (Recto on Right, Verso on Left in RTL)
    // Page 0 = Single Cover / First Page
    // Pages 1,2 = Spread 1; Pages 3,4 = Spread 2; etc.
    let pageIdx = 0;

    while (pageIdx < this.pages.length) {
      const spreadRow = document.createElement('div');
      spreadRow.className = 'tok-spread-row';
      spreadRow.style.display = 'flex';
      spreadRow.style.gap = '8px';
      spreadRow.style.position = 'relative';

      if (pageIdx === 0) {
        // Single recto page (Cover / Title)
        const p0 = this.pages[pageIdx];
        const pageEl = this.createPageSheet(p0, true);
        spreadRow.appendChild(pageEl);
        pageIdx++;
      } else {
        // True RTL Spread: Page N (Recto - Right) and Page N+1 (Verso - Left)
        const rectoPage = this.pages[pageIdx];
        const versoPage = pageIdx + 1 < this.pages.length ? this.pages[pageIdx + 1] : null;

        if (rectoPage) {
          spreadRow.appendChild(this.createPageSheet(rectoPage, true));
        }
        if (versoPage) {
          spreadRow.appendChild(this.createPageSheet(versoPage, false));
        }
        pageIdx += 2;
      }

      this.innerContainer.appendChild(spreadRow);
    }

    this.updateGuides();
  }

  private createPageSheet(page: PageDescriptor, isRecto: boolean): HTMLElement {
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
    talmudGrid.style.gridTemplateColumns = isRecto ? '110px 1fr 110px' : '110px 1fr 110px';
    talmudGrid.style.gap = '12px';
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
    talmudGrid.appendChild(rashiFrame);

    // Gemara Main Frame (Center)
    const gemaraFrame = this.createInteractiveFrame({
      id: `frame-gemara-${page.pageIndex}`,
      title: 'גמרא ראשי',
      flowId: 'gemara',
      fontStyle: 'font-family: "Vilna", "Taamey Frank CLM", serif; font-size: 14.5px; line-height: 1.6; font-weight: bold;',
      text: '<div style="text-align:center; font-size:16px; margin-bottom:8px; border-bottom:1px dotted #888; padding-bottom:4px;">מֵאֵימָתַי קוֹרִין אֶת שְׁמַע בְּעַרְבִית?</div>מִשָּׁעָה שֶׁהַכֹּהֲנִים נִכְנָסִים לֶאֱכֹל בִּתְרוּמָתָן, עַד סוֹף הָאַשְׁמוּרָה הָרִאשׁוֹנָה, דִּבְרֵי רַבִּי אֱלִיעֶזֶר. וַחֲכָמִים אוֹמְרִים: עַד חֲצוֹת. רַבָּן גַּמְלִיאֵל אוֹמֵר: עַד שֶׁיַּעֲלֶה עַמּוּד הַשָּׁחַר. מַעֲשֶׂה שֶׁבָּאוּ בָנָיו מִבֵּית הַמִּשְׁתֶּה, אָמְרוּ לוֹ: לֹא קָרִינוּ אֶת שְׁמַע! אָמַר לָהֶם: אִם לֹא עָלָה עַמּוּד הַשָּׁחַר, חַיָּבִין אַתֶּם לִקְרוֹת.'
    });
    talmudGrid.appendChild(gemaraFrame);

    // Tosafot Frame (Outer)
    const tosafotFrame = this.createInteractiveFrame({
      id: `frame-tosafot-${page.pageIndex}`,
      title: 'תוספות',
      flowId: 'tosafot',
      fontStyle: 'font-family: "Rashi", serif; font-size: 11px; line-height: 1.45;',
      text: '<b>מֵאֵימָתַי קוֹרִין</b> — תֵּימַהּ דְּלָא תָּנֵי זְמַן קְרִיאַת שְׁמַע שֶׁל שַׁחֲרִית בְּרֵישָׁא כְּדִכְתִיב בְּשָׁכְבְּךָ וּבְקוּמֶךָ. וְיֵשׁ לוֹמַר דִּסְמַךְ אַקְּרָא דִּכְתִיב וַיְהִי עֶרֶב וַיְהִי בֹקֶר יוֹם אֶחָד.'
    });
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
  }
}
