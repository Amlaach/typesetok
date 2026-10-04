import { ViewMode } from '../types';
import { t, i18n } from '../i18n';

export interface TopSystemBarCallbacks {
  onMenuAction: (action: string, data?: unknown) => void;
  onOpenCommandPalette: () => void;
  onViewModeChange: (mode: ViewMode) => void;
  onExportPdf: () => void;
  onOpenProjects?: () => void;
  onToggleLanguage?: () => void;
}

export class TopSystemBar {
  public element: HTMLElement;
  private currentMode: ViewMode = 'canvas';
  private callbacks: TopSystemBarCallbacks;
  private activeDropdown: HTMLElement | null = null;
  private documentTitle = 'מסכת ברכות — מהדורת מופת.tok';

  constructor(callbacks: TopSystemBarCallbacks) {
    this.callbacks = callbacks;
    this.element = document.createElement('header');
    this.element.className = 'tok-top-bar';
    this.element.dir = i18n.getLanguage() === 'he' ? 'rtl' : 'ltr';
    this.element.style.height = 'var(--tok-top-bar-height)';
    this.element.style.minHeight = 'var(--tok-top-bar-height)';
    this.element.style.background = '#0B132B'; // Deep navy blue, seamless & modern
    this.element.style.borderBottom = '1px solid #1E293B';
    this.element.style.display = 'flex';
    this.element.style.alignItems = 'center';
    this.element.style.justifyContent = 'space-between';
    this.element.style.padding = '0 14px';
    this.element.style.userSelect = 'none';
    this.element.style.zIndex = '50';
    this.element.style.position = 'relative';

    i18n.onChange((lang) => {
      this.element.dir = lang === 'he' ? 'rtl' : 'ltr';
      this.render();
    });

    this.render();

    // Close any open dropdown on click outside
    document.addEventListener('click', (e) => {
      if (this.activeDropdown && !this.element.contains(e.target as Node)) {
        this.closeDropdown();
      }
    });
  }

  public setDocumentTitle(title: string): void {
    this.documentTitle = title;
    this.render();
  }

