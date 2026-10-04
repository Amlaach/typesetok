import { TopSystemBar } from './components/TopSystemBar';
import { StructureBar } from './components/StructureBar';
import { ContextualInspector } from './components/ContextualInspector';
import { ActionHud } from './components/ActionHud';
import { CommandPalette, PaletteItem } from './components/CommandPalette';
import { StatusBar } from './components/StatusBar';
import { SpreadCanvas, isRightHandPage } from './components/SpreadCanvas';
import { WelcomeModal } from './components/WelcomeModal';
import { SettingsModal } from './components/SettingsModal';
import { AboutModal } from './components/AboutModal';
import { PluginEngine } from './plugins/PluginEngine';
import { StoryEditor, StoryParagraph } from 'tok-story-editor';
import { PageDescriptor } from 'tok-viewer';
import { ViewMode } from './types';
import { i18n, t, tf } from './i18n';
import { themeManager } from './theme';
import { renderIcon } from './icons';

import { toHebrewGematria } from './gematria';
export { toHebrewGematria };

/** Runs `fn` after the next paint, when the renderer is idle (max ~1s later). */
function runWhenIdle(fn: () => void): void {
  const w = window as any;
  requestAnimationFrame(() => {
    if (typeof w.requestIdleCallback === 'function') w.requestIdleCallback(fn, { timeout: 1000 });
    else setTimeout(fn, 0);
  });
}

/** i18n keys for the display names of the multi-flow ids used by the structure bar. */
const FLOW_NAME_KEYS: Record<string, string> = {
  gemara: 'inspFlowGemara',
  rashi: 'inspFlowRashi',
  tosafot: 'inspFlowTosafot',
  notes: 'inspFlowNotes'
};

/** Template id → document title shown in the top bar (document names, not UI text). */
const TEMPLATE_TITLES: Record<string, string> = {
  gemara: 'מסכת ברכות — צורת הדף.tok',
  prose: 'ספר קריאה — מהדורה ראשונה.tok',
  bulletin: 'עלון שבת קודש.tok'
};
const BLANK_TEMPLATE_TITLE = 'מסמך ריק.tok';
const DEMO_PROJECT_TITLE = 'מסכת ברכות — מהדורת מופת.tok';

