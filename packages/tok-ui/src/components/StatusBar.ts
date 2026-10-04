import { renderIcon } from '../icons';

export interface StatusBarCallbacks {
  onZoomChange: (zoomPercent: number) => void;
  onPageClick: () => void;
  onPreflightClick: () => void;
}

export class StatusBar {
  public element: HTMLElement;
  private callbacks: StatusBarCallbacks;
  private pageLabel = 'דף ב ע"א (3 מתוך 142)';
  private zoom = 100;
  private wordCount = 4210;
  private activeFlow = 'גמרא (ראשי)';
  private preflightStatus: 'clean' | 'warning' | 'error' = 'clean';

  constructor(callbacks: StatusBarCallbacks) {
    this.callbacks = callbacks;
    this.element = document.createElement('footer');
    this.element.className = 'tok-status-bar';
    this.element.dir = 'rtl';
    this.element.style.height = 'var(--tok-status-height)';
    this.element.style.minHeight = 'var(--tok-status-height)';
    this.element.style.background = 'var(--tok-bg-app)';
    this.element.style.borderTop = '1px solid var(--tok-border-subtle)';
    this.element.style.display = 'flex';
    this.element.style.alignItems = 'center';
    this.element.style.justifyContent = 'space-between';
    this.element.style.padding = '0 12px';
    this.element.style.fontSize = '11px';
    this.element.style.color = 'var(--tok-text-secondary)';
    this.element.style.userSelect = 'none';

    this.render();
  }

  public updateStats(params: {
    pageLabel?: string;
    zoom?: number;
    wordCount?: number;
    activeFlow?: string;
    preflightStatus?: 'clean' | 'warning' | 'error';
  }): void {
    if (params.pageLabel !== undefined) this.pageLabel = params.pageLabel;
    if (params.zoom !== undefined) this.zoom = params.zoom;
    if (params.wordCount !== undefined) this.wordCount = params.wordCount;
    if (params.activeFlow !== undefined) this.activeFlow = params.activeFlow;
    if (params.preflightStatus !== undefined) this.preflightStatus = params.preflightStatus;
    this.render();
  }

  private render(): void {
    this.element.innerHTML = '';

    // Right side (Leading in RTL)
    const right = document.createElement('div');
    right.style.display = 'flex';
    right.style.alignItems = 'center';
    right.style.gap = '14px';

    // Page indicator
    const pageItem = document.createElement('div');
    pageItem.style.cursor = 'pointer';
    pageItem.style.display = 'flex';
    pageItem.style.alignItems = 'center';
    pageItem.style.gap = '6px';
    pageItem.innerHTML = `${renderIcon('pages', 13)}<span>${this.pageLabel}</span>`;
    pageItem.addEventListener('click', () => this.callbacks.onPageClick());
    right.appendChild(pageItem);

    right.appendChild(this.createSeparator());

    // Word Count
    const countItem = document.createElement('span');
    countItem.textContent = `אורך טקסט: ${this.wordCount.toLocaleString()} מילים`;
    right.appendChild(countItem);

    right.appendChild(this.createSeparator());

    // Active flow
    const flowItem = document.createElement('span');
    flowItem.innerHTML = `<span>תזרים פעיל: </span><strong style="color:#60A5FA;">${this.activeFlow}</strong>`;
    right.appendChild(flowItem);

    this.element.appendChild(right);

    // Left side (Trailing in RTL)
    const left = document.createElement('div');
    left.style.display = 'flex';
    left.style.alignItems = 'center';
    left.style.gap = '14px';

    // Line Breaking Engine info
    const engineItem = document.createElement('span');
    engineItem.textContent = 'חוקי יישור: Knuth-Plass + אהלתר"ם';
    left.appendChild(engineItem);

    left.appendChild(this.createSeparator());

    // Continuous Preflight Status
    const pfItem = document.createElement('div');
    pfItem.style.cursor = 'pointer';
    pfItem.style.display = 'flex';
    pfItem.style.alignItems = 'center';
    pfItem.style.gap = '6px';

    const pfDot = document.createElement('span');
    pfDot.style.width = '8px';
    pfDot.style.height = '8px';
    pfDot.style.borderRadius = '50%';
    pfDot.style.background = this.preflightStatus === 'clean' ? '#10B981' : this.preflightStatus === 'warning' ? '#F59E0B' : '#EF4444';
    pfItem.appendChild(pfDot);

    const pfText = document.createElement('span');
    pfText.style.fontWeight = '600';
    pfText.style.color = this.preflightStatus === 'clean' ? '#10B981' : '#F59E0B';
    pfText.textContent = this.preflightStatus === 'clean' ? 'Preflight: תקין (100% K)' : 'Preflight: אזהרות';
    pfItem.appendChild(pfText);

    pfItem.addEventListener('click', () => this.callbacks.onPreflightClick());
    left.appendChild(pfItem);

    left.appendChild(this.createSeparator());

    // Interactive Zoom Presets
    const zoomItem = document.createElement('div');
    zoomItem.style.display = 'flex';
    zoomItem.style.alignItems = 'center';
    zoomItem.style.gap = '4px';

    const zoomSelect = document.createElement('select');
    zoomSelect.className = 'tok-select';
    zoomSelect.style.height = '20px';
    zoomSelect.style.fontSize = '10px';
    zoomSelect.style.padding = '0 4px';
    zoomSelect.style.background = 'transparent';
    zoomSelect.style.border = 'none';
    zoomSelect.style.color = 'var(--tok-text-secondary)';
    zoomSelect.style.cursor = 'pointer';

    const zoomPresets = [50, 75, 100, 125, 150, 200];
    for (const z of zoomPresets) {
      const opt = document.createElement('option');
      opt.value = z.toString();
      opt.textContent = `זום: ${z}%`;
      if (z === this.zoom) opt.selected = true;
      zoomSelect.appendChild(opt);
    }
    zoomSelect.addEventListener('change', () => {
      const z = parseInt(zoomSelect.value, 10);
      this.zoom = z;
      this.callbacks.onZoomChange(z);
    });
    zoomItem.appendChild(zoomSelect);
    left.appendChild(zoomItem);

    this.element.appendChild(left);
  }

  private createSeparator(): HTMLElement {
    const sep = document.createElement('div');
    sep.style.width = '1px';
    sep.style.height = '12px';
    sep.style.background = 'var(--tok-border-subtle)';
    return sep;
  }
}
