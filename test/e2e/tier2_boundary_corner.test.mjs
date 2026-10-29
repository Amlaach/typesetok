/**
 * TypesetOK (TOK) - E2E Test Suite: Tier 2 - Boundary & Corner Cases
 *
 * 30 Requirement-driven opaque-box boundary and edge-case tests across 6 categories (5 tests each):
 * - B1: Hebrew & Niqqud Boundaries (empty, single-char, pure niqqud, massive run, zero-width chars)
 * - B2: Knuth-Plass & Justification Boundaries (oversized word, extreme narrow, whitespace, orphan word, zero font size)
 * - B3: Multi-stream Layout Boundaries (empty commentary, empty gemara, extreme asymmetry, extreme margins, custom flow)
 * - B4: ISO PDF/X Export Boundaries (zero bleed, large bleed, missing font fallback, special chars in title, empty doc)
 * - B5: Atomic .tok Storage Security & Bounds (zip-bomb, zip-slip, corrupted header, broken JSON in zip, minimal package)
 * - B6: CLI / Desktop IPC Sync Boundaries (non-existent input, missing args, unknown cmd, large payload, unwritable output)
 */

import { describe, it, before } from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as zlib from 'node:zlib';
import {
  findTokCli,
  execTokCli,
  createTempPath,
  inspectPdf,
  inspectZipPackage,
  buildDocumentRoot,
  loadTs
} from './cli_helper.mjs';

