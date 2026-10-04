import { ViewMode } from '../types';

export interface TopSystemBarCallbacks {
  onMenuAction: (action: string, data?: unknown) => void;
  onOpenCommandPalette: () => void;
  onViewModeChange: (mode: ViewMode) => void;
  onExportPdf: () => void;
}

export class TopSystemBar {
  public element: HTMLElement;
  private currentMode: ViewMode = 'canvas';
  private callbacks: TopSystemBarCallbacks;
  private activeDropdown: HTMLElement | null = null;

  constructor(callbacks: TopSystemBarCallbacks) {
    this.callbacks = callbacks;
    this.element = document.createElement('header');
    this.element.className = 'tok-top-bar';
    this.element.dir = 'rtl';
    this.element.style.height = 'var(--tok-top-bar-height)';
    this.element.style.minHeight = 'var(--tok-top-bar-height)';
    this.element.style.background = 'var(--tok-bg-app)';
    this.element.style.borderBottom = '1px solid var(--tok-border-subtle)';
    this.element.style.display = 'flex';
    this.element.style.alignItems = 'center';
    this.element.style.justifyContent = 'space-between';
    this.element.style.padding = '0 12px';
    this.element.style.userSelect = 'none';
    this.element.style.zIndex = '50';
    this.element.style.position = 'relative';

    this.render();

    // Close any open dropdown on click outside
    document.addEventListener('click', (e) => {
      if (this.activeDropdown && !this.element.contains(e.target as Node)) {
        this.closeDropdown();
      }
    });
  }

  private render(): void {
    this.element.innerHTML = '';

    // Right side (Leading in RTL): Brand & Menus
    const rightSide = document.createElement('div');
    rightSide.style.display = 'flex';
    rightSide.style.alignItems = 'center';
    rightSide.style.gap = '12px';

    // Logo & Document Name Pill
    const brandWrap = document.createElement('div');
    brandWrap.style.display = 'flex';
    brandWrap.style.alignItems = 'center';
    brandWrap.style.gap = '8px';

    const brandIcon = document.createElement('span');
    brandIcon.textContent = '📘';
    brandIcon.style.fontSize = '16px';
    brandWrap.appendChild(brandIcon);

    const brandName = document.createElement('span');
    brandName.textContent = 'TypesetOK';
    brandName.style.fontWeight = '700';
    brandName.style.fontSize = '13px';
    brandName.style.color = '#60A5FA';
    brandWrap.appendChild(brandName);

    const docPill = document.createElement('div');
    docPill.className = 'tok-doc-pill';
    docPill.style.background = 'var(--tok-bg-surface-2)';
    docPill.style.border = '1px solid var(--tok-border-strong)';
    docPill.style.borderRadius = '12px';
    docPill.style.padding = '2px 10px';
    docPill.style.fontSize = '11px';
    docPill.style.color = 'var(--tok-text-secondary)';
    docPill.textContent = 'מסכת ברכות — מהדורת מופת.tok';
    brandWrap.appendChild(docPill);

    rightSide.appendChild(brandWrap);

    // Separator
    rightSide.appendChild(this.createSeparator());

    // System Menus
    const menuBar = document.createElement('nav');
    menuBar.style.display = 'flex';
    menuBar.style.alignItems = 'center';
    menuBar.style.gap = '2px';

    const menus: { label: string; items: { label: string; shortcut?: string; action: string }[] }[] = [
      {
        label: 'קובץ',
        items: [
          { label: 'מסמך חדש...', shortcut: 'Ctrl+N', action: 'new-document' },
          { label: 'פתח מסמך (.tok)...', shortcut: 'Ctrl+O', action: 'open-document' },
          { label: 'שמור', shortcut: 'Ctrl+S', action: 'save-document' },
          { label: 'שמור בשם...', shortcut: 'Ctrl+Shift+S', action: 'save-as' },
          { label: 'ייצא לדפוס (ISO PDF/X-1a)...', shortcut: 'Ctrl+E', action: 'export-pdf' }
        ]
      },
      {
        label: 'עריכה',
        items: [
          { label: 'בטל', shortcut: 'Ctrl+Z', action: 'undo' },
          { label: 'בצע שוב', shortcut: 'Ctrl+Y', action: 'redo' },
          { label: 'גזור', shortcut: 'Ctrl+X', action: 'cut' },
          { label: 'העתק', shortcut: 'Ctrl+C', action: 'copy' },
          { label: 'הדבק', shortcut: 'Ctrl+V', action: 'paste' },
          { label: 'בחר הכל', shortcut: 'Ctrl+A', action: 'select-all' }
        ]
      },
      {
        label: 'טיפוגרפיה',
        items: [
          { label: 'יישור עברי מלא (אהלתר"ם)', shortcut: 'Ctrl+Alt+J', action: 'apply-justification' },
          { label: 'נרמל ניקוד וטעמים (ת"י 6100)', shortcut: 'Ctrl+Shift+N', action: 'normalize-hebrew' },
          { label: 'מגן שמות קדושים (No-Break)', action: 'shield-divine-names' },
          { label: 'סנכרן מספור עמודים עברי (גימטריה)', action: 'recalculate-gematria' }
        ]
      },
      {
        label: 'עמודים',
        items: [
          { label: 'הוסף עמוד חדש', shortcut: 'Ctrl+Enter', action: 'new-page' },
          { label: 'הוסף כפולת עמודים', action: 'new-spread' },
          { label: 'ערוך עמוד מסטר', shortcut: 'Alt+Click', action: 'edit-master' },
          { label: 'קפוץ לעמוד...', shortcut: 'Ctrl+G', action: 'goto-page' }
        ]
      },
      {
        label: 'תצוגה',
        items: [
          { label: 'הצג/הסתר קווי שוליים', action: 'toggle-margins' },
          { label: 'הצג/הסתר רשת שורות בסיס', action: 'toggle-baseline' },
          { label: 'זום 100%', shortcut: 'Ctrl+0', action: 'zoom-100' },
          { label: 'התאם לרוחב חלון', action: 'zoom-fit' }
        ]
      },
      {
        label: 'עזרה',
        items: [
          { label: 'מדריך תוכנת TypesetOK', action: 'help-docs' },
          { label: 'קיצורי מקלדת', shortcut: '?', action: 'shortcuts' }
        ]
      }
    ];

    for (const m of menus) {
      const menuBtn = document.createElement('button');
      menuBtn.className = 'tok-menu-btn';
      menuBtn.textContent = m.label;
      menuBtn.style.background = 'transparent';
      menuBtn.style.border = 'none';
      menuBtn.style.color = 'var(--tok-text-primary)';
      menuBtn.style.padding = '4px 8px';
      menuBtn.style.borderRadius = '4px';
      menuBtn.style.cursor = 'pointer';
      menuBtn.style.fontSize = '12px';
      menuBtn.style.fontFamily = 'inherit';

      menuBtn.addEventListener('mouseenter', () => {
        menuBtn.style.background = 'var(--tok-bg-surface-2)';
      });
      menuBtn.addEventListener('mouseleave', () => {
        if (!this.activeDropdown || this.activeDropdown.dataset.menu !== m.label) {
          menuBtn.style.background = 'transparent';
        }
      });

      menuBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.toggleDropdown(m.label, menuBtn, m.items);
      });

