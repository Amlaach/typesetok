import { renderIcon } from '../icons';
import { t, i18n } from '../i18n';

export interface PaletteItem {
  id: string;
  category: string;
  title: string;
  subtitle?: string;
  shortcut?: string;
  action: () => void;
}

type HotkeyEvent = Pick<KeyboardEvent, 'key' | 'code' | 'ctrlKey' | 'metaKey' | 'altKey' | 'shiftKey'>;

/**
 * Ctrl/Cmd+K. Matched on the physical key (`code`) as well as `key`, because with a
 * Hebrew keyboard layout active the K key reports `key === 'ל'`.
 */
export function isPaletteToggleHotkey(e: HotkeyEvent): boolean {
  if (!(e.ctrlKey || e.metaKey) || e.altKey) return false;
  return e.code === 'KeyK' || e.key === 'k' || e.key === 'K';
}

/** True when keystrokes on `el` are text input that must not be hijacked by global shortcuts. */
export function isEditableTarget(el: unknown): boolean {
  if (!el || typeof el !== 'object') return false;
  const node = el as { tagName?: string; isContentEditable?: boolean };
  if (node.isContentEditable) return true;
  const tag = (node.tagName || '').toUpperCase();
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT';
}

/** The bare "/" quick-open shortcut: no modifiers, and never while typing into an editable field. */
export function isPaletteSlashHotkey(e: HotkeyEvent, target: unknown): boolean {
  if (e.key !== '/' || e.ctrlKey || e.metaKey || e.altKey) return false;
  return !isEditableTarget(target);
}

/**
 * Normalizes text for palette search: lower-case, niqqud/cantillation removed, Hebrew
 * geresh/gershayim folded to ASCII quotes, whitespace collapsed. So typing ת"י finds
 * ת״י, and unpointed input matches pointed titles.
 */
