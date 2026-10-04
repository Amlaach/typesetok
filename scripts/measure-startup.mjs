// Measures desktop startup time of the built app (run `npm run build` first).
//
//   node scripts/measure-startup.mjs [runs=7] [appRoot ...]
//
// Launches Electron with TOK_STARTUP_TRACE=exit, which makes main.ts print
// epoch-ms milestones and quit as soon as the main window is visible and the
// renderer timings are collected. All numbers are ms since process spawn.
// One warm-up run per target is discarded; medians are reported.
//
// With several appRoots (directories containing packages/tok-electron/dist and
// packages/tok-ui/dist, e.g. a copy of an older build) the runs are interleaved
// A/B/A/B so that background machine load affects every target equally.
import { spawn } from 'child_process';
import { createRequire } from 'module';
import * as os from 'os';
import * as path from 'path';
import { fileURLToPath } from 'url';

const require = createRequire(import.meta.url);
const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const electronExe = require('electron');
const runs = Math.max(1, parseInt(process.argv[2] || '7', 10));
const targets = (process.argv.length > 3 ? process.argv.slice(3) : [rootDir]).map((p) => path.resolve(p));
// Isolated profile so measurements never touch the real userData (logs, plugins, caches).
const userDataDir = process.env.TOK_MEASURE_USER_DATA || path.join(os.tmpdir(), 'typesetok-startup-profile');

const ORDER = [
  'main-module-loaded',
  'app-ready',
  'main-window-created',
  'splash-loaded',
  'renderer-navStart',
  'renderer-htmlLoaded',
  'renderer-scriptStart',
  'renderer-dclStart',
  'renderer-uiBuilt',
  'renderer-domContentLoaded',
  'ipc-get-plugins-start',
  'ipc-get-plugins-end',
  'renderer-fcp',
  'main-ready-to-show',
  'main-shown',
];

function killTree(pid) {
  if (!pid) return;
  if (process.platform === 'win32') spawn('taskkill', ['/pid', String(pid), '/T', '/F'], { stdio: 'ignore' });
  else {
    try {
      process.kill(pid, 'SIGKILL');
    } catch {}
  }
}

function runOnce(appRoot) {
  return new Promise((resolve, reject) => {
    const mainJs = path.join(appRoot, 'packages/tok-electron/dist/main.js');
    const t0 = Date.now();
    const child = spawn(electronExe, [mainJs, `--user-data-dir=${userDataDir}`], {
      cwd: rootDir,
      env: { ...process.env, TOK_STARTUP_TRACE: 'exit' },
      stdio: ['ignore', 'pipe', 'ignore'],
    });
    const marks = {};
    let buf = '';
    child.stdout.on('data', (d) => {
      buf += d.toString();
      let nl;
      while ((nl = buf.indexOf('\n')) >= 0) {
        const line = buf.slice(0, nl).trim();
        buf = buf.slice(nl + 1);
        const m = line.match(/^\[TOK-TRACE\] (\S+) (\d+)$/);
        if (m && !(m[1] in marks)) marks[m[1]] = Number(m[2]) - t0;
      }
    });
    const timer = setTimeout(() => {
      killTree(child.pid);
      if ('main-shown' in marks) return resolve(marks); // shown, but renderer timings never arrived
      reject(new Error(`timeout waiting for startup trace of ${appRoot} (got: ${Object.keys(marks).join(', ') || 'nothing'})`));
    }, 20000);
    child.on('exit', () => {
      clearTimeout(timer);
      if (!('main-shown' in marks)) reject(new Error(`run of ${appRoot} ended without main-shown mark`));
      else resolve(marks);
    });
  });
}

const median = (xs) => {
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : Math.round((s[m - 1] + s[m]) / 2);
};

console.log(`Electron: ${electronExe}\nProfile:  ${userDataDir}\nRuns: ${runs} per target (+1 warm-up)\n`);
const results = targets.map(() => []);
const tryRun = (t) =>
  runOnce(t).catch((err) => {
    console.error(`  ! ${err.message}`);
    return null;
  });
for (const t of targets) await tryRun(t); // warm-up (disk cache, first-run plugin folder creation)
for (let i = 0; i < runs; i++) {
  for (let j = 0; j < targets.length; j++) {
    const r = await tryRun(targets[j]);
    if (!r) continue;
    results[j].push(r);
    console.log(`[${j}] run ${i + 1}: shown=${r['main-shown']}ms ready-to-show=${r['main-ready-to-show']}ms`);
  }
}
for (let j = 0; j < targets.length; j++) {
  console.log(`\n[${j}] ${targets[j]}\nmedian ms since spawn   [min..max]`);
  for (const k of ORDER) {
    const vals = results[j].map((r) => r[k]).filter((v) => typeof v === 'number');
    if (vals.length) console.log(`  ${k.padEnd(28)} ${String(median(vals)).padStart(6)}   [${Math.min(...vals)}..${Math.max(...vals)}]`);
  }
}
