import { MultiFlowItem, StyleToken, PageThumbnailItem } from '../types';
import { t, i18n } from '../i18n';

export interface StructureBarCallbacks {
  onSelectPage: (pageIndex: number) => void;
  onAddPage: () => void;
  onSelectFlow: (flowId: string) => void;
  onSelectStyle: (styleId: string) => void;
  onToggleLayer: (layerId: string, visible: boolean) => void;
  onOpenSettings?: () => void;
  onOpenAbout?: () => void;
}

export class StructureBar {
  public element: HTMLElement;
  private callbacks: StructureBarCallbacks;
  private activeTab: 'pages' | 'flows' | 'styles' | 'layers' = 'pages';
  private activePageIndex = 0;
  private activeFlowId = 'gemara';
  private pages: PageThumbnailItem[] = [];
  private contentContainer!: HTMLElement;

  private flows: MultiFlowItem[] = [
    { id: 'gemara', name: 'גמרא (ראשי)', color: '#3B82F6', role: 'מרכז העמוד', wordCount: 2450, isActive: true },
    { id: 'rashi', name: 'רש"י', color: '#10B981', role: 'פירוש פנימי', wordCount: 1180, isActive: false },
    { id: 'tosafot', name: 'תוספות', color: '#F59E0B', role: 'פירוש חיצוני', wordCount: 860, isActive: false },
    { id: 'notes', name: 'הערות שוליים', color: '#8B5CF6', role: 'תחתית העמוד', wordCount: 340, isActive: false }
  ];

  private styles: StyleToken[] = [
    { id: 'style-gemara-heading', name: 'כותרת פרק', fontFamily: 'Vilna', fontSizePt: 20, fontWeight: 'bold', flowId: 'gemara' },
    { id: 'style-gemara-main', name: 'גמרא ראשי', fontFamily: 'Taamey Frank CLM', fontSizePt: 15, fontWeight: 'bold', flowId: 'gemara' },
    { id: 'style-rashi-body', name: 'רש"י רציף', fontFamily: 'Rashi', fontSizePt: 12, fontWeight: 'normal', flowId: 'rashi' },
    { id: 'style-tosafot-body', name: 'תוספות רציף', fontFamily: 'Rashi', fontSizePt: 11.5, fontWeight: 'normal', flowId: 'tosafot' },
    { id: 'style-dibur-hamatchil', name: 'דיבור המתחיל', fontFamily: 'David CLM', fontSizePt: 12.5, fontWeight: 'bold', flowId: 'rashi' },
    { id: 'style-footnotes', name: 'הערות שוליים', fontFamily: 'Taamey Frank CLM', fontSizePt: 10, fontWeight: 'normal', flowId: 'notes' }
  ];

  private layers: { id: string; name: string; visible: boolean; locked: boolean }[] = [
    { id: 'text-main', name: 'שכבת טקסט ראשי', visible: true, locked: false },
    { id: 'text-commentary', name: 'שכבת פירושים', visible: true, locked: false },
    { id: 'decorations', name: 'עיטורים ומסגרות', visible: true, locked: false },
    { id: 'guides', name: 'קווי עזר ושוליים', visible: true, locked: true }
  ];

  constructor(callbacks: StructureBarCallbacks) {
    this.callbacks = callbacks;
    this.element = document.createElement('aside');
    this.element.className = 'tok-structure-bar';
    this.element.dir = i18n.getLanguage() === 'he' ? 'rtl' : 'ltr';
    this.element.style.width = 'var(--tok-structure-width)';
    this.element.style.minWidth = 'var(--tok-structure-width)';
    this.element.style.background = 'var(--tok-bg-surface-1)';
    this.element.style.borderLeft = i18n.getLanguage() === 'he' ? '1px solid var(--tok-border-subtle)' : 'none';
    this.element.style.borderRight = i18n.getLanguage() === 'en' ? '1px solid var(--tok-border-subtle)' : 'none';
    this.element.style.display = 'flex';
    this.element.style.flexDirection = 'column';
    this.element.style.overflow = 'hidden';
    this.element.style.userSelect = 'none';

    i18n.onChange((lang) => {
      this.element.dir = lang === 'he' ? 'rtl' : 'ltr';
      this.element.style.borderLeft = lang === 'he' ? '1px solid var(--tok-border-subtle)' : 'none';
      this.element.style.borderRight = lang === 'en' ? '1px solid var(--tok-border-subtle)' : 'none';
      this.render();
    });

    this.render();
  }

