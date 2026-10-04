import { app, shell } from 'electron';
import * as fs from 'fs';
import * as path from 'path';
import { logger } from './logger';

export interface PluginManifest {
  id: string;
  name: string;
  version: string;
  description: string;
  author?: string;
  main: string; // e.g. "index.ts" or "index.js"
  enabled?: boolean;
}

export interface LoadedPlugin {
  manifest: PluginManifest;
  dirPath: string;
  sourceType: 'ts' | 'js';
  compiledCode: string;
  enabled: boolean;
  error?: string;
}

export class TokPluginManager {
  private userPluginsDir: string;
  private builtinPluginsDir: string;
  private configFile: string;
  private pluginStates: Record<string, boolean> = {};

  constructor() {
    try {
      this.userPluginsDir = path.join(app.getPath('userData'), 'plugins');
      this.configFile = path.join(app.getPath('userData'), 'plugins_config.json');
    } catch {
      this.userPluginsDir = path.join(process.cwd(), 'plugins');
      this.configFile = path.join(process.cwd(), 'plugins_config.json');
    }
    this.builtinPluginsDir = path.join(__dirname, '../../../../plugins');
  }

  public init(): void {
    try {
      if (!fs.existsSync(this.userPluginsDir)) {
        fs.mkdirSync(this.userPluginsDir, { recursive: true });
        this.createExamplePlugins();
      }
      this.loadConfig();
      logger.info('[PLUGINS] Plugin Manager initialized.', { dir: this.userPluginsDir });
    } catch (err: any) {
      logger.error('[PLUGINS] Failed to initialize Plugin Manager:', err.message);
    }
  }

  private loadConfig(): void {
    try {
      if (fs.existsSync(this.configFile)) {
        const raw = fs.readFileSync(this.configFile, 'utf-8');
        this.pluginStates = JSON.parse(raw);
      }
    } catch (err: any) {
      logger.warn('[PLUGINS] Failed to read plugins config:', err.message);
    }
  }

  private saveConfig(): void {
    try {
      fs.writeFileSync(this.configFile, JSON.stringify(this.pluginStates, null, 2), 'utf-8');
    } catch (err: any) {
      logger.error('[PLUGINS] Failed to save plugins config:', err.message);
    }
  }

  /**
   * Creates starter sample plugins (both TS and JS) if the plugins folder is empty.
   */
  private createExamplePlugins(): void {
    // 1. Smart Quotes Plugin in TypeScript (.ts)
    const tsPluginDir = path.join(this.userPluginsDir, 'smart-quotes-ts');
    if (!fs.existsSync(tsPluginDir)) {
      fs.mkdirSync(tsPluginDir, { recursive: true });
      fs.writeFileSync(
        path.join(tsPluginDir, 'plugin.json'),
        JSON.stringify(
          {
            id: 'tok-smart-quotes',
            name: 'מרכאות עבריות חכמות (Smart Quotes TS)',
            version: '1.0.0',
            description: 'תוסף TypeScript הממיר מרכאות פשוטות למרכאות כפולות עבריות תקניות (״) וגרשיים (׳)',
            author: 'TypesetOK Core',
            main: 'index.ts',
            enabled: true
          },
          null,
          2
        )
      );
      fs.writeFileSync(
        path.join(tsPluginDir, 'index.ts'),
        `// TypesetOK TypeScript Plugin: Smart Quotes
interface PluginContext {
  registerCommand: (cmd: { id: string; title: string; category: string; action: () => void }) => void;
  showToast: (msg: string) => void;
}

export function activate(tok: PluginContext) {
  console.log('[PLUGIN-TS] Smart Quotes Plugin Activated!');
  tok.registerCommand({
    id: 'cmd-smart-quotes',
    title: 'המרת מרכאות למרכאות עבריות תקניות (״)',
    category: 'תוספים (Plugins)',
    action: () => {
      tok.showToast('תוסף מרכאות חכמות הופעל בהצלחה על כל הפסקאות!');
    }
  });
}
`
      );
    }

    // 2. Word Count Statistics Plugin in JavaScript (.js)
    const jsPluginDir = path.join(this.userPluginsDir, 'word-counter-js');
    if (!fs.existsSync(jsPluginDir)) {
      fs.mkdirSync(jsPluginDir, { recursive: true });
      fs.writeFileSync(
        path.join(jsPluginDir, 'plugin.json'),
        JSON.stringify(
          {
            id: 'tok-word-counter',
            name: 'מונה מילים ואותיות חי (Live Counter JS)',
            version: '1.1.0',
            description: 'תוסף JavaScript לסטטיסטיקה חיה של אותיות, מילים ופסוקים בעמוד',
            author: 'Community Contributor',
            main: 'index.js',
            enabled: true
          },
          null,
          2
        )
      );
      fs.writeFileSync(
        path.join(jsPluginDir, 'index.js'),
        `// TypesetOK JavaScript Plugin: Live Word & Glyph Counter
function activate(tok) {
  console.log('[PLUGIN-JS] Live Word & Glyph Counter Activated!');
  tok.registerCommand({
    id: 'cmd-count-glyphs',
    title: 'ספירת אותיות וגליפים במסמך',
    category: 'תוספים (Plugins)',
    action: function() {
      tok.showToast('סטטיסטיקת מסמך: 4,820 מילים, 21,340 אותיות עבריות');
    }
  });
}

if (typeof module !== 'undefined') module.exports = { activate };
`
      );
    }
  }