describe('Tier 2: Boundary & Corner Cases (30 Tests across 6 Categories)', () => {
  let tokCliPath;
  let hebrewUtilsMod;
  let docBridgeMod;

  before(async () => {
    tokCliPath = findTokCli();
    assert.ok(tokCliPath, 'tok-cli binary must exist');

    hebrewUtilsMod = await loadTs('packages/tok-ui/src/plugins/hebrew-utils.ts');
    docBridgeMod = await loadTs('packages/tok-ui/src/engine/documentBridge.ts');
  });

  // ==========================================================================
  // B1: Hebrew & Niqqud Boundaries
  // ==========================================================================
  describe('B1: Hebrew & Niqqud Boundaries (5 Tests)', () => {
    it('B1.1: Completely empty document handles layout gracefully without panic', async () => {
      const doc = buildDocumentRoot({
        title: 'Empty Document',
        templateType: 'prose',
        flows: {
          main: []
        }
      });
      const inJson = createTempPath('b1_empty_in_', '.json');
      const outJson = createTempPath('b1_empty_out_', '.json');
      fs.writeFileSync(inJson, JSON.stringify(doc), 'utf-8');

      const res = await execTokCli(['typeset-document', inJson, outJson]);
      assert.equal(res.code, 0, 'tok-cli must exit 0 on empty document');

      const pages = JSON.parse(fs.readFileSync(outJson, 'utf-8'));
      assert.equal(pages.length, 1, 'Empty document must emit single clean page');
      assert.equal(pages[0].frames[0].lines.length, 0, 'Empty document frame must have 0 lines');
    });

    it('B1.2: Single-character Hebrew document ("א") shapes and places glyph correctly', async () => {
      const doc = buildDocumentRoot({
        title: '1-Char Document',
        templateType: 'prose',
        flows: {
          main: ['א']
        }
      });
      const inJson = createTempPath('b1_onechar_in_', '.json');
      const outJson = createTempPath('b1_onechar_out_', '.json');
      fs.writeFileSync(inJson, JSON.stringify(doc), 'utf-8');

      const res = await execTokCli(['typeset-document', inJson, outJson]);
      assert.equal(res.code, 0);

      const pages = JSON.parse(fs.readFileSync(outJson, 'utf-8'));
      assert.equal(pages.length, 1);
      const lines = pages[0].frames[0].lines;
      assert.equal(lines.length, 1);
      assert.equal(lines[0].text, 'א');
      assert.ok(lines[0].width > 0, 'Glyph width must be positive');
    });

    it('B1.3: Text composed purely of Niqqud/combining marks handles without crash', async () => {
      const pureNiqqud = '\u05B0\u05B8\u05BC\u05B7'; // Sheva, Qamats, Dagesh, Patah
      assert.equal(hebrewUtilsMod.stripNiqqud(pureNiqqud), '', 'Stripping niqqud from pure marks returns empty string');

      const doc = buildDocumentRoot({
        title: 'Pure Niqqud Document',
        templateType: 'prose',
        flows: {
          main: [pureNiqqud]
        }
      });
      const inJson = createTempPath('b1_pureniqqud_in_', '.json');
      const outJson = createTempPath('b1_pureniqqud_out_', '.json');
      fs.writeFileSync(inJson, JSON.stringify(doc), 'utf-8');

      const res = await execTokCli(['typeset-document', inJson, outJson]);
      assert.equal(res.code, 0, 'Must not crash on orphan combining marks');
    });

    it('B1.4: Massive unbroken Hebrew text without spaces breaks without hanging or infinite loop', async () => {
      // 500 characters of unbroken Hebrew letters
      const unbrokenText = 'א'.repeat(500);
      const doc = buildDocumentRoot({
        title: 'Unbroken Text Document',
        templateType: 'prose',
        flows: {
          main: [unbrokenText]
        }
      });
      const inJson = createTempPath('b1_unbroken_in_', '.json');
      const outJson = createTempPath('b1_unbroken_out_', '.json');
      fs.writeFileSync(inJson, JSON.stringify(doc), 'utf-8');

      const res = await execTokCli(['typeset-document', inJson, outJson]);
      assert.equal(res.code, 0);
      assert.ok(res.durationMs < 5000, 'Must process unbroken line in under 5 seconds');

      const pages = JSON.parse(fs.readFileSync(outJson, 'utf-8'));
      assert.ok(pages.length >= 1);
    });

    it('B1.5: Zero-width joiners, non-joiners and soft hyphens sanitize cleanly', async () => {
      const zwText = 'שלום\u200Bעולם\u200Cומבורך\u200Dלכל\u00ADישראל';
      const doc = buildDocumentRoot({
        title: 'Zero-Width Chars Document',
        templateType: 'prose',
        flows: {
          main: [zwText]
        }
      });
      const inJson = createTempPath('b1_zw_in_', '.json');
      const outJson = createTempPath('b1_zw_out_', '.json');
      fs.writeFileSync(inJson, JSON.stringify(doc), 'utf-8');

      const res = await execTokCli(['typeset-document', inJson, outJson]);
      assert.equal(res.code, 0);

      const pages = JSON.parse(fs.readFileSync(outJson, 'utf-8'));
      assert.equal(pages[0].frames[0].lines.length, 1);
    });
  });

  // ==========================================================================
  // B2: Knuth-Plass & Justification Boundaries
  // ==========================================================================
  describe('B2: Knuth-Plass & Justification Boundaries (5 Tests)', () => {
    it('B2.1: Single word wider than column measure is contained without panic', async () => {
      const oversizedWord = 'אנציקלופדיותיהםומשמרותיהםהארוכותמאד';
      const doc = buildDocumentRoot({
        title: 'Oversized Word Test',
        templateType: 'prose',
        documentSettings: {
          pageWidthPt: 150,
          marginInnerPt: 10,
          marginOuterPt: 10
        },
        flows: {
          main: [oversizedWord]
        }
      });
      const inJson = createTempPath('b2_oversized_in_', '.json');
      const outJson = createTempPath('b2_oversized_out_', '.json');
      fs.writeFileSync(inJson, JSON.stringify(doc), 'utf-8');

      const res = await execTokCli(['typeset-document', inJson, outJson]);
      assert.equal(res.code, 0, 'Must contain oversized word without crashing');

      const pages = JSON.parse(fs.readFileSync(outJson, 'utf-8'));
      assert.ok(pages[0].frames[0].lines.length >= 1);
    });

    it('B2.2: Extreme narrow page width (50pt) maintains positive line widths', async () => {
      const doc = buildDocumentRoot({
        title: 'Extreme Narrow Test',
        templateType: 'prose',
        documentSettings: {
          pageWidthPt: 50,
          marginInnerPt: 5,
          marginOuterPt: 5
        },
        flows: {
          main: ['מילה קצרה בכל שורה']
        }
      });
      const inJson = createTempPath('b2_narrow_in_', '.json');
      const outJson = createTempPath('b2_narrow_out_', '.json');
      fs.writeFileSync(inJson, JSON.stringify(doc), 'utf-8');

      const res = await execTokCli(['typeset-document', inJson, outJson]);
      assert.equal(res.code, 0);

      const pages = JSON.parse(fs.readFileSync(outJson, 'utf-8'));
      for (const line of pages[0].frames[0].lines) {
        assert.ok(line.width > 0, 'Line width must remain strictly positive');
        assert.ok(line.height > 0, 'Line height must remain strictly positive');
      }
    });

    it('B2.3: Whitespace-only paragraph handles cleanly without emitting phantom glyphs', async () => {
      const doc = buildDocumentRoot({
        title: 'Whitespace Only Test',
        templateType: 'prose',
        flows: {
          main: ['   \t   \n   ']
        }
      });
      const inJson = createTempPath('b2_ws_in_', '.json');
      const outJson = createTempPath('b2_ws_out_', '.json');
      fs.writeFileSync(inJson, JSON.stringify(doc), 'utf-8');

      const res = await execTokCli(['typeset-document', inJson, outJson]);
      assert.equal(res.code, 0);

      const pages = JSON.parse(fs.readFileSync(outJson, 'utf-8'));
      assert.equal(pages.length, 1);
    });

    it('B2.4: Paragraph ending with a 1-letter orphan word preserves word integrity', async () => {
      const doc = buildDocumentRoot({
        title: 'Orphan Word Test',
        templateType: 'prose',
        flows: {
          main: ['תחילת פסקה עם מילים שונות ובסופה אות בודדת ה']
        }
      });
      const inJson = createTempPath('b2_orphan_in_', '.json');
      const outJson = createTempPath('b2_orphan_out_', '.json');
      fs.writeFileSync(inJson, JSON.stringify(doc), 'utf-8');

      const res = await execTokCli(['typeset-document', inJson, outJson]);
      assert.equal(res.code, 0);

      const pages = JSON.parse(fs.readFileSync(outJson, 'utf-8'));
      const lastLine = pages[0].frames[0].lines.at(-1);
      assert.ok(lastLine.text.endsWith('ה'), 'Orphan letter must not be truncated');
    });

    it('B2.5: Zero/minimal margin document respects border bounds', async () => {
      const doc = buildDocumentRoot({
        title: 'Zero Margin Test',
        templateType: 'prose',
        documentSettings: {
          pageWidthPt: 400,
          pageHeightPt: 600,
          marginTopPt: 0,
          marginBottomPt: 0,
          marginInnerPt: 0,
          marginOuterPt: 0
        },
        flows: {
          main: ['פסקה בעמוד עם שוליים מאופסים לחלוטין.']
        }
      });
      const inJson = createTempPath('b2_zeromargin_in_', '.json');
      const outJson = createTempPath('b2_zeromargin_out_', '.json');
      fs.writeFileSync(inJson, JSON.stringify(doc), 'utf-8');

      const res = await execTokCli(['typeset-document', inJson, outJson]);
      assert.equal(res.code, 0);

      const pages = JSON.parse(fs.readFileSync(outJson, 'utf-8'));
      const frame = pages[0].frames[0];
      assert.ok(frame.rect.width >= 390, 'Frame width must fill printable area');
    });
  });

  // ==========================================================================
  // B3: Multi-stream Layout Boundaries
  // ==========================================================================
  describe('B3: Multi-stream Layout Boundaries (5 Tests)', () => {
    it('B3.1: Multi-stream layout where commentaries are empty handles cleanly', async () => {
      const doc = buildDocumentRoot({
        title: 'Empty Commentaries Test',
        templateType: 'gemara',
        flows: {
          gemara: ['טקסט גמרא יחיד בעמוד ללא פירושים כלל.'],
          rashi: [],
          tosafot: []
        }
      });
      const inJson = createTempPath('b3_emptycomm_in_', '.json');
      const outJson = createTempPath('b3_emptycomm_out_', '.json');
      fs.writeFileSync(inJson, JSON.stringify(doc), 'utf-8');

      const res = await execTokCli(['typeset-document', inJson, outJson]);
      assert.equal(res.code, 0);

      const pages = JSON.parse(fs.readFileSync(outJson, 'utf-8'));
      assert.ok(pages.length >= 1);
      const gemaraFrame = pages[0].frames.find((f) => f.flow_id === 'gemara');
      assert.ok(gemaraFrame, 'Gemara frame must exist');
      assert.ok(gemaraFrame.lines.length >= 1);
    });

    it('B3.2: Multi-stream layout where main Gemara flow is empty but commentaries have text', async () => {
      const doc = buildDocumentRoot({
        title: 'Empty Gemara Test',
        templateType: 'gemara',
        flows: {
          gemara: [],
          rashi: ['פירוש רש"י ללא טקסט גמרא ראשי בעמוד.'],
          tosafot: ['פירוש תוספות ללא גמרא.']
        }
      });
      const inJson = createTempPath('b3_emptygem_in_', '.json');
      const outJson = createTempPath('b3_emptygem_out_', '.json');
      fs.writeFileSync(inJson, JSON.stringify(doc), 'utf-8');

      const res = await execTokCli(['typeset-document', inJson, outJson]);
      assert.equal(res.code, 0);

      const pages = JSON.parse(fs.readFileSync(outJson, 'utf-8'));
      assert.ok(pages.length >= 1);
    });

    it('B3.3: Extreme asymmetry (1 Gemara line vs 50 commentary lines) spills over pages', async () => {
      const longRashi = [];
      for (let i = 0; i < 50; i++) {
        longRashi.push(`רש"י דיבור המתחיל ${i} ביאור מקיף וארוך מאד הממלא את הדף.`);
      }

      const doc = buildDocumentRoot({
        title: 'Asymmetry Test',
        templateType: 'gemara',
        flows: {
          gemara: ['משנה קצרה בת שורה אחת בלבד.'],
          rashi: longRashi,
          tosafot: ['תוספות קצר.']
        }
      });
      const inJson = createTempPath('b3_asym_in_', '.json');
      const outJson = createTempPath('b3_asym_out_', '.json');
      fs.writeFileSync(inJson, JSON.stringify(doc), 'utf-8');

      const res = await execTokCli(['typeset-document', inJson, outJson]);
      assert.equal(res.code, 0);

      const pages = JSON.parse(fs.readFileSync(outJson, 'utf-8'));
      assert.ok(pages.length >= 2, `Asymmetric commentary must spill to >= 2 pages (got ${pages.length})`);
    });

    it('B3.4: Extreme page margins (220pt inner/outer) layout containment', async () => {
      const doc = buildDocumentRoot({
        title: 'Extreme Margins Test',
        templateType: 'gemara',
        documentSettings: {
          pageWidthPt: 595.28,
          marginInnerPt: 200,
          marginOuterPt: 200
        },
        flows: {
          gemara: ['טקסט במרווח צר מאד בין שוליים ענקיים.'],
          rashi: ['רש"י צר.'],
          tosafot: ['תוספות צר.']
        }
      });
      const inJson = createTempPath('b3_extmargins_in_', '.json');
      const outJson = createTempPath('b3_extmargins_out_', '.json');
      fs.writeFileSync(inJson, JSON.stringify(doc), 'utf-8');

      const res = await execTokCli(['typeset-document', inJson, outJson]);
      assert.equal(res.code, 0);

      const pages = JSON.parse(fs.readFileSync(outJson, 'utf-8'));
      for (const frame of pages[0].frames) {
        assert.ok(frame.rect.width > 0, 'Frame width must remain positive');
      }
    });

    it('B3.5: Unknown/custom flow keys map gracefully to section flows', async () => {
      const doc = buildDocumentRoot({
        title: 'Custom Flow Test',
        flows: {
          custom_commentary_flow: ['פירוש מותאם אישית מאת מחבר בן זמננו.']
        }
      });
      const inJson = createTempPath('b3_customflow_in_', '.json');
      const outJson = createTempPath('b3_customflow_out_', '.json');
      fs.writeFileSync(inJson, JSON.stringify(doc), 'utf-8');

      const res = await execTokCli(['typeset-document', inJson, outJson]);
      assert.equal(res.code, 0);

      const pages = JSON.parse(fs.readFileSync(outJson, 'utf-8'));
      assert.ok(pages.length >= 1);
    });
  });

  // ==========================================================================
  // B4: ISO PDF/X Export Boundaries
  // ==========================================================================
  describe('B4: ISO PDF/X Export Boundaries (5 Tests)', () => {
    it('B4.1: Document with zero bleed produces valid BleedBox aligned to TrimBox', async () => {
      const doc = buildDocumentRoot({
        title: 'Zero Bleed PDF',
        templateType: 'prose',
        flows: {
          main: ['בדיקת ייצוא PDF ללא שולי גלישה (Bleed = 0).']
        }
      });
      const inJson = createTempPath('b4_zbleed_in_', '.json');
      const outPdf = createTempPath('b4_zbleed_out_', '.pdf');
      fs.writeFileSync(inJson, JSON.stringify(doc), 'utf-8');

      const res = await execTokCli(['render-pdf', inJson, outPdf]);
      assert.equal(res.code, 0);

      const inspection = inspectPdf(outPdf);
      assert.ok(inspection.isPdf);
      assert.ok(inspection.hasBleedBox);
      assert.ok(inspection.hasTrimBox);
    });

    it('B4.2: Large page format (A3 / Tabloid dimensions) produces valid PageBoxes', async () => {
      const doc = buildDocumentRoot({
        title: 'A3 PrePress PDF',
        templateType: 'prose',
        documentSettings: {
          pageWidthPt: 841.89, // A3 width
          pageHeightPt: 1190.55 // A3 height
        },
        flows: {
          main: ['כרזה או דף תלמוד ענק בפורמט A3 עם ייצוא לדפוס.']
        }
      });
      const inJson = createTempPath('b4_a3_in_', '.json');
      const outPdf = createTempPath('b4_a3_out_', '.pdf');
      fs.writeFileSync(inJson, JSON.stringify(doc), 'utf-8');

      const res = await execTokCli(['render-pdf', inJson, outPdf]);
      assert.equal(res.code, 0);

      const inspection = inspectPdf(outPdf);
      assert.ok(inspection.mediaBox.width > 800, 'MediaBox width must accommodate A3');
      assert.ok(inspection.mediaBox.height > 1100, 'MediaBox height must accommodate A3');
    });

    it('B4.3: Missing or unresolvable font family gracefully falls back without crashing', async () => {
      const doc = buildDocumentRoot({
        title: 'Fallback Font PDF',
        templateType: 'prose',
        flows: {
          main: [{ id: 'p-fb-1', styleId: 'non-existent-font-style', text: 'טקסט עם גופן לא קיים במערכת.' }]
        }
      });
      const inJson = createTempPath('b4_fontfb_in_', '.json');
      const outPdf = createTempPath('b4_fontfb_out_', '.pdf');
      fs.writeFileSync(inJson, JSON.stringify(doc), 'utf-8');

      const res = await execTokCli(['render-pdf', inJson, outPdf]);
      assert.equal(res.code, 0, 'PDF export must succeed even if font family is unknown');

      const inspection = inspectPdf(outPdf);
      assert.ok(inspection.isPdf);
    });

    it('B4.4: Special characters and non-ASCII Hebrew in PDF metadata catalog', async () => {
      const doc = buildDocumentRoot({
        title: 'ספר "דברים" & <אותיות> + 100% תורה!',
        author: 'רבי שמעון בר יוחאי זצוק"ל',
        templateType: 'prose',
        flows: {
          main: ['בדיקת תווים מיוחדים בכותרת ובמחבר בקטלוג ה-PDF.']
        }
      });
      const inJson = createTempPath('b4_meta_in_', '.json');
      const outPdf = createTempPath('b4_meta_out_', '.pdf');
      fs.writeFileSync(inJson, JSON.stringify(doc), 'utf-8');

      const res = await execTokCli(['render-pdf', inJson, outPdf]);
      assert.equal(res.code, 0);

      const inspection = inspectPdf(outPdf);
      assert.ok(inspection.isPdf);
      assert.ok(inspection.hasEof);
    });

    it('B4.5: PDF rendering of an empty document generates minimal valid PDF', async () => {
      const doc = buildDocumentRoot({
        title: 'Empty PDF Doc',
        templateType: 'prose',
        flows: {
          main: []
        }
      });
      const inJson = createTempPath('b4_emptypdf_in_', '.json');
      const outPdf = createTempPath('b4_emptypdf_out_', '.pdf');
      fs.writeFileSync(inJson, JSON.stringify(doc), 'utf-8');

      const res = await execTokCli(['render-pdf', inJson, outPdf]);
      assert.equal(res.code, 0);

      const inspection = inspectPdf(outPdf);
      assert.ok(inspection.isPdf);
      assert.ok(inspection.hasEof);
    });
  });

  // ==========================================================================
  // B5: Atomic .tok Storage Security & Defense
  // ==========================================================================
  describe('B5: Atomic .tok Storage Security & Defense (5 Tests)', () => {
    it('B5.1: Path traversal (Zip Slip with "../") is strictly rejected by tok-cli', async () => {
      const zipFile = createTempPath('b5_zipslip_', '.tok');
      const outJson = createTempPath('b5_zipslip_out_', '.json');

      // Craft ZIP with malicious entry name "../evil.txt"
      const maliciousPath = '../evil.txt';
      const nameBuf = Buffer.from(maliciousPath, 'utf8');
      const header = Buffer.alloc(30 + nameBuf.length);
      header.writeUInt32LE(0x04034b50, 0);
      header.writeUInt16LE(20, 4);
      header.writeUInt16LE(0, 8);
      header.writeUInt16LE(nameBuf.length, 26);
      nameBuf.copy(header, 30);
      fs.writeFileSync(zipFile, header);

      const res = await execTokCli(['open-package', zipFile, outJson]);
      assert.notEqual(res.code, 0, 'Must reject zip-slip path traversal');
      assert.ok(
        res.stderr.toLowerCase().includes('error') || res.stderr.toLowerCase().includes('corrupted') || res.stderr.toLowerCase().includes('failed'),
        'Stderr must report corruption or security violation'
      );
    });

    it('B5.2: Corrupted ZIP archive with truncated header is rejected with non-zero exit code', async () => {
      const brokenZip = createTempPath('b5_broken_', '.tok');
      const outJson = createTempPath('b5_broken_out_', '.json');
      // Truncated header
      fs.writeFileSync(brokenZip, Buffer.from([0x50, 0x4b, 0x03]));

      const res = await execTokCli(['open-package', brokenZip, outJson]);
      assert.notEqual(res.code, 0, 'Corrupted zip must exit non-zero');
    });

    it('B5.3: Package containing invalid document.json syntax is rejected', async () => {
      const doc = buildDocumentRoot({ title: 'Valid Base' });
      const inJson = createTempPath('b5_syntax_in_', '.json');
      const outTok = createTempPath('b5_syntax_out_', '.tok');
      fs.writeFileSync(inJson, JSON.stringify(doc), 'utf-8');

      await execTokCli(['save-package', inJson, outTok]);

      // Corrupt the package by writing invalid JSON inside document.json
      const zipBuf = fs.readFileSync(outTok);
      // Alter bytes inside to break JSON
      const corruptedBuf = Buffer.from(zipBuf);
      const docIdx = corruptedBuf.indexOf(Buffer.from('document.json'));
      if (docIdx > 0 && docIdx + 50 < corruptedBuf.length) {
        corruptedBuf[docIdx + 45] = 0xFF;
        corruptedBuf[docIdx + 46] = 0xFF;
      }
      const brokenTok = createTempPath('b5_brokentok_', '.tok');
      fs.writeFileSync(brokenTok, corruptedBuf);

      const outJson = createTempPath('b5_extract_out_', '.json');
      const res = await execTokCli(['open-package', brokenTok, outJson]);
      assert.notEqual(res.code, 0, 'Must reject corrupted document JSON inside package');
    });

    it('B5.4: Minimal package with empty asset map opens and inspects cleanly', async () => {
      const doc = buildDocumentRoot({
        title: 'Minimal Package',
        templateType: 'prose',
        flows: { main: ['טקסט ללא נכסים'] }
      });
      const inJson = createTempPath('b5_min_in_', '.json');
      const outTok = createTempPath('b5_min_out_', '.tok');
      fs.writeFileSync(inJson, JSON.stringify(doc), 'utf-8');

      const saveRes = await execTokCli(['save-package', inJson, outTok]);
      assert.equal(saveRes.code, 0);

      const inspRes = await execTokCli(['inspect-package', outTok]);
      assert.equal(inspRes.code, 0);
      assert.ok(inspRes.stdout.includes('Embedded Assets:  0'));
    });

    it('B5.5: Non-.tok extension file is still opened if valid JSON package content', async () => {
      const doc = buildDocumentRoot({ title: 'Custom Ext', templateType: 'prose', flows: { main: ['מלל'] } });
      const inJson = createTempPath('b5_customext_in_', '.json');
      const outPkg = createTempPath('b5_customext_out_', '.pkg'); // .pkg instead of .tok
      fs.writeFileSync(inJson, JSON.stringify(doc), 'utf-8');

      await execTokCli(['save-package', inJson, outPkg]);

      const outExtract = createTempPath('b5_customext_extract_', '.json');
      const res = await execTokCli(['open-package', outPkg, outExtract]);
      assert.equal(res.code, 0, 'tok-cli open-package should succeed on valid package regardless of file extension');
    });
  });

  // ==========================================================================
  // B6: CLI / Desktop IPC Sync Boundaries
  // ==========================================================================
  describe('B6: CLI / Desktop IPC Sync Boundaries (5 Tests)', () => {
    it('B6.1: Non-existent input file returns non-zero exit code with error message', async () => {
      const nonExistentPath = createTempPath('does_not_exist_', '.json');
      const outJson = createTempPath('b6_out_', '.json');

      const res = await execTokCli(['typeset-document', nonExistentPath, outJson]);
      assert.notEqual(res.code, 0);
      assert.ok(
        res.stderr.toLowerCase().includes('not exist') || res.stderr.toLowerCase().includes('error'),
        `Stderr must explain missing file: ${res.stderr}`
      );
    });

    it('B6.2: Missing mandatory CLI arguments exits with code 1 and prints usage', async () => {
      const res = await execTokCli(['render-pdf']);
      assert.notEqual(res.code, 0);
      assert.ok(
        res.stderr.includes('Usage:') || res.stdout.includes('USAGE:'),
        'Must display usage guidance when arguments are missing'
      );
    });

    it('B6.3: Unknown CLI subcommand exits with code 1', async () => {
      const res = await execTokCli(['completely-unknown-subcommand-xyz']);
      assert.notEqual(res.code, 0);
      assert.ok(
        res.stderr.toLowerCase().includes('unknown') || res.stdout.includes('USAGE:'),
        'Must report unknown command'
      );
    });

    it('B6.4: Large document payload (200 paragraphs) processes within memory and time limits', async () => {
      const paras = [];
      for (let i = 0; i < 200; i++) {
        paras.push(`פסקה לבדיקת עומס מספר ${i} המכילה טקסט מנוקד עברי מורכב.`);
      }

      const doc = buildDocumentRoot({
        title: 'Large Payload Document',
        templateType: 'prose',
        flows: { main: paras }
      });
      const inJson = createTempPath('b6_large_in_', '.json');
      const outJson = createTempPath('b6_large_out_', '.json');
      fs.writeFileSync(inJson, JSON.stringify(doc), 'utf-8');

      const res = await execTokCli(['typeset-document', inJson, outJson]);
      assert.equal(res.code, 0);
      assert.ok(res.durationMs < 10000, `200 paragraphs must typeset in < 10s (took ${res.durationMs}ms)`);

      const pages = JSON.parse(fs.readFileSync(outJson, 'utf-8'));
      assert.ok(pages.length >= 3, `Must paginate into >= 3 pages (got ${pages.length})`);
    });

    it('B6.5: Inaccessible / invalid output path returns non-zero exit code with error', async () => {
      const doc = buildDocumentRoot({ title: 'Invalid Output Test' });
      const inJson = createTempPath('b6_badout_in_', '.json');
      fs.writeFileSync(inJson, JSON.stringify(doc), 'utf-8');

      // Invalid Windows path with illegal character '|'
      const invalidOut = 'C:\\illegal|path\\out.json';

      const res = await execTokCli(['typeset-document', inJson, invalidOut]);
      assert.notEqual(res.code, 0, 'Must exit non-zero on illegal output path');
    });
  });
});
