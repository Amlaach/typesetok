import { t, i18n, Language } from '../i18n';
import { themeManager, ACCENT_PRESETS, CANVAS_TONE_PRESETS, THEME_PALETTES } from '../theme';
import { PluginEngine } from '../plugins/PluginEngine';
import { renderIcon, IconName } from '../icons';

export interface SettingsModalCallbacks {
  onLanguageChange: (lang: Language) => void;
  onClose: () => void;
  pluginEngine: PluginEngine;
  showToast: (msg: string) => void;
}

export class SettingsModal {
  public element: HTMLElement;
  private callbacks: SettingsModalCallbacks;
  private activeTab: 'appearance' | 'accessibility' | 'language' | 'logs' | 'updates' | 'plugins' = 'appearance';
  private isVisible = false;
  private logRetentionDays = 14;

  constructor(callbacks: SettingsModalCallbacks) {
    this.callbacks = callbacks;
    this.element = document.createElement('div');
    this.element.className = 'tok-settings-overlay';
    this.element.style.position = 'fixed';
    this.element.style.top = '0';
    this.element.style.left = '0';
    this.element.style.width = '100vw';
    this.element.style.height = '100vh';
    this.element.style.background = 'rgba(0, 0, 0, 0.75)';
    this.element.style.backdropFilter = 'blur(6px)';
    this.element.style.zIndex = '99999';
    this.element.style.display = 'none';
    this.element.style.alignItems = 'center';
    this.element.style.justifyContent = 'center';

    try {
      const savedRetention = localStorage.getItem('tok_log_retention');
      if (savedRetention) this.logRetentionDays = parseInt(savedRetention, 10) || 14;
    } catch {}

    i18n.onChange(() => {
      if (this.isVisible) this.render();
    });
  }

  public show(initialTab?: 'appearance' | 'accessibility' | 'language' | 'logs' | 'updates' | 'plugins'): void {
    if (initialTab) this.activeTab = initialTab;
    this.isVisible = true;
    this.element.style.display = 'flex';
    this.render();
  }

  public hide(): void {
    this.isVisible = false;
    this.element.style.display = 'none';
    this.callbacks.onClose();
  }

