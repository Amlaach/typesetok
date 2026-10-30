import { t, i18n, Language } from '../i18n';
import { el, icon, iconButton, button } from '../ui';
import { ModalController } from './ModalController';
import { UpdatesStateManager } from '../updates/updatesManager';
import { ChangelogEntry } from '../updates/types';
import { createVersionBadge } from '../updates/updatePills';

export interface MajorUpdateModalCallbacks {
  onClose: () => void;
  onExploreAll: () => void;
}

export class MajorUpdateModal {
  public element: HTMLElement;
  private callbacks: MajorUpdateModalCallbacks;
  private isVisible = false;
  private modal: ModalController;
  private stateManager: UpdatesStateManager;
  private currentEntry?: ChangelogEntry;
  private dontShowAgainCheckbox?: HTMLInputElement;

  constructor(callbacks: MajorUpdateModalCallbacks, customManager?: UpdatesStateManager) {
    this.callbacks = callbacks;
    this.stateManager = customManager || UpdatesStateManager.getInstance();
    this.element = el('div', 'tok-overlay tok-major-update-overlay');

    this.modal = new ModalController(this.element, () => this.hide(), { closeOnBackdrop: true });

    i18n.onChange(() => {
      if (this.isVisible) this.render();
    });
  }

  public show(targetVersion?: string): void {
    if (targetVersion) {
      this.currentEntry = this.stateManager.getEntry(targetVersion);
    } else {
      this.currentEntry = this.stateManager.getLatestMajorEntry() || this.stateManager.getLatestEntry();
    }

    if (!this.currentEntry) return;

    this.isVisible = true;
    this.element.classList.add('tok-open');
    this.render();
    this.modal.opened();
  }

  public hide(): void {
    if (!this.isVisible) return;

    if (this.currentEntry) {
      if (this.dontShowAgainCheckbox?.checked) {
        this.stateManager.dismissMajorPrompt(this.currentEntry.version);
      } else {
        this.stateManager.markVersionAsSeen(this.currentEntry.version);
      }
    }

    this.isVisible = false;
    this.element.classList.remove('tok-open');
    this.modal.closed();
    this.callbacks.onClose();
  }

  public isOpen(): boolean {
    return this.isVisible;
  }

  public render(): void {
    if (!this.currentEntry) return;

    const focusKey = this.modal.captureFocus();
    this.element.innerHTML = '';
    this.element.dir = i18n.getDirection();
    const lang: Language = i18n.getLanguage();

    const dialog = el('div', 'tok-dialog tok-major-dialog');
    dialog.setAttribute('role', 'dialog');
    dialog.setAttribute('aria-modal', 'true');
    dialog.setAttribute('aria-label', t('whatsNewMajorTitle'));

    // 1. Dialog Header
    const head = el('header', 'tok-dialog-head tok-major-head');

    const brandMark = el('span', 'tok-major-hero-icon', { 'aria-hidden': 'true' });
    brandMark.appendChild(icon('sparkle', 24));
    head.appendChild(brandMark);

    const headText = el('div', 'tok-dialog-head-text');
    const titleRow = el('div', 'tok-major-head-row');
    titleRow.appendChild(el('h2', undefined, { 'data-modal-title': '' }, t('whatsNewMajorTitle')));
    titleRow.appendChild(createVersionBadge(this.currentEntry.importance, this.currentEntry.badge));
    headText.appendChild(titleRow);

    headText.appendChild(el('p', undefined, undefined, t('whatsNewMajorSubtitle')));
    head.appendChild(headText);

    head.appendChild(iconButton('close', t('aboutClose'), () => this.hide(), {
      attrs: { 'data-focus-key': 'close-x' }
    }));
    dialog.appendChild(head);

    // 2. Dialog Body (content & highlights container)
    const body = el('div', 'tok-dialog-body tok-major-body');

    // Hero title banner
    const heroBanner = el('div', 'tok-major-hero-banner');
    const versionLabel = el('span', 'tok-major-version-pill', { dir: 'ltr' }, `v${this.currentEntry.version}`);
    heroBanner.appendChild(versionLabel);

    const mainTitle = el('h3', 'tok-major-main-title', undefined, this.currentEntry.title[lang] || this.currentEntry.title.en);
    heroBanner.appendChild(mainTitle);

    const summaryPara = el('p', 'tok-major-summary', undefined, this.currentEntry.summary[lang] || this.currentEntry.summary.en);
    heroBanner.appendChild(summaryPara);

    body.appendChild(heroBanner);

    // Showcase slot (cards populated in next commit)
    const showcaseSlot = el('div', 'tok-major-showcase-slot');
    body.appendChild(showcaseSlot);

    dialog.appendChild(body);

    // 3. Dialog Footer
    const foot = el('footer', 'tok-dialog-foot tok-major-foot');

    // Don't show again checkbox
    const checkboxLabel = el('label', 'tok-checkbox-label');
    this.dontShowAgainCheckbox = el('input', 'tok-checkbox', {
      type: 'checkbox'
    }) as HTMLInputElement;
    checkboxLabel.appendChild(this.dontShowAgainCheckbox);
    checkboxLabel.appendChild(el('span', undefined, undefined, t('whatsNewDontShowAgain')));
    foot.appendChild(checkboxLabel);

    foot.appendChild(el('span', 'tok-grow'));

    // Explore All Button
    const exploreBtn = button(t('whatsNewExploreAll'), {
      className: 'tok-btn tok-btn-secondary',
      icon: 'pages',
      attrs: { 'data-focus-key': 'explore-all' },
      onClick: () => {
        this.hide();
        this.callbacks.onExploreAll();
      }
    });
    foot.appendChild(exploreBtn);

    // Primary Got It Button
    const gotItBtn = button(t('whatsNewGotIt'), {
      className: 'tok-btn tok-btn-primary',
      attrs: { 'data-focus-key': 'got-it' },
      onClick: () => this.hide()
    });
    foot.appendChild(gotItBtn);

    dialog.appendChild(foot);
    this.element.appendChild(dialog);

    this.modal.afterRender(focusKey);
  }
}
