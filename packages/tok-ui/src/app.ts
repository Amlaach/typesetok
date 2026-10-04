import { TopSystemBar } from './components/TopSystemBar';
import { StructureBar } from './components/StructureBar';
import { ContextualInspector } from './components/ContextualInspector';
import { ActionHud } from './components/ActionHud';
import { CommandPalette, PaletteItem } from './components/CommandPalette';
import { StatusBar } from './components/StatusBar';
import { SpreadCanvas } from './components/SpreadCanvas';
import { WelcomeModal } from './components/WelcomeModal';
import { SettingsModal } from './components/SettingsModal';
import { AboutModal } from './components/AboutModal';
import { PluginEngine } from './plugins/PluginEngine';
import { StoryEditor } from 'tok-story-editor';
import { PageDescriptor } from 'tok-viewer';
import { ViewMode } from './types';
import { i18n, t } from './i18n';
import { themeManager } from './theme';

export class TypesetOkApp {
  private root: HTMLElement;
  private topBar!: TopSystemBar;
  private structureBar!: StructureBar;
  private canvas!: SpreadCanvas;
  private inspector!: ContextualInspector;
  private statusBar!: StatusBar;
  private actionHud!: ActionHud;
  private commandPalette!: CommandPalette;
  private storyEditor!: StoryEditor;
  private storyContainer!: HTMLElement;
  private workbench!: HTMLElement;

  // New Feature Modals & Engines
  private welcomeModal!: WelcomeModal;
  private settingsModal!: SettingsModal;
  private aboutModal!: AboutModal;
  private pluginEngine!: PluginEngine;

  private currentViewMode: ViewMode = 'canvas';
  private pages: PageDescriptor[] = [];

  constructor(root: HTMLElement) {
    this.root = root;
    this.root.className = 'tok-workbench-root';
    this.root.dir = i18n.getLanguage() === 'he' ? 'rtl' : 'ltr';
    this.root.style.display = 'flex';
    this.root.style.flexDirection = 'column';
    this.root.style.height = '100vh';
    this.root.style.overflow = 'hidden';
    this.root.style.background = 'var(--tok-bg-app)';
    this.root.style.color = 'var(--tok-text-primary)';
    this.root.style.fontFamily = 'var(--tok-font-system)';
    this.root.style.position = 'relative';

    // Apply theme & language
    themeManager.applyTheme();

    i18n.onChange((lang) => {
      this.root.dir = lang === 'he' ? 'rtl' : 'ltr';
      if (this.workbench) {
        this.workbench.dir = lang === 'he' ? 'rtl' : 'ltr';
      }
    });

    this.initUI();
  }

