import { ViewMode } from '../types';
import { t, i18n } from '../i18n';
import { renderIcon } from '../icons';

export interface TopSystemBarCallbacks {
  onMenuAction: (action: string, data?: unknown) => void;
  onOpenCommandPalette: () => void;
  onViewModeChange: (mode: ViewMode) => void;
  onExportPdf: () => void;
  onOpenProjects?: () => void;
  onToggleLanguage?: () => void;
  onOpenSettings?: () => void;
  onOpenAbout?: () => void;
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
    brandIcon.style.color = '#3B82F6';
    brandIcon.innerHTML = renderIcon('brand', 18);
    brandWrap.appendChild(brandIcon);

    const brandName = document.createElement('span');
    brandName.textContent = 'TypesetOK';
    brandName.style.fontWeight = '700';
    brandName.style.fontSize = '13px';
    brandName.style.color = '#60A5FA';
    brandName.style.letterSpacing = '-0.2px';
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

    // Unified Project & File Menu Button (Uncluttered)
    const menuBtn = document.createElement('button');
    menuBtn.className = 'tok-btn';
    menuBtn.style.height = '28px';
    menuBtn.style.padding = '0 10px';
    menuBtn.style.fontSize = '12px';
    menuBtn.style.fontWeight = '500';
    menuBtn.style.background = 'var(--tok-bg-surface-2, #1E293B)';
    menuBtn.style.border = '1px solid var(--tok-border-strong, #334155)';
    menuBtn.style.color = '#F1F5F9';
    menuBtn.style.borderRadius = '6px';
    menuBtn.style.cursor = 'pointer';
    menuBtn.style.display = 'inline-flex';
    menuBtn.style.alignItems = 'center';
    menuBtn.style.gap = '6px';
    menuBtn.innerHTML = `${renderIcon('folder', 13)} <span>${t('topBarFileAndMenu')}</span> ${renderIcon('chevronDown', 10)}`;
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

