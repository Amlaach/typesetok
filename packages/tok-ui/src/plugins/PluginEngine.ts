export interface PluginItem {
  id: string;
  name: string;
  version: string;
  description: string;
  author?: string;
  sourceType: 'ts' | 'js';
  enabled: boolean;
  compiledCode?: string;
  error?: string;
}

export interface PluginCommand {
  id: string;
  title: string;
  category: string;
  action: () => void;
}

export interface PluginContext {
  registerCommand: (cmd: PluginCommand) => void;
  showToast: (msg: string) => void;
}

/**
 * Converts one raw entry from the main process (`LoadedPlugin`) into a PluginItem.
 * Returns null for malformed entries so that one broken plugin.json cannot make the
 * whole list disappear (the previous `.map()` threw on the first entry without a
 * manifest and the catch dropped every plugin).
 */
export function normalizePluginEntry(raw: unknown): PluginItem | null {
  if (!raw || typeof raw !== 'object') return null;
  const p = raw as Record<string, any>;
  const m = p.manifest;
  if (!m || typeof m !== 'object' || typeof m.id !== 'string' || !m.id) return null;
  return {
    id: m.id,
    name: typeof m.name === 'string' && m.name ? m.name : m.id,
    version: typeof m.version === 'string' ? m.version : '0.0.0',
    description: typeof m.description === 'string' ? m.description : '',
    author: typeof m.author === 'string' ? m.author : undefined,
    sourceType: p.sourceType === 'ts' ? 'ts' : 'js',
    enabled: p.enabled === true,
    compiledCode: typeof p.compiledCode === 'string' ? p.compiledCode : undefined,
    error: typeof p.error === 'string' ? p.error : undefined,
  };
}

export class PluginEngine {
  private plugins: PluginItem[] = [];
  private onCommandRegistered?: (cmd: PluginCommand) => void;
  private onToast?: (msg: string) => void;
  /** Plugins whose code already ran in this renderer. Code cannot be un-run, so each plugin activates at most once. */
  private activated = new Set<string>();
  /** Command ids each plugin registered, so they can be withdrawn when it is disabled. */
  private commandsByPlugin = new Map<string, Map<string, PluginCommand>>();
  private onCommandUnregistered?: (commandId: string) => void;

  constructor(
    onCommandRegistered?: (cmd: PluginCommand) => void,
    onToast?: (msg: string) => void,
    onCommandUnregistered?: (commandId: string) => void
  ) {
    this.onCommandRegistered = onCommandRegistered;
    this.onToast = onToast;
    this.onCommandUnregistered = onCommandUnregistered;
  }

  public async loadPlugins(): Promise<PluginItem[]> {
    const win = window as any;
    if (win.tokIpc && win.tokIpc.getPlugins) {
      try {
        const rawPlugins = await win.tokIpc.getPlugins();
        const list: unknown[] = Array.isArray(rawPlugins) ? rawPlugins : [];
        const seen = new Set<string>();
        this.plugins = [];
        for (const raw of list) {
          const item = normalizePluginEntry(raw);
          // The same id can exist in both the user and the built-in plugin folders; the first one wins.
          if (!item || seen.has(item.id)) continue;
          seen.add(item.id);
          this.plugins.push(item);
        }
      } catch (err: any) {
        console.warn('[PLUGIN-ENGINE] Failed to fetch plugins from IPC:', err?.message ?? err);
      }
    } else {
      // Standalone web preview: start with empty plugins list
      this.plugins = [];
    }

    for (const p of this.plugins) {
      if (p.enabled) this.activatePlugin(p);
    }
    return this.getPlugins();
  }

  public getPlugins(): PluginItem[] {
    return this.plugins.map((p) => ({ ...p }));
  }

  public isActivated(pluginId: string): boolean {
    return this.activated.has(pluginId);
  }

  private createContext(pluginId: string): PluginContext {
    return {
      registerCommand: (cmd) => {
        if (!cmd || typeof cmd.id !== 'string' || typeof cmd.action !== 'function') {
          console.warn(`[PLUGIN-ENGINE] ${pluginId}: ignoring invalid command`, cmd);
          return;
        }
        let cmds = this.commandsByPlugin.get(pluginId);
        if (!cmds) this.commandsByPlugin.set(pluginId, (cmds = new Map()));
        cmds.set(cmd.id, cmd);
        // A disabled plugin's late registrations (timers etc.) are ignored.
        const plugin = this.plugins.find((p) => p.id === pluginId);
        if (plugin && !plugin.enabled) return;
        if (this.onCommandRegistered) this.onCommandRegistered(cmd);
      },
      showToast: (msg) => {
        if (this.onToast) this.onToast(String(msg));
      }
    };
  }

  /**
   * Runs a plugin's code once. Reloading the plugin list ("Reload All Plugins") no longer
   * executes every enabled plugin again, which duplicated whatever side effects it had
   * (listeners, timers, toasts) on each reload.
   */
  private activatePlugin(p: PluginItem): boolean {
    if (this.activated.has(p.id) || !p.compiledCode) return false;
    this.activated.add(p.id);
    try {
      // NOTE: this runs with full renderer privileges (including window.tokIpc); plugins are trusted local code.
      const runner = new Function('tok', 'module', 'exports', `
        ${p.compiledCode}
        ;if (typeof activate === 'function') {
          activate(tok);
        } else if (typeof module !== 'undefined' && module.exports && typeof module.exports.activate === 'function') {
          module.exports.activate(tok);
        }
      `);
      const fakeModule = { exports: {} };
      runner(this.createContext(p.id), fakeModule, fakeModule.exports);
      console.log(`[PLUGIN-ENGINE] Activated plugin: ${p.name} (${p.sourceType.toUpperCase()})`);
      return true;
    } catch (err: any) {
      console.error(`[PLUGIN-ENGINE] Failed to activate plugin ${p.name}:`, err?.message ?? err);
      return false;
    }
  }

  /**
   * Persists the new state first and only then updates the in-memory list, so a failed
   * IPC call leaves both in agreement (the error propagates to the caller). Enabling a
   * plugin activates it right away; disabling takes full effect after a restart.
   */
  public async togglePlugin(pluginId: string, enabled: boolean): Promise<boolean> {
    const win = window as any;
    if (win.tokIpc && win.tokIpc.togglePlugin) {
      await win.tokIpc.togglePlugin(pluginId, enabled);
    }
    const target = this.plugins.find(p => p.id === pluginId);
    if (target) {
      target.enabled = enabled;
      const cmds = [...(this.commandsByPlugin.get(pluginId)?.values() ?? [])];
      if (enabled) {
        // First enable runs the code; re-enabling restores the commands it registered before.
        if (!this.activatePlugin(target)) cmds.forEach((cmd) => this.onCommandRegistered?.(cmd));
      } else if (this.onCommandUnregistered) {
        // Code that already ran cannot be unloaded, but its commands can leave the palette.
        cmds.forEach((cmd) => this.onCommandUnregistered!(cmd.id));
      }
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