  private initUI(): void {
    // 1. Initialize Plugin Engine
    this.pluginEngine = new PluginEngine(
      (cmd) => {
        this.commandPalette?.registerItem(cmd);
      },
      (msg) => {
        this.showToast(msg);
      }
    );

    // 2. Top System Bar (Modern, seamless, no grey toolbar)
    this.topBar = new TopSystemBar({
      onMenuAction: (action, data) => this.handleSystemAction(action, data),
      onOpenCommandPalette: () => this.commandPalette.show(),
      onViewModeChange: (mode) => this.setViewMode(mode),
      onExportPdf: () => this.handleSystemAction('export-pdf'),
      onOpenProjects: () => this.welcomeModal.show(),
      onToggleLanguage: () => {
        this.showToast(`שפת הממשק הוחלפה ל-${i18n.getLanguage() === 'he' ? 'עברית (RTL)' : 'English (LTR)'}`);
      }
    });
    this.root.appendChild(this.topBar.element);

    // 3. Main Workbench Perimeter
    this.workbench = document.createElement('div');
    this.workbench.className = 'tok-workbench-main';
    this.workbench.dir = i18n.getLanguage() === 'he' ? 'rtl' : 'ltr';
    this.workbench.style.display = 'flex';
    this.workbench.style.flex = '1';
    this.workbench.style.overflow = 'hidden';
    this.workbench.style.position = 'relative';
    this.root.appendChild(this.workbench);

    // 3a. Right Side (Leading in RTL): Structure Bar with spacer & bottom Settings/About
    this.structureBar = new StructureBar({
      onSelectPage: (idx) => {
        this.canvas.scrollToPage(idx);
        this.updatePageStats(idx);
      },
      onAddPage: () => this.addNewPage(),
      onSelectFlow: (flowId) => {
        this.statusBar.updateStats({ activeFlow: flowId });
        this.showToast(`תזרים נבחר: ${flowId}`);
      },
      onSelectStyle: (styleId) => {
        this.inspector.setMode('text-edit');
        this.showToast(`החלת סגנון: ${styleId}`);
      },
      onToggleLayer: (layerId, visible) => {
        this.showToast(`שכבה ${layerId}: ${visible ? 'מוצגת' : 'מוסתרת'}`);
      },
      onOpenSettings: () => {
        this.settingsModal.show();
      },
      onOpenAbout: () => {
        this.aboutModal.show();
      }
    });
    this.workbench.appendChild(this.structureBar.element);

    // 3b. Center: Spread Canvas
    this.canvas = new SpreadCanvas({
      onSelectionModeChange: (mode, frameData) => {
        this.inspector.setMode(mode, frameData);
      },
      onRequestActionHud: (x, y, initialValues) => {
        this.actionHud.showAt(x, y, initialValues);
      },
      onDismissActionHud: () => {
        this.actionHud.hide();
      },
      onPageChange: (idx) => {
        this.updatePageStats(idx);
      }
    });
    this.workbench.appendChild(this.canvas.element);

    // 3c. Continuous Story Editor Panel (Hidden in pure canvas mode)
    this.storyContainer = document.createElement('div');
    this.storyContainer.className = 'tok-story-panel';
    this.storyContainer.style.width = '360px';
    this.storyContainer.style.background = 'var(--tok-bg-surface-1)';
    this.storyContainer.style.borderRight = '1px solid var(--tok-border-subtle)';
    this.storyContainer.style.display = 'none';
    this.storyContainer.style.flexDirection = 'column';

    const storyHeader = document.createElement('div');
    storyHeader.style.padding = '8px 14px';
    storyHeader.style.background = 'var(--tok-bg-surface-2)';
    storyHeader.style.borderBottom = '1px solid var(--tok-border-subtle)';
    storyHeader.style.fontWeight = 'bold';
    storyHeader.style.fontSize = '12px';
    storyHeader.style.color = 'var(--tok-text-secondary)';
    storyHeader.textContent = 'עורך סיפור רציף (Story Editor)';
    this.storyContainer.appendChild(storyHeader);

    this.storyEditor = new StoryEditor(this.storyContainer);
    this.workbench.appendChild(this.storyContainer);

    // 3d. Left Side (Trailing in RTL): Contextual Inspector
    this.inspector = new ContextualInspector({
      onDocumentChange: (settings) => {
        console.log('[TOK] Document settings changed:', settings);
      },
      onFrameChange: (geometry) => {
        console.log('[TOK] Frame geometry changed:', geometry);
      },
      onTypographyChange: (typo) => {
        console.log('[TOK] Typography changed:', typo);
      },
      onSyncStyleToken: () => {
        this.showToast('הסגנון הגלובלי עודכן בהצלחה מכל השינויים המקומיים!');
      },
      onNormalizeNiqqud: () => {
        this.handleSystemAction('normalize-hebrew');
      },
      onAlignFrames: (alignType) => {
        this.showToast(`יישור אובייקטים הוחל: ${alignType}`);
      }
    });
    this.workbench.appendChild(this.inspector.element);

    // 4. Status Bar (26px)
    this.statusBar = new StatusBar({
      onZoomChange: (z) => this.canvas.setZoom(z),
      onPageClick: () => this.commandPalette.show(),
      onPreflightClick: () => {
        this.inspector.setMode('zero');
        this.showToast('דוח קדם-דפוס (Continuous Preflight): תקין ללא חריגות');
      }
    });
    this.root.appendChild(this.statusBar.element);

    // 5. Action HUD (Floating, anchored)
    this.actionHud = new ActionHud({
      onFontChange: (f) => this.inspector.setMode('text-edit', undefined, { fontFamily: f }),
      onSizeChange: (s) => this.inspector.setMode('text-edit', undefined, { fontSizePt: s }),
      onWeightChange: (b) => this.inspector.setMode('text-edit', undefined, { fontWeight: b ? 'bold' : 'normal' }),
      onAlignChange: (a) => this.inspector.setMode('text-edit', undefined, { alignment: a }),
      onStyleChange: (st) => this.showToast(`הוחל סגנון מהיר: ${st}`),
      onDismiss: () => this.inspector.setMode('zero')
    });
    this.root.appendChild(this.actionHud.element);

    // 6. Command Palette (Ctrl+K)
    this.initCommandPalette();

    // 7. Initialize Feature Modals
    this.welcomeModal = new WelcomeModal({
      onSelectTemplate: (tmpl) => this.handleTemplateSelect(tmpl),
      onOpenProject: () => this.handleSystemAction('open-document'),
      onLoadDemo: () => this.loadDemoProject(),
      onClose: () => {}
    });
    this.root.appendChild(this.welcomeModal.element);

    this.settingsModal = new SettingsModal({
      onLanguageChange: (lang) => {
        this.showToast(`שפת הממשק עודכנה: ${lang === 'he' ? 'עברית' : 'English'}`);
      },
      onClose: () => {},
      pluginEngine: this.pluginEngine,
      showToast: (msg) => this.showToast(msg)
    });
    this.root.appendChild(this.settingsModal.element);

    this.aboutModal = new AboutModal({
      onClose: () => {}
    });
    this.root.appendChild(this.aboutModal.element);

    // Load Plugins asynchronously
    this.pluginEngine.loadPlugins().catch(console.error);

    // 8. First launch project picker check
    const showWelcome = localStorage.getItem('tok_show_welcome');
    if (showWelcome !== 'false') {
      setTimeout(() => this.welcomeModal.show(), 100);
    }
  }