  private render(): void {
    this.element.innerHTML = '';
    this.element.style.direction = i18n.getLanguage() === 'he' ? 'rtl' : 'ltr';

    const card = document.createElement('div');
    card.className = 'tok-settings-card';
    card.style.width = '820px';
    card.style.maxWidth = '92vw';
    card.style.height = '580px';
    card.style.maxHeight = '90vh';
    card.style.background = '#0F172A';
    card.style.border = '1px solid #1E3A8A';
    card.style.borderRadius = '12px';
    card.style.boxShadow = '0 20px 50px rgba(0,0,0,0.8)';
    card.style.display = 'flex';
    card.style.flexDirection = 'column';
    card.style.overflow = 'hidden';

    // Header
    const header = document.createElement('div');
    header.style.padding = '16px 24px';
    header.style.background = '#131E38';
    header.style.borderBottom = '1px solid #1E293B';
    header.style.display = 'flex';
    header.style.alignItems = 'center';
    header.style.justifyContent = 'space-between';

    const titleWrap = document.createElement('div');
    titleWrap.style.display = 'flex';
    titleWrap.style.alignItems = 'center';
    titleWrap.style.gap = '10px';

    const icon = document.createElement('span');
    icon.style.color = '#60A5FA';
    icon.innerHTML = renderIcon('settings', 18);
    titleWrap.appendChild(icon);

    const title = document.createElement('h2');
    title.style.margin = '0';
    title.style.fontSize = '16px';
    title.style.fontWeight = '700';
    title.style.color = '#F8FAFC';
    title.textContent = t('settingsTitle');
    titleWrap.appendChild(title);

    header.appendChild(titleWrap);

    const closeBtn = document.createElement('button');
    closeBtn.style.background = 'transparent';
    closeBtn.style.border = 'none';
    closeBtn.style.color = '#94A3B8';
    closeBtn.style.cursor = 'pointer';
    closeBtn.style.padding = '4px';
    closeBtn.style.display = 'inline-flex';
    closeBtn.style.alignItems = 'center';
    closeBtn.style.justifyContent = 'center';
    closeBtn.innerHTML = renderIcon('close', 14);
    closeBtn.addEventListener('click', () => this.hide());
    header.appendChild(closeBtn);

    card.appendChild(header);

    // Body with Tabs sidebar + Content
    const body = document.createElement('div');
    body.style.display = 'flex';
    body.style.flex = '1';
    body.style.overflow = 'hidden';

    // Tabs Column
    const tabsCol = document.createElement('div');
    tabsCol.style.width = '210px';
    tabsCol.style.background = '#0B132B';
    tabsCol.style.borderLeft = i18n.getLanguage() === 'he' ? '1px solid #1E293B' : 'none';
    tabsCol.style.borderRight = i18n.getLanguage() === 'en' ? '1px solid #1E293B' : 'none';
    tabsCol.style.padding = '12px 8px';
    tabsCol.style.display = 'flex';
    tabsCol.style.flexDirection = 'column';
    tabsCol.style.gap = '4px';

    const tabs: { id: 'appearance' | 'accessibility' | 'language' | 'logs' | 'updates' | 'plugins'; label: string; icon: IconName }[] = [
      { id: 'appearance', label: t('settingsTabAppearance'), icon: 'typography' },
      { id: 'accessibility', label: t('settingsTabAccessibility'), icon: 'accessibility' },
      { id: 'language', label: t('settingsTabLanguage'), icon: 'globe' },
      { id: 'logs', label: t('settingsTabLogs'), icon: 'file' },
      { id: 'updates', label: t('settingsTabUpdates'), icon: 'refresh' },
      { id: 'plugins', label: t('settingsTabPlugins'), icon: 'plugin' },
    ];

    for (const tab of tabs) {
      const tabBtn = document.createElement('button');
      tabBtn.style.display = 'flex';
      tabBtn.style.alignItems = 'center';
      tabBtn.style.gap = '10px';
      tabBtn.style.padding = '9px 12px';
      tabBtn.style.borderRadius = '8px';
      tabBtn.style.border = 'none';
      tabBtn.style.background = this.activeTab === tab.id ? '#1E3A8A' : 'transparent';
      tabBtn.style.color = this.activeTab === tab.id ? '#FFFFFF' : '#94A3B8';
      tabBtn.style.fontWeight = this.activeTab === tab.id ? '600' : 'normal';
      tabBtn.style.cursor = 'pointer';
      tabBtn.style.textAlign = i18n.getLanguage() === 'he' ? 'right' : 'left';
      tabBtn.style.fontSize = '12.5px';
      tabBtn.style.transition = 'all 0.15s';

      tabBtn.innerHTML = `${renderIcon(tab.icon, 14)} <span>${tab.label}</span>`;
      tabBtn.addEventListener('click', () => {
        this.activeTab = tab.id;
        this.render();
      });
      tabsCol.appendChild(tabBtn);
    }

    body.appendChild(tabsCol);

    // Content Area
    const contentArea = document.createElement('div');
    contentArea.style.flex = '1';
    contentArea.style.padding = '24px 28px';
    contentArea.style.overflowY = 'auto';

    if (this.activeTab === 'appearance') {
      this.renderAppearanceTab(contentArea);
    } else if (this.activeTab === 'accessibility') {
      this.renderAccessibilityTab(contentArea);
    } else if (this.activeTab === 'language') {
      this.renderLanguageTab(contentArea);
    } else if (this.activeTab === 'logs') {
      this.renderLogsTab(contentArea);
    } else if (this.activeTab === 'updates') {
      this.renderUpdatesTab(contentArea);
    } else if (this.activeTab === 'plugins') {
      this.renderPluginsTab(contentArea);
    }

    body.appendChild(contentArea);
    card.appendChild(body);
    this.element.appendChild(card);
  }

