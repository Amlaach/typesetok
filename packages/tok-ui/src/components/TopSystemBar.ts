import { UpdatesBellButton } from '../updates/UpdatesBellButton';
import { ViewMode } from '../types';
import { t, i18n } from '../i18n';
import { el, icon, iconButton, kbd, button } from '../ui';

export interface TopSystemBarCallbacks {
  onMenuAction: (action: string, data?: unknown) => void;
  onOpenCommandPalette: () => void;
  onViewModeChange: (mode: ViewMode) => void;
  onExportPdf?: () => void;
  onOpenProjects?: () => void;
  onToggleLanguage?: () => void;
  onOpenSettings?: () => void;
  onOpenAbout?: () => void;
  onOpenWhatsNew?: () => void;
  onUndo?: () => void;
  onRedo?: () => void;
  onRenameDocument?: (newTitle: string) => void;
}

type MenuItem = { type: 'separator' } | { labelKey: string; shortcut?: string; action: string };

// Only shortcuts that are actually bound (Electron menu accelerators) are shown.
const MENU_ITEMS: MenuItem[] = [
  { labelKey: 'topBarProjects', shortcut: 'Ctrl+Shift+P', action: 'open-projects' },
  { labelKey: 'menuNewDocument', shortcut: 'Ctrl+N', action: 'new-document' },
  { labelKey: 'menuOpenDocument', shortcut: 'Ctrl+O', action: 'open-document' },
  { labelKey: 'menuImportDocument', shortcut: 'Ctrl+I', action: 'import-document' },
  { labelKey: 'menuSave', shortcut: 'Ctrl+S', action: 'save-document' },
  { labelKey: 'menuSaveAs', shortcut: 'Ctrl+Shift+S', action: 'save-as' },
  { labelKey: 'menuRenameDocument', shortcut: 'F2', action: 'rename-document' },
  { type: 'separator' },
  { labelKey: 'menuTextCleanup', shortcut: 'Ctrl+Shift+C', action: 'open-text-cleanup' },
  { labelKey: 'menuNormalizeNiqqud', action: 'normalize-hebrew' },
  { labelKey: 'menuShieldDivineNames', action: 'shield-divine-names' },
  { labelKey: 'menuRecalcGematria', action: 'recalculate-gematria' },
  { type: 'separator' },
  { labelKey: 'menuExportPdf', shortcut: 'Ctrl+E', action: 'export-pdf' },
  { type: 'separator' },
  { labelKey: 'sidebarSettings', shortcut: 'Ctrl+,', action: 'open-settings' },
  { labelKey: 'menuWhatsNew', action: 'open-whats-new' },
  { labelKey: 'sidebarAbout', action: 'open-about' },
  { type: 'separator' },
  { labelKey: 'menuExit', shortcut: 'Ctrl+Q', action: 'quit-app' }
];

/**
 * App header: brand + document (start side), view switcher (center), command search,
 * undo/redo, language and export (end side). All colors come from theme tokens.
 */
export class TopSystemBar {
  public element: HTMLElement;
  private currentMode: ViewMode = 'canvas';
  private callbacks: TopSystemBarCallbacks;
  private activeDropdown: HTMLElement | null = null;
  private activeAnchor: HTMLElement | null = null;
  private documentTitle = '';
  private isDirty = false;
  private pageLabel = '';
  private pageLabelEl: HTMLElement | null = null;
  private undoBtn?: HTMLButtonElement;
  private redoBtn?: HTMLButtonElement;

  constructor(callbacks: TopSystemBarCallbacks) {
    this.callbacks = callbacks;
    this.element = document.createElement('header');
    this.element.className = 'tok-top-bar';
    this.element.dir = i18n.getDirection();

    i18n.onChange(() => {
      this.element.dir = i18n.getDirection();
      this.render();
    });

    this.render();

    // Close an open dropdown on click outside or Escape.
    // Capture phase: page frames stop click propagation, which used to keep the menu open.
    document.addEventListener('pointerdown', (e) => {
      if (this.activeDropdown && !this.element.contains(e.target as Node)) this.closeDropdown();
    }, true);
    document.addEventListener('keydown', (e) => {
      if (this.activeDropdown && e.key === 'Escape') this.closeDropdown();
    });
  }