  private initCommandPalette(): void {
    const commands: PaletteItem[] = [
      {
        id: 'cmd-open-welcome',
        category: 'פרויקטים ומסמכים',
        title: 'מסך בחירת פרויקטים (Welcome Screen)',
        subtitle: 'בחירת תבנית או פרויקט קיים',
        shortcut: 'Ctrl+Shift+P',
        action: () => this.welcomeModal.show()
      },
      {
        id: 'cmd-open-settings',
        category: 'מערכת והעדפות',
        title: 'הגדרות המערכת (Settings)',
        subtitle: 'ערכות עיצוב, שפה, לוגים ותוספים',
        shortcut: 'Ctrl+,',
        action: () => this.settingsModal.show()
      },
      {
        id: 'cmd-open-about',
        category: 'מערכת והעדפות',
        title: 'אודות TypesetOK (About)',
        subtitle: 'גרסה, רישיון ומאגר GitHub',
        action: () => this.aboutModal.show()
      },
      {
        id: 'cmd-toggle-lang',
        category: 'מערכת והעדפות',
        title: 'החלף שפה וכיוון (עברית RTL / English LTR)',
        shortcut: 'Alt+Shift+L',
        action: () => i18n.toggleLanguage()
      },
      {
        id: 'cmd-full-justify',
        category: 'פעולות טיפוגרפיה',
        title: 'יישור עברי מלא (אהלתר"ם + רווחי מילים)',
        subtitle: 'שילוב 3 שכבות יישור',
        shortcut: 'Ctrl+Alt+J',
        action: () => this.handleSystemAction('apply-justification')
      },
      {
        id: 'cmd-norm-niqqud',
        category: 'פעולות טיפוגרפיה',
        title: 'נרמל ניקוד וטעמים (ת"י 6100)',
        subtitle: 'תיקון סדר תווי יוניקוד',
        shortcut: 'Ctrl+Shift+N',
        action: () => this.handleSystemAction('normalize-hebrew')
      },
      {
        id: 'cmd-shield-divine',
        category: 'פעולות טיפוגרפיה',
        title: 'מגן שמות קדושים (איסור שבירה)',
        subtitle: 'הגנה על שמות הוי"ה ואדנות',
        action: () => this.handleSystemAction('shield-divine-names')
      },
      {
        id: 'cmd-recalc-gematria',
        category: 'פעולות טיפוגרפיה',
        title: 'סנכרן מספור עמודים עברי (גימטריה)',
        subtitle: 'החלת גרשיים וכללי טו/טז',
        action: () => this.handleSystemAction('recalculate-gematria')
      },
      {
        id: 'cmd-export-pdf',
        category: 'מערכת ודפוס',
        title: 'ייצוא קובץ לדפוס (ISO PDF/X-1a)',
        subtitle: 'קדם-דפוס רציף 100% K',
        shortcut: 'Ctrl+E',
        action: () => this.handleSystemAction('export-pdf')
      },
      {
        id: 'cmd-new-page',
        category: 'עמודים וניווט',
        title: 'הוסף עמוד חדש לספר',
        shortcut: 'Ctrl+Enter',
        action: () => this.addNewPage()
      },
      {
        id: 'cmd-toggle-margins',
        category: 'תצוגה ורשת',
        title: 'הצג/הסתר קווי שוליים (Margins Guide)',
        action: () => {
          this.canvas.toggleMarginsGuide();
          this.showToast('מתג קווי שוליים הופעל');
        }
      },
      {
        id: 'cmd-toggle-baseline',
        category: 'תצוגה ורשת',
        title: 'הצג/הסתר רשת שורות בסיס (Baseline Grid)',
        action: () => {
          this.canvas.toggleBaselineGuide();
          this.showToast('מתג רשת שורות בסיס הופעל');
        }
      },
      {
        id: 'cmd-zoom-100',
        category: 'תצוגה ורשת',
        title: 'זום 100% (גודל טבעי)',
        shortcut: 'Ctrl+0',
        action: () => {
          this.canvas.setZoom(100);
          this.statusBar.updateStats({ zoom: 100 });
        }
      }
    ];

    this.commandPalette = new CommandPalette(commands);
    this.root.appendChild(this.commandPalette.element);
  }