  private render(): void {
    this.element.innerHTML = '';

    // ==========================================
    // Leading Section: Brand & Document Indicator
    // ==========================================
    const leadingSide = document.createElement('div');
    leadingSide.style.display = 'flex';
    leadingSide.style.alignItems = 'center';
    leadingSide.style.gap = '10px';

    // Logo & Brand
    const brandWrap = document.createElement('div');
    brandWrap.style.display = 'flex';
    brandWrap.style.alignItems = 'center';
    brandWrap.style.gap = '8px';
    brandWrap.style.cursor = 'pointer';
    brandWrap.title = 'TypesetOK Desktop Publishing';
    brandWrap.addEventListener('click', () => {
      if (this.callbacks.onOpenProjects) this.callbacks.onOpenProjects();
    });

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

    leadingSide.appendChild(brandWrap);

    // Document Name Pill with Saved Indicator
    const docPill = document.createElement('div');
    docPill.className = 'tok-doc-pill';
    docPill.style.background = '#131E38';
    docPill.style.border = '1px solid #1E3A8A';
    docPill.style.borderRadius = '12px';
    docPill.style.padding = '3px 10px';
    docPill.style.fontSize = '11px';
    docPill.style.display = 'flex';
    docPill.style.alignItems = 'center';
    docPill.style.gap = '6px';
    docPill.style.color = '#E2E8F0';

    const statusDot = document.createElement('span');
    statusDot.style.width = '6px';
    statusDot.style.height = '6px';
    statusDot.style.borderRadius = '50%';
    statusDot.style.background = '#10B981'; // Green saved status
    statusDot.title = t('topBarSaved');
    docPill.appendChild(statusDot);

    const docTitle = document.createElement('span');
    docTitle.textContent = this.documentTitle;
    docPill.appendChild(docTitle);

    leadingSide.appendChild(docPill);

    // Projects Button
    const projectsBtn = document.createElement('button');
    projectsBtn.className = 'tok-btn';
    projectsBtn.style.height = '26px';
    projectsBtn.style.padding = '0 8px';
    projectsBtn.style.fontSize = '11px';
    projectsBtn.style.background = '#1E293B';
    projectsBtn.style.border = '1px solid #334155';
    projectsBtn.style.color = '#94A3B8';
    projectsBtn.style.borderRadius = '6px';
    projectsBtn.style.cursor = 'pointer';
    projectsBtn.innerHTML = `📁 ${t('topBarProjects')}`;
    projectsBtn.addEventListener('click', () => {
      if (this.callbacks.onOpenProjects) this.callbacks.onOpenProjects();
    });
    leadingSide.appendChild(projectsBtn);

    // Menu Dropdown (Compact, Non-intrusive)
    const menuBtn = document.createElement('button');
    menuBtn.className = 'tok-btn';
    menuBtn.style.height = '26px';
    menuBtn.style.padding = '0 8px';
    menuBtn.style.fontSize = '11px';
    menuBtn.style.background = 'transparent';
    menuBtn.style.border = '1px solid transparent';
    menuBtn.style.color = '#94A3B8';
    menuBtn.style.borderRadius = '6px';
    menuBtn.style.cursor = 'pointer';
    menuBtn.innerHTML = `☰ ${i18n.getLanguage() === 'he' ? 'תפריט' : 'Menu'}`;
    menuBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      this.toggleQuickMenu(menuBtn);
    });
    leadingSide.appendChild(menuBtn);

    this.element.appendChild(leadingSide);

    // ==========================================
    // Center Section: Minimalist View Switcher & Search
    // ==========================================
    const centerSide = document.createElement('div');
    centerSide.style.display = 'flex';
    centerSide.style.alignItems = 'center';
    centerSide.style.gap = '12px';

    // View Switcher Capsule
    const viewGroup = document.createElement('div');
    viewGroup.style.display = 'flex';
    viewGroup.style.background = '#0F172A';
    viewGroup.style.border = '1px solid #1E293B';
    viewGroup.style.borderRadius = '6px';
    viewGroup.style.padding = '2px';

    const modes: { id: ViewMode; label: string; icon: string }[] = [
      { id: 'canvas', label: t('topBarViewCanvas'), icon: '📄' },
      { id: 'split', label: t('topBarViewSplit'), icon: '🔲' },
      { id: 'story', label: t('topBarViewStory'), icon: '📝' }
    ];

    for (const m of modes) {
      const modeBtn = document.createElement('button');
      modeBtn.style.border = 'none';
      modeBtn.style.background = this.currentMode === m.id ? '#1E3A8A' : 'transparent';
      modeBtn.style.color = this.currentMode === m.id ? '#FFFFFF' : '#94A3B8';
      modeBtn.style.padding = '4px 10px';
      modeBtn.style.borderRadius = '4px';
      modeBtn.style.fontSize = '11px';
      modeBtn.style.fontWeight = this.currentMode === m.id ? '600' : 'normal';
      modeBtn.style.cursor = 'pointer';
      modeBtn.style.transition = 'all 0.15s';
      modeBtn.innerHTML = `<span>${m.icon}</span> <span>${m.label}</span>`;

      modeBtn.addEventListener('click', () => {
        this.currentMode = m.id;
        this.callbacks.onViewModeChange(m.id);
        this.render();
      });

      viewGroup.appendChild(modeBtn);
    }
    centerSide.appendChild(viewGroup);

    // Minimal Search Pill Trigger (Ctrl+K)
    const searchPill = document.createElement('button');
    searchPill.className = 'tok-search-pill';
    searchPill.style.height = '28px';
    searchPill.style.background = '#131E38';
    searchPill.style.border = '1px solid #1E293B';
    searchPill.style.borderRadius = '6px';
    searchPill.style.padding = '0 12px';
    searchPill.style.color = '#94A3B8';
    searchPill.style.fontSize = '11px';
    searchPill.style.display = 'flex';
    searchPill.style.alignItems = 'center';
    searchPill.style.gap = '8px';
    searchPill.style.cursor = 'pointer';
    searchPill.style.transition = 'all 0.15s';

    searchPill.innerHTML = `
      <span>🔍</span>
      <span>${t('topBarSearchPlaceholder')}</span>
      <kbd style="background: #1E293B; padding: 1px 5px; border-radius: 4px; font-size: 10px; color: #CBD5E1; border: 1px solid #334155;">Ctrl+K</kbd>
    `;

    searchPill.addEventListener('mouseenter', () => {
      searchPill.style.borderColor = '#3B82F6';
      searchPill.style.color = '#F8FAFC';
    });
    searchPill.addEventListener('mouseleave', () => {
      searchPill.style.borderColor = '#1E293B';
      searchPill.style.color = '#94A3B8';
    });
    searchPill.addEventListener('click', () => {
      this.callbacks.onOpenCommandPalette();
    });
    centerSide.appendChild(searchPill);

    this.element.appendChild(centerSide);

    // ==========================================
    // Trailing Section: Language & Export Actions
    // ==========================================
    const trailingSide = document.createElement('div');
    trailingSide.style.display = 'flex';
    trailingSide.style.alignItems = 'center';
    trailingSide.style.gap = '8px';

    // Language Switcher Button
    const langBtn = document.createElement('button');
    langBtn.className = 'tok-btn';
    langBtn.style.height = '28px';
    langBtn.style.padding = '0 8px';
    langBtn.style.fontSize = '11px';
    langBtn.style.background = '#1E293B';
    langBtn.style.border = '1px solid #334155';
    langBtn.style.color = '#CBD5E1';
    langBtn.style.borderRadius = '6px';
    langBtn.style.cursor = 'pointer';
    langBtn.innerHTML = i18n.getLanguage() === 'he' ? '🌐 עברית' : '🌐 English';
    langBtn.title = 'Switch Language / החלף שפה';
    langBtn.addEventListener('click', () => {
      i18n.toggleLanguage();
      if (this.callbacks.onToggleLanguage) this.callbacks.onToggleLanguage();
    });
    trailingSide.appendChild(langBtn);

    // Primary Action: Export PDF
    const exportBtn = document.createElement('button');
    exportBtn.className = 'tok-btn tok-btn-primary';
    exportBtn.style.height = '28px';
    exportBtn.style.padding = '0 12px';
    exportBtn.style.fontSize = '12px';
    exportBtn.style.fontWeight = '600';
    exportBtn.style.borderRadius = '6px';
    exportBtn.style.boxShadow = '0 0 10px rgba(37, 99, 235, 0.4)';
    exportBtn.innerHTML = `🚀 ${t('topBarExportPdf')}`;
    exportBtn.addEventListener('click', () => {
      this.callbacks.onExportPdf();
    });
    trailingSide.appendChild(exportBtn);

    this.element.appendChild(trailingSide);
  }

  private toggleQuickMenu(anchorBtn: HTMLElement): void {
    if (this.activeDropdown) {
      this.closeDropdown();
      return;
    }

    const dropdown = document.createElement('div');
    dropdown.className = 'tok-quick-menu';
    dropdown.style.position = 'absolute';
    dropdown.style.top = '100%';
    dropdown.style.background = '#1E293B';
    dropdown.style.border = '1px solid #334155';
    dropdown.style.borderRadius = '8px';
    dropdown.style.boxShadow = '0 10px 30px rgba(0,0,0,0.7)';
    dropdown.style.padding = '6px 0';
    dropdown.style.minWidth = '200px';
    dropdown.style.zIndex = '999';

    if (i18n.getLanguage() === 'he') {
      dropdown.style.right = '120px';
    } else {
      dropdown.style.left = '120px';
    }

    const menuItems = [
      { label: 'מסמך חדש...', shortcut: 'Ctrl+N', action: 'new-document' },
      { label: 'פתח מסמך...', shortcut: 'Ctrl+O', action: 'open-document' },
      { label: 'שמור מסמך', shortcut: 'Ctrl+S', action: 'save-document' },
      { label: 'שמור בשם...', shortcut: 'Ctrl+Shift+S', action: 'save-as' },
      { type: 'separator' },
      { label: 'נרמל ניקוד וטעמים (ת"י 6100)', shortcut: 'Ctrl+Shift+N', action: 'normalize-hebrew' },
      { label: 'מגן שמות קדושים', action: 'shield-divine-names' },
      { label: 'סנכרן גימטריה', action: 'recalculate-gematria' },
      { type: 'separator' },
      { label: 'ייצא לדפוס (ISO PDF/X-1a)...', shortcut: 'Ctrl+E', action: 'export-pdf' }
    ];

    for (const item of menuItems) {
      if (item.type === 'separator') {
        const sep = document.createElement('div');
        sep.style.height = '1px';
        sep.style.background = '#334155';
        sep.style.margin = '4px 0';
        dropdown.appendChild(sep);
        continue;
      }

      const row = document.createElement('div');
      row.style.padding = '7px 14px';
      row.style.fontSize = '12px';
      row.style.color = '#F8FAFC';
      row.style.display = 'flex';
      row.style.alignItems = 'center';
      row.style.justifyContent = 'space-between';
      row.style.cursor = 'pointer';

      row.addEventListener('mouseenter', () => {
        row.style.background = '#2563EB';
      });
      row.addEventListener('mouseleave', () => {
        row.style.background = 'transparent';
      });

      row.innerHTML = `
        <span>${item.label}</span>
        ${item.shortcut ? `<span style="font-size: 10px; color: #94A3B8;">${item.shortcut}</span>` : ''}
      `;

      row.addEventListener('click', () => {
        this.closeDropdown();
        this.callbacks.onMenuAction(item.action!);
      });

      dropdown.appendChild(row);
    }

    this.element.appendChild(dropdown);
    this.activeDropdown = dropdown;
  }

  private closeDropdown(): void {
    if (this.activeDropdown) {
      this.activeDropdown.remove();
      this.activeDropdown = null;
    }
  }
}
