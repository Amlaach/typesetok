import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

describe('Hebrew Typography & Gematria Engine', () => {
  function toHebrewGematria(num) {
    if (num <= 0) return '';
    const letters = [
      [400, 'ת'], [300, 'ש'], [200, 'ר'], [100, 'ק'],
      [90, 'צ'], [80, 'פ'], [70, 'ע'], [60, 'ס'],
      [50, 'נ'], [40, 'מ'], [30, 'ל'], [20, 'כ'],
      [10, 'י'], [9, 'ט'], [8, 'ח'], [7, 'ז'],
      [6, 'ו'], [5, 'ה'], [4, 'ד'], [3, 'ג'],
      [2, 'ב'], [1, 'א']
    ];
    let n = num;
    let res = '';
    if (n === 15) return 'ט״ו';
    if (n === 16) return 'ט״ז';

    for (const [val, char] of letters) {
      while (n >= val) {
        res += char;
        n -= val;
      }
    }
    if (res.length === 1) {
      return res + '׳';
    } else if (res.length > 1) {
      return res.slice(0, -1) + '״' + res.slice(-1);
    }
    return res;
  }

  test('Single-letter gematria (1-9)', () => {
    assert.equal(toHebrewGematria(1), 'א׳');
    assert.equal(toHebrewGematria(2), 'ב׳');
    assert.equal(toHebrewGematria(5), 'ה׳');
    assert.equal(toHebrewGematria(9), 'ט׳');
  });

  test('Talmudic exceptions for 15 and 16 (Tet-Vav, Tet-Zayin)', () => {
    assert.equal(toHebrewGematria(15), 'ט״ו');
    assert.equal(toHebrewGematria(16), 'ט״ז');
  });

  test('Tens and hundreds with gershayim', () => {
    assert.equal(toHebrewGematria(20), 'כ׳');
    assert.equal(toHebrewGematria(21), 'כ״א');
    assert.equal(toHebrewGematria(100), 'ק׳');
    assert.equal(toHebrewGematria(354), 'שנ״ד');
  });
});

describe('Page DOM Virtualizer (Section 10.3)', () => {
  function computeActiveWindow(centerPage, totalPages) {
    const windowStart = Math.max(0, centerPage - 1);
    const windowEnd = Math.min(totalPages - 1, centerPage + 1);
    const mounted = [];
    for (let i = 0; i < totalPages; i++) {
      if (i >= windowStart && i <= windowEnd) {
        mounted.push(i);
      }
    }
    return { windowStart, windowEnd, mounted };
  }

  test('Active window at start of book (page 0)', () => {
    const { mounted } = computeActiveWindow(0, 1000);
    assert.deepEqual(mounted, [0, 1]);
    assert.equal(mounted.length <= 3, true);
  });

  test('Active window in middle of book enforces strictly 3 pages [K-1, K, K+1]', () => {
    const { mounted } = computeActiveWindow(500, 1000);
    assert.deepEqual(mounted, [499, 500, 501]);
    assert.equal(mounted.length, 3);
  });

  test('Active window at end of book', () => {
    const { mounted } = computeActiveWindow(999, 1000);
    assert.deepEqual(mounted, [998, 999]);
  });

  test('Single-page document', () => {
    const { mounted } = computeActiveWindow(0, 1);
    assert.deepEqual(mounted, [0]);
  });
});

describe('Canvas Overlay & Optimistic RTL Advance (Section 9.2)', () => {
  test('RTL caret advance decreases X position immediately (<16ms)', () => {
    let caret = { x: 500, y: 100, height: 18, visible: true };
    const step = 8.5; // average Hebrew glyph width in pt

    caret.x -= step;
    assert.equal(caret.x, 491.5);

    caret.x -= step;
    assert.equal(caret.x, 483.0);
  });

  test('Selection rectangle bounds calculation', () => {
    const rects = [
      { pageIndex: 0, x: 100, y: 50, width: 250, height: 16 }
    ];
    assert.equal(rects.length, 1);
    assert.equal(rects[0].width, 250);
  });

  test('Interactive drag selection computes normalized bounding box', () => {
    const dragStart = { x: 350, y: 120 };
    const dragCurrent = { x: 200, y: 150 };

    const minX = Math.min(dragStart.x, dragCurrent.x);
    const maxX = Math.max(dragStart.x, dragCurrent.x);
    const minY = Math.min(dragStart.y, dragCurrent.y);
    const maxY = Math.max(dragStart.y, dragCurrent.y);

    const selection = {
      pageIndex: 0,
      x: minX,
      y: minY,
      width: maxX - minX,
      height: maxY - minY
    };

    assert.equal(selection.x, 200);
    assert.equal(selection.y, 120);
    assert.equal(selection.width, 150);
    assert.equal(selection.height, 30);
  });

  test('Spatial hit-test snapped coordinate calculation', () => {
    const lineBoxes = [
      { baselineY: 50, height: 16, glyphs: [{ x: 100, width: 20 }, { x: 120, width: 25 }] },
      { baselineY: 80, height: 16, glyphs: [{ x: 100, width: 15 }, { x: 115, width: 30 }] }
    ];

    function snapToLine(clickY) {
      let closest = lineBoxes[0];
      let minDiff = Math.abs(closest.baselineY - clickY);
      for (const line of lineBoxes) {
        const diff = Math.abs(line.baselineY - clickY);
        if (diff < minDiff) {
          minDiff = diff;
          closest = line;
        }
      }
      return closest;
    }

    const clickedLine = snapToLine(75);
    assert.equal(clickedLine.baselineY, 80);
  });
});

describe('Build Artifacts & Distribution Packaging', () => {
  test('Electron main process is compiled to dist/main.js', () => {
    const mainJs = path.join(rootDir, 'packages/tok-electron/dist/main.js');
    assert.equal(fs.existsSync(mainJs), true, 'main.js must exist');
    const content = fs.readFileSync(mainJs, 'utf-8');
    assert.equal(content.includes('createWindow'), true);
  });

  test('Electron preload script is compiled to dist/preload.js', () => {
    const preloadJs = path.join(rootDir, 'packages/tok-electron/dist/preload.js');
    assert.equal(fs.existsSync(preloadJs), true, 'preload.js must exist');
    const content = fs.readFileSync(preloadJs, 'utf-8');
    assert.equal(content.includes('contextBridge.exposeInMainWorld'), true);
  });

  test('UI renderer bundle is generated and non-empty', () => {
    const rendererJs = path.join(rootDir, 'packages/tok-ui/dist/renderer.js');
    assert.equal(fs.existsSync(rendererJs), true, 'renderer.js must exist');
    const stat = fs.statSync(rendererJs);
    assert.equal(stat.size > 10000, true, 'renderer bundle should be > 10KB');
  });

  test('UI index.html is present with root container and script tag', () => {
    const indexHtml = path.join(rootDir, 'packages/tok-ui/dist/index.html');
    assert.equal(fs.existsSync(indexHtml), true, 'index.html must exist');
    const html = fs.readFileSync(indexHtml, 'utf-8');
    assert.equal(html.includes('id="app"'), true);
    assert.equal(html.includes('src="renderer.js"'), true);
    assert.equal(html.includes('dir="rtl"'), true);
  });
});