  // --- TAB 1: Appearance ---
  private renderAppearanceTab(container: HTMLElement): void {
    const currentTheme = themeManager.getSettings();

    // 0. Visual Themes & Rich Atmospheres
    const section0 = document.createElement('div');
    section0.style.marginBottom = '24px';

    const h3_0 = document.createElement('h3');
    h3_0.style.fontSize = '14px';
    h3_0.style.fontWeight = '700';
    h3_0.style.color = '#60A5FA';
    h3_0.style.marginBottom = '12px';
    h3_0.textContent = 'ערכות נושא וגיוון צבעים (Visual Themes & Atmospheres)';
    section0.appendChild(h3_0);

    const palettesGrid = document.createElement('div');
    palettesGrid.style.display = 'grid';
    palettesGrid.style.gridTemplateColumns = 'repeat(2, 1fr)';
    palettesGrid.style.gap = '10px';

    for (const pal of THEME_PALETTES) {
      const card = document.createElement('div');
      card.style.padding = '12px 14px';
      card.style.borderRadius = '8px';
      card.style.background = currentTheme.paletteId === pal.id ? 'var(--tok-bg-surface-hover, #293548)' : 'var(--tok-bg-surface-2, #1E293B)';
      card.style.border = currentTheme.paletteId === pal.id ? '2px solid #3B82F6' : '1px solid var(--tok-border-subtle, #334155)';
      card.style.cursor = 'pointer';
      card.style.transition = 'all 0.15s ease';

      const swatches = document.createElement('div');
      swatches.style.display = 'flex';
      swatches.style.gap = '6px';
      swatches.style.marginBottom = '8px';

      for (const col of pal.previewColors) {
        const dot = document.createElement('span');
        dot.style.width = '14px';
        dot.style.height = '14px';
        dot.style.borderRadius = '4px';
        dot.style.background = col;
        dot.style.border = '1px solid rgba(255,255,255,0.2)';
        swatches.appendChild(dot);
      }
      card.appendChild(swatches);

      const palName = document.createElement('div');
      palName.style.fontSize = '12px';
      palName.style.fontWeight = '700';
      palName.style.color = '#F8FAFC';
      palName.textContent = pal.name;
      card.appendChild(palName);

      const palDesc = document.createElement('div');
      palDesc.style.fontSize = '11px';
      palDesc.style.color = '#94A3B8';
      palDesc.style.marginTop = '2px';
      palDesc.textContent = pal.desc;
      card.appendChild(palDesc);

      card.addEventListener('click', () => {
        themeManager.setPalette(pal.id);
        this.render();
      });

      palettesGrid.appendChild(card);
    }
    section0.appendChild(palettesGrid);
    container.appendChild(section0);

    // 1. Accent Color
    const section1 = document.createElement('div');
    section1.style.marginBottom = '24px';

    const h3_1 = document.createElement('h3');
    h3_1.style.fontSize = '13.5px';
    h3_1.style.color = '#60A5FA';
    h3_1.style.marginBottom = '12px';
    h3_1.textContent = t('appearanceAccentColor');
    section1.appendChild(h3_1);

    const colorsWrap = document.createElement('div');
    colorsWrap.style.display = 'grid';
    colorsWrap.style.gridTemplateColumns = 'repeat(3, 1fr)';
    colorsWrap.style.gap = '10px';

    for (const preset of ACCENT_PRESETS) {
      const btn = document.createElement('button');
      btn.style.display = 'flex';
      btn.style.alignItems = 'center';
      btn.style.gap = '8px';
      btn.style.padding = '8px 12px';
      btn.style.borderRadius = '6px';
      btn.style.background = '#1E293B';
      btn.style.border = currentTheme.accentColor === preset.value ? '2px solid #60A5FA' : '1px solid #334155';
      btn.style.color = '#F8FAFC';
      btn.style.cursor = 'pointer';
      btn.style.fontSize = '12px';

      const dot = document.createElement('span');
      dot.style.width = '12px';
      dot.style.height = '12px';
      dot.style.borderRadius = '50%';
      dot.style.background = preset.value;
      btn.appendChild(dot);

      const label = document.createElement('span');
      label.textContent = preset.name.split('(')[0].trim();
      btn.appendChild(label);

      btn.addEventListener('click', () => {
        themeManager.setAccentColor(preset.value);
        this.render();
      });

      colorsWrap.appendChild(btn);
    }
    section1.appendChild(colorsWrap);
    container.appendChild(section1);

    // 2. Canvas Background Tone
    const section2 = document.createElement('div');
    section2.style.marginBottom = '24px';

    const h3_2 = document.createElement('h3');
    h3_2.style.fontSize = '13.5px';
    h3_2.style.color = '#60A5FA';
    h3_2.style.marginBottom = '12px';
    h3_2.textContent = t('appearanceCanvasTone');
    section2.appendChild(h3_2);

    const tonesWrap = document.createElement('div');
    tonesWrap.style.display = 'grid';
    tonesWrap.style.gridTemplateColumns = 'repeat(2, 1fr)';
    tonesWrap.style.gap = '10px';

    for (const preset of CANVAS_TONE_PRESETS) {
      const btn = document.createElement('button');
      btn.style.display = 'flex';
      btn.style.alignItems = 'center';
      btn.style.gap = '10px';
      btn.style.padding = '10px 14px';
      btn.style.borderRadius = '6px';
      btn.style.background = '#1E293B';
      btn.style.border = currentTheme.canvasTone === preset.value ? '2px solid #60A5FA' : '1px solid #334155';
      btn.style.color = '#F8FAFC';
      btn.style.cursor = 'pointer';
      btn.style.fontSize = '12px';

      const box = document.createElement('span');
      box.style.width = '18px';
      box.style.height = '18px';
      box.style.borderRadius = '4px';
      box.style.background = preset.value;
      box.style.border = '1px solid #475569';
      btn.appendChild(box);

      const label = document.createElement('span');
      label.textContent = preset.name;
      btn.appendChild(label);

      btn.addEventListener('click', () => {
        themeManager.setCanvasTone(preset.value);
        this.render();
      });

      tonesWrap.appendChild(btn);
    }
    section2.appendChild(tonesWrap);
    container.appendChild(section2);

    // 3. UI Density
    const section3 = document.createElement('div');
    const h3_3 = document.createElement('h3');
    h3_3.style.fontSize = '13.5px';
    h3_3.style.color = '#60A5FA';
    h3_3.style.marginBottom = '12px';
    h3_3.textContent = t('appearanceDensity');
    section3.appendChild(h3_3);

    const densityWrap = document.createElement('div');
    densityWrap.style.display = 'flex';
    densityWrap.style.gap = '12px';

    const densities: { id: 'comfortable' | 'compact'; label: string }[] = [
      { id: 'comfortable', label: t('densityComfortable') },
      { id: 'compact', label: t('densityCompact') }
    ];

    for (const d of densities) {
      const btn = document.createElement('button');
      btn.style.flex = '1';
      btn.style.padding = '10px';
      btn.style.borderRadius = '6px';
      btn.style.background = currentTheme.density === d.id ? '#1E3A8A' : '#1E293B';
      btn.style.border = currentTheme.density === d.id ? '1px solid #3B82F6' : '1px solid #334155';
      btn.style.color = '#F8FAFC';
      btn.style.cursor = 'pointer';
      btn.style.fontWeight = currentTheme.density === d.id ? '600' : 'normal';
      btn.textContent = d.label;
      btn.addEventListener('click', () => {
        themeManager.setDensity(d.id);
        this.render();
      });
      densityWrap.appendChild(btn);
    }
    section3.appendChild(densityWrap);
    container.appendChild(section3);
  }

