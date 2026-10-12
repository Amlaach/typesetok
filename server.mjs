import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import { execSync } from 'child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = __dirname;
const port = 3000;

const app = express();

// Ensure UI is built
const distIndex = path.join(rootDir, 'packages/tok-ui/dist/index.html');
const distRenderer = path.join(rootDir, 'packages/tok-ui/dist/renderer.js');
if (!fs.existsSync(distIndex) || !fs.existsSync(distRenderer)) {
  console.log('[Server] Building UI dist bundle...');
  try {
    execSync('node scripts/bundle-ui.mjs', { stdio: 'inherit', cwd: rootDir });
  } catch (err) {
    console.error('[Server] Bundle build error:', err);
  }
}

process.on('uncaughtException', (err) => {
  console.error('[Server] Uncaught exception:', err);
});

process.on('unhandledRejection', (reason) => {
  console.error('[Server] Unhandled rejection:', reason);
});

// Serve static assets and dist
app.use('/assets', express.static(path.join(rootDir, 'assets')));
app.use(express.static(path.join(rootDir, 'packages/tok-ui/dist')));

// Fallback to index.html for SPA routing
app.use((req, res) => {
  res.sendFile(distIndex);
});

app.listen(port, '0.0.0.0', () => {
  console.log(`TypesetOK running on http://0.0.0.0:${port}`);
});
