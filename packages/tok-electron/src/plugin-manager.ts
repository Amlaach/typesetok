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

/** Bump when compiler options change so stale compiled output is discarded. */
const COMPILE_CACHE_VERSION = 2;

interface CompileCacheEntry {
  mtimeMs: number;
  size: number;
  code: string;
}

const fsp = fs.promises;

async function pathExists(p: string): Promise<boolean> {
  try {
    await fsp.access(p);
    return true;
  } catch {
    return false;
  }
}

/** Write-then-rename so a crash or quit mid-write never leaves a truncated JSON file. */
async function writeFileAtomic(file: string, data: string): Promise<void> {
  const tmp = `${file}.${process.pid}.tmp`;
  await fsp.writeFile(tmp, data, 'utf-8');
  try {
    await fsp.rename(tmp, file);
  } catch (err) {
    await fsp.unlink(tmp).catch(() => {});
    throw err;
  }
}

/** esbuild is a dev dependency: present when running from source, absent in packaged builds. */
let esbuildModule: any | null | undefined;
function loadEsbuild(): any | null {
  if (esbuildModule === undefined) {
    try {
      esbuildModule = require('esbuild');
    } catch {
      esbuildModule = null;
    }
  }
  return esbuildModule;
}

export class TokPluginManager {
  private userPluginsDir: string;
  private builtinPluginsDir: string;
  private configFile: string;
  private cacheFile: string;
  private pluginStates: Record<string, boolean> = {};
  private compileCache: Record<string, CompileCacheEntry> = {};
  private initPromise: Promise<void> | null = null;
  private discoverPromise: Promise<LoadedPlugin[]> | null = null;

  constructor() {
    let base: string;
    try {
      base = app.getPath('userData');
    } catch {
      base = process.cwd();
    }
    this.userPluginsDir = path.join(base, 'plugins');
    this.configFile = path.join(base, 'plugins_config.json');
    this.cacheFile = path.join(base, 'plugins_compile_cache.json');
    // <app root>/plugins (repo root in dev, resources/app in packaged builds)
    this.builtinPluginsDir = path.join(__dirname, '../../../plugins');
  }

  /**
   * Lazy, idempotent, non-blocking initialisation: creates the user plugin folder
   * (with starter examples) on first run and loads the enabled/disabled states and
   * the compile cache. Runs on first use instead of on the startup path.
   */
  public init(): Promise<void> {
    if (!this.initPromise) {
      this.initPromise = this.doInit().catch((err: any) => {
        logger.error('[PLUGINS] Failed to initialize Plugin Manager:', err?.message);
      });
    }
    return this.initPromise;
  }

  private async doInit(): Promise<void> {
    if (!(await pathExists(this.userPluginsDir))) {
      await fsp.mkdir(this.userPluginsDir, { recursive: true });
    } else {
      // Clean up legacy starter examples if present so users don't see mock/dummy plugins
      for (const legacyDir of ['smart-quotes-ts', 'word-counter-js']) {
        const p = path.join(this.userPluginsDir, legacyDir);
        if (await pathExists(p)) {
          try {
            await fsp.rm(p, { recursive: true, force: true });
          } catch {}
        }
      }
    }
    this.pluginStates = await this.readJson(this.configFile, {});
    // Clean legacy dummy ids from config
    delete this.pluginStates['tok-smart-quotes'];
    delete this.pluginStates['tok-word-counter'];

    const cache = await this.readJson<{ version?: number; entries?: Record<string, CompileCacheEntry> }>(this.cacheFile, {});
    this.compileCache = cache.version === COMPILE_CACHE_VERSION && cache.entries ? cache.entries : {};
    logger.info('[PLUGINS] Plugin Manager initialized.', { dir: this.userPluginsDir });
  }

  private async readJson<T>(file: string, fallback: T): Promise<T> {
    try {
      const parsed = JSON.parse(await fsp.readFile(file, 'utf-8'));
      return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : fallback;
    } catch (err: any) {
      if (err?.code !== 'ENOENT') logger.warn(`[PLUGINS] Ignoring unreadable ${path.basename(file)}:`, err?.message);
      return fallback;
    }
  }

