import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = __dirname;
const port = parseInt(process.env.PORT || '3000', 10);

const distDir = path.join(rootDir, 'packages', 'tok-ui', 'dist');
const assetsDir = path.join(rootDir, 'assets');
const distIndex = path.join(distDir, 'index.html');
const distRenderer = path.join(distDir, 'renderer.js');

// Ensure UI is built if missing
if (!fs.existsSync(distIndex) || !fs.existsSync(distRenderer)) {
  console.log('[Server] Building UI dist bundle...');
  try {
    execSync('node scripts/bundle-ui.mjs', { stdio: 'inherit', cwd: rootDir });
  } catch (err) {
    console.error('[Server] Bundle build error:', err);
  }
}

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.otf': 'font/otf',
  '.txt': 'text/plain; charset=utf-8',
  '.map': 'application/json'
};

function sendFile(res, filePath) {
  try {
    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';
    const stat = fs.statSync(filePath);

    res.writeHead(200, {
      'Content-Type': contentType,
      'Content-Length': stat.size,
      'Cache-Control': ext === '.html' ? 'no-cache' : 'public, max-age=3600'
    });

    const stream = fs.createReadStream(filePath);
    stream.pipe(res);
  } catch (err) {
    res.writeHead(500, { 'Content-Type': 'text/plain' });
    res.end('Internal Server Error');
  }
}

const server = http.createServer((req, res) => {
  // Simple health check endpoint
  if (req.url === '/healthz' || req.url === '/_health') {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('OK');
    return;
  }

  // Parse request path
  const parsedUrl = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  let pathname = decodeURIComponent(parsedUrl.pathname);

  // Normalize path
  if (pathname === '/') {
    pathname = '/index.html';
  }

  // Check assets folder
  if (pathname.startsWith('/assets/')) {
    const relativeAssetPath = pathname.slice('/assets/'.length);
    const resolvedAssetPath = path.resolve(assetsDir, relativeAssetPath);
    if (resolvedAssetPath.startsWith(assetsDir) && fs.existsSync(resolvedAssetPath) && fs.statSync(resolvedAssetPath).isFile()) {
      sendFile(res, resolvedAssetPath);
      return;
    }
  }

  // Check dist folder
  const relativeDistPath = pathname.startsWith('/') ? pathname.slice(1) : pathname;
  const resolvedDistPath = path.resolve(distDir, relativeDistPath);
  if (resolvedDistPath.startsWith(distDir) && fs.existsSync(resolvedDistPath) && fs.statSync(resolvedDistPath).isFile()) {
    sendFile(res, resolvedDistPath);
    return;
  }

  // SPA fallback to index.html
  if (fs.existsSync(distIndex)) {
    sendFile(res, distIndex);
  } else {
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('Not Found');
  }
});

server.listen(port, '0.0.0.0', () => {
  console.log(`[TypesetOK] HTTP Server listening on http://0.0.0.0:${port}`);
});

process.on('uncaughtException', (err) => {
  console.error('[Server] Uncaught exception:', err);
});

process.on('unhandledRejection', (reason) => {
  console.error('[Server] Unhandled rejection:', reason);
});
