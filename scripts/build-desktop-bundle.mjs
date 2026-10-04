import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

const electronDist = path.join(rootDir, 'node_modules/electron/dist');
const outDir = path.join(rootDir, 'dist/TypesetOK-v0.6.0-windows-x64');
const zipFile = path.join(rootDir, 'dist/TypesetOK-v0.6.0-windows-x64.zip');

console.log('[BUNDLE] Packaging TypesetOK Standalone Windows Desktop App...');

if (!fs.existsSync(electronDist)) {
  console.error('[BUNDLE] Electron dist directory not found at', electronDist);
  process.exit(1);
}

// 1. Prepare output dir
if (fs.existsSync(outDir)) {
  fs.rmSync(outDir, { recursive: true, force: true });
}
fs.mkdirSync(outDir, { recursive: true });

// 2. Copy Electron runtime files
console.log('[BUNDLE] Copying Electron runtime...');
fs.cpSync(electronDist, outDir, { recursive: true });

// 3. Rename electron to TypesetOK
const isWin = process.platform === 'win32';
const defaultExe = path.join(outDir, isWin ? 'electron.exe' : 'electron');
const targetExe = path.join(outDir, isWin ? 'TypesetOK.exe' : 'TypesetOK');
if (fs.existsSync(defaultExe)) {
  fs.renameSync(defaultExe, targetExe);
  console.log(`[BUNDLE] Renamed ${path.basename(defaultExe)} -> ${path.basename(targetExe)}`);
}

// 4. Create resources structure
const resourcesDir = path.join(outDir, 'resources');
const appDir = path.join(resourcesDir, 'app');
const binDir = path.join(resourcesDir, 'bin');
fs.mkdirSync(appDir, { recursive: true });
fs.mkdirSync(binDir, { recursive: true });

// 5. Copy tok-cli into resources/bin/
const candidateCliPaths = [
  'C:/Users/USER/AppData/Local/tok_target/release/tok-cli.exe',
  'C:/Users/USER/AppData/Local/tok_target/debug/tok-cli.exe',
  path.join(rootDir, 'target/release/tok-cli.exe'),
  path.join(rootDir, 'target/release/tok-cli'),
  path.join(rootDir, 'target/debug/tok-cli.exe'),
  path.join(rootDir, 'target/debug/tok-cli')
];

let foundCli = null;
for (const p of candidateCliPaths) {
  if (fs.existsSync(p)) {
    foundCli = p;
    break;
  }
}

if (foundCli) {
  const destCli = path.join(binDir, path.basename(foundCli));
  fs.copyFileSync(foundCli, destCli);
  console.log('[BUNDLE] Bundled CLI binary from:', foundCli, '->', destCli);
} else {
  console.warn('[BUNDLE] Warning: tok-cli binary not found in candidate paths.');
}

// 6. Populate resources/app
fs.writeFileSync(
  path.join(appDir, 'package.json'),
  JSON.stringify(
    {
      name: 'typesetok',
      version: '0.6.0',
      main: 'packages/tok-electron/dist/main.js'
    },
    null,
    2
  )
);

// Copy compiled packages and assets
const electronDistSrc = path.join(rootDir, 'packages/tok-electron/dist');
const uiDistSrc = path.join(rootDir, 'packages/tok-ui/dist');
const assetsSrc = path.join(rootDir, 'assets');

if (fs.existsSync(electronDistSrc)) {
  fs.cpSync(electronDistSrc, path.join(appDir, 'packages/tok-electron/dist'), { recursive: true });
}
if (fs.existsSync(uiDistSrc)) {
  fs.cpSync(uiDistSrc, path.join(appDir, 'packages/tok-ui/dist'), { recursive: true });
}
if (fs.existsSync(assetsSrc)) {
  fs.cpSync(assetsSrc, path.join(appDir, 'assets'), { recursive: true });
}

// Copy license and readme
fs.copyFileSync(path.join(rootDir, 'LICENSE.md'), path.join(outDir, 'LICENSE.md'));
fs.copyFileSync(path.join(rootDir, 'README.md'), path.join(outDir, 'README.md'));

console.log('[BUNDLE] Created portable app at:', outDir);
console.log('[BUNDLE] Executable binary:', targetExe);