      menuBar.appendChild(menuBtn);
    }

    rightSide.appendChild(menuBar);
    this.element.appendChild(rightSide);

    // Center: View Mode Segmented Switcher
    const centerSide = document.createElement('div');
    centerSide.style.display = 'flex';
    centerSide.style.alignItems = 'center';
    centerSide.style.background = 'var(--tok-bg-surface-1)';
    centerSide.style.border = '1px solid var(--tok-border-subtle)';
    centerSide.style.borderRadius = '6px';
    centerSide.style.padding = '2px';
    centerSide.style.gap = '2px';

    const modes: { id: ViewMode; label: string; icon: string }[] = [
      { id: 'canvas', label: 'עמודים מעומדים', icon: '📄' },
      { id: 'story', label: 'עורך סיפור רציף', icon: '📝' },
      { id: 'split', label: 'תצוגה מפוצלת', icon: '🔀' }
    ];

    for (const mode of modes) {
      const modeBtn = document.createElement('button');
      modeBtn.className = 'tok-mode-btn';
      modeBtn.textContent = `${mode.icon} ${mode.label}`;
      modeBtn.dataset.mode = mode.id;
      modeBtn.style.background = this.currentMode === mode.id ? 'var(--tok-bg-surface-hover)' : 'transparent';
      modeBtn.style.color = this.currentMode === mode.id ? '#FFFFFF' : 'var(--tok-text-secondary)';
      modeBtn.style.fontWeight = this.currentMode === mode.id ? '600' : 'normal';
      modeBtn.style.border = 'none';
      modeBtn.style.padding = '3px 10px';
      modeBtn.style.borderRadius = '4px';
      modeBtn.style.cursor = 'pointer';
      modeBtn.style.fontSize = '11px';
      modeBtn.style.fontFamily = 'inherit';
      modeBtn.style.transition = 'all 0.15s ease';

      modeBtn.addEventListener('click', () => {
        this.currentMode = mode.id;
        this.callbacks.onViewModeChange(mode.id);
        this.updateModeButtons(centerSide);
      });

      centerSide.appendChild(modeBtn);
    }
    this.element.appendChild(centerSide);

    // Left side (Trailing in RTL): Command Palette & Export PDF
    const leftSide = document.createElement('div');
    leftSide.style.display = 'flex';
    leftSide.style.alignItems = 'center';
    leftSide.style.gap = '10px';

    // Command Palette Trigger (Cmd+K)
    const cmdBtn = document.createElement('button');
    cmdBtn.className = 'tok-btn';
    cmdBtn.title = 'חיפוש פקודה וניווט (Ctrl+K)';
    cmdBtn.style.background = 'var(--tok-bg-surface-2)';
    cmdBtn.style.borderColor = 'var(--tok-border-strong)';
    cmdBtn.style.color = 'var(--tok-text-secondary)';
    cmdBtn.style.display = 'flex';
    cmdBtn.style.alignItems = 'center';
    cmdBtn.style.gap = '8px';
    cmdBtn.style.padding = '0 10px';

    cmdBtn.innerHTML = `
      <span>🔍</span>
      <span style="font-size: 11px;">חפש פקודה...</span>
      <span style="background: #333; padding: 1px 5px; border-radius: 3px; font-size: 10px; color: #BBB;">Ctrl+K</span>
    `;

    cmdBtn.addEventListener('click', () => {
      this.callbacks.onOpenCommandPalette();
    });
    leftSide.appendChild(cmdBtn);

    // Export PDF/X-1a Prepress Button
    const exportBtn = document.createElement('button');
    exportBtn.className = 'tok-btn tok-btn-primary';
    exportBtn.title = 'ייצא לדפוס בתקן ISO PDF/X-1a';
    exportBtn.innerHTML = `<span>⚡</span><span>ייצוא PDF/X-1a</span>`;
    exportBtn.addEventListener('click', () => {
      this.callbacks.onExportPdf();
    });
    leftSide.appendChild(exportBtn);

    this.element.appendChild(leftSide);
  }

  private updateModeButtons(container: HTMLElement): void {
    const btns = container.querySelectorAll<HTMLButtonElement>('.tok-mode-btn');
    btns.forEach((btn) => {
      const isActive = btn.dataset.mode === this.currentMode;
      btn.style.background = isActive ? 'var(--tok-bg-surface-hover)' : 'transparent';
      btn.style.color = isActive ? '#FFFFFF' : 'var(--tok-text-secondary)';
      btn.style.fontWeight = isActive ? '600' : 'normal';
    });
  }

  private toggleDropdown(menuLabel: string, anchor: HTMLElement, items: { label: string; shortcut?: string; action: string }[]): void {
    if (this.activeDropdown) {
      const isSame = this.activeDropdown.dataset.menu === menuLabel;
      this.closeDropdown();
      if (isSame) return;
    }

    const dropdown = document.createElement('div');
    dropdown.dataset.menu = menuLabel;
    dropdown.style.position = 'absolute';
    dropdown.style.top = 'var(--tok-top-bar-height)';
    dropdown.style.background = 'var(--tok-bg-elevated)';
    dropdown.style.border = '1px solid var(--tok-border-strong)';
    dropdown.style.borderRadius = '6px';
    dropdown.style.boxShadow = '0 8px 24px rgba(0,0,0,0.6)';
    dropdown.style.minWidth = '220px';
    dropdown.style.padding = '4px 0';
    dropdown.style.zIndex = '1000';
    dropdown.style.direction = 'rtl';

    // Position relative to anchor
    const rect = anchor.getBoundingClientRect();
    dropdown.style.right = `${window.innerWidth - rect.right}px`;

    for (const it of items) {
      const itemEl = document.createElement('div');
      itemEl.style.display = 'flex';
      itemEl.style.alignItems = 'center';
      itemEl.style.justifyContent = 'space-between';
      itemEl.style.padding = '6px 14px';
      itemEl.style.cursor = 'pointer';
      itemEl.style.fontSize = '12px';
      itemEl.style.color = 'var(--tok-text-primary)';

      itemEl.addEventListener('mouseenter', () => (itemEl.style.background = 'var(--tok-accent-primary)'));
      itemEl.addEventListener('mouseleave', () => (itemEl.style.background = 'transparent'));

      itemEl.addEventListener('click', () => {
        this.closeDropdown();
        this.callbacks.onMenuAction(it.action);
      });

      const labelSpan = document.createElement('span');
      labelSpan.textContent = it.label;
      itemEl.appendChild(labelSpan);

      if (it.shortcut) {
        const scSpan = document.createElement('span');
        scSpan.textContent = it.shortcut;
        scSpan.style.fontSize = '10px';
        scSpan.style.color = 'var(--tok-text-muted)';
        scSpan.style.direction = 'ltr';
        itemEl.appendChild(scSpan);
      }

      dropdown.appendChild(itemEl);
    }

    this.element.appendChild(dropdown);
    this.activeDropdown = dropdown;
    anchor.style.background = 'var(--tok-bg-surface-2)';
  }

  private closeDropdown(): void {
    if (this.activeDropdown) {
      this.activeDropdown.remove();
      this.activeDropdown = null;
      const allMenuBtns = this.element.querySelectorAll<HTMLButtonElement>('.tok-menu-btn');
      allMenuBtns.forEach((b) => (b.style.background = 'transparent'));
    }
  }

  private createSeparator(): HTMLElement {
    const sep = document.createElement('div');
    sep.style.width = '1px';
    sep.style.height = '18px';
    sep.style.background = 'var(--tok-border-subtle)';
    return sep;
  }
}