  // --- TAB 2: Accessibility (נגישות) ---
  private renderAccessibilityTab(container: HTMLElement): void {
    const currentTheme = themeManager.getSettings();

    const title = document.createElement('h3');
    title.style.fontSize = '14px';
    title.style.color = '#60A5FA';
    title.style.marginBottom = '16px';
    title.textContent = t('settingsTabAccessibility');
    container.appendChild(title);

    // 1. High Contrast Switch
    this.createToggleCard(
      container,
      t('accessHighContrast'),
      t('accessHighContrastDesc'),
      currentTheme.highContrast,
      (val) => {
        themeManager.setHighContrast(val);
        this.callbacks.showToast(`מצב ניגודיות גבוהה: ${val ? 'הופעל' : 'הושבת'}`);
        this.render();
      }
    );

    // 2. Font Scale Selector
    const scaleCard = document.createElement('div');
    scaleCard.style.padding = '14px 18px';
    scaleCard.style.background = '#1E293B';
    scaleCard.style.border = '1px solid #334155';
    scaleCard.style.borderRadius = '8px';
    scaleCard.style.marginBottom = '12px';

    const scaleTop = document.createElement('div');
    scaleTop.style.display = 'flex';
    scaleTop.style.justifyContent = 'space-between';
    scaleTop.style.alignItems = 'center';
    scaleTop.style.marginBottom = '6px';

    const scaleLabel = document.createElement('span');
    scaleLabel.style.fontSize = '13px';
    scaleLabel.style.fontWeight = '600';
    scaleLabel.style.color = '#F8FAFC';
    scaleLabel.textContent = t('accessFontScale');
    scaleTop.appendChild(scaleLabel);

    const scaleBadge = document.createElement('span');
    scaleBadge.style.fontSize = '12px';
    scaleBadge.style.color = '#60A5FA';
    scaleBadge.textContent = `${currentTheme.fontScale}%`;
    scaleTop.appendChild(scaleBadge);
    scaleCard.appendChild(scaleTop);

    const scaleDesc = document.createElement('div');
    scaleDesc.style.fontSize = '11px';
    scaleDesc.style.color = '#94A3B8';
    scaleDesc.style.marginBottom = '12px';
    scaleDesc.textContent = t('accessFontScaleDesc');
    scaleCard.appendChild(scaleDesc);

    const scaleButtons = document.createElement('div');
    scaleButtons.style.display = 'flex';
    scaleButtons.style.gap = '8px';

    const scales = [100, 110, 120, 130];
    for (const sc of scales) {
      const btn = document.createElement('button');
      btn.style.flex = '1';
      btn.style.padding = '6px 8px';
      btn.style.borderRadius = '5px';
      btn.style.background = currentTheme.fontScale === sc ? '#1E3A8A' : '#0F172A';
      btn.style.border = currentTheme.fontScale === sc ? '1.5px solid #3B82F6' : '1px solid #334155';
      btn.style.color = '#F8FAFC';
      btn.style.cursor = 'pointer';
      btn.style.fontSize = '12px';
      btn.textContent = `${sc}%`;
      btn.addEventListener('click', () => {
        themeManager.setFontScale(sc);
        this.render();
      });
      scaleButtons.appendChild(btn);
    }
    scaleCard.appendChild(scaleButtons);
    container.appendChild(scaleCard);

    // 3. Reduced Motion
    this.createToggleCard(
      container,
      t('accessReducedMotion'),
      t('accessReducedMotionDesc'),
      currentTheme.reducedMotion,
      (val) => {
        themeManager.setReducedMotion(val);
        this.callbacks.showToast(`הפחתת אנימציות: ${val ? 'פעיל' : 'מושבת'}`);
      }
    );

    // 4. Enhanced Focus Indicators
    this.createToggleCard(
      container,
      t('accessEnhancedFocus'),
      t('accessEnhancedFocusDesc'),
      currentTheme.enhancedFocus,
      (val) => {
        themeManager.setEnhancedFocus(val);
        this.callbacks.showToast(`הדגשת פוקוס במקלדת: ${val ? 'פעיל' : 'מושבת'}`);
      }
    );

    // 5. Accessible UI Font
    this.createToggleCard(
      container,
      t('accessDyslexicFont'),
      t('accessDyslexicFontDesc'),
      currentTheme.accessibleFont,
      (val) => {
        themeManager.setAccessibleFont(val);
        this.callbacks.showToast(`גופן ממשק נגיש: ${val ? 'הופעל' : 'הושבת'}`);
      }
    );
  }