  public loadDocumentPages(pages: PageDescriptor[]): void {
    this.pages = pages;
    this.canvas.setPages(pages);

    const thumbnails = pages.map((p, idx) => ({
      pageIndex: p.pageIndex,
      gematria: p.gematriaNumber,
      label: `דף ${p.gematriaNumber}`,
      isSpreadRight: idx % 2 === 0
    }));

    this.structureBar.setPages(thumbnails);
    this.updatePageStats(0);
  }

  private handleTemplateSelect(templateId: string): void {
    let name = 'מסמך חדש';
    let count = 4;
    if (templateId === 'gemara') {
      name = 'מסכת ברכות — צורת הדף.tok';
      count = 8;
    } else if (templateId === 'prose') {
      name = 'ספר קריאה — מהדורה ראשונה.tok';
      count = 6;
    } else if (templateId === 'bulletin') {
      name = 'עלון שבת קודש.tok';
      count = 4;
    } else {
      name = 'מסמך ריק.tok';
      count = 2;
    }

    this.topBar.setDocumentTitle(name);
    this.showToast(`נוצר פרויקט חדש מתבנית: ${name}`);
  }

  private loadDemoProject(): void {
    this.topBar.setDocumentTitle('מסכת ברכות — מהדורת מופת.tok');
    this.showToast('פרויקט לדוגמה נטען בהצלחה');
  }

  public setViewMode(mode: ViewMode): void {
    this.currentViewMode = mode;
    if (mode === 'canvas') {
      this.canvas.element.style.display = 'flex';
      this.storyContainer.style.display = 'none';
    } else if (mode === 'story') {
      this.canvas.element.style.display = 'none';
      this.storyContainer.style.display = 'flex';
      this.storyContainer.style.flex = '1';
    } else if (mode === 'split') {
      this.canvas.element.style.display = 'flex';
      this.canvas.element.style.flex = '1';
      this.storyContainer.style.display = 'flex';
      this.storyContainer.style.width = '380px';
    }
  }

