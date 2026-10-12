/**
 * Geometric Fidelity Test Suite
 *
 * Verifies that the Canvas reflects Rust typesetting engine geometry directly,
 * does not perform independent line breaking or text-align justification recalculation,
 * uses actual document dimensions, and preserves Hebrew RTL typography.
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import fs from 'node:fs';
import os from 'node:os';
import { pathToFileURL } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

let esbuildMod = null;
async function loadTs(relPath) {
  esbuildMod ||= await import('esbuild');
  const outfile = path.join(
    os.tmpdir(),
    `tok-geom-test-${process.pid}-${relPath.replace(/[^a-zA-Z0-9]+/g, '_')}-${Date.now()}.mjs`
  );
  esbuildMod.buildSync({
    entryPoints: [path.join(rootDir, relPath)],
    bundle: true,
    format: 'esm',
    platform: 'neutral',
    outfile,
    logLevel: 'silent',
  });
  try {
    return await import(pathToFileURL(outfile).href);
  } finally {
    fs.rmSync(outfile, { force: true });
  }
}

describe('Geometric Fidelity: Canvas & Rust Layout Engine Parity', async () => {
  const typesetBridgeMod = await loadTs('packages/tok-ui/src/engine/typesetBridge.ts');
  const { layoutToPageDescriptors, formatEngineFont, ENGINE_FONT_STACK } = typesetBridgeMod;
  const flowPaginatorMod = await loadTs('packages/tok-ui/src/engine/FlowPaginator.ts');
  const { FlowPaginator } = flowPaginatorMod;

  test('1. LineBox renders with white-space: nowrap !important and no browser re-wrapping', () => {
    const mockPages = [
      {
        page_index: 0,
        page_number_gematria: 'א׳',
        dimensions: { x: 0, y: 0, width: 595.28, height: 841.89 },
        frames: [
          {
            frame_id: 'frame-test-1',
            flow_id: 'gemara',
            rect: { x: 42.52, y: 56.69, width: 510.24, height: 728.51 },
            lines: [
              {
                line_index: 0,
                paragraph_id: 'para-1',
                baseline_y: 20.5,
                height: 15.0,
                width: 480.0,
                text: 'מֵאֵימָתַי קוֹרִין אֶת שְׁמַע בְּעַרְבִית',
                is_rtl: true,
                fonts: ['Frank Ruhl Libre']
              },
              {
                line_index: 1,
                paragraph_id: 'para-1',
                baseline_y: 40.5,
                height: 15.0,
                width: 475.5,
                text: 'מִשָּׁעָה שֶׁהַכֹּהֲנִים נִכְנָסִים לֶאֱכֹל בִּתְרוּמָתָן',
                is_rtl: true,
                fonts: ['Frank Ruhl Libre']
              }
            ]
          }
        ]
      }
    ];

    const descriptors = layoutToPageDescriptors(mockPages);
    assert.equal(descriptors.length, 1);
    const html = descriptors[0].htmlContent;

    // Must enforce nowrap to prevent browser line breaking
    assert.ok(html.includes('white-space: nowrap !important;'), 'Line must enforce nowrap !important');
    // Must NOT have text-align: justify
    assert.ok(!html.includes('text-align: justify;'), 'Must not inject text-align: justify');
    // Must contain both lines
    assert.ok(html.includes('data-line-index="0"'));
    assert.ok(html.includes('data-line-index="1"'));
    assert.ok(html.includes('מֵאֵימָתַי קוֹרִין'));
    assert.ok(html.includes('מִשָּׁעָה שֶׁהַכֹּהֲנִים'));
  });

  test('2. Exact physical baseline and height mapping from Rust layout', () => {
    const mockPages = [
      {
        page_index: 0,
        page_number_gematria: 'ב׳',
        dimensions: { x: 0, y: 0, width: 595.28, height: 841.89 },
        frames: [
          {
            frame_id: 'frame-test-2',
            flow_id: 'gemara',
            rect: { x: 50.0, y: 60.0, width: 400.0, height: 600.0 },
            lines: [
              {
                line_index: 0,
                paragraph_id: 'para-xyz',
                baseline_y: 28.5,
                height: 18.0,
                width: 380.0,
                text: 'שורה ראשונה עם מדידות מדויקות',
                is_rtl: true
              }
            ]
          }
        ]
      }
    ];

    const descriptors = layoutToPageDescriptors(mockPages);
    const html = descriptors[0].htmlContent;

    // Top offset = baseline_y - height = 28.5 - 18.0 = 10.50pt
    assert.ok(html.includes('top: 10.50pt;'), 'Top offset must equal baseline_y - height in pt');
    assert.ok(html.includes('height: 18.00pt;'), 'Height must equal line height in pt');
    assert.ok(html.includes('line-height: 18.00pt;'), 'Line-height must equal line height in pt');
    assert.ok(html.includes('data-baseline-y="28.5"'), 'data-baseline-y must be preserved');
    assert.ok(html.includes('data-line-height="18"'), 'data-line-height must be preserved');
    assert.ok(html.includes('data-line-width="380"'), 'data-line-width must be preserved');
  });

  test('3. Document page dimensions in points are used directly without 404x577 scaling', () => {
    const customWidthPt = 612.0; // US Letter width
    const customHeightPt = 792.0; // US Letter height
    const frameX = 72.0;
    const frameY = 72.0;
    const frameW = 468.0;
    const frameH = 648.0;

    const mockPages = [
      {
        page_index: 0,
        page_number_gematria: 'א׳',
        dimensions: { x: 0, y: 0, width: customWidthPt, height: customHeightPt },
        frames: [
          {
            frame_id: 'frame-letter',
            flow_id: 'main',
            rect: { x: frameX, y: frameY, width: frameW, height: frameH },
            lines: []
          }
        ]
      }
    ];

    const descriptors = layoutToPageDescriptors(mockPages);
    assert.equal(descriptors[0].widthPt, customWidthPt);
    assert.equal(descriptors[0].heightPt, customHeightPt);

    const html = descriptors[0].htmlContent;
    // Frame coordinates must match rect exactly in points
    assert.ok(html.includes(`left: ${frameX.toFixed(2)}pt;`), 'Frame left must match rect.x in pt');
    assert.ok(html.includes(`top: ${frameY.toFixed(2)}pt;`), 'Frame top must match rect.y in pt');
    assert.ok(html.includes(`width: ${frameW.toFixed(2)}pt;`), 'Frame width must match rect.width in pt');
    assert.ok(html.includes(`height: ${frameH.toFixed(2)}pt;`), 'Frame height must match rect.height in pt');
  });

  test('4. Hebrew RTL typography, Niqqud, Taamim and font features are preserved', () => {
    const niqqudText = 'בְּרֵאשִׁ֖ית בָּרָ֣א אֱלֹהִ֑ים אֵ֥ת הַשָּׁמַ֖יִם וְאֵ֥ת הָאָֽרֶץ׃';
    const mockPages = [
      {
        page_index: 0,
        page_number_gematria: 'א׳',
        dimensions: { x: 0, y: 0, width: 595.28, height: 841.89 },
        frames: [
          {
            frame_id: 'frame-torah',
            flow_id: 'gemara',
            rect: { x: 50, y: 50, width: 500, height: 700 },
            lines: [
              {
                line_index: 0,
                baseline_y: 25,
                height: 20,
                width: 480,
                text: niqqudText,
                is_rtl: true,
                fonts: ['Frank Ruhl Libre Bold']
              }
            ]
          }
        ]
      }
    ];

    const descriptors = layoutToPageDescriptors(mockPages);
    const html = descriptors[0].htmlContent;

    assert.ok(html.includes('direction: rtl;'), 'Hebrew line must have direction: rtl');
    assert.ok(html.includes("font-feature-settings: 'kern' 1, 'mark' 1, 'mkmk' 1;"), 'Must specify mark positioning');
    assert.ok(html.includes('text-rendering: optimizeLegibility;'), 'Must specify optimizeLegibility');
    assert.ok(html.includes('font-weight: 700;'), 'Bold font must map to font-weight: 700');
    assert.ok(html.includes(niqqudText), 'Niqqud and Taamim text must remain intact');
  });

  test('5. Font formatting helper formatEngineFont strips Bold suffix and maps weight', () => {
    const primary = formatEngineFont('Frank Ruhl Libre Bold', true);
    assert.ok(primary.fontFamily.includes('Frank Ruhl Libre'));
    assert.equal(primary.fontWeight, 700);

    const rashi = formatEngineFont('Noto Rashi Hebrew', false);
    assert.ok(rashi.fontFamily.includes('Noto Rashi Hebrew'));
    assert.equal(rashi.fontWeight, undefined);

    const defaultFont = formatEngineFont(undefined, true);
    assert.ok(defaultFont.fontFamily.includes('Frank Ruhl Libre'));
  });

  test('6. FlowPaginator fallback is flagged explicitly and not disguised as Rust layout', () => {
    const doc = {
      title: 'Fallback Test',
      templateType: 'prose',
      flows: {
        gemara: [{ id: 'p-1', styleId: 'body', text: 'טקסט פשוט לבדיקת פולבק' }],
        rashi: [],
        tosafot: [],
        notes: []
      }
    };

    // Standard call
    const regularPages = FlowPaginator.paginateDocument(doc, 1, false);
    assert.equal(regularPages.length, 1);
    assert.equal(Boolean(regularPages[0].isSimulatedFallback), false);

    // Explicit fallback call
    const fallbackPages = FlowPaginator.paginateDocument(doc, 1, true);
    assert.equal(fallbackPages.length, 1);
    assert.equal(fallbackPages[0].isSimulatedFallback, true);
    assert.ok(fallbackPages[0].htmlContent.includes('tok-fallback-warning-badge'), 'Must contain warning badge');
    assert.ok(fallbackPages[0].htmlContent.includes('תצוגה משוערת בלבד'), 'Must warn user layout is simulated');
  });

  test('7. Exact coordinate parity between Canvas layout and PDF HtmlProjectionCompiler contract', () => {
    const multiFlowBox = {
      page_index: 0,
      page_number_gematria: 'א׳',
      dimensions: { x: 0, y: 0, width: 595.28, height: 841.89 },
      frames: [
        {
          frame_id: 'frame-gemara-0',
          flow_id: 'gemara',
          rect: { x: 180.5, y: 55.0, width: 234.28, height: 600.0 },
          lines: [
            {
              line_index: 0,
              paragraph_id: 'p-gem-1',
              baseline_y: 24.0,
              height: 16.0,
              width: 234.28,
              text: 'מאימתי קורין את שמע בערבית',
              is_rtl: true,
              fonts: ['Frank Ruhl Libre']
            }
          ]
        },
        {
          frame_id: 'frame-rashi-0',
          flow_id: 'rashi',
          rect: { x: 42.5, y: 55.0, width: 125.0, height: 700.0 },
          lines: [
            {
              line_index: 0,
              paragraph_id: 'p-rash-1',
              baseline_y: 18.0,
              height: 12.0,
              width: 125.0,
              text: 'מאמתי - משעה שהכהנים טובלים',
              is_rtl: true,
              fonts: ['Noto Rashi Hebrew']
            }
          ]
        }
      ]
    };

    const descriptors = layoutToPageDescriptors([multiFlowBox]);
    const canvasHtml = descriptors[0].htmlContent;

    // Verify each frame has 1:1 pt coordinates matching Rust
    for (const frame of multiFlowBox.frames) {
      const expectedLeft = `left: ${frame.rect.x.toFixed(2)}pt;`;
      const expectedTop = `top: ${frame.rect.y.toFixed(2)}pt;`;
      const expectedWidth = `width: ${frame.rect.width.toFixed(2)}pt;`;
      const expectedHeight = `height: ${frame.rect.height.toFixed(2)}pt;`;

      assert.ok(canvasHtml.includes(expectedLeft), `Canvas must match frame left pt: ${expectedLeft}`);
      assert.ok(canvasHtml.includes(expectedTop), `Canvas must match frame top pt: ${expectedTop}`);
      assert.ok(canvasHtml.includes(expectedWidth), `Canvas must match frame width pt: ${expectedWidth}`);
      assert.ok(canvasHtml.includes(expectedHeight), `Canvas must match frame height pt: ${expectedHeight}`);

      for (const line of frame.lines) {
        const expectedLineTop = `top: ${Math.max(0, line.baseline_y - line.height).toFixed(2)}pt;`;
        const expectedLineHeight = `height: ${line.height.toFixed(2)}pt;`;
        assert.ok(canvasHtml.includes(expectedLineTop), `Canvas must match line top pt: ${expectedLineTop}`);
        assert.ok(canvasHtml.includes(expectedLineHeight), `Canvas must match line height pt: ${expectedLineHeight}`);
      }
    }
  });

  test('8. Real tok-cli typeset-document layout maintains exact geometric parity into Canvas descriptors', async () => {
    const { spawn } = await import('node:child_process');
    const bridgeMod = await loadTs('packages/tok-ui/src/engine/documentBridge.ts');
    const { documentStateToDocumentRoot } = bridgeMod;

    // Find tok-cli binary
    const binName = process.platform === 'win32' ? 'tok-cli.exe' : 'tok-cli';
    const candidates = [
      path.join(rootDir, 'target', 'debug', binName),
      path.join(rootDir, 'target', 'release', binName),
      path.join(rootDir, 'crates', 'target', 'debug', binName),
      path.join(rootDir, 'crates', 'target', 'release', binName),
      path.join(rootDir, 'target', 'debug', 'tok-cli'),
      path.join(rootDir, 'target', 'release', 'tok-cli'),
      path.join(process.env.LOCALAPPDATA || '', 'tok_target', 'debug', binName),
      path.join(process.env.LOCALAPPDATA || '', 'tok_target', 'release', binName),
    ];
    const tokCli = candidates.find((p) => fs.existsSync(p));
    if (!tokCli) return; // Skip if engine binary is not built in environment

    const testDocState = {
      title: 'בדיקת נאמנות גאומטרית',
      templateType: 'prose',
      flows: {
        gemara: [
          {
            id: 'p-geom-1',
            styleId: 'normal',
            text: 'וַיְהִי בִּימֵי אֲחַשְׁוֵרוֹשׁ הוּא אֲחַשְׁוֵרוֹשׁ הַמֹּלֵךְ מֵהֹדּוּ וְעַד כּוּשׁ שֶׁבַע וְעֶשְׂרִים וּמֵאָה מְדִינָה.'
          },
          {
            id: 'p-geom-2',
            styleId: 'normal',
            text: 'בַּיָּמִים הָהֵם כְּשֶׁבֶת הַמֶּלֶךְ אֲחַשְׁוֵרוֹשׁ עַל כִּסֵּא מַלְכוּתוֹ אֲשֶׁר בְּשׁוּשַׁן הַבִּירָה.'
          }
        ],
        rashi: [],
        tosafot: [],
        notes: []
      }
    };

    const docRoot = documentStateToDocumentRoot(testDocState);
    const tempIn = path.join(os.tmpdir(), `geom_parity_in_${Date.now()}.json`);
    const tempOut = path.join(os.tmpdir(), `geom_parity_out_${Date.now()}.json`);

    try {
      fs.writeFileSync(tempIn, JSON.stringify(docRoot, null, 2), 'utf-8');
      const exitCode = await new Promise((resolve) => {
        const proc = spawn(tokCli, ['typeset-document', tempIn, tempOut], { windowsHide: true });
        proc.on('close', resolve);
      });
      assert.equal(exitCode, 0, 'tok-cli typeset-document must succeed');

      const rustPages = JSON.parse(fs.readFileSync(tempOut, 'utf-8'));
      assert.ok(rustPages.length > 0, 'Must produce at least 1 page');

      const descriptors = layoutToPageDescriptors(rustPages);
      assert.equal(descriptors.length, rustPages.length);

      for (let i = 0; i < rustPages.length; i++) {
        const rPage = rustPages[i];
        const desc = descriptors[i];
        assert.equal(desc.widthPt, rPage.dimensions.width);
        assert.equal(desc.heightPt, rPage.dimensions.height);

        for (const frame of rPage.frames) {
          assert.ok(desc.htmlContent.includes(`left: ${frame.rect.x.toFixed(2)}pt;`));
          assert.ok(desc.htmlContent.includes(`top: ${frame.rect.y.toFixed(2)}pt;`));
          assert.ok(desc.htmlContent.includes(`width: ${frame.rect.width.toFixed(2)}pt;`));
          assert.ok(desc.htmlContent.includes(`height: ${frame.rect.height.toFixed(2)}pt;`));

          for (const line of frame.lines) {
            const expectedTop = `top: ${Math.max(0, line.baseline_y - line.height).toFixed(2)}pt;`;
            assert.ok(desc.htmlContent.includes(expectedTop));
            assert.ok(desc.htmlContent.includes(`data-baseline-y="${line.baseline_y}"`));
          }
        }
      }
    } finally {
      if (fs.existsSync(tempIn)) fs.unlinkSync(tempIn);
      if (fs.existsSync(tempOut)) fs.unlinkSync(tempOut);
    }
  });
});