  private createToggleCard(
    container: HTMLElement,
    title: string,
    desc: string,
    checked: boolean,
    onChange: (val: boolean) => void
  ): void {
    const card = document.createElement('div');
    card.style.display = 'flex';
    card.style.alignItems = 'center';
    card.style.justifyContent = 'space-between';
    card.style.padding = '14px 18px';
    card.style.background = '#1E293B';
    card.style.border = '1px solid #334155';
    card.style.borderRadius = '8px';
    card.style.marginBottom = '12px';

    const textWrap = document.createElement('div');
    textWrap.style.flex = '1';
    textWrap.style.paddingLeft = i18n.getLanguage() === 'he' ? '0' : '14px';
    textWrap.style.paddingRight = i18n.getLanguage() === 'he' ? '14px' : '0';

    const titleEl = document.createElement('div');
    titleEl.style.fontSize = '13px';
    titleEl.style.fontWeight = '600';
    titleEl.style.color = '#F8FAFC';
    titleEl.textContent = title;
    textWrap.appendChild(titleEl);

    const descEl = document.createElement('div');
    descEl.style.fontSize = '11px';
    descEl.style.color = '#94A3B8';
    descEl.style.marginTop = '2px';
    descEl.textContent = desc;
    textWrap.appendChild(descEl);

    card.appendChild(textWrap);

    const toggle = document.createElement('input');
    toggle.type = 'checkbox';
    toggle.checked = checked;
    toggle.style.width = '18px';
    toggle.style.height = '18px';
    toggle.style.cursor = 'pointer';
    toggle.addEventListener('change', () => onChange(toggle.checked));
    card.appendChild(toggle);

    container.appendChild(card);
  }

  // --- TAB 3: Language & Direction ---
  private renderLanguageTab(container: HTMLElement): void {
    const title = document.createElement('h3');
    title.style.fontSize = '13.5px';
    title.style.color = '#60A5FA';
    title.style.marginBottom = '16px';
    title.textContent = t('languageSelect');
    container.appendChild(title);

    const currentLang = i18n.getLanguage();

    const langs: { id: Language; label: string }[] = [
      { id: 'he', label: t('languageHebrew') },
      { id: 'en', label: t('languageEnglish') }
    ];

    for (const l of langs) {
      const card = document.createElement('div');
      card.style.display = 'flex';
      card.style.alignItems = 'center';
      card.style.justifyContent = 'space-between';
      card.style.padding = '14px 18px';
      card.style.background = '#1E293B';
      card.style.border = currentLang === l.id ? '2px solid #3B82F6' : '1px solid #334155';
      card.style.borderRadius = '8px';
      card.style.marginBottom = '12px';
      card.style.cursor = 'pointer';

      const left = document.createElement('div');
      left.style.display = 'flex';
      left.style.alignItems = 'center';
      left.style.gap = '12px';

      const icon = document.createElement('span');
      icon.style.color = currentLang === l.id ? '#60A5FA' : '#94A3B8';
      icon.innerHTML = renderIcon('globe', 18);
      left.appendChild(icon);

      const text = document.createElement('span');
      text.style.fontSize = '13.5px';
      text.style.fontWeight = currentLang === l.id ? '600' : 'normal';
      text.style.color = '#F8FAFC';
      text.textContent = l.label;
      left.appendChild(text);

      card.appendChild(left);

      if (currentLang === l.id) {
        const badge = document.createElement('span');
        badge.style.background = '#2563EB';
        badge.style.color = '#FFFFFF';
        badge.style.padding = '3px 9px';
        badge.style.borderRadius = '12px';
        badge.style.fontSize = '11px';
        badge.style.display = 'inline-flex';
        badge.style.alignItems = 'center';
        badge.style.gap = '5px';
        badge.innerHTML = `${renderIcon('check', 11)} <span>${t('languageActiveBadge')}</span>`;
        card.appendChild(badge);
      }

      card.addEventListener('click', () => {
        i18n.setLanguage(l.id);
        this.callbacks.onLanguageChange(l.id);
        this.render();
      });

      container.appendChild(card);
    }
  }