export function normalizeSearchText(s: string): string {
  return s
    .toLowerCase()
    .replace(/[֑-ׇֽֿׁׂׅׄ]/g, '')
    .replace(/[״“”]/g, '"')
    .replace(/[׳‘’]/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

/** Every whitespace-separated term of the query must occur in title, subtitle, category or shortcut. */
export function matchesPaletteQuery(item: Pick<PaletteItem, 'title' | 'category' | 'subtitle' | 'shortcut'>, query: string): boolean {
  const q = normalizeSearchText(query);
  if (!q) return true;
  const hay = normalizeSearchText([item.title, item.subtitle || '', item.category, item.shortcut || ''].join(' '));
  return q.split(' ').every((term) => hay.includes(term));
}

export class CommandPalette {
  public element: HTMLElement;
  private isVisible = false;
  private inputEl!: HTMLInputElement;
  private listEl!: HTMLElement;
  private footerEl!: HTMLElement;
  private emptyText = '';
  private items: PaletteItem[] = [];
  private filteredItems: PaletteItem[] = [];
  private itemEls: HTMLElement[] = [];
  private selectedIndex = 0;
  private restoreFocusTo: HTMLElement | null = null;

  constructor(items: PaletteItem[]) {
    this.items = [...items];
    this.filteredItems = [...items];

    this.element = document.createElement('div');
    this.element.className = 'tok-palette-overlay';
    this.element.style.display = 'none';

    this.render();
    this.bindEvents();
    i18n.onChange(() => this.applyTexts());
  }

  public setItems(items: PaletteItem[]): void {
    this.items = [...items];
    this.filter(this.inputEl.value);
  }

  public registerItem(item: PaletteItem): void {
    const existingIdx = this.items.findIndex(i => i.id === item.id);
    if (existingIdx >= 0) {
      this.items[existingIdx] = item;
    } else {
      this.items.push(item);
    }
    // Only the visible list needs refreshing; show() always re-filters.
    if (this.isVisible) this.filter(this.inputEl.value, true);
  }

  public unregisterItem(id: string): void {
    this.items = this.items.filter((i) => i.id !== id);
    if (this.isVisible) this.filter(this.inputEl.value, true);
  }

  public getIsOpen(): boolean {
    return this.isVisible;
  }

  public show(): void {
    if (!this.isVisible) {
      const active = document.activeElement;
      this.restoreFocusTo = active instanceof HTMLElement && active !== document.body ? active : null;
    }
    this.element.style.display = 'flex';
    this.isVisible = true;
    this.inputEl.value = '';
    this.filter('');
    // Focus synchronously so the first typed character isn't lost (it used to wait 20ms).
    this.inputEl.focus();
  }

  public hide(): void {
    if (!this.isVisible) return;
    this.element.style.display = 'none';
    this.isVisible = false;
    // Return focus to where the user was (story editor, canvas...) instead of <body>.
    const target = this.restoreFocusTo;
    this.restoreFocusTo = null;
    if (target && target.isConnected) target.focus();
  }

  public toggle(): void {
    if (this.isVisible) this.hide();
    else this.show();
  }

  private applyTexts(): void {
    this.element.dir = i18n.getDirection();
    this.inputEl.placeholder = t('paletteSearchPlaceholder');
    this.inputEl.setAttribute('aria-label', t('paletteSearchPlaceholder'));
    this.footerEl.innerHTML = '';
    for (const key of ['paletteHintNavigate', 'paletteHintRun', 'paletteHintClose']) {
      const span = document.createElement('span');
      span.textContent = t(key);
      this.footerEl.appendChild(span);
    }
    this.emptyText = t('paletteNoResults');
    if (this.isVisible && this.filteredItems.length === 0) this.renderList();
  }

  private render(): void {
    this.element.innerHTML = '';
    this.element.setAttribute('role', 'dialog');
    this.element.setAttribute('aria-modal', 'true');

    const modal = document.createElement('div');
    modal.className = 'tok-palette-modal';
    // The stylesheet hard-codes `direction: rtl` on the modal; follow the UI language instead.
    modal.style.direction = 'inherit';
    modal.addEventListener('click', (e) => e.stopPropagation());

    // Search Input Bar
    const inputWrap = document.createElement('div');
    inputWrap.className = 'tok-palette-input-wrap';

    const searchIcon = document.createElement('span');
    searchIcon.style.display = 'inline-flex';
    searchIcon.style.alignItems = 'center';
    searchIcon.style.marginInlineEnd = '10px';
    searchIcon.style.color = '#94A3B8';
    searchIcon.setAttribute('aria-hidden', 'true');
    searchIcon.innerHTML = renderIcon('search', 16);
    inputWrap.appendChild(searchIcon);

    this.inputEl = document.createElement('input');
    this.inputEl.type = 'text';
    this.inputEl.className = 'tok-palette-input';
    this.inputEl.setAttribute('role', 'combobox');
    this.inputEl.setAttribute('aria-expanded', 'true');
    this.inputEl.setAttribute('aria-controls', 'tok-palette-list');
    this.inputEl.setAttribute('aria-autocomplete', 'list');
    this.inputEl.autocomplete = 'off';
    this.inputEl.spellcheck = false;
    inputWrap.appendChild(this.inputEl);

    const escBadge = document.createElement('span');
    escBadge.style.fontSize = '11px';
    escBadge.style.color = 'var(--tok-text-muted)';
    escBadge.style.background = '#333';
    escBadge.style.padding = '2px 6px';
    escBadge.style.borderRadius = '4px';
    escBadge.setAttribute('aria-hidden', 'true');
    escBadge.textContent = 'Esc';
    inputWrap.appendChild(escBadge);

    modal.appendChild(inputWrap);

    // Filtered List
    this.listEl = document.createElement('div');
    this.listEl.className = 'tok-palette-list';
    this.listEl.id = 'tok-palette-list';
    this.listEl.setAttribute('role', 'listbox');
    modal.appendChild(this.listEl);

    // Footer Hint Bar
    this.footerEl = document.createElement('div');
    this.footerEl.style.padding = '8px 16px';
    this.footerEl.style.borderTop = '1px solid var(--tok-border-subtle)';
    this.footerEl.style.background = '#222222';
    this.footerEl.style.display = 'flex';
    this.footerEl.style.alignItems = 'center';
    this.footerEl.style.justifyContent = 'space-between';
    this.footerEl.style.fontSize = '11px';
    this.footerEl.style.color = 'var(--tok-text-muted)';
    this.footerEl.setAttribute('aria-hidden', 'true');
    modal.appendChild(this.footerEl);

    this.element.appendChild(modal);
    this.applyTexts();
  }

  private bindEvents(): void {
    // Click backdrop to dismiss
    this.element.addEventListener('click', () => this.hide());

    // Input text filter
    this.inputEl.addEventListener('input', () => {
      this.filter(this.inputEl.value);
    });

    // Keyboard navigation
    this.inputEl.addEventListener('keydown', (e) => {
      if (e.isComposing) return;
      const count = this.filteredItems.length;
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        if (count) this.setSelected((this.selectedIndex + 1) % count);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        if (count) this.setSelected((this.selectedIndex - 1 + count) % count);
      } else if (e.key === 'Home' || e.key === 'End') {
        if (count) {
          e.preventDefault();
          this.setSelected(e.key === 'Home' ? 0 : count - 1);
        }
      } else if (e.key === 'Enter') {
        e.preventDefault();
        this.runItem(this.filteredItems[this.selectedIndex]);
      } else if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        this.hide();
      } else if (e.key === 'Tab') {
        // Keep focus inside the modal dialog.
        e.preventDefault();
      }
    });

    // Global shortcut Ctrl+K / Cmd+K / /
    window.addEventListener('keydown', (e) => {
      if (e.isComposing) return;
      // The palette sits below the Settings/Welcome/About overlays; opening it behind
      // one of them used to move focus to an input the user cannot see.
      if (!this.isVisible && this.isOtherModalOpen()) return;
      if (isPaletteToggleHotkey(e)) {
        e.preventDefault();
        this.toggle();
      } else if (!this.isVisible && isPaletteSlashHotkey(e, e.target ?? document.activeElement)) {
        e.preventDefault();
        this.show();
      }
    });
  }

  private isOtherModalOpen(): boolean {
    return Array.from(document.querySelectorAll<HTMLElement>('[aria-modal="true"]')).some(
      (el) => el !== this.element && el.style.display !== 'none'
    );
  }

  private runItem(item: PaletteItem | undefined): void {
    if (!item) return;
    this.hide();
    try {
      item.action();
    } catch (err) {
      // A failing (e.g. plugin-provided) command must not break the palette.
      console.error(`[PALETTE] Command "${item.id}" failed:`, err);
    }
  }

  private filter(query: string, keepSelection = false): void {
    const selectedId = keepSelection ? this.filteredItems[this.selectedIndex]?.id : undefined;
    this.filteredItems = this.items.filter((it) => matchesPaletteQuery(it, query));
    const keptIdx = selectedId ? this.filteredItems.findIndex((i) => i.id === selectedId) : -1;
    this.selectedIndex = keptIdx >= 0 ? keptIdx : 0;
    this.renderList();
  }

  /** Moves the highlight without rebuilding the list (it used to be rebuilt on every arrow key). */
  private setSelected(index: number): void {
    const prev = this.itemEls[this.selectedIndex];
    if (prev) {
      prev.classList.remove('active');
      prev.setAttribute('aria-selected', 'false');
      const arrow = prev.firstElementChild?.firstElementChild as HTMLElement | null;
      if (arrow) arrow.style.opacity = '0.4';
    }
    this.selectedIndex = index;
    const el = this.itemEls[index];
    if (el) {
      el.classList.add('active');
      el.setAttribute('aria-selected', 'true');
      const arrow = el.firstElementChild?.firstElementChild as HTMLElement | null;
      if (arrow) arrow.style.opacity = '1';
      this.inputEl.setAttribute('aria-activedescendant', el.id);
      el.scrollIntoView({ block: 'nearest' });
    } else {
      this.inputEl.removeAttribute('aria-activedescendant');
    }
  }

  private renderList(): void {
    this.listEl.innerHTML = '';
    this.itemEls = [];

    if (this.filteredItems.length === 0) {
      const empty = document.createElement('div');
      empty.style.padding = '24px';
      empty.style.textAlign = 'center';
      empty.style.color = 'var(--tok-text-muted)';
      empty.textContent = this.emptyText;
      this.listEl.appendChild(empty);
      this.inputEl.removeAttribute('aria-activedescendant');
      return;
    }

    const fragment = document.createDocumentFragment();
    let currentCat = '';
    this.filteredItems.forEach((item, index) => {
      if (item.category !== currentCat) {
        currentCat = item.category;
        const catEl = document.createElement('div');
        catEl.className = 'tok-palette-category';
        catEl.setAttribute('role', 'presentation');
        catEl.textContent = currentCat;
        fragment.appendChild(catEl);
      }

      const itemEl = document.createElement('div');
      itemEl.className = 'tok-palette-item';
      itemEl.id = `tok-palette-item-${index}`;
      itemEl.setAttribute('role', 'option');
      itemEl.setAttribute('aria-selected', 'false');

      const left = document.createElement('div');
      left.style.display = 'flex';
      left.style.alignItems = 'center';
      left.style.gap = '8px';

      const arrow = document.createElement('span');
      // Points toward the reading direction's start of the text.
      arrow.textContent = i18n.getDirection() === 'rtl' ? '‹' : '›';
      arrow.setAttribute('aria-hidden', 'true');
      arrow.style.opacity = '0.4';
      left.appendChild(arrow);

      const title = document.createElement('span');
      title.textContent = item.title;
      left.appendChild(title);

      if (item.subtitle) {
        const sub = document.createElement('span');
        sub.style.fontSize = '11px';
        sub.style.opacity = '0.7';
        sub.textContent = `— ${item.subtitle}`;
        left.appendChild(sub);
      }
      itemEl.appendChild(left);

      if (item.shortcut) {
        const sc = document.createElement('kbd');
        sc.style.fontSize = '10px';
        sc.style.background = 'rgba(0,0,0,0.3)';
        sc.style.padding = '1px 5px';
        sc.style.borderRadius = '3px';
        sc.style.fontFamily = 'inherit';
        sc.dir = 'ltr';
        sc.textContent = item.shortcut;
        itemEl.appendChild(sc);
      }

      itemEl.addEventListener('mousemove', () => {
        if (this.selectedIndex !== index) this.setSelected(index);
      });
      itemEl.addEventListener('click', () => this.runItem(item));

      this.itemEls.push(itemEl);
      fragment.appendChild(itemEl);
    });
    this.listEl.appendChild(fragment);

    this.setSelected(Math.min(this.selectedIndex, this.itemEls.length - 1));
  }
}