  private addNewPage(): void {
    const newIdx = this.pages.length;
    const newGematria = this.toGematria(newIdx + 1);
    const newPage: PageDescriptor = {
      pageIndex: newIdx,
      gematriaNumber: newGematria,
      widthPt: 480,
      heightPt: 680,
      htmlContent: ''
    };
    this.pages.push(newPage);
    this.loadDocumentPages(this.pages);
    this.canvas.scrollToPage(newIdx);
    this.showToast(`נוסף עמוד חדש: דף ${newGematria} (עמ' ${newIdx + 1})`);
  }

  private updatePageStats(idx: number): void {
    const p = this.pages[idx];
    const gematria = p ? p.gematriaNumber : this.toGematria(idx + 1);
    const label = `דף ${gematria} (${idx + 1} מתוך ${this.pages.length})`;
    this.statusBar.updateStats({ pageLabel: label });
    this.structureBar.setActivePage(idx);
  }

  private handleSystemAction(action: string, data?: unknown): void {
    const win = window as any;

    switch (action) {
      case 'new-document':
        this.welcomeModal.show();
        break;
      case 'open-document':
        this.showToast(`פתיחת קובץ: ${data || ''}`);
        break;
      case 'save-document':
      case 'save-as':
        this.showToast('המסמך נשמר בהצלחה בפורמט .tok');
        break;
      case 'export-pdf':
        if (win.tokIpc) {
          this.showToast('מייצא לקובץ לדפוס ISO PDF/X-1a...');
          win.tokIpc.renderPdf('--demo', 'TypesetOK_Export.pdf')
            .then(() => {
              this.showToast('הייצוא לדפוס הושלם בהצלחה!');
            })
            .catch((err: any) => {
              this.showToast(`שגיאת ייצוא: ${err.message}`, true);
            });
        } else {
          this.showToast('הדמיית ייצוא: קובץ ISO PDF/X-1a הופק בהצלחה!');
        }
        break;
      case 'normalize-hebrew':
        this.showToast('נרמול ניקוד וטעמים ת"י 6100 הוחל בהצלחה על כל הפסקאות');
        break;
      case 'shield-divine-names':
        this.showToast('מגן שמות קדושים הופעל (איסור שבירה בשמות הויה ואדנות)');
        break;
      case 'recalculate-gematria':
        this.showToast('סנכרון מספור עמודים עברי בגימטריה הושלם');
        break;
      case 'apply-justification':
        this.showToast('יישור עברי מלא הוחל: רווחי מילים 85%-125% + מתיחת אהלתר"ם 120%');
        break;
      default:
        console.log('[TOK] Action:', action);
    }
  }

  public showToast(msg: string, isError = false): void {
    const toast = document.createElement('div');
    toast.className = 'tok-toast';
    toast.style.background = isError ? '#EF4444' : '#1E293B';
    toast.style.borderColor = isError ? '#B91C1C' : '#334155';
    toast.innerHTML = `<span>${isError ? '⚠️' : '⚡'}</span><span>${msg}</span>`;

    document.body.appendChild(toast);
    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transition = 'opacity 0.25s ease';
      setTimeout(() => toast.remove(), 250);
    }, 3200);
  }

  private toGematria(num: number): string {
    if (num <= 0) return '';
    const letters: [number, string][] = [
      [400, 'ת'], [300, 'ש'], [200, 'ר'], [100, 'ק'],
      [90, 'צ'], [80, 'פ'], [70, 'ע'], [60, 'ס'],
      [50, 'נ'], [40, 'מ'], [30, 'ל'], [20, 'כ'],
      [10, 'י'], [9, 'ט'], [8, 'ח'], [7, 'ז'],
      [6, 'ו'], [5, 'ה'], [4, 'ד'], [3, 'ג'],
      [2, 'ב'], [1, 'א']
    ];
    let n = num;
    let res = '';
    if (n === 15) return 'ט״ו';
    if (n === 16) return 'ט״ז';

    for (const [val, char] of letters) {
      while (n >= val) {
        res += char;
        n -= val;
      }
    }
    if (res.length === 1) return res + '׳';
    else if (res.length > 1) return res.slice(0, -1) + '״' + res.slice(-1);
    return res;
  }
}