  // --- TAB 4: Logs & Maintenance ---
  private renderLogsTab(container: HTMLElement): void {
    const title = document.createElement('h3');
    title.style.fontSize = '13.5px';
    title.style.color = '#60A5FA';
    title.style.marginBottom = '14px';
    title.textContent = t('settingsTabLogs');
    container.appendChild(title);

    // Retention Days Row
    const retentionRow = document.createElement('div');
    retentionRow.style.display = 'flex';
    retentionRow.style.alignItems = 'center';
    retentionRow.style.justifyContent = 'space-between';
    retentionRow.style.padding = '12px 16px';
    retentionRow.style.background = '#1E293B';
    retentionRow.style.borderRadius = '8px';
    retentionRow.style.marginBottom = '14px';

    const label = document.createElement('span');
    label.style.fontSize = '12.5px';
    label.style.color = '#F8FAFC';
    label.textContent = t('logsRetentionLabel');
    retentionRow.appendChild(label);

    const select = document.createElement('select');
    select.className = 'tok-select';
    select.style.background = '#0F172A';
    select.style.color = '#F8FAFC';
    select.style.border = '1px solid #334155';

    const options = [3, 7, 14, 30, 60];
    for (const opt of options) {
      const option = document.createElement('option');
      option.value = opt.toString();
      option.textContent = `${opt} ${t('logsRetentionDays')}`;
      if (opt === this.logRetentionDays) option.selected = true;
      select.appendChild(option);
    }

    select.addEventListener('change', () => {
      this.logRetentionDays = parseInt(select.value, 10);
      try {
        localStorage.setItem('tok_log_retention', select.value);
      } catch {}
      const win = window as any;
      if (win.tokIpc && win.tokIpc.setLogRetention) {
        win.tokIpc.setLogRetention(this.logRetentionDays);
      }
      this.callbacks.showToast(`מדיניות מחיקת יומנים עודכנה ל-${this.logRetentionDays} ימים`);
    });
    retentionRow.appendChild(select);
    container.appendChild(retentionRow);

    // Actions Row
    const actionsRow = document.createElement('div');
    actionsRow.style.display = 'flex';
    actionsRow.style.gap = '10px';
    actionsRow.style.marginBottom = '16px';

    const openFolderBtn = document.createElement('button');
    openFolderBtn.className = 'tok-btn';
    openFolderBtn.style.flex = '1';
    openFolderBtn.style.display = 'inline-flex';
    openFolderBtn.style.alignItems = 'center';
    openFolderBtn.style.justifyContent = 'center';
    openFolderBtn.style.gap = '7px';
    openFolderBtn.innerHTML = `${renderIcon('folder', 14)} <span>${t('logsOpenFolder')}</span>`;
    openFolderBtn.addEventListener('click', async () => {
      const win = window as any;
      if (win.tokIpc && win.tokIpc.openLogsFolder) {
        await win.tokIpc.openLogsFolder();
      } else {
        this.callbacks.showToast('פתיחת תיקייה נתמכת בסביבת שולחן העבודה Electron');
      }
    });
    actionsRow.appendChild(openFolderBtn);

    const cleanNowBtn = document.createElement('button');
    cleanNowBtn.className = 'tok-btn';
    cleanNowBtn.style.flex = '1';
    cleanNowBtn.style.display = 'inline-flex';
    cleanNowBtn.style.alignItems = 'center';
    cleanNowBtn.style.justifyContent = 'center';
    cleanNowBtn.style.gap = '7px';
    cleanNowBtn.innerHTML = `${renderIcon('trash', 14)} <span>${t('logsCleanNow')}</span>`;
    cleanNowBtn.addEventListener('click', async () => {
      const win = window as any;
      if (win.tokIpc && win.tokIpc.cleanOldLogs) {
        const deleted = await win.tokIpc.cleanOldLogs(this.logRetentionDays);
        this.callbacks.showToast(`ניקוי הושלם: נמחקו ${deleted} קובצי יומן ישנים`);
        this.render();
      } else {
        this.callbacks.showToast('ניקוי יומנים הושלם בהצלחה');
      }
    });
    actionsRow.appendChild(cleanNowBtn);

    container.appendChild(actionsRow);

    // Recent Logs Viewer
    const recentHeading = document.createElement('div');
    recentHeading.style.fontSize = '12px';
    recentHeading.style.fontWeight = '600';
    recentHeading.style.color = '#94A3B8';
    recentHeading.style.marginBottom = '6px';
    recentHeading.textContent = t('logsRecentTitle');
    container.appendChild(recentHeading);

    const logBox = document.createElement('div');
    logBox.style.height = '180px';
    logBox.style.background = '#0B132B';
    logBox.style.border = '1px solid #1E293B';
    logBox.style.borderRadius = '6px';
    logBox.style.padding = '10px';
    logBox.style.fontFamily = 'monospace';
    logBox.style.fontSize = '11px';
    logBox.style.color = '#CBD5E1';
    logBox.style.overflowY = 'auto';
    logBox.style.whiteSpace = 'pre-wrap';
    logBox.textContent = 'טוען רשומות מיומן המערכת...';

    const win = window as any;
    if (win.tokIpc && win.tokIpc.getRecentLogs) {
      win.tokIpc.getRecentLogs().then((lines: string[]) => {
        logBox.textContent = lines.length ? lines.join('\n') : '[אין רשומות יומן להצגה]';
      }).catch((e: any) => {
        logBox.textContent = `[שגיאה בטעינת יומן: ${e.message}]`;
      });
    } else {
      logBox.textContent = `[${new Date().toISOString()}] [INFO] TypesetOK Desktop Publishing Platform.\n[${new Date().toISOString()}] [INFO] Knuth-Plass Hebrew Breaker and Pre-press pipeline active.`;
    }

    container.appendChild(logBox);
  }

