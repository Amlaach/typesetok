import { IconName } from '../icons';
import { t, tf, i18n } from '../i18n';
import { el, icon, kbd } from '../ui';

export interface PaletteItem {
  id: string;
  category: string;
  title: string;
  subtitle?: string;
  shortcut?: string;
  /** Optional icon shown before the title. */
  icon?: IconName;
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

/**
 * Splits `text` into plain and matched parts for every query term (niqqud-insensitive
 * matching is approximated on the visible text; unmatched text stays plain).
 */
export function highlightParts(text: string, query: string): { text: string; match: boolean }[] {
  const terms = normalizeSearchText(query).split(' ').filter(Boolean);
  if (!terms.length) return [{ text, match: false }];
  const lower = text.toLowerCase();
  const marks = new Array(text.length).fill(false);
  for (const term of terms) {
    let from = 0;
    for (;;) {
      const idx = lower.indexOf(term, from);
      if (idx < 0) break;
      for (let k = idx; k < idx + term.length; k++) marks[k] = true;
      from = idx + term.length;
    }
  }
  const parts: { text: string; match: boolean }[] = [];
  for (let k = 0; k < text.length; k++) {
    const last = parts[parts.length - 1];
    if (last && last.match === marks[k]) last.text += text[k];
    else parts.push({ text: text[k], match: marks[k] });
  }
  return parts;
}

export class CommandPalette {
  public element: HTMLElement;
  private isVisible = false;
  private inputEl!: HTMLInputElement;
  private listEl!: HTMLElement;
  private footerEl!: HTMLElement;
  private countEl!: HTMLElement;
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
    const hint = (keys: string, labelKey: string) => {
      const span = el('span');
      span.appendChild(kbd(keys));
      span.appendChild(el('span', undefined, undefined, t(labelKey)));
      return span;
    };
    this.footerEl.appendChild(hint('↑ ↓', 'paletteNavigateShort'));
    this.footerEl.appendChild(hint('Enter', 'paletteRunShort'));
    this.footerEl.appendChild(hint('Esc', 'aboutClose'));
    this.footerEl.appendChild(el('span', 'tok-grow'));
    this.countEl = el('span');
    this.footerEl.appendChild(this.countEl);
    this.updateCount();
    this.emptyText = t('paletteNoResults');
    if (this.isVisible && this.filteredItems.length === 0) this.renderList();
  }

  private updateCount(): void {
    if (this.countEl) this.countEl.textContent = tf('paletteResultsCount', { n: this.filteredItems.length });
  }

  private render(): void {
    this.element.innerHTML = '';
    this.element.setAttribute('role', 'dialog');
    this.element.setAttribute('aria-modal', 'true');

    const modal = el('div', 'tok-palette-modal');
    modal.addEventListener('click', (e) => e.stopPropagation());

    // Search field
    const inputWrap = el('div', 'tok-palette-input-wrap');
    inputWrap.appendChild(icon('search', 19));
    this.inputEl = el('input', 'tok-palette-input', {
      type: 'text',
      role: 'combobox',
      'aria-expanded': 'true',
      'aria-controls': 'tok-palette-list',
      'aria-autocomplete': 'list',
      autocomplete: 'off',
      spellcheck: 'false'
    });
    inputWrap.appendChild(this.inputEl);
    const esc = kbd('Esc');
    esc.setAttribute('aria-hidden', 'true');
    inputWrap.appendChild(esc);
    modal.appendChild(inputWrap);

    // Results
    this.listEl = el('div', 'tok-palette-list', { id: 'tok-palette-list', role: 'listbox' });
    modal.appendChild(this.listEl);

    // Footer hints
    this.footerEl = el('div', 'tok-palette-foot', { 'aria-hidden': 'true' });
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
      // Overlays open via a CSS class, so check the computed display, not the inline style.
      (node) => node !== this.element && node.isConnected && getComputedStyle(node).display !== 'none'
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
    }
    this.selectedIndex = index;
    const item = this.itemEls[index];
    if (item) {
      item.classList.add('active');
      item.setAttribute('aria-selected', 'true');
      this.inputEl.setAttribute('aria-activedescendant', item.id);
      item.scrollIntoView({ block: 'nearest' });
    } else {
      this.inputEl.removeAttribute('aria-activedescendant');
    }
  }

  private renderList(): void {
    this.listEl.innerHTML = '';
    this.itemEls = [];
    this.updateCount();

    if (this.filteredItems.length === 0) {
      this.listEl.appendChild(el('div', 'tok-palette-empty', undefined, this.emptyText));
      this.inputEl.removeAttribute('aria-activedescendant');
      return;
    }

    const query = this.inputEl.value;
    const fragment = document.createDocumentFragment();
    let currentCat = '';
    this.filteredItems.forEach((item, index) => {
      if (item.category !== currentCat) {
        currentCat = item.category;
        fragment.appendChild(el('div', 'tok-palette-category', { role: 'presentation' }, currentCat));
      }

      const row = el('div', 'tok-palette-item', { id: `tok-palette-item-${index}`, role: 'option', 'aria-selected': 'false' });
      const ic = el('span', 'tok-palette-icon', { 'aria-hidden': 'true' });
      ic.appendChild(icon(item.icon ?? 'zap', 17));
      row.appendChild(ic);

      const title = el('span', 'tok-palette-title');
      for (const part of highlightParts(item.title, query)) {
        title.appendChild(part.match ? el('mark', undefined, undefined, part.text) : document.createTextNode(part.text));
      }
      row.appendChild(title);
      if (item.subtitle) row.appendChild(el('span', 'tok-palette-sub', undefined, item.subtitle));
      row.appendChild(el('span', 'tok-grow'));
      if (item.shortcut) row.appendChild(kbd(item.shortcut));
      const enter = el('span', 'tok-palette-enter tok-flip-rtl', { 'aria-hidden': 'true' });
      enter.appendChild(icon('arrowForward', 16));
      row.appendChild(enter);

      row.addEventListener('mousemove', () => {
        if (this.selectedIndex !== index) this.setSelected(index);
      });
      row.addEventListener('click', () => this.runItem(item));

      this.itemEls.push(row);
      fragment.appendChild(row);
    });
    this.listEl.appendChild(fragment);

    this.setSelected(Math.min(this.selectedIndex, this.itemEls.length - 1));
  }
}