  public setPages(pages: PageThumbnailItem[], activeIndex = 0): void {
    this.pages = pages;
    this.activePageIndex = activeIndex;
    if (this.activeTab === 'pages') {
      this.renderTabContent();
    }
  }

  public setActivePage(pageIndex: number): void {
    this.activePageIndex = pageIndex;
    if (this.activeTab === 'pages') {
      this.highlightActivePageCard();
    }
  }

  private render(): void {
    this.element.innerHTML = '';

    // 1. Tab Bar Header
    const tabHeader = document.createElement('div');
    tabHeader.style.display = 'flex';
    tabHeader.style.borderBottom = '1px solid var(--tok-border-subtle)';
    tabHeader.style.background = 'var(--tok-bg-app)';
    tabHeader.style.flexShrink = '0';

    const tabs: { id: 'pages' | 'flows' | 'styles' | 'layers'; label: string; icon: string }[] = [
      { id: 'pages', label: t('sidebarPages'), icon: '📄' },
      { id: 'flows', label: t('sidebarFlows'), icon: '🌊' },
      { id: 'styles', label: t('sidebarStyles'), icon: '🔤' },
      { id: 'layers', label: t('sidebarLayers'), icon: '📑' }
    ];

    for (const tItem of tabs) {
      const tabBtn = document.createElement('button');
      tabBtn.style.flex = '1';
      tabBtn.style.padding = '8px 4px';
      tabBtn.style.background = this.activeTab === tItem.id ? 'var(--tok-bg-surface-1)' : 'transparent';
      tabBtn.style.color = this.activeTab === tItem.id ? '#FFFFFF' : 'var(--tok-text-secondary)';
      tabBtn.style.border = 'none';
      tabBtn.style.borderBottom = this.activeTab === tItem.id ? '2px solid var(--tok-accent-primary)' : '2px solid transparent';
      tabBtn.style.cursor = 'pointer';
      tabBtn.style.fontSize = '11px';
      tabBtn.style.fontWeight = this.activeTab === tItem.id ? '600' : 'normal';
      tabBtn.innerHTML = `<span>${tItem.icon}</span> <span>${tItem.label}</span>`;

      tabBtn.addEventListener('click', () => {
        this.activeTab = tItem.id;
        this.render();
      });

      tabHeader.appendChild(tabBtn);
    }
    this.element.appendChild(tabHeader);

    // 2. Tab Content Area (fills available space)
    const bodyWrapper = document.createElement('div');
    bodyWrapper.className = 'tok-structure-body';
    bodyWrapper.style.flex = '1';
    bodyWrapper.style.overflowY = 'auto';
    bodyWrapper.style.padding = '10px';
    this.element.appendChild(bodyWrapper);

    // 3. Bottom Spacer & Bottom Section (Settings & About)
    const bottomSection = document.createElement('div');
    bottomSection.className = 'tok-structure-bottom';
    bottomSection.style.flexShrink = '0';
    bottomSection.style.borderTop = '1px solid var(--tok-border-subtle)';
    bottomSection.style.background = 'var(--tok-bg-app)';
    bottomSection.style.padding = '8px 10px';
    bottomSection.style.display = 'flex';
    bottomSection.style.flexDirection = 'column';
    bottomSection.style.gap = '4px';

    // Settings Button
    const settingsBtn = document.createElement('button');
    settingsBtn.className = 'tok-btn';
    settingsBtn.style.width = '100%';
    settingsBtn.style.height = '30px';
    settingsBtn.style.display = 'flex';
    settingsBtn.style.alignItems = 'center';
    settingsBtn.style.justifyContent = 'flex-start';
    settingsBtn.style.gap = '8px';
    settingsBtn.style.fontSize = '12px';
    settingsBtn.style.background = 'transparent';
    settingsBtn.style.border = '1px solid transparent';
    settingsBtn.style.color = 'var(--tok-text-secondary)';
    settingsBtn.style.cursor = 'pointer';
    settingsBtn.style.padding = '0 10px';
    settingsBtn.style.borderRadius = '6px';
    settingsBtn.style.transition = 'all 0.15s';
    settingsBtn.innerHTML = `<span>⚙️</span><span>${t('sidebarSettings')}</span>`;

    settingsBtn.addEventListener('mouseenter', () => {
      settingsBtn.style.background = 'var(--tok-bg-surface-2)';
      settingsBtn.style.color = '#FFFFFF';
      settingsBtn.style.borderColor = 'var(--tok-border-subtle)';
    });
    settingsBtn.addEventListener('mouseleave', () => {
      settingsBtn.style.background = 'transparent';
      settingsBtn.style.color = 'var(--tok-text-secondary)';
      settingsBtn.style.borderColor = 'transparent';
    });
    settingsBtn.addEventListener('click', () => {
      if (this.callbacks.onOpenSettings) this.callbacks.onOpenSettings();
    });
    bottomSection.appendChild(settingsBtn);

    // About Button
    const aboutBtn = document.createElement('button');
    aboutBtn.className = 'tok-btn';
    aboutBtn.style.width = '100%';
    aboutBtn.style.height = '30px';
    aboutBtn.style.display = 'flex';
    aboutBtn.style.alignItems = 'center';
    aboutBtn.style.justifyContent = 'flex-start';
    aboutBtn.style.gap = '8px';
    aboutBtn.style.fontSize = '12px';
    aboutBtn.style.background = 'transparent';
    aboutBtn.style.border = '1px solid transparent';
    aboutBtn.style.color = 'var(--tok-text-secondary)';
    aboutBtn.style.cursor = 'pointer';
    aboutBtn.style.padding = '0 10px';
    aboutBtn.style.borderRadius = '6px';
    aboutBtn.style.transition = 'all 0.15s';
    aboutBtn.innerHTML = `<span>ℹ️</span><span>${t('sidebarAbout')}</span>`;

    aboutBtn.addEventListener('mouseenter', () => {
      aboutBtn.style.background = 'var(--tok-bg-surface-2)';
      aboutBtn.style.color = '#FFFFFF';
      aboutBtn.style.borderColor = 'var(--tok-border-subtle)';
    });
    aboutBtn.addEventListener('mouseleave', () => {
      aboutBtn.style.background = 'transparent';
      aboutBtn.style.color = 'var(--tok-text-secondary)';
      aboutBtn.style.borderColor = 'transparent';
    });
    aboutBtn.addEventListener('click', () => {
      if (this.callbacks.onOpenAbout) this.callbacks.onOpenAbout();
    });
    bottomSection.appendChild(aboutBtn);

    this.element.appendChild(bottomSection);

    this.renderTabContent();
  }

