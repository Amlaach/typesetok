import { t, tf, onOff, i18n, Language } from '../i18n';
import { themeManager, ACCENT_PRESETS, CANVAS_TONE_PRESETS, FONT_SCALES, THEME_PALETTES } from '../theme';
import { PluginEngine } from '../plugins/PluginEngine';
import { renderIcon, IconName } from '../icons';
import { ModalController } from './ModalController';
import { fillAppVersion, getAppVersion } from '../appInfo';

export interface SettingsModalCallbacks {
  onLanguageChange: (lang: Language) => void;
  onClose: () => void;
  pluginEngine: PluginEngine;
  showToast: (msg: string) => void;
}

/**
 * Preset names are stored bilingually as "עברית (English)". Show the half that matches
 * the UI language (English mode used to show the Hebrew half / the whole string).
 */
export function localizedPresetName(name: string, lang: Language = i18n.getLanguage()): string {
  const m = name.match(/^(.*?)\s*\(([^)]*)\)\s*$/);
  if (!m) return name.trim();
  return (lang === 'en' ? m[2] : m[1]).trim() || name.trim();
}

export class SettingsModal {
  public element: HTMLElement;
  private callbacks: SettingsModalCallbacks;
  private activeTab: 'appearance' | 'accessibility' | 'language' | 'logs' | 'updates' | 'plugins' = 'appearance';
  private isVisible = false;
  private logRetentionDays = 14;
  private modal: ModalController;

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
      const parsed = savedRetention ? parseInt(savedRetention, 10) : NaN;
      if (parsed >= 1 && parsed <= 365) this.logRetentionDays = parsed;
    } catch {}

    this.modal = new ModalController(this.element, () => this.hide(), { closeOnBackdrop: true });

    i18n.onChange(() => {
      if (this.isVisible) this.render();
    });
  }

  public show(initialTab?: 'appearance' | 'accessibility' | 'language' | 'logs' | 'updates' | 'plugins'): void {
    if (initialTab) this.activeTab = initialTab;
    this.isVisible = true;
    this.element.style.display = 'flex';
    this.render();
    this.modal.opened();
  }

  public hide(): void {
    if (!this.isVisible) return;
    this.isVisible = false;
    this.element.style.display = 'none';
    this.modal.closed();
    this.callbacks.onClose();
  }

  private render(): void {
    const focusKey = this.modal.captureFocus();
    this.renderContent();
    this.modal.afterRender(focusKey);
  }

  private renderContent(): void {
    this.element.innerHTML = '';
    this.element.style.direction = i18n.getDirection();

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
    title.dataset.modalTitle = '';
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
    closeBtn.title = t('aboutClose');
    closeBtn.setAttribute('aria-label', t('aboutClose'));
    closeBtn.dataset.focusKey = 'close';
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
    tabsCol.setAttribute('role', 'tablist');
    tabsCol.setAttribute('aria-orientation', 'vertical');

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
      tabBtn.setAttribute('role', 'tab');
      tabBtn.setAttribute('aria-selected', String(this.activeTab === tab.id));
      tabBtn.dataset.focusKey = `tab-${tab.id}`;
      if (this.activeTab === tab.id) tabBtn.dataset.autofocus = '';
      tabBtn.addEventListener('click', () => {
        if (this.activeTab === tab.id) return;
        this.activeTab = tab.id;
        this.render();
      });
      // Arrow keys move between tabs (vertical tablist).
      tabBtn.addEventListener('keydown', (e) => {
        if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
        e.preventDefault();
        const idx = tabs.findIndex((x) => x.id === tab.id);
        const next = tabs[(idx + (e.key === 'ArrowDown' ? 1 : tabs.length - 1)) % tabs.length];
        this.activeTab = next.id;
        this.render();
        (this.element.querySelector(`[data-focus-key="tab-${next.id}"]`) as HTMLElement | null)?.focus();
      });
      tabsCol.appendChild(tabBtn);
    }

    body.appendChild(tabsCol);

    // Content Area
    const contentArea = document.createElement('div');
    contentArea.style.flex = '1';
    contentArea.style.padding = '24px 28px';
    contentArea.style.overflowY = 'auto';
    contentArea.setAttribute('role', 'tabpanel');

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
      label.textContent = localizedPresetName(preset.name);
      btn.appendChild(label);
      btn.dataset.focusKey = `accent-${preset.id}`;
      btn.setAttribute('aria-pressed', String(currentTheme.accentColor === preset.value));

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
      label.textContent = localizedPresetName(preset.name);
      btn.appendChild(label);
      btn.dataset.focusKey = `tone-${preset.id}`;
      btn.setAttribute('aria-pressed', String(currentTheme.canvasTone === preset.value));

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
      btn.dataset.focusKey = `density-${d.id}`;
      btn.setAttribute('aria-pressed', String(currentTheme.density === d.id));
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
        this.callbacks.showToast(`${t('accessHighContrast')}: ${onOff(val)}`);
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

    for (const sc of FONT_SCALES) {
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
      btn.dataset.focusKey = `scale-${sc}`;
      btn.setAttribute('aria-pressed', String(currentTheme.fontScale === sc));
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
        this.callbacks.showToast(`${t('accessReducedMotion')}: ${onOff(val)}`);
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
        this.callbacks.showToast(`${t('accessEnhancedFocus')}: ${onOff(val)}`);
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
        this.callbacks.showToast(`${t('accessDyslexicFont')}: ${onOff(val)}`);
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
    // A <label> so clicking anywhere on the card toggles the switch, and the checkbox
    // gets the title as its accessible name.
    const card = document.createElement('label');
    card.style.display = 'flex';
    card.style.alignItems = 'center';
    card.style.justifyContent = 'space-between';
    card.style.padding = '14px 18px';
    card.style.background = '#1E293B';
    card.style.border = '1px solid #334155';
    card.style.borderRadius = '8px';
    card.style.marginBottom = '12px';
    card.style.cursor = 'pointer';

    const textWrap = document.createElement('div');
    textWrap.style.flex = '1';
    // Space between the text and the switch, i.e. on the text's inline-end side in both
    // directions (the old left/right logic padded the outer edge in Hebrew).
    textWrap.style.paddingInlineEnd = '14px';

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
    toggle.dataset.focusKey = `toggle-${title}`;
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

    const group = document.createElement('div');
    group.setAttribute('role', 'radiogroup');
    group.setAttribute('aria-label', t('languageSelect'));
    container.appendChild(group);

    for (const l of langs) {
      // A real button (was a <div>): reachable with Tab and activated with Enter/Space.
      const card = document.createElement('button');
      card.type = 'button';
      card.setAttribute('role', 'radio');
      card.setAttribute('aria-checked', String(currentLang === l.id));
      card.dataset.focusKey = `lang-${l.id}`;
      card.style.width = '100%';
      card.style.font = 'inherit';
      card.style.textAlign = 'start';
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
        if (i18n.getLanguage() === l.id) return;
        // setLanguage notifies the i18n listener registered in the constructor, which
        // re-renders this modal; rendering here as well built the whole modal twice.
        i18n.setLanguage(l.id);
        this.callbacks.onLanguageChange(l.id);
      });

      group.appendChild(card);
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
    select.setAttribute('aria-label', t('logsRetentionLabel'));
    select.dataset.focusKey = 'log-retention';

    const options = [3, 7, 14, 30, 60];
    // Keep a stored value that is not one of the presets visible instead of silently
    // showing the first option.
    if (!options.includes(this.logRetentionDays)) {
      options.push(this.logRetentionDays);
      options.sort((a, b) => a - b);
    }
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
        Promise.resolve(win.tokIpc.setLogRetention(this.logRetentionDays)).catch((e: any) => {
          console.warn('[SETTINGS] setLogRetention failed:', e?.message ?? e);
        });
      }
      this.callbacks.showToast(tf('logsRetentionUpdated', { n: this.logRetentionDays }));
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
        try {
          await win.tokIpc.openLogsFolder();
        } catch (e: any) {
          this.callbacks.showToast(`${t('actionFailed')}: ${e?.message ?? e}`);
        }
      } else {
        this.callbacks.showToast(t('desktopOnlyFeature'));
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
        try {
          const deleted = await win.tokIpc.cleanOldLogs(this.logRetentionDays);
          this.callbacks.showToast(tf('logsCleanedCount', { n: Number(deleted) || 0 }));
        } catch (e: any) {
          this.callbacks.showToast(`${t('actionFailed')}: ${e?.message ?? e}`);
        }
        if (this.isVisible && this.activeTab === 'logs') this.render();
      } else {
        this.callbacks.showToast(t('logsCleaned'));
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
    logBox.textContent = t('logsLoading');

    // Log lines are English/ISO text: lay them out LTR, otherwise the bidi algorithm in
    // the RTL modal reorders the "[timestamp] [LEVEL]" brackets.
    logBox.dir = 'ltr';
    logBox.style.textAlign = 'left';
    logBox.tabIndex = 0;
    logBox.setAttribute('role', 'log');
    logBox.setAttribute('aria-label', t('logsRecentTitle'));

    const win = window as any;
    if (win.tokIpc && win.tokIpc.getRecentLogs) {
      win.tokIpc.getRecentLogs().then((lines: string[]) => {
        logBox.textContent = Array.isArray(lines) && lines.length ? lines.join('\n') : t('logsEmpty');
      }).catch((e: any) => {
        logBox.textContent = `[${t('logsLoadFailed')}: ${e?.message ?? e}]`;
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
      <div style="font-size: 13px; font-weight: 600; color: #F8FAFC;" data-app-version>TypesetOK</div>
      <div style="font-size: 11px; color: #94A3B8; margin-top: 2px;">${t('updatesCurrentChannel')}</div>
    `;
    fillAppVersion(currentInfo.querySelector('[data-app-version]') as HTMLElement, (v) => `TypesetOK v${v}`);
    currentCard.appendChild(currentInfo);

    const checkBtn = document.createElement('button');
    checkBtn.className = 'tok-btn tok-btn-primary';
    checkBtn.style.display = 'inline-flex';
    checkBtn.style.alignItems = 'center';
    checkBtn.style.gap = '6px';
    checkBtn.dataset.focusKey = 'check-updates';
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
    resultBox.setAttribute('aria-live', 'polite');
    resultBox.textContent = t('updatesHint');
    container.appendChild(resultBox);

    const showLatest = (version: string) => {
      resultBox.innerHTML = `<span style="color: #60A5FA; display: inline-flex; align-items: center; gap: 6px;">${renderIcon('check', 14)} <span></span></span>`;
      const label = resultBox.querySelector('span > span') as HTMLElement;
      label.textContent = version ? `${t('updatesStatusLatest')} (v${version})` : t('updatesStatusLatest');
    };

    checkBtn.addEventListener('click', async () => {
      if (checkBtn.disabled) return;
      checkBtn.disabled = true;
      checkBtn.innerHTML = `${renderIcon('refresh', 13)} <span>${t('updatesStatusChecking')}</span>`;
      const win = window as any;
      if (win.tokIpc && win.tokIpc.checkForUpdates) {
        try {
          const res = await win.tokIpc.checkForUpdates();
          if (res && res.error) {
            // The updater resolves (never rejects) on network/HTTP/parse failures and
            // reports them in `error`; this used to be shown as "you are up to date".
            resultBox.textContent = `${t('updatesCheckFailed')}: ${res.error}`;
          } else if (res && res.hasUpdate) {
            // Release name/notes come from the GitHub API: render them as text, never as HTML.
            resultBox.innerHTML = '';
            const headline = document.createElement('div');
            headline.style.cssText = 'color: #34D399; font-weight: 600; margin-bottom: 6px; display: flex; align-items: center; gap: 6px;';
            headline.innerHTML = renderIcon('sparkle', 14);
            const headlineText = document.createElement('span');
            headlineText.textContent = `${t('updatesStatusAvailable')} (v${String(res.latestVersion ?? '')})`;
            headline.appendChild(headlineText);
            resultBox.appendChild(headline);

            const notes = document.createElement('div');
            notes.style.cssText = 'font-size: 12px; color: #E2E8F0; margin-bottom: 10px; white-space: pre-wrap; max-height: 160px; overflow-y: auto;';
            notes.textContent = String(res.releaseNotes ?? '');
            resultBox.appendChild(notes);

            const dlBtn = document.createElement('button');
            dlBtn.className = 'tok-btn tok-btn-primary';
            dlBtn.style.cssText = 'height: 30px; font-size: 12px; display: inline-flex; align-items: center; gap: 6px;';
            dlBtn.innerHTML = `${renderIcon('export', 13)} <span>${t('updatesDownload')}</span>`;
            dlBtn.addEventListener('click', () => {
              Promise.resolve(win.tokIpc.openReleaseUrl(res.downloadUrl || res.releaseUrl)).catch((e: any) => {
                this.callbacks.showToast(`${t('updatesCheckFailed')}: ${e?.message ?? e}`);
              });
            });
            resultBox.appendChild(dlBtn);
          } else {
            showLatest(typeof res?.currentVersion === 'string' && res.currentVersion ? res.currentVersion : await getAppVersion());
          }
        } catch (err: any) {
          resultBox.textContent = `${t('updatesCheckFailed')}: ${err?.message ?? err}`;
        }
      } else {
        await new Promise((r) => setTimeout(r, 300));
        showLatest(await getAppVersion());
      }
      checkBtn.disabled = false;
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
    openFolderBtn.dataset.focusKey = 'plugins-folder';
    openFolderBtn.addEventListener('click', () => {
      this.callbacks.pluginEngine.openPluginsFolder().catch((e: any) => {
        this.callbacks.showToast(`${t('actionFailed')}: ${e?.message ?? e}`);
      });
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
    reloadBtn.dataset.focusKey = 'plugins-reload';
    reloadBtn.addEventListener('click', async () => {
      reloadBtn.disabled = true;
      try {
        await this.callbacks.pluginEngine.loadPlugins();
        this.callbacks.showToast(t('pluginsReloaded'));
      } catch (e: any) {
        this.callbacks.showToast(`${t('actionFailed')}: ${e?.message ?? e}`);
      }
      if (this.isVisible && this.activeTab === 'plugins') this.render();
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

      if (plugin.error) {
        // e.g. "Main entry file not found" from the main process; previously never shown.
        const err = document.createElement('div');
        err.style.fontSize = '11px';
        err.style.color = '#F87171';
        err.style.marginTop = '4px';
        err.textContent = `: ${plugin.error}`;
        left.appendChild(err);
      }

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
      toggle.disabled = !!plugin.error;
      toggle.dataset.focusKey = `plugin-${plugin.id}`;
      toggle.setAttribute('aria-label', plugin.name);

      toggleLabel.appendChild(toggle);
      const toggleText = document.createElement('span');
      toggleText.style.fontSize = '12px';
      toggleText.style.color = '#CBD5E1';
      toggleText.textContent = plugin.enabled ? t('pluginsEnabled') : t('pluginsDisabled');
      toggleLabel.appendChild(toggleText);

      toggle.addEventListener('change', async () => {
        const wanted = toggle.checked;
        toggle.disabled = true;
        try {
          await this.callbacks.pluginEngine.togglePlugin(plugin.id, wanted);
          toggleText.textContent = wanted ? t('pluginsEnabled') : t('pluginsDisabled');
          this.callbacks.showToast(`${plugin.name}: ${onOff(wanted)}`);
        } catch (e: any) {
          // The state was not persisted: put the switch back where it really is.
          toggle.checked = !wanted;
          this.callbacks.showToast(`${t('actionFailed')}: ${e?.message ?? e}`);
        } finally {
          toggle.disabled = false;
        }
      });

      card.appendChild(toggleLabel);
      container.appendChild(card);
    }
  }
}