  public setDocumentTitle(title: string, isDirty: boolean = false): void {
    this.documentTitle = title;
    this.isDirty = isDirty;
    this.render();
  }

  public setDirty(isDirty: boolean): void {
    if (this.isDirty === isDirty) return;
    this.isDirty = isDirty;
    const savedEl = this.element.querySelector('.tok-saved');
    if (savedEl) {
      if (isDirty) {
        savedEl.classList.add('tok-unsaved');
      } else {
        savedEl.classList.remove('tok-unsaved');
      }
      const labelSpan = savedEl.querySelector('span:not(.tok-dot)');
      if (labelSpan) {
        labelSpan.textContent = isDirty ? t('topBarUnsaved') : t('topBarSaved');
      }
    }
    const nameEl = this.element.querySelector('.tok-doc-title-name');
    if (nameEl && this.documentTitle) {
      const cleanTitle = this.documentTitle.replace(/\.tok$/i, '');
      nameEl.textContent = isDirty ? `• ${cleanTitle}` : cleanTitle;
    }
  }

  /** Current page shown next to the document name (e.g. "דף ב׳ ע״ב"). */
  public setPageLabel(label: string): void {
    this.pageLabel = label;
    if (this.pageLabelEl) {
      this.pageLabelEl.textContent = label;
      this.pageLabelEl.hidden = !label;
      const sep = this.pageLabelEl.previousElementSibling as HTMLElement | null;
      if (sep) sep.hidden = !label;
    }
  }

  /** Reflects a view change made elsewhere (palette, story "show on page") without re-firing it. */
  public setViewMode(mode: ViewMode): void {
    if (this.currentMode === mode) return;
    this.currentMode = mode;
    this.element.querySelectorAll<HTMLElement>('.tok-seg-btn[data-view]').forEach((b) =>
      b.setAttribute('aria-pressed', String(b.dataset.view === mode))
    );
  }

  public setHistoryState(canUndo: boolean, canRedo: boolean): void {
    if (this.undoBtn) {
      this.undoBtn.disabled = !canUndo;
      this.undoBtn.style.opacity = canUndo ? '1' : '0.4';
    }
    if (this.redoBtn) {
      this.redoBtn.disabled = !canRedo;
      this.redoBtn.style.opacity = canRedo ? '1' : '0.4';
    }
  }