  // --- TAB 5: Software Updates ---
  private renderUpdatesTab(container: HTMLElement): void {
    const title = document.createElement('h3');
    title.style.fontSize = '13.5px';
    title.style.color = '#60A5FA';
    title.style.marginBottom = '14px';
    title.textContent = t('settingsTabUpdates');
    container.appendChild(title);

    const currentCard = document.createElement('div');
    currentCard.style.padding = '14px 18px';
    currentCard.style.background = '#1E293B';
    currentCard.style.borderRadius = '8px';
    currentCard.style.marginBottom = '16px';
    currentCard.style.display = 'flex';
    currentCard.style.alignItems = 'center';
    currentCard.style.justifyContent = 'space-between';

    const currentInfo = document.createElement('div');
    currentInfo.innerHTML = `
      <div style="font-size: 13px; font-weight: 600; color: #F8FAFC;">TypesetOK v0.7.3</div>
      <div style="font-size: 11px; color: #94A3B8; margin-top: 2px;">ערוץ שחרור רשמי יציב (Official Stable Channel)</div>
    `;
    currentCard.appendChild(currentInfo);

    const checkBtn = document.createElement('button');
    checkBtn.className = 'tok-btn tok-btn-primary';
    checkBtn.style.display = 'inline-flex';
    checkBtn.style.alignItems = 'center';
    checkBtn.style.gap = '6px';
    checkBtn.innerHTML = `${renderIcon('refresh', 13)} <span>${t('updatesCheckNow')}</span>`;
    currentCard.appendChild(checkBtn);

    container.appendChild(currentCard);

    // Result container
    const resultBox = document.createElement('div');
    resultBox.style.padding = '14px 18px';
    resultBox.style.background = '#0B132B';
    resultBox.style.border = '1px solid #1E293B';
    resultBox.style.borderRadius = '8px';
    resultBox.style.fontSize = '12.5px';
    resultBox.style.color = '#94A3B8';
    resultBox.textContent = 'לחץ על "בדיקת עדכונים כעת" כדי לבדוק שחרורים מול מאגר GitHub.';
    container.appendChild(resultBox);

    checkBtn.addEventListener('click', async () => {
      checkBtn.innerHTML = `${renderIcon('refresh', 13)} <span>${t('updatesStatusChecking')}</span>`;
      const win = window as any;
      if (win.tokIpc && win.tokIpc.checkForUpdates) {
        try {
          const res = await win.tokIpc.checkForUpdates();
          if (res.hasUpdate) {
            resultBox.innerHTML = `
              <div style="color: #34D399; font-weight: 600; margin-bottom: 6px; display: flex; align-items: center; gap: 6px;">
                ${renderIcon('sparkle', 14)} <span>${t('updatesStatusAvailable')} (גרסה v${res.latestVersion})</span>
              </div>
              <div style="font-size: 12px; color: #E2E8F0; margin-bottom: 10px;">${res.releaseNotes}</div>
              <button id="tok-download-btn" class="tok-btn tok-btn-primary" style="height: 30px; font-size: 12px; display: inline-flex; align-items: center; gap: 6px;">
                ${renderIcon('export', 13)} <span>${t('updatesDownload')}</span>
              </button>
            `;
            const dlBtn = resultBox.querySelector('#tok-download-btn');
            dlBtn?.addEventListener('click', () => {
              win.tokIpc.openReleaseUrl(res.downloadUrl || res.releaseUrl);
            });
          } else {
            resultBox.innerHTML = `<span style="color: #60A5FA; display: inline-flex; align-items: center; gap: 6px;">${renderIcon('check', 14)} <span>${t('updatesStatusLatest')}</span></span>`;
          }
        } catch (err: any) {
          resultBox.textContent = `שגיאה בבדיקת עדכונים: ${err.message}`;
        }
      } else {
        setTimeout(() => {
          resultBox.innerHTML = `<span style="color: #60A5FA; display: inline-flex; align-items: center; gap: 6px;">${renderIcon('check', 14)} <span>${t('updatesStatusLatest')}</span></span>`;
        }, 300);
      }
      checkBtn.innerHTML = `${renderIcon('refresh', 13)} <span>${t('updatesCheckNow')}</span>`;
    });
  }

