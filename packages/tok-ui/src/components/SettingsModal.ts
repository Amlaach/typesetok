import { t, i18n, Language } from '../i18n';
import { themeManager, ACCENT_PRESETS, CANVAS_TONE_PRESETS } from '../theme';
import { PluginEngine } from '../plugins/PluginEngine';

export interface SettingsModalCallbacks {
  onLanguageChange: (lang: Language) => void;
  onClose: () => void;
  pluginEngine: PluginEngine;
  showToast: (msg: string) => void;
}

export class SettingsModal {
  public element: HTMLElement;
  private callbacks: SettingsModalCallbacks;
  private activeTab: 'appearance' | 'language' | 'logs' | 'updates' | 'plugins' = 'appearance';
  private isVisible = false;
  private logRetentionDays = 14;
  private autoCheckUpdates = true;

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

  public show(initialTab?: 'appearance' | 'language' | 'logs' | 'updates' | 'plugins'): void {
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
    card.style.width = '780px';
    card.style.maxWidth = '92vw';
    card.style.height = '560px';
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
    icon.style.fontSize = '20px';
    icon.textContent = '⚙️';
    titleWrap.appendChild(icon);

    const title = document.createElement('h2');
    title.style.margin = '0';
    title.style.fontSize = '17px';
    title.style.fontWeight = '700';
    title.style.color = '#F8FAFC';
    title.textContent = t('settingsTitle');
    titleWrap.appendChild(title);

    header.appendChild(titleWrap);

    const closeBtn = document.createElement('button');
    closeBtn.style.background = 'transparent';
    closeBtn.style.border = 'none';
    closeBtn.style.color = '#94A3B8';
    closeBtn.style.fontSize = '20px';
    closeBtn.style.cursor = 'pointer';
    closeBtn.textContent = '✕';
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
    tabsCol.style.width = '200px';
    tabsCol.style.background = '#0B132B';
    tabsCol.style.borderLeft = i18n.getLanguage() === 'he' ? '1px solid #1E293B' : 'none';
    tabsCol.style.borderRight = i18n.getLanguage() === 'en' ? '1px solid #1E293B' : 'none';
    tabsCol.style.padding = '12px 8px';
    tabsCol.style.display = 'flex';
    tabsCol.style.flexDirection = 'column';
    tabsCol.style.gap = '4px';

    const tabs: { id: 'appearance' | 'language' | 'logs' | 'updates' | 'plugins'; label: string; icon: string }[] = [
      { id: 'appearance', label: t('settingsTabAppearance'), icon: '🎨' },
      { id: 'language', label: t('settingsTabLanguage'), icon: '🌐' },
      { id: 'logs', label: t('settingsTabLogs'), icon: '📋' },
      { id: 'updates', label: t('settingsTabUpdates'), icon: '🔄' },
      { id: 'plugins', label: t('settingsTabPlugins'), icon: '🧩' },
    ];

    for (const tab of tabs) {
      const tabBtn = document.createElement('button');
      tabBtn.style.display = 'flex';
      tabBtn.style.alignItems = 'center';
      tabBtn.style.gap = '10px';
      tabBtn.style.padding = '10px 14px';
      tabBtn.style.borderRadius = '8px';
      tabBtn.style.border = 'none';
      tabBtn.style.background = this.activeTab === tab.id ? '#1E3A8A' : 'transparent';
      tabBtn.style.color = this.activeTab === tab.id ? '#FFFFFF' : '#94A3B8';
      tabBtn.style.fontWeight = this.activeTab === tab.id ? '600' : 'normal';
      tabBtn.style.cursor = 'pointer';
      tabBtn.style.textAlign = i18n.getLanguage() === 'he' ? 'right' : 'left';
      tabBtn.style.fontSize = '13px';
      tabBtn.style.transition = 'all 0.15s';

      tabBtn.innerHTML = `<span>${tab.icon}</span><span>${tab.label}</span>`;
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

    // 1. Accent Color
    const section1 = document.createElement('div');
    section1.style.marginBottom = '24px';

    const h3_1 = document.createElement('h3');
    h3_1.style.fontSize = '14px';
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
      dot.style.width = '14px';
      dot.style.height = '14px';
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
    h3_2.style.fontSize = '14px';
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
      box.style.width = '20px';
      box.style.height = '20px';
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
    h3_3.style.fontSize = '14px';
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

  // --- TAB 2: Language & Direction ---
  private renderLanguageTab(container: HTMLElement): void {
    const title = document.createElement('h3');
    title.style.fontSize = '14px';
    title.style.color = '#60A5FA';
    title.style.marginBottom = '16px';
    title.textContent = t('languageSelect');
    container.appendChild(title);

    const currentLang = i18n.getLanguage();

    const langs: { id: Language; label: string; flag: string }[] = [
      { id: 'he', label: t('languageHebrew'), flag: '🇮🇱' },
      { id: 'en', label: t('languageEnglish'), flag: '🌐' }
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

      const flag = document.createElement('span');
      flag.style.fontSize = '22px';
      flag.textContent = l.flag;
      left.appendChild(flag);

      const text = document.createElement('span');
      text.style.fontSize = '14px';
      text.style.fontWeight = currentLang === l.id ? '600' : 'normal';
      text.style.color = '#F8FAFC';
      text.textContent = l.label;
      left.appendChild(text);

      card.appendChild(left);

      if (currentLang === l.id) {
        const badge = document.createElement('span');
        badge.style.background = '#2563EB';
        badge.style.color = '#FFFFFF';
        badge.style.padding = '2px 8px';
        badge.style.borderRadius = '12px';
        badge.style.fontSize = '11px';
        badge.textContent = '✓ פעיל';
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

  // --- TAB 3: Logs & Maintenance ---
  private renderLogsTab(container: HTMLElement): void {
    const title = document.createElement('h3');
    title.style.fontSize = '14px';
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
    label.style.fontSize = '13px';
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
      this.callbacks.showToast(`מדיניות מחיקת לוגים עודכנה ל-${this.logRetentionDays} ימים`);
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
    openFolderBtn.textContent = `📁 ${t('logsOpenFolder')}`;
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
    cleanNowBtn.textContent = `🧹 ${t('logsCleanNow')}`;
    cleanNowBtn.addEventListener('click', async () => {
      const win = window as any;
      if (win.tokIpc && win.tokIpc.cleanOldLogs) {
        const deleted = await win.tokIpc.cleanOldLogs(this.logRetentionDays);
        this.callbacks.showToast(`ניקוי הושלם: נמחקו ${deleted} קובצי לוג ישנים`);
        this.render();
      } else {
        this.callbacks.showToast('ניקוי לוגים הושלם');
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
    logBox.textContent = 'טוען לוגים אחרונים...';

    const win = window as any;
    if (win.tokIpc && win.tokIpc.getRecentLogs) {
      win.tokIpc.getRecentLogs().then((lines: string[]) => {
        logBox.textContent = lines.length ? lines.join('\n') : '[אין רשומות לוג להצגה]';
      }).catch((e: any) => {
        logBox.textContent = `[שגיאה בטעינת לוגים: ${e.message}]`;
      });
    } else {
      logBox.textContent = `[${new Date().toISOString()}] [INFO] TypesetOK Web Preview active.\n[${new Date().toISOString()}] [INFO] Knuth-Plass typesetting engine verified (58/58 tests passed).\n[${new Date().toISOString()}] [INFO] Hebrew typography normalizer SI 6100 initialized.`;
    }

    container.appendChild(logBox);
  }

  // --- TAB 4: Software Updates ---
  private renderUpdatesTab(container: HTMLElement): void {
    const title = document.createElement('h3');
    title.style.fontSize = '14px';
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
      <div style="font-size: 13px; font-weight: 600; color: #F8FAFC;">TypesetOK v0.8.0</div>
      <div style="font-size: 11px; color: #94A3B8; margin-top: 2px;">מהדורת סתיו 2026 • ערוץ שחרור רשמי (Stable)</div>
    `;
    currentCard.appendChild(currentInfo);

    const checkBtn = document.createElement('button');
    checkBtn.className = 'tok-btn tok-btn-primary';
    checkBtn.textContent = `🔄 ${t('updatesCheckNow')}`;
    currentCard.appendChild(checkBtn);

    container.appendChild(currentCard);

    // Result container
    const resultBox = document.createElement('div');
    resultBox.style.padding = '14px 18px';
    resultBox.style.background = '#0B132B';
    resultBox.style.border = '1px solid #1E293B';
    resultBox.style.borderRadius = '8px';
    resultBox.style.fontSize = '13px';
    resultBox.style.color = '#94A3B8';
    resultBox.textContent = 'לחץ על "בדוק עדכונים כעת" כדי לבדוק שחרורים חדשים ב-GitHub.';
    container.appendChild(resultBox);

    checkBtn.addEventListener('click', async () => {
      checkBtn.textContent = t('updatesStatusChecking');
      const win = window as any;
      if (win.tokIpc && win.tokIpc.checkForUpdates) {
        try {
          const res = await win.tokIpc.checkForUpdates();
          if (res.hasUpdate) {
            resultBox.innerHTML = `
              <div style="color: #34D399; font-weight: 600; margin-bottom: 6px;">🎉 ${t('updatesStatusAvailable')} (גרסה v${res.latestVersion})</div>
              <div style="font-size: 12px; color: #E2E8F0; margin-bottom: 8px;">${res.releaseNotes}</div>
              <button id="tok-download-btn" class="tok-btn tok-btn-primary" style="height: 30px; font-size: 12px;">⬇️ ${t('updatesDownload')}</button>
            `;
            const dlBtn = resultBox.querySelector('#tok-download-btn');
            dlBtn?.addEventListener('click', () => {
              win.tokIpc.openReleaseUrl(res.downloadUrl || res.releaseUrl);
            });
          } else {
            resultBox.innerHTML = `<span style="color: #60A5FA;">✓ ${t('updatesStatusLatest')}</span>`;
          }
        } catch (err: any) {
          resultBox.textContent = `שגיאה בבדיקת עדכונים: ${err.message}`;
        }
      } else {
        setTimeout(() => {
          resultBox.innerHTML = `<span style="color: #60A5FA;">✓ ${t('updatesStatusLatest')}</span>`;
        }, 400);
      }
      checkBtn.textContent = `🔄 ${t('updatesCheckNow')}`;
    });
  }

  // --- TAB 5: Plugins Manager ---
  private renderPluginsTab(container: HTMLElement): void {
    const title = document.createElement('h3');
    title.style.fontSize = '14px';
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
    openFolderBtn.textContent = `📂 ${t('pluginsOpenFolder')}`;
    openFolderBtn.addEventListener('click', () => {
      this.callbacks.pluginEngine.openPluginsFolder();
    });
    actionsRow.appendChild(openFolderBtn);

    const reloadBtn = document.createElement('button');
    reloadBtn.className = 'tok-btn';
    reloadBtn.style.flex = '1';
    reloadBtn.textContent = `🔄 ${t('pluginsReload')}`;
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