const countWords = (text: string) => (text.match(/\S+/g) || []).length;

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
  private storyHeader!: HTMLElement;
  private workbench!: HTMLElement;

  // Feature modals are built on first use (they are hidden at startup).
  private welcomeModalInstance?: WelcomeModal;
  private settingsModalInstance?: SettingsModal;
  private aboutModalInstance?: AboutModal;
  private pluginEngine!: PluginEngine;

  private currentViewMode: ViewMode = 'canvas';
  private pages: PageDescriptor[] = [];
  private activePageIndex = 0;
  private activeFlowId: string | null = null;
  private wordCountTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(root: HTMLElement) {
    this.root = root;
    this.root.className = 'tok-workbench-root';
    this.root.dir = i18n.getDirection();
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

    this.initUI();

    i18n.onChange(() => this.applyLanguage());
  }

  private initUI(): void {
    // 1. Initialize Plugin Engine
    this.pluginEngine = new PluginEngine(
      (cmd) => this.commandPalette?.registerItem(cmd),
      (msg) => this.showToast(msg),
      (id) => this.commandPalette?.unregisterItem(id)
    );

    // 2. Top System Bar (Modern, seamless, no grey toolbar)
    this.topBar = new TopSystemBar({
      onMenuAction: (action, data) => this.handleSystemAction(action, data),
      onOpenCommandPalette: () => this.commandPalette.show(),
      onViewModeChange: (mode) => this.setViewMode(mode),
      onExportPdf: () => this.handleSystemAction('export-pdf'),
      onOpenProjects: () => this.welcomeModal.show(),
      onOpenSettings: () => this.settingsModal.show(),
      onOpenAbout: () => this.aboutModal.show(),
      onToggleLanguage: () => {
        this.showToast(tf('toastLangSwitched', { lang: t(i18n.getLanguage() === 'he' ? 'appLangHebrewRtl' : 'appLangEnglishLtr') }));
      }
    });
    this.root.appendChild(this.topBar.element);

    // 3. Main Workbench Perimeter
    this.workbench = document.createElement('div');
    this.workbench.className = 'tok-workbench-main';
    this.workbench.dir = i18n.getDirection();
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
        this.activeFlowId = flowId;
        const name = this.flowDisplayName(flowId);
        this.statusBar.updateStats({ activeFlow: name });
        this.showToast(tf('toastFlowSelected', { name }));
      },
      onSelectStyle: (styleId) => {
        this.inspector.setMode('text-edit');
        this.showToast(tf('toastStyleApplied', { name: styleId }));
      },
      onToggleLayer: (layerId, visible) => {
        this.showToast(tf('toastLayerToggled', { name: layerId, state: t(visible ? 'appLayerShown' : 'appLayerHidden') }));
      },
      onOpenSettings: () => this.settingsModal.show(),
      onOpenAbout: () => this.aboutModal.show()
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

    this.storyHeader = document.createElement('div');
    this.storyHeader.style.padding = '8px 14px';
    this.storyHeader.style.background = 'var(--tok-bg-surface-2)';
    this.storyHeader.style.borderBottom = '1px solid var(--tok-border-subtle)';
    this.storyHeader.style.fontWeight = 'bold';
    this.storyHeader.style.fontSize = '12px';
    this.storyHeader.style.color = 'var(--tok-text-secondary)';
    this.storyHeader.textContent = t('appStoryEditorTitle');
    this.storyContainer.appendChild(this.storyHeader);

    this.storyEditor = new StoryEditor(this.storyContainer);
    this.storyEditor.onTextChange(() => this.scheduleWordCountUpdate());
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
        this.showToast(t('toastGlobalStyleSynced'));
      },
      onNormalizeNiqqud: () => {
        this.handleSystemAction('normalize-hebrew');
      },
      onAlignFrames: (alignType) => {
        this.showToast(tf('toastAlignApplied', { type: alignType }));
      }
    });
    this.workbench.appendChild(this.inspector.element);

    // 4. Status Bar (26px)
    this.statusBar = new StatusBar({
      onZoomChange: (z) => this.canvas.setZoom(z),
      onPageClick: () => this.commandPalette.show(),
      onPreflightClick: () => {
        this.inspector.setMode('zero');
        this.showToast(t('toastPreflightOk'));
      }
    });
    this.root.appendChild(this.statusBar.element);
    // The structure bar starts on the Gemara flow; show its localized name.
    this.activeFlowId = 'gemara';
    this.statusBar.updateStats({ activeFlow: this.flowDisplayName(this.activeFlowId) });

    // 5. Action HUD (Floating, anchored)
    this.actionHud = new ActionHud({
      onFontChange: (f) => this.inspector.setMode('text-edit', undefined, { fontFamily: f }),
      onSizeChange: (s) => this.inspector.setMode('text-edit', undefined, { fontSizePt: s }),
      onWeightChange: (b) => this.inspector.setMode('text-edit', undefined, { fontWeight: b ? 'bold' : 'normal' }),
      onAlignChange: (a) => this.inspector.setMode('text-edit', undefined, { alignment: a }),
      onStyleChange: (st) => this.showToast(tf('toastQuickStyle', { name: st })),
      onDismiss: () => this.inspector.setMode('zero')
    });
    this.root.appendChild(this.actionHud.element);

    // 6. Command Palette (Ctrl+K). Its global shortcut must be live from the start.
    this.commandPalette = new CommandPalette(this.buildCommands());
    this.root.appendChild(this.commandPalette.element);

    // 7. Welcome / Settings / About are created lazily on first open (see getters below).

    // Load plugins once the first frame is on screen: discovery/compilation happens
    // in the main process and must not compete with the initial paint.
    runWhenIdle(() => {
      this.pluginEngine.loadPlugins().catch(console.error);
    });

    // 8. First launch project picker check
    let showWelcome: string | null = null;
    try {
      showWelcome = localStorage.getItem('tok_show_welcome');
    } catch {}
    if (showWelcome !== 'false') {
      setTimeout(() => this.welcomeModal.show(), 100);
    }
  }

  /** Re-applies texts owned by the app shell after a language switch. */
  private applyLanguage(): void {
    const dir = i18n.getDirection();
    this.root.dir = dir;
    this.workbench.dir = dir;
    this.storyHeader.textContent = t('appStoryEditorTitle');
    // registerItem replaces by id, so plugin-registered commands are kept.
    for (const cmd of this.buildCommands()) this.commandPalette.registerItem(cmd);
    this.refreshThumbnails();
    this.updatePageStats(this.activePageIndex);
    if (this.activeFlowId) {
      this.statusBar.updateStats({ activeFlow: this.flowDisplayName(this.activeFlowId) });
    }
  }

  private flowDisplayName(flowId: string): string {
    const key = FLOW_NAME_KEYS[flowId];
    return key ? t(key) : flowId;
  }

  private get welcomeModal(): WelcomeModal {
    if (!this.welcomeModalInstance) {
      this.welcomeModalInstance = new WelcomeModal({
        onSelectTemplate: (tmpl) => this.handleTemplateSelect(tmpl),
        onOpenProject: () => this.handleSystemAction('open-document'),
        onLoadDemo: () => this.loadDemoProject(),
        onClose: () => {},
        onOpenSettings: () => this.settingsModal.show(),
        onOpenAbout: () => this.aboutModal.show()
      });
      this.root.appendChild(this.welcomeModalInstance.element);
    }
    return this.welcomeModalInstance;
  }

  private get settingsModal(): SettingsModal {
    if (!this.settingsModalInstance) {
      this.settingsModalInstance = new SettingsModal({
        onLanguageChange: (lang) => {
          this.showToast(tf('toastLangUpdated', { lang: t(lang === 'he' ? 'appLangHebrew' : 'appLangEnglish') }));
        },
        onClose: () => {},
        pluginEngine: this.pluginEngine,
        showToast: (msg) => this.showToast(msg)
      });
      this.root.appendChild(this.settingsModalInstance.element);
    }
    return this.settingsModalInstance;
  }

  private get aboutModal(): AboutModal {
    if (!this.aboutModalInstance) {
      this.aboutModalInstance = new AboutModal({
        onClose: () => {}
      });
      this.root.appendChild(this.aboutModalInstance.element);
    }
    return this.aboutModalInstance;
  }

  public openWelcome(): void {
    this.welcomeModal.show();
  }

  public openSettings(): void {
    this.settingsModal.show();
  }

  public openAbout(): void {
    this.aboutModal.show();
  }

  /** Built-in palette commands in the current UI language. */
  private buildCommands(): PaletteItem[] {
    return [
      {
        id: 'cmd-open-welcome',
        category: t('cmdCatProjects'),
        title: t('cmdWelcomeTitle'),
        subtitle: t('cmdWelcomeSub'),
        shortcut: 'Ctrl+Shift+P',
        action: () => this.welcomeModal.show()
      },
      {
        id: 'cmd-open-settings',
        category: t('cmdCatSystem'),
        title: t('cmdSettingsTitle'),
        subtitle: t('cmdSettingsSub'),
        shortcut: 'Ctrl+,',
        action: () => this.settingsModal.show()
      },
      {
        id: 'cmd-open-about',
        category: t('cmdCatSystem'),
        title: t('cmdAboutTitle'),
        subtitle: t('cmdAboutSub'),
        action: () => this.aboutModal.show()
      },
      {
        id: 'cmd-toggle-lang',
        category: t('cmdCatSystem'),
        title: t('cmdToggleLangTitle'),
        shortcut: 'Alt+Shift+L',
        action: () => i18n.toggleLanguage()
      },
      {
        id: 'cmd-full-justify',
        category: t('cmdCatTypography'),
        title: t('cmdJustifyTitle'),
        subtitle: t('cmdJustifySub'),
        shortcut: 'Ctrl+Alt+J',
        action: () => this.handleSystemAction('apply-justification')
      },
      {
        id: 'cmd-norm-niqqud',
        category: t('cmdCatTypography'),
        title: t('cmdNormalizeTitle'),
        subtitle: t('cmdNormalizeSub'),
        shortcut: 'Ctrl+Shift+N',
        action: () => this.handleSystemAction('normalize-hebrew')
      },
      {
        id: 'cmd-shield-divine',
        category: t('cmdCatTypography'),
        title: t('cmdShieldTitle'),
        subtitle: t('cmdShieldSub'),
        action: () => this.handleSystemAction('shield-divine-names')
      },
      {
        id: 'cmd-recalc-gematria',
        category: t('cmdCatTypography'),
        title: t('cmdGematriaTitle'),
        subtitle: t('cmdGematriaSub'),
        action: () => this.handleSystemAction('recalculate-gematria')
      },
      {
        id: 'cmd-export-pdf',
        category: t('cmdCatPrint'),
        title: t('cmdExportTitle'),
        subtitle: t('cmdExportSub'),
        shortcut: 'Ctrl+E',
        action: () => this.handleSystemAction('export-pdf')
      },
      {
        id: 'cmd-new-page',
        category: t('cmdCatPages'),
        title: t('cmdNewPageTitle'),
        shortcut: 'Ctrl+Enter',
        action: () => this.addNewPage()
      },
      {
        id: 'cmd-toggle-margins',
        category: t('cmdCatView'),
        title: t('cmdMarginsTitle'),
        action: () => {
          this.canvas.toggleMarginsGuide();
          this.showToast(t('toastMarginsToggled'));
        }
      },
      {
        id: 'cmd-toggle-baseline',
        category: t('cmdCatView'),
        title: t('cmdBaselineTitle'),
        action: () => {
          this.canvas.toggleBaselineGuide();
          this.showToast(t('toastBaselineToggled'));
        }
      },
      {
        id: 'cmd-zoom-100',
        category: t('cmdCatView'),
        title: t('cmdZoom100Title'),
        shortcut: 'Ctrl+0',
        action: () => {
          this.canvas.setZoom(100);
          this.statusBar.updateStats({ zoom: 100 });
        }
      }
    ];
  }

  public loadDocumentPages(pages: PageDescriptor[]): void {
    this.pages = pages;
    this.canvas.setPages(pages);
    this.refreshThumbnails();
    this.updatePageStats(0);
  }

  /** Loads paragraphs into the continuous Story Editor panel. */
  public loadStory(paragraphs: StoryParagraph[]): void {
    this.storyEditor.loadStory(paragraphs);
  }

  private refreshThumbnails(): void {
    this.structureBar.setPages(
      this.pages.map((p, idx) => ({
        pageIndex: p.pageIndex,
        gematria: p.gematriaNumber,
        label: tf('appPageThumb', { page: p.gematriaNumber }),
        isSpreadRight: isRightHandPage(idx)
      })),
      this.activePageIndex
    );
  }

  /** Story edits update the word count in the status bar (debounced while typing). */
  private scheduleWordCountUpdate(): void {
    if (this.wordCountTimer) clearTimeout(this.wordCountTimer);
    this.wordCountTimer = setTimeout(() => {
      this.wordCountTimer = null;
      const words = this.storyEditor.getStory().reduce((sum, p) => sum + countWords(p.text), 0);
      this.statusBar.updateStats({ wordCount: words });
    }, 250);
  }

  private handleTemplateSelect(templateId: string): void {
    const name = TEMPLATE_TITLES[templateId] || BLANK_TEMPLATE_TITLE;
    this.topBar.setDocumentTitle(name);
    this.showToast(tf('toastProjectCreated', { name }));
  }

  private loadDemoProject(): void {
    this.topBar.setDocumentTitle(DEMO_PROJECT_TITLE);
    this.showToast(t('toastDemoLoaded'));
  }

  public setViewMode(mode: ViewMode): void {
    this.currentViewMode = mode;
    if (mode === 'canvas') {
      this.canvas.element.style.display = 'flex';
      this.storyContainer.style.display = 'none';
      this.storyContainer.style.flex = '';
    } else if (mode === 'story') {
      this.canvas.element.style.display = 'none';
      this.storyContainer.style.display = 'flex';
      this.storyContainer.style.flex = '1';
    } else if (mode === 'split') {
      this.canvas.element.style.display = 'flex';
      this.canvas.element.style.flex = '1';
      this.storyContainer.style.display = 'flex';
      // Back to a fixed-width side panel (story mode stretches it with flex: 1).
      this.storyContainer.style.flex = '';
      this.storyContainer.style.width = '380px';
    }
  }

  public getViewMode(): ViewMode {
    return this.currentViewMode;
  }

  private addNewPage(): void {
    const newIdx = this.pages.length;
    const newGematria = toHebrewGematria(newIdx + 1);
    this.pages.push({
      pageIndex: newIdx,
      gematriaNumber: newGematria,
      widthPt: 480,
      heightPt: 680,
      htmlContent: ''
    });
    this.loadDocumentPages(this.pages);
    this.canvas.scrollToPage(newIdx);
    this.updatePageStats(newIdx);
    this.showToast(tf('toastPageAdded', { page: newGematria, index: newIdx + 1 }));
  }

  private updatePageStats(idx: number): void {
    this.activePageIndex = idx;
    const p = this.pages[idx];
    const gematria = p ? p.gematriaNumber : toHebrewGematria(idx + 1);
    this.statusBar.updateStats({
      pageLabel: tf('appPageStatus', { page: gematria, index: idx + 1, total: this.pages.length })
    });
    this.structureBar.setActivePage(idx);
  }

  /**
   * Single entry point for app-level actions: top bar, command palette, the
   * native menu (via IPC) and `tok-action` DOM events all route through here.
   */
  public handleSystemAction(action: string, data?: unknown): void {
    const win = window as any;

    switch (action) {
      case 'new-document':
      case 'open-projects':
      case 'open-welcome':
        this.welcomeModal.show();
        break;
      case 'open-settings':
        this.settingsModal.show();
        break;
      case 'open-about':
        this.aboutModal.show();
        break;
      case 'toggle-lang':
        i18n.toggleLanguage();
        break;
      case 'open-document':
        this.showToast(tf('toastOpenFile', { path: typeof data === 'string' ? data : '' }));
        break;
      case 'save-document':
      case 'save-as':
        this.showToast(t('toastSaved'));
        break;
      case 'export-pdf':
        if (win.tokIpc) {
          this.showToast(t('toastExporting'));
          win.tokIpc.renderPdf('--demo', 'TypesetOK_Export.pdf')
            .then(() => {
              this.showToast(t('toastExportDone'));
            })
            .catch((err: any) => {
              this.showToast(tf('toastExportError', { error: err?.message ?? String(err) }), true);
            });
        } else {
          this.showToast(t('toastExportSimulated'));
        }
        break;
      case 'normalize-hebrew':
        this.showToast(t('toastNormalized'));
        break;
      case 'shield-divine-names':
        this.showToast(t('toastShieldOn'));
        break;
      case 'recalculate-gematria':
        this.showToast(t('toastGematriaSynced'));
        break;
      case 'apply-justification':
        this.showToast(t('toastJustified'));
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
    // Messages can carry file paths, CLI stderr or plugin text: never parse them as HTML.
    toast.innerHTML = renderIcon(isError ? 'warning' : 'zap', 14);
    const text = document.createElement('span');
    text.textContent = msg;
    toast.appendChild(text);

    document.body.appendChild(toast);
    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transition = 'opacity 0.25s ease';
      setTimeout(() => toast.remove(), 250);
    }, 3200);
  }
}
