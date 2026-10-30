import { t, i18n } from '../i18n';
import { el, icon, iconButton, button } from '../ui';
import { ModalController } from './ModalController';
import { UpdatesStateManager } from '../updates/updatesManager';
import { ChangelogEntryCard } from '../updates/ChangelogEntryCard';
import { ChangelogEntry, UpdatesFilterOptions } from '../updates/types';

export interface UpdatesDrawerCallbacks {
  onClose: () => void;
  onCheckUpdates?: () => void;
  onOpenSettings?: () => void;
}

export class UpdatesDrawer {
  public element: HTMLElement;
  private callbacks: UpdatesDrawerCallbacks;
  private isVisible = false;
  private modal: ModalController;
  private stateManager: UpdatesStateManager;
  private filterOptions: UpdatesFilterOptions = { category: 'all', importance: 'all', searchQuery: '' };
  private cardsContainer!: HTMLElement;

  constructor(callbacks: UpdatesDrawerCallbacks, customManager?: UpdatesStateManager) {
    this.callbacks = callbacks;
    this.stateManager = customManager || UpdatesStateManager.getInstance();
    this.element = el('div', 'tok-overlay tok-updates-overlay');

    this.modal = new ModalController(this.element, () => this.hide(), { closeOnBackdrop: true });

    i18n.onChange(() => {
      if (this.isVisible) this.render();
    });
  }

  public show(targetVersion?: string): void {
    this.isVisible = true;
    this.element.classList.add('tok-open');

    // Mark current updates as seen when user opens the drawer
    if (targetVersion) {
      this.stateManager.markVersionAsSeen(targetVersion);
    } else {
      this.stateManager.markAllAsSeen();
    }

    this.render();
    this.modal.opened();
  }

  public hide(): void {
    if (!this.isVisible) return;
    this.isVisible = false;
    this.element.classList.remove('tok-open');
    this.modal.closed();
    this.callbacks.onClose();
  }

  public isOpen(): boolean {
    return this.isVisible;
  }

  public render(): void {
    const focusKey = this.modal.captureFocus();
    this.element.innerHTML = '';
    this.element.dir = i18n.getDirection();

    // Drawer container
    const drawer = el('div', 'tok-drawer tok-updates-drawer');
    drawer.setAttribute('role', 'dialog');
    drawer.setAttribute('aria-modal', 'true');
    drawer.setAttribute('aria-label', t('whatsNewTitle'));

    // 1. Drawer Header
    const head = el('header', 'tok-drawer-head');
    const headIconWrap = el('div', 'tok-drawer-head-icon');
    headIconWrap.appendChild(icon('sparkle', 22));
    head.appendChild(headIconWrap);

    const headText = el('div', 'tok-dialog-head-text');
    headText.appendChild(el('h2', undefined, { 'data-modal-title': '' }, t('whatsNewTitle')));
    headText.appendChild(el('p', undefined, undefined, t('whatsNewSubtitle')));
    head.appendChild(headText);

    head.appendChild(iconButton('close', t('aboutClose'), () => this.hide(), {
      attrs: { 'data-focus-key': 'close-x' }
    }));
    drawer.appendChild(head);

    // 2. Filter Area slot (implemented in next commit)
    const filterSlot = el('div', 'tok-updates-filter-slot');
    drawer.appendChild(filterSlot);

    // 3. Scrollable Changelog Cards List
    const body = el('div', 'tok-drawer-body tok-updates-body');
    this.cardsContainer = el('div', 'tok-updates-cards-list');
    body.appendChild(this.cardsContainer);
    drawer.appendChild(body);

    // 4. Drawer Footer
    const foot = el('footer', 'tok-drawer-foot');

    const checkBtn = button(t('whatsNewCheckUpdates'), {
      className: 'tok-btn tok-btn-secondary',
      icon: 'refresh',
      attrs: { 'data-focus-key': 'check-net' },
      onClick: () => {
        if (this.callbacks.onCheckUpdates) {
          this.callbacks.onCheckUpdates();
        } else if (this.callbacks.onOpenSettings) {
          this.hide();
          this.callbacks.onOpenSettings();
        }
      }
    });
    foot.appendChild(checkBtn);

    foot.appendChild(el('span', 'tok-grow'));

    const closeBtn = button(t('whatsNewGotIt'), {
      className: 'tok-btn tok-btn-primary',
      attrs: { 'data-focus-key': 'close-btn' },
      onClick: () => this.hide()
    });
    foot.appendChild(closeBtn);

    drawer.appendChild(foot);
    this.element.appendChild(drawer);

    this.populateCards();
    this.modal.afterRender(focusKey);
  }

  private populateCards(): void {
    this.cardsContainer.innerHTML = '';
    const lang = i18n.getLanguage();
    const entries = this.stateManager.filterEntries(this.filterOptions, lang);

    if (entries.length === 0) {
      const empty = el('div', 'tok-updates-empty-state');
      empty.appendChild(icon('info', 28));
      empty.appendChild(el('p', undefined, undefined, t('whatsNewNoResults')));
      this.cardsContainer.appendChild(empty);
      return;
    }

    for (const entry of entries) {
      const card = new ChangelogEntryCard(entry);
      this.cardsContainer.appendChild(card.element);
    }
  }
}