  private renderTabContent(): void {
    const body = this.element.querySelector('.tok-structure-body') as HTMLElement;
    if (!body) return;
    body.innerHTML = '';

    switch (this.activeTab) {
      case 'pages':
        this.renderPagesView(body);
        break;
      case 'flows':
        this.renderFlowsView(body);
        break;
      case 'styles':
        this.renderStylesView(body);
        break;
      case 'layers':
        this.renderLayersView(body);
        break;
    }
  }

  private renderPagesView(container: HTMLElement): void {
    // Action bar: Header + Add Page
    const headerRow = document.createElement('div');
    headerRow.style.display = 'flex';
    headerRow.style.alignItems = 'center';
    headerRow.style.justifyContent = 'space-between';
    headerRow.style.marginBottom = '10px';

    const countLabel = document.createElement('span');
    countLabel.style.fontSize = '12px';
    countLabel.style.fontWeight = 'bold';
    countLabel.style.color = 'var(--tok-text-primary)';
    countLabel.textContent = `עמודי הספר (${this.pages.length})`;
    headerRow.appendChild(countLabel);

    const addBtn = document.createElement('button');
    addBtn.className = 'tok-btn tok-btn-primary';
    addBtn.style.height = '24px';
    addBtn.style.fontSize = '11px';
    addBtn.style.padding = '0 8px';
    addBtn.textContent = '+ עמוד חדש';
    addBtn.title = 'הוסף עמוד לספר (Ctrl+Enter)';
    addBtn.addEventListener('click', () => this.callbacks.onAddPage());
    headerRow.appendChild(addBtn);

    container.appendChild(headerRow);

    // Grid of Thumbnail Cards
    const list = document.createElement('div');
    list.className = 'tok-pages-list';
    list.style.display = 'flex';
    list.style.flexDirection = 'column';
    list.style.gap = '8px';

    this.pages.forEach((p) => {
      const card = document.createElement('div');
      card.className = 'tok-page-card';
      card.dataset.pageIndex = p.pageIndex.toString();
      card.style.background = p.pageIndex === this.activePageIndex ? 'var(--tok-bg-surface-hover)' : 'var(--tok-bg-surface-2)';
      card.style.border = p.pageIndex === this.activePageIndex ? '1px solid var(--tok-selection-frame)' : '1px solid var(--tok-border-strong)';
      card.style.borderRadius = '6px';
      card.style.padding = '8px 10px';
      card.style.cursor = 'pointer';
      card.style.display = 'flex';
      card.style.alignItems = 'center';
      card.style.justifyContent = 'space-between';
      card.style.transition = 'all 0.15s ease';

      card.addEventListener('mouseenter', () => {
        if (p.pageIndex !== this.activePageIndex) card.style.borderColor = '#60A5FA';
      });
      card.addEventListener('mouseleave', () => {
        if (p.pageIndex !== this.activePageIndex) card.style.borderColor = 'var(--tok-border-strong)';
      });

      card.addEventListener('click', () => {
        this.activePageIndex = p.pageIndex;
        this.highlightActivePageCard();
        this.callbacks.onSelectPage(p.pageIndex);
      });

      const infoWrap = document.createElement('div');
      infoWrap.style.display = 'flex';
      infoWrap.style.flexDirection = 'column';
      infoWrap.style.gap = '2px';

      const title = document.createElement('span');
      title.style.fontSize = '13px';
      title.style.fontWeight = 'bold';
      title.style.color = p.pageIndex === this.activePageIndex ? '#60A5FA' : '#FFFFFF';
      title.textContent = p.label || `דף ${p.gematria}`;
      infoWrap.appendChild(title);

      const subtitle = document.createElement('span');
      subtitle.style.fontSize = '11px';
      subtitle.style.color = 'var(--tok-text-muted)';
      subtitle.textContent = `עמ' ${p.pageIndex + 1} • ${p.isSpreadRight ? 'כפולה ימנית (ע"א)' : 'כפולה שמאלית (ע"ב)'}`;
      infoWrap.appendChild(subtitle);

      card.appendChild(infoWrap);

      const badge = document.createElement('span');
      badge.style.fontSize = '11px';
      badge.style.background = '#1E293B';
      badge.style.color = '#94A3B8';
      badge.style.padding = '2px 6px';
      badge.style.borderRadius = '4px';
      badge.textContent = p.gematria;
      card.appendChild(badge);

      list.appendChild(card);
    });

    container.appendChild(list);
  }