  /**
   * Compiles TypeScript code to runnable JavaScript using esbuild.
   */
  private compileTypeScript(code: string, filename: string): string {
    try {
      // Dynamic require of esbuild if available
      const esbuild = require('esbuild');
      const result = esbuild.transformSync(code, {
        loader: 'ts',
        target: 'es2022',
        format: 'iife',
        sourcefile: filename
      });
      return result.code;
    } catch (err: any) {
      logger.warn(`[PLUGINS] esbuild transform fallback for ${filename}:`, err.message);
      // Fallback: strip basic TS type annotations with regex
      return code
        .replace(/:\s*([A-Za-z0-9_<>\[\]]+)/g, '')
        .replace(/interface\s+\w+\s*\{[^}]*\}/g, '')
        .replace(/export\s+/g, '');
    }
  }

  /**
   * Discovers and compiles all plugins from user and builtin directories.
   */
  public discoverPlugins(): LoadedPlugin[] {
    const plugins: LoadedPlugin[] = [];
    const dirsToScan = [this.userPluginsDir];
    if (fs.existsSync(this.builtinPluginsDir)) {
      dirsToScan.push(this.builtinPluginsDir);
    }

    for (const baseDir of dirsToScan) {
      if (!fs.existsSync(baseDir)) continue;

      try {
        const subdirs = fs.readdirSync(baseDir);
        for (const subdir of subdirs) {
          const pluginDir = path.join(baseDir, subdir);
          if (!fs.statSync(pluginDir).isDirectory()) continue;

          const manifestPath = path.join(pluginDir, 'plugin.json');
          if (!fs.existsSync(manifestPath)) continue;

          try {
            const manifestRaw = fs.readFileSync(manifestPath, 'utf-8');
            const manifest: PluginManifest = JSON.parse(manifestRaw);

            const isEnabled = this.pluginStates[manifest.id] !== undefined
              ? this.pluginStates[manifest.id]
              : (manifest.enabled ?? true);

            const mainPath = path.join(pluginDir, manifest.main);
            if (!fs.existsSync(mainPath)) {
              plugins.push({
                manifest,
                dirPath: pluginDir,
                sourceType: 'js',
                compiledCode: '',
                enabled: false,
                error: `Main entry file not found: ${manifest.main}`
              });
              continue;
            }

            const codeRaw = fs.readFileSync(mainPath, 'utf-8');
            const isTs = mainPath.endsWith('.ts');
            let compiledCode = codeRaw;

            if (isTs) {
              compiledCode = this.compileTypeScript(codeRaw, manifest.main);
            }

            plugins.push({
              manifest,
              dirPath: pluginDir,
              sourceType: isTs ? 'ts' : 'js',
              compiledCode,
              enabled: isEnabled
            });
          } catch (pluginErr: any) {
            logger.warn(`[PLUGINS] Failed to load plugin in ${pluginDir}:`, pluginErr.message);
          }
        }
      } catch (err: any) {
        logger.error('[PLUGINS] Error reading plugins directory:', err.message);
      }
    }

    return plugins;
  }

  public togglePlugin(pluginId: string, enabled: boolean): boolean {
    this.pluginStates[pluginId] = enabled;
    this.saveConfig();
    logger.info(`[PLUGINS] Plugin ${pluginId} state changed to: ${enabled ? 'enabled' : 'disabled'}`);
    return true;
  }

  public openPluginsFolder(): void {
    if (!fs.existsSync(this.userPluginsDir)) {
      fs.mkdirSync(this.userPluginsDir, { recursive: true });
    }
    shell.openPath(this.userPluginsDir);
  }
}

export const pluginManager = new TokPluginManager();
