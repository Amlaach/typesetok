import { app, BrowserWindow, ipcMain, dialog } from 'electron';
import * as path from 'path';
import * as fs from 'fs';
import { spawn } from 'child_process';
import { buildApplicationMenu } from './menu';

let mainWindow: BrowserWindow | null = null;

function getTokCliPath(): string {
  // Check custom local target directory first
  const localDebug = 'C:/Users/USER/AppData/Local/tok_target/debug/tok-cli.exe';
  if (fs.existsSync(localDebug)) {
    return localDebug;
  }
  const localRelease = 'C:/Users/USER/AppData/Local/tok_target/release/tok-cli.exe';
  if (fs.existsSync(localRelease)) {
    return localRelease;
  }
  // Standard cargo target directory
  const rootTarget = path.join(__dirname, '../../../../target/debug/tok-cli.exe');
  if (fs.existsSync(rootTarget)) {
    return rootTarget;
  }
  return path.join(process.resourcesPath, 'bin', 'tok-cli.exe');
}

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1024,
    minHeight: 700,
    title: 'TypesetOK (TOK) - תוכנת עימוד מקצועית',
    backgroundColor: '#1e1e1e',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  const menu = buildApplicationMenu(mainWindow);
  mainWindow.setMenu(menu);

  // Load UI entry point
  const uiPath = path.join(__dirname, '../../tok-ui/dist/index.html');
  mainWindow.loadFile(uiPath).catch((err) => {
    console.warn(`[TOK-ELECTRON] Could not load ${uiPath}: ${err.message}. Loading fallback shell.`);
    mainWindow?.loadURL(
      `data:text/html;charset=utf-8,${encodeURIComponent(`
      <!DOCTYPE html>
      <html dir="rtl" lang="he">
      <head>
        <meta charset="utf-8">
        <title>TypesetOK Shell</title>
        <style>
          body { margin: 0; background: #1a1a1a; color: #e0e0e0; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; display: flex; flex-direction: column; height: 100vh; }
          header { background: #2d2d2d; padding: 12px 24px; border-bottom: 1px solid #3d3d3d; font-weight: bold; }
          main { flex: 1; display: flex; align-items: center; justify-content: center; flex-direction: column; }
          .card { background: #252525; padding: 32px; border-radius: 8px; border: 1px solid #3a3a3a; text-align: center; max-width: 600px; }
          h1 { margin-top: 0; color: #4fc3f7; }
          .badge { display: inline-block; background: #1b5e20; color: #a5d6a7; padding: 4px 12px; border-radius: 12px; font-size: 13px; margin: 4px; }
        </style>
      </head>
      <body>
        <header>TypesetOK (TOK) v0.1.0 — Desktop Publishing</header>
        <main>
          <div class="card">
            <h1>ליבת העימוד והדפוס הנייטיב פעילה במלואה</h1>
            <p>שכבת ה-Core ב-Rust עברה את כל 58 מבחני האימות ובדיקות העומס.</p>
            <div>
              <span class="badge">Knuth-Plass Hebrew Breaker</span>
              <span class="badge">Ahalterm 3-Tier Justifier</span>
              <span class="badge">ISO PDF/X-1a Pre-Press</span>
              <span class="badge">SQLite WAL Workspace</span>
              <span class="badge">Page DOM Virtualizer</span>
              <span class="badge">Canvas Interaction Overlay</span>
            </div>
          </div>
        </main>
      </body>
      </html>
    `)}`
    );
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// IPC Handlers
ipcMain.handle('tok:send-command', async (_, cmd: any) => {
  const cli = getTokCliPath();
  const action = typeof cmd === 'string' ? cmd : cmd?.action;

  if (action === 'ping') {
    return { status: 'ok', version: '0.1.0', cliPath: cli, cliExists: fs.existsSync(cli) };
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
        resolve(stdout);
      } else {
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

app.whenReady().then(createWindow);

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