  public startRenaming(): void {
    const titleContainer = this.element.querySelector<HTMLElement>('.tok-doc-title');
    if (!titleContainer) return;
    const titleEl = titleContainer.querySelector<HTMLElement>('.tok-doc-title-name');
    if (!titleEl || titleEl.querySelector('input')) return;

    const currentTitle = this.documentTitle.replace(/\.tok$/i, '');
    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'tok-doc-title-input tok-title-inline-input';
    input.value = currentTitle;
    input.setAttribute('aria-label', t('menuRenameDocument'));
    input.style.cssText = 'background: var(--tok-bg-surface-2); color: var(--tok-text-primary); border: 1px solid var(--tok-accent-text); border-radius: 4px; padding: 1px 6px; font-size: 13px; font-weight: 600; width: 180px; outline: none; font-family: inherit;';

    let committed = false;
    const commit = () => {
      if (committed) return;
      committed = true;
      const next = input.value.trim();
      if (next && next !== currentTitle) {
        this.callbacks.onRenameDocument?.(next);
      } else {
        titleEl.textContent = this.isDirty ? `• ${currentTitle}` : currentTitle;
      }
    };

    const cancel = () => {
      if (committed) return;
      committed = true;
      titleEl.textContent = this.isDirty ? `• ${currentTitle}` : currentTitle;
    };

    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        commit();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        cancel();
      }
    });

    input.addEventListener('blur', () => commit());

    titleEl.replaceChildren(input);
    input.focus();
    input.select();
  }

  private render(): void {
    // innerHTML='' detaches an open dropdown; drop the reference too.
    this.closeDropdown();
    this.element.innerHTML = '';

    // ---- Start side: brand, document, saved state, file menu ----
    const start = el('div', 'tok-top-side');

    const brand = el('button', 'tok-brand-btn', { type: 'button', title: t('topBarProjects'), 'aria-label': `TypesetOK · ${t('topBarProjects')}` });
    const mark = el('span', 'tok-brand-mark', { 'aria-hidden': 'true' });
    mark.appendChild(icon('brand', 20));
    brand.appendChild(mark);
    brand.appendChild(el('span', 'tok-brand-name', undefined, 'TypesetOK'));
    brand.addEventListener('click', () => this.callbacks.onOpenProjects?.());
    start.appendChild(brand);

    start.appendChild(el('span', 'tok-divider-v', { 'aria-hidden': 'true' }));

    if (this.documentTitle) {
      const doc = el('div', 'tok-doc-title', { title: this.documentTitle });
      const cleanTitle = this.documentTitle.replace(/\.tok$/i, '');

      const titleSpan = el('span', 'tok-doc-title-name', {
        tabindex: '0',
        role: 'button',
        title: t('renameDocumentTooltip'),
        style: 'cursor: pointer; border-radius: 3px; padding: 1px 4px;'
      }, this.isDirty ? `• ${cleanTitle}` : cleanTitle);
      titleSpan.addEventListener('dblclick', (e) => {
        e.stopPropagation();
        this.startRenaming();
      });
      titleSpan.addEventListener('keydown', (e) => {
        if (e.key === 'F2' || e.key === 'Enter') {
          e.preventDefault();
          this.startRenaming();
        }
      });
      doc.appendChild(titleSpan);

      const renameBtn = iconButton('edit', t('renameDocumentTooltip'), () => {
        this.startRenaming();
      }, { size: 12, className: 'tok-btn tok-btn-ghost tok-btn-xs', attrs: { style: 'height: 20px; width: 20px; padding: 0; opacity: 0.6; margin-inline-start: 2px;' } });
      doc.appendChild(renameBtn);

      const sep = el('span', 'tok-doc-title-sep', { 'aria-hidden': 'true' }, '/');
      sep.hidden = !this.pageLabel;
      doc.appendChild(sep);
      this.pageLabelEl = el('span', 'tok-doc-title-page', undefined, this.pageLabel);
      this.pageLabelEl.hidden = !this.pageLabel;
      doc.appendChild(this.pageLabelEl);
      start.appendChild(doc);

      const saved = el('span', this.isDirty ? 'tok-saved tok-unsaved' : 'tok-saved', { role: 'status' });
      saved.appendChild(el('span', 'tok-dot', { 'aria-hidden': 'true' }));
      saved.appendChild(el('span', undefined, undefined, this.isDirty ? t('topBarUnsaved') : t('topBarSaved')));
      start.appendChild(saved);
    }

    const menuBtn = el('button', 'tok-btn tok-menu-btn', { type: 'button', 'aria-haspopup': 'menu', 'aria-expanded': 'false' });
    menuBtn.appendChild(el('span', undefined, undefined, t('topBarFileAndMenu')));
    menuBtn.appendChild(icon('chevronDown', 12));
    menuBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      this.toggleQuickMenu(menuBtn);
    });
    start.appendChild(menuBtn);

    this.element.appendChild(start);

    // ---- Center: view switcher ----
    const views = el('div', 'tok-seg', { role: 'group', 'aria-label': t('topBarViewMode') });
    const modes: { id: ViewMode; label: string }[] = [
      { id: 'canvas', label: t('topBarViewCanvas') },
      { id: 'split', label: t('topBarViewSplit') },
      { id: 'story', label: t('topBarViewStory') }
    ];
    for (const m of modes) {
      const b = el('button', 'tok-seg-btn', { type: 'button', 'aria-pressed': String(this.currentMode === m.id), 'data-view': m.id }, m.label);
      b.addEventListener('click', () => {
        if (this.currentMode === m.id) return;
        this.setViewMode(m.id);
        this.callbacks.onViewModeChange(m.id);
      });
      views.appendChild(b);
    }
    this.element.appendChild(views);

    // ---- End side: search, undo/redo, language, export ----
    const end = el('div', 'tok-top-side tok-end');

    const search = el('button', 'tok-search-pill', { type: 'button', 'aria-keyshortcuts': 'Control+K' });
    search.appendChild(icon('search', 16));
    search.appendChild(el('span', undefined, undefined, t('topBarSearchPlaceholder')));
    search.appendChild(kbd('Ctrl K'));
    search.addEventListener('click', () => this.callbacks.onOpenCommandPalette());
    end.appendChild(search);

    const undo = iconButton('undo', t('topBarUndo'), () => this.callbacks.onUndo?.(), { attrs: { 'aria-keyshortcuts': 'Control+Z' } });
    const redo = iconButton('redo', t('topBarRedo'), () => this.callbacks.onRedo?.(), { attrs: { 'aria-keyshortcuts': 'Control+Y' } });
    undo.disabled = true;
    undo.style.opacity = '0.4';
    redo.disabled = true;
    redo.style.opacity = '0.4';
    this.undoBtn = undo;
    this.redoBtn = redo;
    // In RTL the "back" arrow points right.
    if (i18n.getDirection() === 'rtl') {
      undo.replaceChildren(icon('redo', 18));
      redo.replaceChildren(icon('undo', 18));
    }
    end.appendChild(undo);
    end.appendChild(redo);
    if (this.callbacks.onOpenWhatsNew) {
      const bell = new UpdatesBellButton({
        onClick: () => this.callbacks.onOpenWhatsNew?.()
      });
      end.appendChild(bell.element);
    }

    this.element.appendChild(end);
  }

  private toggleQuickMenu(anchorBtn: HTMLElement): void {
    if (this.activeDropdown) {
      this.closeDropdown();
      return;
    }

    const dropdown = el('div', 'tok-quick-menu', { role: 'menu', 'aria-label': t('topBarFileAndMenu') });
    // Open under the menu button on its start edge.
    if (i18n.getDirection() === 'rtl') {
      dropdown.style.right = `${Math.max(0, this.element.clientWidth - (anchorBtn.offsetLeft + anchorBtn.offsetWidth))}px`;
    } else {
      dropdown.style.left = `${Math.max(0, anchorBtn.offsetLeft)}px`;
    }

    const rows: HTMLButtonElement[] = [];
    for (const item of MENU_ITEMS) {
      if ('type' in item) {
        dropdown.appendChild(el('div', 'tok-quick-menu-sep', { role: 'separator' }));
        continue;
      }
      const row = el('button', 'tok-quick-menu-item', { type: 'button', role: 'menuitem', tabindex: '-1' });
      row.appendChild(el('span', undefined, undefined, t(item.labelKey)));
      if (item.shortcut) row.appendChild(kbd(item.shortcut));
      row.addEventListener('mouseenter', () => row.focus());
      row.addEventListener('click', () => {
        this.closeDropdown();
        this.callbacks.onMenuAction(item.action);
      });
      rows.push(row);
      dropdown.appendChild(row);
    }

    // Keyboard: ArrowUp/Down/Home/End move between items, Escape/Tab close.
    dropdown.addEventListener('keydown', (e) => {
      const idx = rows.indexOf(document.activeElement as HTMLButtonElement);
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        const delta = e.key === 'ArrowDown' ? 1 : -1;
        rows[(idx + delta + rows.length) % rows.length].focus();
      } else if (e.key === 'Home' || e.key === 'End') {
        e.preventDefault();
        rows[e.key === 'Home' ? 0 : rows.length - 1].focus();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        this.closeDropdown();
        anchorBtn.focus();
      } else if (e.key === 'Tab') {
        this.closeDropdown();
      }
    });

    this.element.appendChild(dropdown);
    this.activeDropdown = dropdown;
    anchorBtn.setAttribute('aria-expanded', 'true');
    this.activeAnchor = anchorBtn;
    // Opened from the keyboard: put focus on the first item.
    if (document.activeElement === anchorBtn) rows[0]?.focus();
  }

  private closeDropdown(): void {
    if (this.activeDropdown) {
      this.activeDropdown.remove();
      this.activeDropdown = null;
    }
    if (this.activeAnchor) {
      this.activeAnchor.setAttribute('aria-expanded', 'false');
      this.activeAnchor = null;
    }
  }
}
