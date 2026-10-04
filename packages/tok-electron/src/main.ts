import { app, BrowserWindow, ipcMain, dialog, shell } from 'electron';
import * as path from 'path';
import * as fs from 'fs';
import { spawn } from 'child_process';
import { buildApplicationMenu } from './menu';
import { logger } from './logger';
import { updater } from './updater';
import { pluginManager } from './plugin-manager';

let mainWindow: BrowserWindow | null = null;
let splashWindow: BrowserWindow | null = null;

function getTokCliPath(): string {
  const isWin = process.platform === 'win32';
  const exeName = isWin ? 'tok-cli.exe' : 'tok-cli';

  // 1. Packaged application resources/bin
  const bundled = path.join(process.resourcesPath, 'bin', exeName);
  if (fs.existsSync(bundled)) {
    return bundled;
  }

  // 2. Custom local target directory via CARGO_TARGET_DIR or LOCALAPPDATA env
  if (process.env.CARGO_TARGET_DIR) {
    const customRelease = path.join(process.env.CARGO_TARGET_DIR, 'release', exeName);
    if (fs.existsSync(customRelease)) return customRelease;
    const customDebug = path.join(process.env.CARGO_TARGET_DIR, 'debug', exeName);
    if (fs.existsSync(customDebug)) return customDebug;
  }
  if (process.env.LOCALAPPDATA) {
    const localRelease = path.join(process.env.LOCALAPPDATA, 'tok_target', 'release', exeName);
    if (fs.existsSync(localRelease)) return localRelease;
    const localDebug = path.join(process.env.LOCALAPPDATA, 'tok_target', 'debug', exeName);
    if (fs.existsSync(localDebug)) return localDebug;
  }

  // 3. Monorepo workspace target directories
  const rootRelease = path.join(__dirname, '../../../../target/release', exeName);
  if (fs.existsSync(rootRelease)) {
    return rootRelease;
  }
  const rootDebug = path.join(__dirname, '../../../../target/debug', exeName);
  if (fs.existsSync(rootDebug)) {
    return rootDebug;
  }

  return bundled;
}

/**
 * Creates an instantaneous, dark-themed splash screen with a subtle pulsating logo.
 * Eliminates stark white contrast and provides instant launch feedback (<100ms).
 */
