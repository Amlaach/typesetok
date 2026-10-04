import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
const rootPkg = JSON.parse(fs.readFileSync(path.join(rootDir, 'package.json'), 'utf-8'));
const version = rootPkg.version || '0.7.3';
const distDir = path.join(rootDir, 'dist');
const bundleDir = path.join(distDir, `TypesetOK-v${version}-windows-x64`);

console.log('====================================================');
console.log(' TypesetOK Multilingual Windows Installer Builder');
console.log('====================================================');

// 1. Check if desktop bundle exists
if (!fs.existsSync(bundleDir)) {
  console.log('[BUILD-INSTALLER] Desktop bundle not found. Building desktop bundle first...');
  execSync('node scripts/build-desktop-bundle.mjs', { cwd: rootDir, stdio: 'inherit' });
}

// 2. Candidate paths for Inno Setup compiler (ISCC.exe)
const isccCandidates = [
  'iscc',
  'ISCC.exe',
  'C:\\Program Files (x86)\\Inno Setup 6\\ISCC.exe',
  'C:\\Program Files\\Inno Setup 6\\ISCC.exe',
  'C:\\Program Files (x86)\\Inno Setup 5\\ISCC.exe',
  'C:\\Users\\USER\\AppData\\Local\\Programs\\Inno Setup 6\\ISCC.exe'
];

let foundIscc = null;
for (const p of isccCandidates) {
  try {
    const check = execSync(`where ${p}`, { stdio: 'pipe' }).toString().trim();
    if (check) {
      foundIscc = check.split('\n')[0].trim();
      break;
    }
  } catch {
    if (fs.existsSync(p)) {
      foundIscc = p;
      break;
    }
  }
}

// 3. Candidate paths for NSIS (makensis.exe)
const nsisCandidates = [
  'makensis',
  'makensis.exe',
  'C:\\Program Files (x86)\\NSIS\\makensis.exe',
  'C:\\Program Files\\NSIS\\makensis.exe'
];

let foundNsis = null;
if (!foundIscc) {
  for (const p of nsisCandidates) {
    try {
      const check = execSync(`where ${p}`, { stdio: 'pipe' }).toString().trim();
      if (check) {
        foundNsis = check.split('\n')[0].trim();
        break;
      }
    } catch {
      if (fs.existsSync(p)) {
        foundNsis = p;
        break;
      }
    }
  }
}

if (foundIscc) {
  console.log(`[BUILD-INSTALLER] Compiling with Inno Setup: ${foundIscc}`);
  const issFile = path.join(rootDir, 'scripts/installer.iss');
  execSync(`"${foundIscc}" "${issFile}"`, { cwd: rootDir, stdio: 'inherit' });
  console.log(`[BUILD-INSTALLER] SUCCESS! Installer created in dist/TypesetOK-v${version}-Setup-x64.exe`);
} else if (foundNsis) {
  console.log(`[BUILD-INSTALLER] Compiling with NSIS: ${foundNsis}`);
  const nsiFile = path.join(rootDir, 'scripts/installer.nsi');
  execSync(`"${foundNsis}" "${nsiFile}"`, { cwd: rootDir, stdio: 'inherit' });
  console.log(`[BUILD-INSTALLER] SUCCESS! Installer created in dist/TypesetOK-v${version}-NSIS-Setup.exe`);
} else {
  console.log('[BUILD-INSTALLER] Note: Inno Setup (ISCC.exe) and NSIS (makensis.exe) were not found in standard paths.');
  console.log('[BUILD-INSTALLER] Bilingual Installer scripts generated successfully:');
  console.log('  -> scripts/installer.iss (Inno Setup 6 - Hebrew & English)');
  console.log('  -> scripts/installer.nsi (NSIS - Hebrew & English)');
  console.log('[BUILD-INSTALLER] To compile on a build machine with Inno Setup, run:');
  console.log('  ISCC scripts/installer.iss');
}