  private highlightActivePageCard(): void {
    const cards = this.element.querySelectorAll<HTMLElement>('.tok-page-card');
    cards.forEach((card) => {
      const idx = parseInt(card.dataset.pageIndex || '-1', 10);
      const isActive = idx === this.activePageIndex;
      card.style.background = isActive ? 'var(--tok-bg-surface-hover)' : 'var(--tok-bg-surface-2)';
      card.style.borderColor = isActive ? 'var(--tok-selection-frame)' : 'var(--tok-border-strong)';
      const title = card.querySelector('span');
      if (title) {
        title.style.color = isActive ? '#60A5FA' : '#FFFFFF';
      }
    });
  }

  private renderFlowsView(container: HTMLElement): void {
    const title = document.createElement('div');
    title.style.fontSize = '12px';
    title.style.fontWeight = 'bold';
    title.style.marginBottom = '8px';
    title.textContent = 'תזרימים מקבילים (Multi-Flow)';
    container.appendChild(title);

    const desc = document.createElement('p');
    desc.style.fontSize = '11px';
    desc.style.color = 'var(--tok-text-muted)';
    desc.style.marginBottom = '12px';
    desc.textContent = 'מנוע סנכרון רב-תזרימי תורני: כל תזרים מוזרם באזור מוגדר בעמוד.';
    container.appendChild(desc);

    for (const f of this.flows) {
      const item = document.createElement('div');
      item.style.background = f.id === this.activeFlowId ? 'var(--tok-bg-surface-hover)' : 'var(--tok-bg-surface-2)';
      item.style.border = f.id === this.activeFlowId ? `1px solid ${f.color}` : '1px solid var(--tok-border-strong)';
      item.style.borderRadius = '6px';
      item.style.padding = '10px';
      item.style.marginBottom = '8px';
      item.style.cursor = 'pointer';

      item.addEventListener('click', () => {
        this.activeFlowId = f.id;
        this.flows.forEach((flow) => (flow.isActive = flow.id === f.id));
        this.renderTabContent();
        this.callbacks.onSelectFlow(f.id);
      });

      const topRow = document.createElement('div');
      topRow.style.display = 'flex';
      topRow.style.alignItems = 'center';
      topRow.style.justifyContent = 'space-between';
      topRow.style.marginBottom = '4px';

      const nameWrap = document.createElement('div');
      nameWrap.style.display = 'flex';
      nameWrap.style.alignItems = 'center';
      nameWrap.style.gap = '8px';

      const dot = document.createElement('span');
      dot.style.width = '10px';
      dot.style.height = '10px';
      dot.style.borderRadius = '50%';
      dot.style.background = f.color;
      nameWrap.appendChild(dot);

      const name = document.createElement('span');
      name.style.fontWeight = 'bold';
      name.style.fontSize = '12px';
      name.textContent = f.name;
      nameWrap.appendChild(name);

      topRow.appendChild(nameWrap);

      const words = document.createElement('span');
      words.style.fontSize = '11px';
      words.style.color = 'var(--tok-text-muted)';
      words.textContent = `${f.wordCount.toLocaleString()} מילים`;
      topRow.appendChild(words);

      item.appendChild(topRow);

      const role = document.createElement('div');
      role.style.fontSize = '11px';
      role.style.color = 'var(--tok-text-secondary)';
      role.textContent = `מיקום: ${f.role}`;
      item.appendChild(role);

      container.appendChild(item);
    }
  }