  private async saveConfig(): Promise<void> {
    try {
      await writeFileAtomic(this.configFile, JSON.stringify(this.pluginStates, null, 2));
    } catch (err: any) {
      logger.error('[PLUGINS] Failed to save plugins config:', err?.message);
    }
  }

  /**
   * Compiles TypeScript code to runnable JavaScript using esbuild's async API
   * (never blocks the main process). Falls back to a crude type-stripping regex
   * when esbuild is not available (packaged builds).
   */
  private async compileTypeScript(code: string, filename: string): Promise<string> {
    const esbuild = loadEsbuild();
    if (esbuild) {
      try {
        // CommonJS output: `export function activate` becomes `module.exports.activate`,
        // which the renderer's PluginEngine looks up. (An IIFE would hide `activate`
        // inside its closure, so TS plugins never activated.)
        const result = await esbuild.transform(code, {
          loader: 'ts',
          target: 'es2022',
          format: 'cjs',
          charset: 'utf8',
          sourcefile: filename
        });
        return result.code;
      } catch (err: any) {
        logger.warn(`[PLUGINS] esbuild transform failed for ${filename}, using fallback:`, err?.message);
      }
    }
    // Fallback: strip basic TS type annotations with regex
    return code
      .replace(/:\s*([A-Za-z0-9_<>\[\]]+)/g, '')
      .replace(/interface\s+\w+\s*\{[^}]*\}/g, '')
      .replace(/export\s+/g, '');
  }

  /** Returns compiled code for a TS entry, reusing the on-disk cache when the source is unchanged. */
  private async getCompiledTs(mainPath: string, code: string, filename: string): Promise<{ code: string; fresh: boolean }> {
    const stats = await fsp.stat(mainPath);
    const cached = this.compileCache[mainPath];
    if (cached && cached.mtimeMs === stats.mtimeMs && cached.size === stats.size) {
      return { code: cached.code, fresh: false };
    }
    const compiled = await this.compileTypeScript(code, filename);
    // Only cache real esbuild output, so a later run with esbuild available recompiles.
    if (loadEsbuild()) {
      this.compileCache[mainPath] = { mtimeMs: stats.mtimeMs, size: stats.size, code: compiled };
    }
    return { code: compiled, fresh: true };
  }

  private async loadPlugin(pluginDir: string): Promise<{ plugin: LoadedPlugin | null; compiled: boolean }> {
    const manifestPath = path.join(pluginDir, 'plugin.json');
    let manifest: PluginManifest;
    try {
      manifest = JSON.parse(await fsp.readFile(manifestPath, 'utf-8'));
    } catch (err: any) {
      if (err?.code !== 'ENOENT' && err?.code !== 'ENOTDIR') logger.warn(`[PLUGINS] Invalid plugin.json in ${pluginDir}:`, err?.message);
      return { plugin: null, compiled: false };
    }
    if (!manifest || typeof manifest.id !== 'string' || typeof manifest.main !== 'string') {
      logger.warn(`[PLUGINS] plugin.json in ${pluginDir} is missing "id" or "main"`);
      return { plugin: null, compiled: false };
    }

    const isEnabled = this.pluginStates[manifest.id] !== undefined
      ? this.pluginStates[manifest.id]
      : (manifest.enabled ?? true);

    const mainPath = path.resolve(pluginDir, manifest.main);
    const isTs = mainPath.endsWith('.ts');
    const broken = (error: string): LoadedPlugin => ({
      manifest,
      dirPath: pluginDir,
      sourceType: isTs ? 'ts' : 'js',
      compiledCode: '',
      enabled: false,
      error
    });

    // The entry file must live inside the plugin's own folder.
    const rel = path.relative(pluginDir, mainPath);
    if (!rel || rel.startsWith('..') || path.isAbsolute(rel)) {
      return { plugin: broken(`Main entry must be inside the plugin folder: ${manifest.main}`), compiled: false };
    }

    let codeRaw: string;
    try {
      codeRaw = await fsp.readFile(mainPath, 'utf-8');
    } catch {
      return { plugin: broken(`Main entry file not found: ${manifest.main}`), compiled: false };
    }

    let compiledCode = codeRaw;
    let compiled = false;
    if (isTs) {
      const r = await this.getCompiledTs(mainPath, codeRaw, manifest.main);
      compiledCode = r.code;
      compiled = r.fresh;
    }

    return {
      plugin: { manifest, dirPath: pluginDir, sourceType: isTs ? 'ts' : 'js', compiledCode, enabled: isEnabled },
      compiled
    };
  }

  /**
   * Discovers and compiles all plugins from user and builtin directories.
   * Fully asynchronous; concurrent callers share one scan.
   */
  public discoverPlugins(): Promise<LoadedPlugin[]> {
    if (!this.discoverPromise) {
      this.discoverPromise = this.doDiscover().finally(() => {
        this.discoverPromise = null;
      });
    }
    return this.discoverPromise;
  }

  private async doDiscover(): Promise<LoadedPlugin[]> {
    await this.init();
    const plugins: LoadedPlugin[] = [];
    let cacheDirty = false;

    for (const baseDir of [this.userPluginsDir, this.builtinPluginsDir]) {
      let entries: fs.Dirent[];
      try {
        entries = await fsp.readdir(baseDir, { withFileTypes: true });
      } catch (err: any) {
        if (err?.code !== 'ENOENT') logger.error('[PLUGINS] Error reading plugins directory:', err?.message);
        continue;
      }

      const results = await Promise.all(
        entries
          .filter((e) => e.isDirectory() || e.isSymbolicLink())
          .map((e) =>
            this.loadPlugin(path.join(baseDir, e.name)).catch((err: any) => {
              logger.warn(`[PLUGINS] Failed to load plugin in ${path.join(baseDir, e.name)}:`, err?.message);
              return { plugin: null, compiled: false };
            })
          )
      );
      for (const r of results) {
        if (r.plugin) plugins.push(r.plugin);
        if (r.compiled) cacheDirty = true;
      }
    }

    // Drop cache entries of plugins that no longer exist.
    const live = new Set(plugins.map((p) => path.resolve(p.dirPath, p.manifest.main)));
    for (const key of Object.keys(this.compileCache)) {
      if (!live.has(key)) {
        delete this.compileCache[key];
        cacheDirty = true;
      }
    }

    if (cacheDirty) {
      // Shut down esbuild's helper process; it restarts on demand.
      Promise.resolve()
        .then(() => loadEsbuild()?.stop?.())
        .catch(() => {});
      writeFileAtomic(this.cacheFile, JSON.stringify({ version: COMPILE_CACHE_VERSION, entries: this.compileCache })).catch((err: any) => {
        logger.warn('[PLUGINS] Failed to write compile cache:', err?.message);
      });
    }
    return plugins;
  }

  public async togglePlugin(pluginId: string, enabled: boolean): Promise<boolean> {
    if (typeof pluginId !== 'string' || !pluginId) return false;
    await this.init();
    this.pluginStates[pluginId] = Boolean(enabled);
    await this.saveConfig();
    logger.info(`[PLUGINS] Plugin ${pluginId} state changed to: ${enabled ? 'enabled' : 'disabled'}`);
    return true;
  }

  public async openPluginsFolder(): Promise<void> {
    await this.init();
    try {
      await fsp.mkdir(this.userPluginsDir, { recursive: true });
    } catch (err: any) {
      logger.error('[PLUGINS] Cannot create plugins folder:', err?.message);
      return;
    }
    const err = await shell.openPath(this.userPluginsDir);
    if (err) logger.warn('[PLUGINS] Failed to open plugins folder:', err);
  }
}

export const pluginManager = new TokPluginManager();
