// Bundles the renderer (packages/tok-ui/src/renderer.ts) into packages/tok-ui/dist/renderer.js
// and copies index.html next to it.
//
//   node scripts/bundle-ui.mjs          production bundle (minified)
//   node scripts/bundle-ui.mjs --dev    readable bundle with an inline source map
import * as esbuild from 'esbuild';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const uiDir = path.join(rootDir, 'packages/tok-ui');
const dev = process.argv.includes('--dev');

try {
  await esbuild.build({
    entryPoints: [path.join(uiDir, 'src/renderer.ts')],
    outfile: path.join(uiDir, 'dist/renderer.js'),
    bundle: true,
    platform: 'browser',
    target: 'es2022',
    // The UI is mostly Hebrew strings; emitting them as UTF-8 instead of \uXXXX
    // escapes makes the bundle ~25% smaller. index.html declares <meta charset="utf-8">.
    charset: 'utf8',
    minify: !dev,
    // Keep class/function names: readable stack traces in logs and the
    // component names the test-suite looks for in the bundle.
    keepNames: true,
    sourcemap: dev ? 'inline' : false,
    legalComments: 'none',
    // Marks when the bundle starts evaluating (read by the opt-in startup trace).
    banner: { js: "performance.mark('tok-script-start');" },
    logLevel: 'info',
  });
  fs.copyFileSync(path.join(uiDir, 'src/index.html'), path.join(uiDir, 'dist/index.html'));
} catch {
  // esbuild has already printed the errors
  process.exit(1);
}
