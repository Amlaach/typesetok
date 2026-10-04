export interface PluginItem {
  id: string;
  name: string;
  version: string;
  description: string;
  author?: string;
  sourceType: 'ts' | 'js';
  enabled: boolean;
  compiledCode?: string;
}

export interface PluginContext {
  registerCommand: (cmd: { id: string; title: string; category: string; action: () => void }) => void;
  showToast: (msg: string) => void;
}

export class PluginEngine {
  private plugins: PluginItem[] = [];
  private onCommandRegistered?: (cmd: { id: string; title: string; category: string; action: () => void }) => void;
  private onToast?: (msg: string) => void;

  constructor(
    onCommandRegistered?: (cmd: { id: string; title: string; category: string; action: () => void }) => void,
    onToast?: (msg: string) => void
  ) {
    this.onCommandRegistered = onCommandRegistered;
    this.onToast = onToast;
  }

  public async loadPlugins(): Promise<PluginItem[]> {
    const win = window as any;
    if (win.tokIpc && win.tokIpc.getPlugins) {
      try {
        const rawPlugins = await win.tokIpc.getPlugins();
        this.plugins = rawPlugins.map((p: any) => ({
          id: p.manifest.id,
          name: p.manifest.name,
          version: p.manifest.version,
          description: p.manifest.description,
          author: p.manifest.author,
          sourceType: p.sourceType,
          enabled: p.enabled,
          compiledCode: p.compiledCode
        }));
      } catch (err: any) {
        console.warn('[PLUGIN-ENGINE] Failed to fetch plugins from IPC:', err.message);
      }
    } else {
      // Default built-in mock plugins for preview
      this.plugins = [
        {
          id: 'tok-smart-quotes',
          name: 'מרכאות עבריות חכמות (Smart Quotes TS)',
          version: '1.0.0',
          description: 'תוסף TypeScript הממיר מרכאות פשוטות למרכאות כפולות עבריות תקניות (״) וגרשיים (׳)',
          author: 'TypesetOK Core',
          sourceType: 'ts',
          enabled: true
        },
        {
          id: 'tok-word-counter',
          name: 'מונה מילים ואותיות חי (Live Counter JS)',
          version: '1.1.0',
          description: 'תוסף JavaScript לסטטיסטיקה חיה של אותיות, מילים ופסוקים בעמוד',
          author: 'Community Contributor',
          sourceType: 'js',
          enabled: true
        }
      ];
    }

    this.activateEnabledPlugins();
    return this.plugins;
  }

  public getPlugins(): PluginItem[] {
    return [...this.plugins];
  }

  private activateEnabledPlugins(): void {
    const context: PluginContext = {
      registerCommand: (cmd) => {
        if (this.onCommandRegistered) this.onCommandRegistered(cmd);
      },
      showToast: (msg) => {
        if (this.onToast) this.onToast(msg);
      }
    };

    for (const p of this.plugins) {
      if (!p.enabled || !p.compiledCode) continue;

      try {
        // Evaluate compiled JS/TS bundle safely
        const runner = new Function('tok', 'module', 'exports', `
          ${p.compiledCode}
          if (typeof activate === 'function') {
            activate(tok);
          } else if (typeof module !== 'undefined' && module.exports && typeof module.exports.activate === 'function') {
            module.exports.activate(tok);
          }
        `);
        const fakeModule = { exports: {} };
        runner(context, fakeModule, fakeModule.exports);
        console.log(`[PLUGIN-ENGINE] Activated plugin: ${p.name} (${p.sourceType.toUpperCase()})`);
      } catch (err: any) {
        console.error(`[PLUGIN-ENGINE] Failed to activate plugin ${p.name}:`, err.message);
      }
    }
  }

  public async togglePlugin(pluginId: string, enabled: boolean): Promise<boolean> {
    const target = this.plugins.find(p => p.id === pluginId);
    if (target) {
      target.enabled = enabled;
    }
    const win = window as any;
    if (win.tokIpc && win.tokIpc.togglePlugin) {
      await win.tokIpc.togglePlugin(pluginId, enabled);
    }
    return true;
  }

  public async openPluginsFolder(): Promise<void> {
    const win = window as any;
    if (win.tokIpc && win.tokIpc.openPluginsFolder) {
      await win.tokIpc.openPluginsFolder();
    }
  }
}