    const modes: { id: ViewMode; label: string; icon: 'canvas' | 'split' | 'story' }[] = [
      { id: 'canvas', label: t('topBarViewCanvas'), icon: 'canvas' },
      { id: 'split', label: t('topBarViewSplit'), icon: 'split' },
      { id: 'story', label: t('topBarViewStory'), icon: 'story' }
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
      modeBtn.style.display = 'inline-flex';
      modeBtn.style.alignItems = 'center';
      modeBtn.style.gap = '5px';
      modeBtn.style.transition = 'all 0.15s';
      modeBtn.innerHTML = `${renderIcon(m.icon, 13)} <span>${m.label}</span>`;

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
      ${renderIcon('search', 13)}
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

    // Settings Button (Prominent & Direct)
    const settingsBtn = document.createElement('button');
    settingsBtn.className = 'tok-btn';
    settingsBtn.style.height = '28px';
    settingsBtn.style.padding = '0 9px';
    settingsBtn.style.fontSize = '12px';
    settingsBtn.style.background = 'var(--tok-bg-surface-2, #1E293B)';
    settingsBtn.style.border = '1px solid var(--tok-border-strong, #334155)';
    settingsBtn.style.color = '#F8FAFC';
    settingsBtn.style.borderRadius = '6px';
    settingsBtn.style.cursor = 'pointer';
    settingsBtn.style.display = 'inline-flex';
    settingsBtn.style.alignItems = 'center';
    settingsBtn.style.gap = '6px';
    settingsBtn.title = t('sidebarSettings');
    settingsBtn.innerHTML = `${renderIcon('settings', 13)} <span>${t('sidebarSettings')}</span>`;
    settingsBtn.addEventListener('click', () => {
      if (this.callbacks.onOpenSettings) this.callbacks.onOpenSettings();
    });
    trailingSide.appendChild(settingsBtn);

    // About Button (Prominent & Direct)
    const aboutBtn = document.createElement('button');
    aboutBtn.className = 'tok-btn';
    aboutBtn.style.height = '28px';
    aboutBtn.style.padding = '0 8px';
    aboutBtn.style.fontSize = '12px';
    aboutBtn.style.background = 'transparent';
    aboutBtn.style.border = '1px solid var(--tok-border-subtle, #334155)';
    aboutBtn.style.color = 'var(--tok-text-secondary, #94A3B8)';
    aboutBtn.style.borderRadius = '6px';
    aboutBtn.style.cursor = 'pointer';
    aboutBtn.style.display = 'inline-flex';
    aboutBtn.style.alignItems = 'center';
    aboutBtn.style.gap = '5px';
    aboutBtn.title = t('sidebarAbout');
    aboutBtn.innerHTML = `${renderIcon('info', 13)} <span>${t('sidebarAbout')}</span>`;
    aboutBtn.addEventListener('click', () => {
      if (this.callbacks.onOpenAbout) this.callbacks.onOpenAbout();
    });
    trailingSide.appendChild(aboutBtn);

    // Language Switcher Button
    const langBtn = document.createElement('button');
    langBtn.className = 'tok-btn';
    langBtn.style.height = '28px';
    langBtn.style.padding = '0 9px';
    langBtn.style.fontSize = '11px';
    langBtn.style.background = 'var(--tok-bg-surface-2, #1E293B)';
    langBtn.style.border = '1px solid var(--tok-border-subtle, #334155)';
    langBtn.style.color = '#CBD5E1';
    langBtn.style.borderRadius = '6px';
    langBtn.style.cursor = 'pointer';
    langBtn.style.display = 'inline-flex';
    langBtn.style.alignItems = 'center';
    langBtn.style.gap = '6px';
    langBtn.innerHTML = `${renderIcon('globe', 13)} <span>${i18n.getLanguage() === 'he' ? 'עברית' : 'English'}</span>`;
    langBtn.title = 'Switch Language / החלף שפה';
    langBtn.addEventListener('click', () => {
      i18n.toggleLanguage();
      if (this.callbacks.onToggleLanguage) this.callbacks.onToggleLanguage();
    });
    trailingSide.appendChild(langBtn);

    // Primary Action: Export Pre-Press PDF
    const exportBtn = document.createElement('button');
    exportBtn.className = 'tok-btn tok-btn-primary';
    exportBtn.style.height = '28px';
    exportBtn.style.padding = '0 12px';
    exportBtn.style.fontSize = '12px';
    exportBtn.style.fontWeight = '600';
    exportBtn.style.borderRadius = '6px';
    exportBtn.style.boxShadow = '0 0 10px rgba(37, 99, 235, 0.4)';
    exportBtn.style.display = 'inline-flex';
    exportBtn.style.alignItems = 'center';
    exportBtn.style.gap = '6px';
    exportBtn.innerHTML = `${renderIcon('export', 13)} <span>${t('topBarExportPdf')}</span>`;
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
    dropdown.style.background = 'var(--tok-bg-elevated, #1E293B)';
    dropdown.style.border = '1px solid var(--tok-border-strong, #334155)';
    dropdown.style.borderRadius = '8px';
    dropdown.style.boxShadow = '0 10px 30px rgba(0,0,0,0.7)';
    dropdown.style.padding = '6px 0';
    dropdown.style.minWidth = '230px';
    dropdown.style.zIndex = '999';

    if (i18n.getLanguage() === 'he') {
      dropdown.style.right = '120px';
    } else {
      dropdown.style.left = '120px';
    }

    const menuItems = [
      { label: 'מרכז פרויקטים ותבניות...', shortcut: 'Ctrl+P', action: 'open-projects' },
      { label: 'הקמת מסמך חדש...', shortcut: 'Ctrl+N', action: 'new-document' },
      { label: 'פתיחת מסמך (.tok)...', shortcut: 'Ctrl+O', action: 'open-document' },
      { label: 'שמירת מסמך', shortcut: 'Ctrl+S', action: 'save-document' },
      { label: 'שמירה בשם...', shortcut: 'Ctrl+Shift+S', action: 'save-as' },
      { type: 'separator' },
      { label: 'נרמול ניקוד וטעמים (ת"י 6100)', shortcut: 'Ctrl+Shift+N', action: 'normalize-hebrew' },
      { label: 'מגן שמות קדושים (איסור שבירה)', action: 'shield-divine-names' },
      { label: 'סנכרון מספור עמודים עברי', action: 'recalculate-gematria' },
      { type: 'separator' },
      { label: 'ייצוא קדם-דפוס (ISO PDF/X-1a)...', shortcut: 'Ctrl+E', action: 'export-pdf' },
      { type: 'separator' },
      { label: 'הגדרות המערכת...', shortcut: 'Ctrl+,', action: 'open-settings' },
      { label: 'אודות TypesetOK...', action: 'open-about' }
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
