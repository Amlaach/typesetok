import { renderIcon } from '../icons';
import { t, i18n } from '../i18n';

export interface StatusBarCallbacks {
  onZoomChange: (zoomPercent: number) => void;
  onPageClick: () => void;
  onPreflightClick: () => void;
}

export const ZOOM_PRESETS = [50, 75, 100, 125, 150, 200];

export class StatusBar {
  public element: HTMLElement;
  private callbacks: StatusBarCallbacks;
  private pageLabel = '';
  private zoom = 100;
  private wordCount = 4210;
  private activeFlow = 'גמרא (ראשי)';
  private preflightStatus: 'clean' | 'warning' | 'error' = 'clean';

  // Live nodes updated in place by updateStats() (the bar used to be rebuilt on every
  // page change while scrolling).
  private pageText!: HTMLElement;
  private countText!: HTMLElement;
  private flowText!: HTMLElement;
  private pfDot!: HTMLElement;
  private pfText!: HTMLElement;
  private zoomSelect!: HTMLSelectElement;

  constructor(callbacks: StatusBarCallbacks) {
    this.callbacks = callbacks;
    this.element = document.createElement('footer');
    this.element.className = 'tok-status-bar';
    this.element.setAttribute('role', 'status');
    this.element.dir = i18n.getDirection();
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

    i18n.onChange(() => {
      this.element.dir = i18n.getDirection();
      this.build();
    });

    this.build();
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
    this.refresh();
  }

  /** Writes the current state into the existing nodes. All values go in as text, never HTML. */
  private refresh(): void {
    this.pageText.textContent = this.pageLabel;
    this.countText.textContent = `${t('statusTextLength')}: ${this.wordCount.toLocaleString()} ${t('statusWords')}`;
    this.flowText.textContent = this.activeFlow;

    const colors = { clean: '#10B981', warning: '#F59E0B', error: '#EF4444' };
    this.pfDot.style.background = colors[this.preflightStatus];
    this.pfText.style.color = colors[this.preflightStatus];
    this.pfText.textContent =
      this.preflightStatus === 'clean' ? t('statusPreflightClean')
        : this.preflightStatus === 'warning' ? t('statusPreflightWarnings')
          : t('statusPreflightErrors');

    // A zoom value that is not a preset (e.g. set programmatically) still needs an option to show.
    if (!ZOOM_PRESETS.includes(this.zoom) && !this.zoomSelect.querySelector(`option[value="${this.zoom}"]`)) {
      this.zoomSelect.appendChild(this.createZoomOption(this.zoom));
    }
    this.zoomSelect.value = String(this.zoom);
  }

  private createZoomOption(z: number): HTMLOptionElement {
    const opt = document.createElement('option');
    opt.value = z.toString();
    opt.textContent = `${t('statusZoom')}: ${z}%`;
    return opt;
  }

  private build(): void {
    this.element.innerHTML = '';

    // Leading side
    const right = document.createElement('div');
    right.style.display = 'flex';
    right.style.alignItems = 'center';
    right.style.gap = '14px';

    // Page indicator (opens the command palette)
    const pageItem = document.createElement('button');
    pageItem.type = 'button';
    pageItem.style.cursor = 'pointer';
    pageItem.style.display = 'flex';
    pageItem.style.alignItems = 'center';
    pageItem.style.gap = '6px';
    pageItem.style.background = 'transparent';
    pageItem.style.border = 'none';
    pageItem.style.color = 'inherit';
    pageItem.style.font = 'inherit';
    pageItem.style.padding = '0';
    pageItem.title = t('statusGoToPage');
    pageItem.innerHTML = renderIcon('pages', 13);
    this.pageText = document.createElement('span');
    pageItem.appendChild(this.pageText);
    pageItem.addEventListener('click', () => this.callbacks.onPageClick());
    right.appendChild(pageItem);

    right.appendChild(this.createSeparator());

    this.countText = document.createElement('span');
    right.appendChild(this.countText);

    right.appendChild(this.createSeparator());

    const flowItem = document.createElement('span');
    const flowLabel = document.createElement('span');
    flowLabel.textContent = `${t('statusActiveFlow')}: `;
    flowItem.appendChild(flowLabel);
    this.flowText = document.createElement('strong');
    this.flowText.style.color = '#60A5FA';
    flowItem.appendChild(this.flowText);
    right.appendChild(flowItem);

    this.element.appendChild(right);

    // Trailing side
    const left = document.createElement('div');
    left.style.display = 'flex';
    left.style.alignItems = 'center';
    left.style.gap = '14px';

    const engineItem = document.createElement('span');
    engineItem.textContent = t('statusJustificationRules');
    left.appendChild(engineItem);

    left.appendChild(this.createSeparator());

    const pfItem = document.createElement('button');
    pfItem.type = 'button';
    pfItem.style.cursor = 'pointer';
    pfItem.style.display = 'flex';
    pfItem.style.alignItems = 'center';
    pfItem.style.gap = '6px';
    pfItem.style.background = 'transparent';
    pfItem.style.border = 'none';
    pfItem.style.font = 'inherit';
    pfItem.style.padding = '0';

    this.pfDot = document.createElement('span');
    this.pfDot.style.width = '8px';
    this.pfDot.style.height = '8px';
    this.pfDot.style.borderRadius = '50%';
    this.pfDot.setAttribute('aria-hidden', 'true');
    pfItem.appendChild(this.pfDot);

    this.pfText = document.createElement('span');
    this.pfText.style.fontWeight = '600';
    pfItem.appendChild(this.pfText);

    pfItem.addEventListener('click', () => this.callbacks.onPreflightClick());
    left.appendChild(pfItem);

    left.appendChild(this.createSeparator());

    this.zoomSelect = document.createElement('select');
    this.zoomSelect.className = 'tok-select';
    this.zoomSelect.setAttribute('aria-label', t('statusZoom'));
    this.zoomSelect.style.height = '20px';
    this.zoomSelect.style.fontSize = '10px';
    this.zoomSelect.style.padding = '0 4px';
    this.zoomSelect.style.background = 'transparent';
    this.zoomSelect.style.border = 'none';
    this.zoomSelect.style.color = 'var(--tok-text-secondary)';
    this.zoomSelect.style.cursor = 'pointer';
    for (const z of ZOOM_PRESETS) {
      this.zoomSelect.appendChild(this.createZoomOption(z));
    }
    this.zoomSelect.addEventListener('change', () => {
      const z = parseInt(this.zoomSelect.value, 10);
      if (!Number.isFinite(z)) return;
      this.zoom = z;
      this.callbacks.onZoomChange(z);
    });
    left.appendChild(this.zoomSelect);

    this.element.appendChild(left);
    this.refresh();
  }

  private createSeparator(): HTMLElement {
    const sep = document.createElement('div');
    sep.style.width = '1px';
    sep.style.height = '12px';
    sep.style.background = 'var(--tok-border-subtle)';
    sep.setAttribute('aria-hidden', 'true');
    return sep;
  }
}