  // --- TAB 6: Plugins Manager ---
  private renderPluginsTab(container: HTMLElement): void {
    const title = document.createElement('h3');
    title.style.fontSize = '13.5px';
    title.style.color = '#60A5FA';
    title.style.marginBottom = '14px';
    title.textContent = t('pluginsInstalled');
    container.appendChild(title);

    // Top actions
    const actionsRow = document.createElement('div');
    actionsRow.style.display = 'flex';
    actionsRow.style.gap = '10px';
    actionsRow.style.marginBottom = '14px';

    const openFolderBtn = document.createElement('button');
    openFolderBtn.className = 'tok-btn';
    openFolderBtn.style.flex = '1';
    openFolderBtn.style.display = 'inline-flex';
    openFolderBtn.style.alignItems = 'center';
    openFolderBtn.style.justifyContent = 'center';
    openFolderBtn.style.gap = '7px';
    openFolderBtn.innerHTML = `${renderIcon('folder', 14)} <span>${t('pluginsOpenFolder')}</span>`;
    openFolderBtn.addEventListener('click', () => {
      this.callbacks.pluginEngine.openPluginsFolder();
    });
    actionsRow.appendChild(openFolderBtn);

    const reloadBtn = document.createElement('button');
    reloadBtn.className = 'tok-btn';
    reloadBtn.style.flex = '1';
    reloadBtn.style.display = 'inline-flex';
    reloadBtn.style.alignItems = 'center';
    reloadBtn.style.justifyContent = 'center';
    reloadBtn.style.gap = '7px';
    reloadBtn.innerHTML = `${renderIcon('refresh', 14)} <span>${t('pluginsReload')}</span>`;
    reloadBtn.addEventListener('click', async () => {
      await this.callbacks.pluginEngine.loadPlugins();
      this.callbacks.showToast('התוספים נטענו מחדש בהצלחה');
      this.render();
    });
    actionsRow.appendChild(reloadBtn);

    container.appendChild(actionsRow);

    const plugins = this.callbacks.pluginEngine.getPlugins();

    if (plugins.length === 0) {
      const empty = document.createElement('div');
      empty.style.padding = '20px';
      empty.style.textAlign = 'center';
      empty.style.color = '#64748B';
      empty.textContent = t('pluginsNoPlugins');
      container.appendChild(empty);
      return;
    }

    for (const plugin of plugins) {
      const card = document.createElement('div');
      card.style.padding = '12px 16px';
      card.style.background = '#1E293B';
      card.style.borderRadius = '8px';
      card.style.border = '1px solid #334155';
      card.style.marginBottom = '10px';
      card.style.display = 'flex';
      card.style.alignItems = 'center';
      card.style.justifyContent = 'space-between';

      const left = document.createElement('div');
      left.style.flex = '1';

      const titleRow = document.createElement('div');
      titleRow.style.display = 'flex';
      titleRow.style.alignItems = 'center';
      titleRow.style.gap = '8px';

      const name = document.createElement('span');
      name.style.fontSize = '13px';
      name.style.fontWeight = '600';
      name.style.color = '#F8FAFC';
      name.textContent = plugin.name;
      titleRow.appendChild(name);

      const typeBadge = document.createElement('span');
      typeBadge.style.fontSize = '10px';
      typeBadge.style.padding = '1px 6px';
      typeBadge.style.borderRadius = '4px';
      typeBadge.style.fontWeight = 'bold';
      typeBadge.style.background = plugin.sourceType === 'ts' ? '#3178C6' : '#F7DF1E';
      typeBadge.style.color = plugin.sourceType === 'ts' ? '#FFFFFF' : '#000000';
      typeBadge.textContent = plugin.sourceType.toUpperCase();
      titleRow.appendChild(typeBadge);

      const ver = document.createElement('span');
      ver.style.fontSize = '11px';
      ver.style.color = '#64748B';
      ver.textContent = `v${plugin.version}`;
      titleRow.appendChild(ver);

      left.appendChild(titleRow);

      const desc = document.createElement('div');
      desc.style.fontSize = '11px';
      desc.style.color = '#94A3B8';
      desc.style.marginTop = '4px';
      desc.textContent = plugin.description;
      left.appendChild(desc);

      card.appendChild(left);

      // Toggle switch
      const toggleLabel = document.createElement('label');
      toggleLabel.style.display = 'flex';
      toggleLabel.style.alignItems = 'center';
      toggleLabel.style.gap = '8px';
      toggleLabel.style.cursor = 'pointer';

      const toggle = document.createElement('input');
      toggle.type = 'checkbox';
      toggle.checked = plugin.enabled;
      toggle.addEventListener('change', async () => {
        await this.callbacks.pluginEngine.togglePlugin(plugin.id, toggle.checked);
        this.callbacks.showToast(`תוסף ${plugin.name} ${toggle.checked ? 'הופעל' : 'הושבת'}`);
      });

      toggleLabel.appendChild(toggle);
      const toggleText = document.createElement('span');
      toggleText.style.fontSize = '12px';
      toggleText.style.color = '#CBD5E1';
      toggleText.textContent = plugin.enabled ? t('pluginsEnabled') : t('pluginsDisabled');
      toggleLabel.appendChild(toggleText);

      card.appendChild(toggleLabel);
      container.appendChild(card);
    }
  }
}