function createSplashWindow(): void {
  splashWindow = new BrowserWindow({
    width: 480,
    height: 340,
    frame: false,
    resizable: false,
    show: true,
    center: true,
    backgroundColor: '#0B132B',
    alwaysOnTop: true,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
    },
  });

  const splashHtml = `
  <!DOCTYPE html>
  <html dir="rtl" lang="he">
  <head>
    <meta charset="utf-8">
    <title>TypesetOK Starting...</title>
    <style>
      * { box-sizing: border-box; margin: 0; padding: 0; }
      body {
        background-color: #0B132B;
        color: #F8FAFC;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", sans-serif;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        height: 100vh;
        user-select: none;
        overflow: hidden;
        border: 1px solid #1E293B;
      }
      .brand-container {
        display: flex;
        flex-direction: column;
        align-items: center;
        text-align: center;
      }
      .logo-icon {
        width: 80px;
        height: 80px;
        margin-bottom: 18px;
        animation: tokGlowPulse 2s ease-in-out infinite;
      }
      @keyframes tokGlowPulse {
        0%, 100% {
          transform: scale(0.96);
          opacity: 0.85;
          filter: drop-shadow(0 0 14px rgba(59, 130, 246, 0.45));
        }
        50% {
          transform: scale(1.05);
          opacity: 1;
          filter: drop-shadow(0 0 28px rgba(59, 130, 246, 0.9));
        }
      }
      .title {
        font-size: 26px;
        font-weight: 800;
        letter-spacing: -0.5px;
        color: #60A5FA;
        margin-bottom: 6px;
      }
      .subtitle {
        font-size: 13px;
        color: #94A3B8;
        font-weight: 500;
        margin-bottom: 22px;
      }
      .loader-bar-wrap {
        width: 200px;
        height: 4px;
        background: #1E293B;
        border-radius: 4px;
        overflow: hidden;
        position: relative;
      }
      .loader-bar {
        position: absolute;
        top: 0;
        bottom: 0;
        background: linear-gradient(90deg, #2563EB, #60A5FA);
        border-radius: 4px;
        animation: loadSlide 1.5s infinite ease-in-out;
      }
      @keyframes loadSlide {
        0% { left: -40%; width: 40%; }
        50% { left: 30%; width: 60%; }
        100% { left: 100%; width: 40%; }
      }
      .status-text {
        font-size: 11px;
        color: #64748B;
        margin-top: 10px;
      }
    </style>
  </head>
  <body>
    <div class="brand-container">
      <svg class="logo-icon" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
        <rect width="64" height="64" rx="14" fill="#1E293B"/>
        <path d="M16 18C16 15.7909 17.7909 14 20 14H44C46.2091 14 48 15.7909 48 18V46C48 48.2091 46.2091 50 44 50H20C17.7909 50 16 48.2091 16 46V18Z" stroke="#3B82F6" stroke-width="2.5" fill="#0F172A"/>
        <line x1="22" y1="24" x2="42" y2="24" stroke="#60A5FA" stroke-width="2.5" stroke-linecap="round"/>
        <line x1="22" y1="32" x2="42" y2="32" stroke="#93C5FD" stroke-width="2" stroke-linecap="round"/>
        <line x1="22" y1="40" x2="36" y2="40" stroke="#93C5FD" stroke-width="2" stroke-linecap="round"/>
        <circle cx="42" cy="40" r="2.5" fill="#3B82F6"/>
      </svg>
      <div class="title">TypesetOK</div>
      <div class="subtitle">תוכנת עימוד מקצועית לטקסט עברי</div>
      <div class="loader-bar-wrap">
        <div class="loader-bar"></div>
      </div>
      <div class="status-text">טוען ליבת עימוד וסביבת עבודה...</div>
    </div>
  </body>
  </html>
  `;

  splashWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(splashHtml)}`);
}

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1024,
    minHeight: 700,
    title: 'TypesetOK (TOK) - תוכנת עימוד מקצועית',
    backgroundColor: '#0B132B',
    show: false, // Hidden until ready, preventing any white flicker
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  // Remove the clunky greyish Windows native menu bar
  const menu = buildApplicationMenu(mainWindow);
  mainWindow.setMenu(menu);
  mainWindow.setMenuBarVisibility(false);
  mainWindow.setAutoHideMenuBar(true);

  // Load UI entry point
  const uiPath = path.join(__dirname, '../../tok-ui/dist/index.html');
  mainWindow.loadFile(uiPath).catch((err) => {
    logger.warn(`Could not load ${uiPath}: ${err.message}. Loading fallback shell.`);
  });

  // Once UI is ready, instantaneously transition from splash to main window
  mainWindow.once('ready-to-show', () => {
    logger.info('[MAIN] Main window ready to show.');
    if (splashWindow && !splashWindow.isDestroyed()) {
      splashWindow.destroy();
      splashWindow = null;
    }
    mainWindow?.show();
    mainWindow?.focus();
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// IPC Handlers
ipcMain.handle('tok:send-command', async (_, cmd: any) => {
  const cli = getTokCliPath();
  const action = typeof cmd === 'string' ? cmd : cmd?.action;
  logger.info(`[IPC] Received send-command: ${action}`);

  if (action === 'ping') {
    return { status: 'ok', version: '0.7.3', cliPath: cli, cliExists: fs.existsSync(cli) };
  }

  if (action === 'get-demo-html') {
    return new Promise((resolve, reject) => {
      const tempPath = path.join(app.getPath('temp'), `tok_demo_${Date.now()}.html`);
      const proc = spawn(cli, ['render-html', '--demo', tempPath]);
      let stderr = '';
      proc.stderr.on('data', (d) => (stderr += d.toString()));
      proc.on('close', (code) => {
        if (code === 0 && fs.existsSync(tempPath)) {
          const content = fs.readFileSync(tempPath, 'utf-8');
          try { fs.unlinkSync(tempPath); } catch {}
          resolve({ ok: true, html: content });
        } else {
          reject(new Error(`Failed to generate demo HTML (code ${code}): ${stderr}`));
        }
      });
    });
  }

  if (action === 'benchmark-typeset') {
    return new Promise((resolve, reject) => {
      const proc = spawn(cli, ['benchmark-typeset', '--pages', '100']);
      let stdout = '';
      let stderr = '';
      proc.stdout.on('data', (d) => (stdout += d.toString()));
      proc.stderr.on('data', (d) => (stderr += d.toString()));
      proc.on('close', (code) => {
        if (code === 0) resolve({ ok: true, output: stdout });
        else reject(new Error(`Benchmark failed: ${stderr}`));
      });
    });
  }

  if (action === 'verify-determinism') {
    return new Promise((resolve, reject) => {
      const proc = spawn(cli, ['verify-determinism']);
      let stdout = '';
      let stderr = '';
      proc.stdout.on('data', (d) => (stdout += d.toString()));
      proc.stderr.on('data', (d) => (stderr += d.toString()));
      proc.on('close', (code) => {
        if (code === 0) resolve({ ok: true, output: stdout });
        else reject(new Error(`Determinism verification failed: ${stderr}`));
      });
    });
  }

  return { status: 'unhandled_command', cmd };
});

ipcMain.handle('tok:render-pdf', async (_, { inputPath, outputPath }) => {
  return new Promise((resolve, reject) => {
    const cli = getTokCliPath();
    const args = ['render-pdf', inputPath, outputPath];
    const proc = spawn(cli, args);

    let stdout = '';
    let stderr = '';
    proc.stdout.on('data', (d) => (stdout += d.toString()));
    proc.stderr.on('data', (d) => (stderr += d.toString()));

    proc.on('close', (code) => {
      if (code === 0) {
        logger.info(`[IPC] PDF rendering succeeded to: ${outputPath}`);
        resolve(stdout);
      } else {
        logger.error(`[IPC] tok-cli failed with code ${code}: ${stderr}`);
        reject(new Error(`tok-cli failed with code ${code}: ${stderr}`));
      }
    });
  });
});

ipcMain.handle('tok:render-html', async (_, { inputPath, outputPath }) => {
  return new Promise((resolve, reject) => {
    const cli = getTokCliPath();
    const args = ['render-html', inputPath, outputPath];
    const proc = spawn(cli, args);

    let stdout = '';
    let stderr = '';
    proc.stdout.on('data', (d) => (stdout += d.toString()));
    proc.stderr.on('data', (d) => (stderr += d.toString()));

    proc.on('close', (code) => {
      if (code === 0) {
        resolve(stdout);
      } else {
        reject(new Error(`tok-cli failed with code ${code}: ${stderr}`));
      }
    });
  });
});

// Logger Handlers
ipcMain.handle('tok:get-recent-logs', async () => {
  return logger.getRecentLogs(100);
});

ipcMain.handle('tok:open-logs-folder', async () => {
  return logger.openLogsFolder();
});

ipcMain.handle('tok:clean-old-logs', async (_, days?: number) => {
  return logger.cleanOldLogs(days);
});

ipcMain.handle('tok:set-log-retention', async (_, days: number) => {
  logger.setRetentionDays(days);
});

// Updater Handlers
ipcMain.handle('tok:check-for-updates', async () => {
  return await updater.checkForUpdates();
});

ipcMain.handle('tok:open-release-url', async (_, url?: string) => {
  updater.openReleaseUrl(url);
});

// Plugin Handlers
ipcMain.handle('tok:get-plugins', async () => {
  return pluginManager.discoverPlugins();
});

ipcMain.handle('tok:toggle-plugin', async (_, { pluginId, enabled }) => {
  return pluginManager.togglePlugin(pluginId, enabled);
});

ipcMain.handle('tok:open-plugins-folder', async () => {
  pluginManager.openPluginsFolder();
});

ipcMain.handle('tok:reload-plugins', async () => {
  return pluginManager.discoverPlugins();
});

// System Handlers
ipcMain.handle('tok:open-external', async (_, url: string) => {
  if (url && (url.startsWith('https://') || url.startsWith('http://'))) {
    shell.openExternal(url);
  }
});

ipcMain.handle('tok:get-app-info', async () => {
  return {
    version: '0.7.3',
    name: 'TypesetOK (TOK)',
    repoUrl: 'https://github.com/TypesetOK/typesetok'
  };
});

app.whenReady().then(() => {
  createSplashWindow();
  createWindow();
  // Asynchronously initialize logger and plugins concurrently without delaying window creation
  Promise.resolve().then(() => {
    logger.init(14);
    pluginManager.init();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (mainWindow === null) {
    createWindow();
  }
});