  private renderStylesView(container: HTMLElement): void {
    const title = document.createElement('div');
    title.style.fontSize = '12px';
    title.style.fontWeight = 'bold';
    title.style.marginBottom = '8px';
    title.textContent = 'סגנונות מסמך (Style Tokens)';
    container.appendChild(title);

    for (const s of this.styles) {
      const card = document.createElement('div');
      card.style.background = 'var(--tok-bg-surface-2)';
      card.style.border = '1px solid var(--tok-border-strong)';
      card.style.borderRadius = '6px';
      card.style.padding = '8px 10px';
      card.style.marginBottom = '6px';
      card.style.cursor = 'pointer';

      card.addEventListener('mouseenter', () => (card.style.borderColor = 'var(--tok-accent-primary)'));
      card.addEventListener('mouseleave', () => (card.style.borderColor = 'var(--tok-border-strong)'));
      card.addEventListener('click', () => this.callbacks.onSelectStyle(s.id));

      const row = document.createElement('div');
      row.style.display = 'flex';
      row.style.alignItems = 'center';
      row.style.justifyContent = 'space-between';

      const name = document.createElement('span');
      name.style.fontWeight = 'bold';
      name.style.fontSize = '12px';
      name.textContent = s.name;
      row.appendChild(name);

      const spec = document.createElement('span');
      spec.style.fontSize = '11px';
      spec.style.color = 'var(--tok-text-muted)';
      spec.textContent = `${s.fontFamily} ${s.fontSizePt}pt`;
      row.appendChild(spec);

      card.appendChild(row);
      container.appendChild(card);
    }
  }

  private renderLayersView(container: HTMLElement): void {
    const title = document.createElement('div');
    title.style.fontSize = '12px';
    title.style.fontWeight = 'bold';
    title.style.marginBottom = '10px';
    title.textContent = 'שכבות עבודה';
    container.appendChild(title);

    for (const l of this.layers) {
      const row = document.createElement('div');
      row.style.display = 'flex';
      row.style.alignItems = 'center';
      row.style.justifyContent = 'space-between';
      row.style.padding = '8px 10px';
      row.style.background = 'var(--tok-bg-surface-2)';
      row.style.border = '1px solid var(--tok-border-strong)';
      row.style.borderRadius = '6px';
      row.style.marginBottom = '6px';

      const nameWrap = document.createElement('div');
      nameWrap.style.display = 'flex';
      nameWrap.style.alignItems = 'center';
      nameWrap.style.gap = '8px';

      const eye = document.createElement('button');
      eye.style.background = 'transparent';
      eye.style.border = 'none';
      eye.style.cursor = 'pointer';
      eye.style.fontSize = '14px';
      eye.textContent = l.visible ? '👁' : '🚫';
      eye.title = l.visible ? 'הסתר שכבה' : 'הצג שכבה';
      eye.addEventListener('click', () => {
        l.visible = !l.visible;
        eye.textContent = l.visible ? '👁' : '🚫';
        this.callbacks.onToggleLayer(l.id, l.visible);
      });
      nameWrap.appendChild(eye);

      const name = document.createElement('span');
      name.style.fontSize = '12px';
      name.textContent = l.name;
      nameWrap.appendChild(name);

      row.appendChild(nameWrap);

      const lock = document.createElement('button');
      lock.style.background = 'transparent';
      lock.style.border = 'none';
      lock.style.cursor = 'pointer';
      lock.style.fontSize = '13px';
      lock.textContent = l.locked ? '🔒' : '🔓';
      lock.title = l.locked ? 'שחרר נעילת שכבה' : 'נעל שכבה';
      lock.addEventListener('click', () => {
        l.locked = !l.locked;
        lock.textContent = l.locked ? '🔒' : '🔓';
      });
      row.appendChild(lock);

      container.appendChild(row);
    }
  }
}
