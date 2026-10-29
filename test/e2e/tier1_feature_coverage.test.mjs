/**
 * TypesetOK (TOK) - E2E Test Suite: Tier 1 - Feature Coverage
 *
 * 30 Requirement-driven opaque-box tests across 6 core features (5 tests each):
 * - F1: Hebrew Normalization & Niqqud
 * - F2: Knuth-Plass Line Breaking & Justification
 * - F3: Multi-stream Layout (Talmud Co-Pagination)
 * - F4: ISO PDF/X-1a Export & PageBoxes
 * - F5: Atomic .tok Storage & Zip Packaging
 * - F6: Desktop Document IPC & Sync Contract
 */

import { describe, it, before } from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as path from 'node:path';
import {
  findTokCli,
  execTokCli,
  createTempPath,
  inspectPdf,
  inspectZipPackage,
  buildDocumentRoot,
  loadTs
} from './cli_helper.mjs';

describe('Tier 1: Feature Coverage (30 Tests across 6 Features)', () => {
  let tokCliPath;
  let hebrewUtilsMod;
  let gematriaMod;
  let docBridgeMod;
  let typesetBridgeMod;

  before(async () => {
    tokCliPath = findTokCli();
    assert.ok(tokCliPath, 'tok-cli binary must exist');

    hebrewUtilsMod = await loadTs('packages/tok-ui/src/plugins/hebrew-utils.ts');
    gematriaMod = await loadTs('packages/tok-ui/src/gematria.ts');
    docBridgeMod = await loadTs('packages/tok-ui/src/engine/documentBridge.ts');
    typesetBridgeMod = await loadTs('packages/tok-ui/src/engine/typesetBridge.ts');
  });

  // ==========================================================================
  // F1: Hebrew Normalization & Niqqud
  // ==========================================================================
  describe('F1: Hebrew Normalization & Niqqud (5 Tests)', () => {
    it('F1.1: Strips Niqqud while preserving consonants and cantillation (Ta\'amim)', () => {
      // Verse with both Niqqud and Ta'amim (Genesis 1:1)
      const input = 'בְּרֵאשִׁ֖ית בָּרָ֣א אֱלֹהִ֑ים אֵ֥ת הַשָּׁמַ֖יִם וְאֵ֥ת הָאָֽרֶץ׃';
      const stripped = hebrewUtilsMod.stripNiqqud(input);

      // Niqqud points must be stripped: Dagesh (\u05BC), Qamats (\u05B8), Sheva (\u05B0), Patah (\u05B7), etc.
      assert.ok(!/[\u05B0-\u05BC\u05BF\u05C1\u05C2\u05C7]/.test(stripped), 'All vowel points and dagesh must be stripped');

      // Cantillation (Ta'amim) must be preserved: Tipcha (\u0596), Munach (\u05A3), Etnahta (\u0591), etc.
      assert.ok(/[\u0591-\u05AF]/.test(stripped), 'Ta\'amim cantillation marks must be preserved');

      // Consonants must remain (stripping ta'amim reveals plain consonants)
      const plainConsonants = hebrewUtilsMod.stripTaamim(stripped);
      assert.ok(plainConsonants.includes('בראשית'), 'Base Hebrew letters must be intact');
    });

    it('F1.2: Strips Ta\'amim while preserving vowel points (Niqqud)', () => {
      const input = 'בְּרֵאשִׁ֖ית בָּרָ֣א אֱלֹהִ֑ים';
      const stripped = hebrewUtilsMod.stripTaamim(input);

      // Cantillation marks must be gone
      assert.ok(!/[\u0591-\u05AF]/.test(stripped), 'All cantillation marks must be stripped');

      // Niqqud points must remain
      assert.ok(/[\u05B0-\u05BC]/.test(stripped), 'Niqqud vowel points must be preserved');
      assert.ok(stripped.includes('בְּרֵאשִׁית'), 'Niqqud text remains readable');
    });

    it('F1.3: Strips all marks (both Niqqud and Ta\'amim) leaving bare consonants', () => {
      const input = 'מֵאֵימָתַי קוֹרִין אֶת שְׁמַע בְּעַרְבִית?';
      const bare = hebrewUtilsMod.stripAllMarks(input);

      assert.equal(bare, 'מאימתי קורין את שמע בערבית?', 'All combining marks must be removed leaving plain consonants');
    });

    it('F1.4: Normalizes ASCII quotes to proper Hebrew typographic Geresh and Gershayim', () => {
      const input = 'פרק א"ב הלכה ג\' וכתב הרמב"ם ז"ל';
      const normalized = hebrewUtilsMod.normalizeQuotes(input);

      // Must replace " with ״ (U+05F4) and ' with ׳ (U+05F3)
      assert.ok(normalized.includes('א״ב'), 'Acronym must use typographic Gershayim (״)');
      assert.ok(normalized.includes('ג׳'), 'Single abbreviation must use typographic Geresh (׳)');
      assert.ok(normalized.includes('הרמב״ם'), 'Rambam must use Gershayim');
      assert.ok(normalized.includes('ז״ל'), 'Zal must use Gershayim');
      assert.ok(!normalized.includes('"'), 'No ASCII double quotes should remain in Hebrew words');
    });

    it('F1.5: Handles mixed RTL/LTR text with divine names detection and BiDi stability', async () => {
      const text = 'ברוך יהוה לעולם TypesetOK v0.30 אמן ואמן';
      const holyMatches = hebrewUtilsMod.findHolyNames(text);

      assert.ok(holyMatches.length >= 1, 'Tetragrammaton must be detected');
      assert.equal(holyMatches[0].name, 'יהוה');

      // Typeset mixed text via tok-cli to ensure BiDi stability without crash
      const doc = buildDocumentRoot({
        title: 'בדיקת BiDi מעורב',
        templateType: 'prose',
        flows: {
          main: [text]
        }
      });
      const inJson = createTempPath('bidi_in_', '.json');
      const outJson = createTempPath('bidi_out_', '.json');
      fs.writeFileSync(inJson, JSON.stringify(doc), 'utf-8');

      const res = await execTokCli(['typeset-document', inJson, outJson]);
      assert.equal(res.code, 0, `tok-cli must succeed on mixed BiDi text: ${res.stderr}`);

      const pages = JSON.parse(fs.readFileSync(outJson, 'utf-8'));
      assert.ok(pages.length >= 1, 'Must emit at least 1 page');
      assert.ok(pages[0].frames[0].lines.length >= 1, 'Must emit text line');
    });
  });

  // ==========================================================================
  // F2: Knuth-Plass Line Breaking & Justification
  // ==========================================================================
  describe('F2: Knuth-Plass Line Breaking & Justification (5 Tests)', () => {
    it('F2.1: Single-line breaking within bounded measure', async () => {
      const doc = buildDocumentRoot({
        title: 'Single Line Test',
        templateType: 'prose',
        flows: {
          main: ['שורה קצרה אחת בלבד.']
        }
      });
      const inJson = createTempPath('kp_single_in_', '.json');
      const outJson = createTempPath('kp_single_out_', '.json');
      fs.writeFileSync(inJson, JSON.stringify(doc), 'utf-8');

      const res = await execTokCli(['typeset-document', inJson, outJson]);
      assert.equal(res.code, 0, 'tok-cli must succeed on single-line paragraph');

      const pages = JSON.parse(fs.readFileSync(outJson, 'utf-8'));
      assert.equal(pages.length, 1);
      const frame = pages[0].frames[0];
      assert.equal(frame.lines.length, 1);
      assert.ok(frame.lines[0].width <= frame.rect.width, 'Line width must not exceed frame width');
    });

    it('F2.2: Multi-line paragraph Knuth-Plass dynamic programming break points', async () => {
      const multiLineText =
        'מֵאֵימָתַי קוֹרִין אֶת שְׁמַע בְּעַרְבִית? מִשָּׁעָה שֶׁהַכֹּהֲנִים נִכְנָסִים לֶאֱכֹל בִּתְרוּמָתָן עַד סוֹף הָאַשְׁמוּרָה הָרִאשׁוֹנָה דִּבְרֵי רַבִּי אֱלִיעֶזֶר. ' +
        'וַחֲכָמִים אוֹמְרִים עַד חֲצוֹת. רַבָּן גַּמְלִיאֵל אוֹמֵר עַד שֶׁיַּעֲלֶה עַמּוּד הַשָּׁחַר. מַעֲשֶׂה שֶׁבָּאוּ בָנָיו מִבֵּית הַמִּשְׁתֶּה אָמְרוּ לוֹ לֹא קָרִינוּ אֶת שְׁמַע. ' +
        'אָמַר לָהֶם אִם לֹא עָלָה עַמּוּד הַשָּׁחַר חַיָּבִין אַתֶּם לִקְרוֹת.';

      const doc = buildDocumentRoot({
        title: 'Multi Line Justification Test',
        templateType: 'prose',
        flows: {
          main: [multiLineText]
        }
      });
      const inJson = createTempPath('kp_multi_in_', '.json');
      const outJson = createTempPath('kp_multi_out_', '.json');
      fs.writeFileSync(inJson, JSON.stringify(doc), 'utf-8');

      const res = await execTokCli(['typeset-document', inJson, outJson]);
      assert.equal(res.code, 0);

      const pages = JSON.parse(fs.readFileSync(outJson, 'utf-8'));
      const frame = pages[0].frames[0];
      assert.ok(frame.lines.length >= 2, 'Paragraph must break into multiple lines');

      // First line should be fully justified to frame width
      const firstLine = frame.lines[0];
      const diff = Math.abs(firstLine.width - frame.rect.width);
      assert.ok(diff <= 1.0, `First line width (${firstLine.width}) must match frame width (${frame.rect.width}) within 1.0pt`);
    });

    it('F2.3: Inter-word spacing justification within reasonable bounds', async () => {
      const doc = buildDocumentRoot({
        title: 'Word Spacing Test',
        templateType: 'prose',
        flows: {
          main: ['כל אדם בישראל חייב בלימוד התורה והמשנה בכל יום ובכל לילה כדי שיהיו דברי תורה מחודדים בפיו תמיד.']
        }
      });
      const inJson = createTempPath('kp_spacing_in_', '.json');
      const outJson = createTempPath('kp_spacing_out_', '.json');
      fs.writeFileSync(inJson, JSON.stringify(doc), 'utf-8');

      const res = await execTokCli(['typeset-document', inJson, outJson]);
      assert.equal(res.code, 0);

      const pages = JSON.parse(fs.readFileSync(outJson, 'utf-8'));
      const line0 = pages[0].frames[0].lines[0];
      assert.ok(line0.text.split(' ').length >= 4, 'Line must contain multiple words');
      assert.ok(line0.height > 8 && line0.height < 30, 'Line height must be realistic for body font');
    });

    it('F2.4: Monotonic vertical baseline progression without overlapping lines', async () => {
      const doc = buildDocumentRoot({
        title: 'Vertical Baseline Test',
        templateType: 'prose',
        flows: {
          main: [
            'פסקה ראשונה ארוכה ומפורטת לבדיקת מרווחי שורות ואי-חפיפה בין שורות עוקבות במסמך דפוס.',
            'פסקה שנייה ממשיכה מיד לאחריה ומבטיחה שאין התנגשות או דריסה של גובה האותיות והניקוד.',
            'פסקה שלישית חותמת את הבדיקה.'
          ]
        }
      });
      const inJson = createTempPath('kp_baseline_in_', '.json');
      const outJson = createTempPath('kp_baseline_out_', '.json');
      fs.writeFileSync(inJson, JSON.stringify(doc), 'utf-8');

      const res = await execTokCli(['typeset-document', inJson, outJson]);
      assert.equal(res.code, 0);

      const pages = JSON.parse(fs.readFileSync(outJson, 'utf-8'));
      const lines = pages[0].frames[0].lines;
      assert.ok(lines.length >= 3, 'Must have at least 3 lines');

      for (let i = 1; i < lines.length; i++) {
        const prev = lines[i - 1];
        const curr = lines[i];
        assert.ok(curr.baseline_y > prev.baseline_y, `Line ${i} baseline (${curr.baseline_y}) must be strictly below line ${i - 1} (${prev.baseline_y})`);
        assert.ok(curr.baseline_y - prev.baseline_y >= 10.0, 'Line spacing must be at least 10pt');
      }
    });

    it('F2.5: Micro-tracking and margin containment on narrow measures', async () => {
      // Narrow measure (e.g. 150pt)
      const doc = buildDocumentRoot({
        title: 'Narrow Column Justification',
        templateType: 'prose',
        documentSettings: {
          pageWidthPt: 300,
          marginInnerPt: 30,
          marginOuterPt: 30
        },
        flows: {
          main: ['טור צר מחייב חלוקת מילים מדויקת וריווח אותיות עדין למניעת חריגה מעבר לשוליים הימניים והשמאליים.']
        }
      });
      const inJson = createTempPath('kp_narrow_in_', '.json');
      const outJson = createTempPath('kp_narrow_out_', '.json');
      fs.writeFileSync(inJson, JSON.stringify(doc), 'utf-8');

      const res = await execTokCli(['typeset-document', inJson, outJson]);
      assert.equal(res.code, 0);

      const pages = JSON.parse(fs.readFileSync(outJson, 'utf-8'));
      const frame = pages[0].frames[0];
      for (const line of frame.lines) {
        assert.ok(line.width <= frame.rect.width + 1.0, `Line width (${line.width}) must stay inside narrow frame (${frame.rect.width})`);
      }
    });
  });

  // ==========================================================================
  // F3: Multi-stream Layout (Talmud Co-Pagination)
  // ==========================================================================
  describe('F3: Multi-stream Layout (5 Tests)', () => {
    it('F3.1: Classical Talmud 3-flow layout (Gemara, Rashi, Tosafot) co-pagination', async () => {
      const doc = buildDocumentRoot({
        title: 'מסכת ברכות דף ב ע"א',
        templateType: 'gemara',
        flows: {
          gemara: ['מאימתי קורין את שמע בערבית משעה שהכהנים נכנסים לאכול בתרומתן.'],
          rashi: ['מאימתי - תנא אקרא קאי דכתיב בשכבך ובקומך.'],
          tosafot: ['מאימתי - פירש רש"י דתנא אקרא קאי ותימה לר"י.']
        }
      });
      const inJson = createTempPath('talmud_3flow_in_', '.json');
      const outJson = createTempPath('talmud_3flow_out_', '.json');
      fs.writeFileSync(inJson, JSON.stringify(doc), 'utf-8');

      const res = await execTokCli(['typeset-document', inJson, outJson]);
      assert.equal(res.code, 0);

      const pages = JSON.parse(fs.readFileSync(outJson, 'utf-8'));
      assert.ok(pages.length >= 1);
      const page0 = pages[0];
      assert.equal(page0.frames.length, 3, 'Must typeset exactly 3 distinct column frames');

      const flowIds = page0.frames.map((f) => f.flow_id);
      assert.ok(flowIds.includes('gemara'), 'Gemara flow frame must exist');
      assert.ok(flowIds.includes('rashi'), 'Rashi commentary frame must exist');
      assert.ok(flowIds.includes('tosafot'), 'Tosafot commentary frame must exist');
    });

    it('F3.2: Distinct geometric column placement across streams without frame overlap', async () => {
      const doc = buildDocumentRoot({
        title: 'Talmud Geometry Layout',
        templateType: 'gemara',
        flows: {
          gemara: ['גמרא במרכז הדף בטור רחב ומרווח.'],
          rashi: ['רש"י בצד הפנימי באותיות רש"י.'],
          tosafot: ['תוספות בצד החיצוני ברוחב מותאם.']
        }
      });
      const inJson = createTempPath('talmud_geom_in_', '.json');
      const outJson = createTempPath('talmud_geom_out_', '.json');
      fs.writeFileSync(inJson, JSON.stringify(doc), 'utf-8');

      const res = await execTokCli(['typeset-document', inJson, outJson]);
      assert.equal(res.code, 0);

      const pages = JSON.parse(fs.readFileSync(outJson, 'utf-8'));
      const frames = pages[0].frames;
      assert.equal(frames.length, 3);

      // Verify each frame has positive area and distinct X bounds
      for (const f of frames) {
        assert.ok(f.rect.width > 50, `Frame ${f.flow_id} width must be positive (>50pt)`);
        assert.ok(f.rect.height > 20, `Frame ${f.flow_id} height must be positive (>20pt)`);
      }

      // Check non-overlapping horizontal positions
      const sortedByX = [...frames].sort((a, b) => a.rect.x - b.rect.x);
      assert.ok(sortedByX[0].rect.x + sortedByX[0].rect.width <= sortedByX[1].rect.x + 0.1, 'Column 0 and 1 must not overlap');
      assert.ok(sortedByX[1].rect.x + sortedByX[1].rect.width <= sortedByX[2].rect.x + 0.1, 'Column 1 and 2 must not overlap');
    });

    it('F3.3: Hebrew Gematria folio assignment on multi-stream pages', async () => {
      const doc = buildDocumentRoot({
        title: 'Gematria Folio Document',
        templateType: 'gemara',
        flows: {
          gemara: [
            'דף ראשון של המסכת.',
            'המשך דברי הגמרא הממלאים את הדף הראשון.'
          ]
        }
      });
      const inJson = createTempPath('talmud_folio_in_', '.json');
      const outJson = createTempPath('talmud_folio_out_', '.json');
      fs.writeFileSync(inJson, JSON.stringify(doc), 'utf-8');

      const res = await execTokCli(['typeset-document', inJson, outJson]);
      assert.equal(res.code, 0);

      const pages = JSON.parse(fs.readFileSync(outJson, 'utf-8'));
      assert.ok(pages.length >= 1);
      assert.ok(pages[0].page_number_gematria, 'Page must contain Hebrew gematria folio');
      assert.equal(pages[0].page_number_gematria, 'א׳', 'Page 1 gematria folio must be א׳');
    });

    it('F3.4: Multi-stream page overflow and multi-page generation', async () => {
      const longParas = [];
      for (let i = 0; i < 40; i++) {
        longParas.push(`טקסט רב זרימתי ארוך המתפשט על פני עמודים מרובים ובוחן גלישת עמודים אוטומטית חלק ${i}`);
      }

      const doc = buildDocumentRoot({
        title: 'Multi-Page Overflow Test',
        templateType: 'gemara',
        flows: {
          gemara: longParas,
          rashi: longParas,
          tosafot: longParas
        }
      });
      const inJson = createTempPath('talmud_overflow_in_', '.json');
      const outJson = createTempPath('talmud_overflow_out_', '.json');
      fs.writeFileSync(inJson, JSON.stringify(doc), 'utf-8');

      const res = await execTokCli(['typeset-document', inJson, outJson]);
      assert.equal(res.code, 0);

      const pages = JSON.parse(fs.readFileSync(outJson, 'utf-8'));
      assert.ok(pages.length >= 2, `Long multi-stream document must paginate into >= 2 pages (got ${pages.length})`);
      assert.equal(pages[1].page_index, 1);
      assert.equal(pages[1].page_number_gematria, 'ב׳');
    });

    it('F3.5: MultiFlowDocumentState conversion bridge preserves all flow keys', () => {
      const state = {
        title: 'דף בדיקה',
        templateType: 'gemara',
        flows: {
          gemara: [{ id: 'g1', styleId: 'gemara', text: 'טקסט גמרא' }],
          rashi: [{ id: 'r1', styleId: 'rashi', text: 'טקסט רש"י' }],
          tosafot: [{ id: 't1', styleId: 'tosafot', text: 'טקסט תוספות' }]
        }
      };

      const docRoot = docBridgeMod.documentStateToDocumentRoot(state);
      assert.equal(docRoot.sections.length, 1);
      const section = docRoot.sections[0];
      const flowIds = section.flows.map((f) => f.id);
      assert.ok(flowIds.includes('gemara') || flowIds.includes('main'), 'Must include gemara flow');
      assert.ok(flowIds.includes('rashi'), 'Must include rashi flow');
      assert.ok(flowIds.includes('tosafot'), 'Must include tosafot flow');
    });
  });

  // ==========================================================================
  // F4: ISO PDF/X-1a Export & PageBoxes
  // ==========================================================================
  describe('F4: ISO PDF/X-1a Export & PageBoxes (5 Tests)', () => {
    it('F4.1: Emits valid PDF magic header and EOF footer', async () => {
      const doc = buildDocumentRoot({
        title: 'PDF Header Test',
        templateType: 'prose',
        flows: {
          main: ['בדיקת ייצוא קובץ PDF/X תקין עם חתימת ראש וסיום תקנית.']
        }
      });
      const inJson = createTempPath('pdf_header_in_', '.json');
      const outPdf = createTempPath('pdf_header_out_', '.pdf');
      fs.writeFileSync(inJson, JSON.stringify(doc), 'utf-8');

      const res = await execTokCli(['render-pdf', inJson, outPdf]);
      assert.equal(res.code, 0, `PDF export must succeed: ${res.stderr}`);

      const inspection = inspectPdf(outPdf);
      assert.ok(inspection.isPdf, 'File must begin with %PDF-');
      assert.ok(inspection.hasEof, 'File must end with %%EOF');
      assert.ok(inspection.byteLength > 1000, 'PDF size must be substantial');
    });

    it('F4.2: PrePress PageBoxes (MediaBox, BleedBox, TrimBox) presence and valid hierarchy', async () => {
      const doc = buildDocumentRoot({
        title: 'PrePress PageBoxes Test',
        templateType: 'prose',
        documentSettings: {
          pageWidthPt: 595.28,
          pageHeightPt: 841.89
        },
        flows: {
          main: ['בדיקת תיבות עמוד מקצועיות: מדיה, גלישה וחיתוך.']
        }
      });
      const inJson = createTempPath('pdf_boxes_in_', '.json');
      const outPdf = createTempPath('pdf_boxes_out_', '.pdf');
      fs.writeFileSync(inJson, JSON.stringify(doc), 'utf-8');

      const res = await execTokCli(['render-pdf', inJson, outPdf]);
      assert.equal(res.code, 0);

      const inspection = inspectPdf(outPdf);
      assert.ok(inspection.hasMediaBox, 'PDF must specify /MediaBox');
      assert.ok(inspection.hasBleedBox, 'PDF must specify /BleedBox');
      assert.ok(inspection.hasTrimBox, 'PDF must specify /TrimBox');

      assert.ok(inspection.mediaBox, 'MediaBox must be parsed');
      assert.ok(inspection.bleedBox, 'BleedBox must be parsed');
      assert.ok(inspection.trimBox, 'TrimBox must be parsed');

      // PrePress hierarchy: MediaBox >= BleedBox >= TrimBox
      assert.ok(
        inspection.mediaBox.width >= inspection.bleedBox.width,
        'MediaBox width must be >= BleedBox width'
      );
      assert.ok(
        inspection.bleedBox.width >= inspection.trimBox.width,
        'BleedBox width must be >= TrimBox width'
      );
    });

    it('F4.3: ISO PDF/X-1a compliance markers and OutputIntents', async () => {
      const doc = buildDocumentRoot({
        title: 'ISO PDF/X-1a Conformance Test',
        templateType: 'prose',
        flows: {
          main: ['מסמך עם אימות מלא לתקן הדפוס ISO PDF/X-1a.']
        }
      });
      const inJson = createTempPath('pdf_iso_in_', '.json');
      const outPdf = createTempPath('pdf_iso_out_', '.pdf');
      fs.writeFileSync(inJson, JSON.stringify(doc), 'utf-8');

      const res = await execTokCli(['render-pdf', inJson, outPdf]);
      assert.equal(res.code, 0);

      const inspection = inspectPdf(outPdf);
      assert.ok(inspection.hasPdfXVersion, 'PDF must declare /GTS_PDFXVersion');
      assert.ok(inspection.hasOutputIntents, 'PDF must declare /OutputIntents for CMYK prepress target');
    });

    it('F4.4: Embedded ToUnicode CMap for Hebrew text extraction and searchability', async () => {
      const doc = buildDocumentRoot({
        title: 'ToUnicode CMap Test',
        templateType: 'prose',
        flows: {
          main: ['בדיקת חילוץ אותיות עבריות באמצעות טבלת יוניקוד CMap.']
        }
      });
      const inJson = createTempPath('pdf_cmap_in_', '.json');
      const outPdf = createTempPath('pdf_cmap_out_', '.pdf');
      fs.writeFileSync(inJson, JSON.stringify(doc), 'utf-8');

      const res = await execTokCli(['render-pdf', inJson, outPdf]);
      assert.equal(res.code, 0);

      const inspection = inspectPdf(outPdf);
      assert.ok(inspection.hasToUnicode, 'PDF must contain /ToUnicode CMap stream for glyph extraction');
    });

    it('F4.5: Multi-page PDF generation from long prose document', async () => {
      const longParas = [];
      for (let i = 0; i < 70; i++) {
        longParas.push(`פסקה מספר ${i} עם תוכן ספרותי עברי רציף לבדיקת פגינציה רב-עמודית בייצוא PDF/X-1a.`);
      }

      const doc = buildDocumentRoot({
        title: 'Multi-Page PDF Test',
        templateType: 'prose',
        flows: {
          main: longParas
        }
      });
      const inJson = createTempPath('pdf_multipage_in_', '.json');
      const outPdf = createTempPath('pdf_multipage_out_', '.pdf');
      fs.writeFileSync(inJson, JSON.stringify(doc), 'utf-8');

      const res = await execTokCli(['render-pdf', inJson, outPdf]);
      assert.equal(res.code, 0);

      // Verify page count in typeset layout
      const typesetOut = createTempPath('pdf_multipage_layout_', '.json');
      await execTokCli(['typeset-document', inJson, typesetOut]);
      const pages = JSON.parse(fs.readFileSync(typesetOut, 'utf-8'));
      assert.ok(pages.length >= 2, `Long document must typeset into >= 2 pages (got ${pages.length})`);

      const pdfBuf = fs.readFileSync(outPdf);
      assert.ok(pdfBuf.length > 5000, `Multi-page PDF must be larger than 5KB (got ${pdfBuf.length} bytes)`);
    });
  });

  // ==========================================================================
  // F5: Atomic .tok Storage & Zip Packaging
  // ==========================================================================
  describe('F5: Atomic .tok Storage (5 Tests)', () => {
    it('F5.1: Produces valid ZIP archive with manifest.json and document.json', async () => {
      const doc = buildDocumentRoot({
        title: 'חבילת טוק בדיקה',
        author: 'סופר סתם',
        templateType: 'prose',
        flows: {
          main: ['תוכן מסמך לבדיקת אריזת ZIP תקנית.']
        }
      });
      const inJson = createTempPath('tok_zip_in_', '.json');
      const outTok = createTempPath('tok_zip_out_', '.tok');
      fs.writeFileSync(inJson, JSON.stringify(doc), 'utf-8');

      const res = await execTokCli(['save-package', inJson, outTok]);
      assert.equal(res.code, 0, `save-package must succeed: ${res.stderr}`);

      const inspection = inspectZipPackage(outTok);
      assert.ok(inspection.hasManifest, 'Package must contain manifest.json');
      assert.ok(inspection.hasDocument, 'Package must contain document.json');
      assert.equal(inspection.manifest.title, 'חבילת טוק בדיקה');
      assert.equal(inspection.manifest.author, 'סופר סתם');
    });

    it('F5.2: Integrity CRC32 checksums across package entries', async () => {
      const doc = buildDocumentRoot({
        title: 'CRC Check Test',
        templateType: 'prose',
        flows: {
          main: ['בדיקת תקינות גיבוב CRC32 של קבצי החבילה.']
        }
      });
      const inJson = createTempPath('tok_crc_in_', '.json');
      const outTok = createTempPath('tok_crc_out_', '.tok');
      fs.writeFileSync(inJson, JSON.stringify(doc), 'utf-8');

      const res = await execTokCli(['save-package', inJson, outTok]);
      assert.equal(res.code, 0);

      const inspection = inspectZipPackage(outTok);
      for (const entry of inspection.entries) {
        assert.ok(entry.crc32 > 0, `Entry ${entry.name} must have a valid non-zero CRC32`);
        assert.ok(entry.uncompressedSize > 0, `Entry ${entry.name} must have positive uncompressed size`);
      }
    });

    it('F5.3: Atomic file write guarantees complete file on disk without temporary residue', async () => {
      const doc = buildDocumentRoot({
        title: 'Atomic Save Test',
        templateType: 'prose',
        flows: {
          main: ['בדיקת פעולה אטומית שלא משאירה קבצים זמניים פגומים.']
        }
      });
      const inJson = createTempPath('tok_atomic_in_', '.json');
      const outTok = createTempPath('tok_atomic_out_', '.tok');
      fs.writeFileSync(inJson, JSON.stringify(doc), 'utf-8');

      const res = await execTokCli(['save-package', inJson, outTok]);
      assert.equal(res.code, 0);

      assert.ok(fs.existsSync(outTok), 'Target .tok file must exist');
      const stats = fs.statSync(outTok);
      assert.ok(stats.size > 100, 'File must not be empty');

      // No lingering .tmp files in target directory
      const parentDir = path.dirname(outTok);
      const tmpMatches = fs.readdirSync(parentDir).filter((f) => f.startsWith(path.basename(outTok)) && f.endsWith('.tmp'));
      assert.equal(tmpMatches.length, 0, 'No temporary residue files must remain');
    });

    it('F5.4: Deserialization and extraction via open-package preserves document root', async () => {
      const originalDoc = buildDocumentRoot({
        title: 'מסמך לשחזור מלא',
        author: 'רבי יוחנן',
        templateType: 'gemara',
        flows: {
          gemara: ['פסקת גמרא עיקרית לשמירה וטעינה חוזרת.'],
          rashi: ['פירוש רש"י הנלווה למסמך.']
        }
      });
      const inJson = createTempPath('tok_round_in_', '.json');
      const tokPkg = createTempPath('tok_round_pkg_', '.tok');
      const outJson = createTempPath('tok_round_out_', '.json');
      fs.writeFileSync(inJson, JSON.stringify(originalDoc), 'utf-8');

      // 1. Save
      const saveRes = await execTokCli(['save-package', inJson, tokPkg]);
      assert.equal(saveRes.code, 0);

      // 2. Open
      const openRes = await execTokCli(['open-package', tokPkg, outJson]);
      assert.equal(openRes.code, 0);

      // 3. Compare
      const reloadedDoc = JSON.parse(fs.readFileSync(outJson, 'utf-8'));
      assert.equal(reloadedDoc.metadata.title, originalDoc.metadata.title);
      assert.equal(reloadedDoc.metadata.author, originalDoc.metadata.author);
      assert.equal(reloadedDoc.sections.length, 1);
      assert.equal(reloadedDoc.sections[0].flows.length, 2);
    });

    it('F5.5: inspect-package CLI subcommand displays package metadata', async () => {
      const doc = buildDocumentRoot({
        title: 'בדיקת פיקוח חבילה',
        author: 'בודק מערכת',
        templateType: 'prose',
        flows: {
          main: ['טקסט לבדיקת inspect-package']
        }
      });
      const inJson = createTempPath('tok_insp_in_', '.json');
      const outTok = createTempPath('tok_insp_out_', '.tok');
      fs.writeFileSync(inJson, JSON.stringify(doc), 'utf-8');

      await execTokCli(['save-package', inJson, outTok]);

      const inspRes = await execTokCli(['inspect-package', outTok]);
      assert.equal(inspRes.code, 0);
      assert.ok(inspRes.stdout.includes('בדיקת פיקוח חבילה'), 'Output must display package title');
      assert.ok(inspRes.stdout.includes('בודק מערכת'), 'Output must display author');
      assert.ok(inspRes.stdout.includes('Schema Version'), 'Output must display schema version');
    });
  });

  // ==========================================================================
  // F6: Desktop Document IPC & Sync Contract
  // ==========================================================================
  describe('F6: Desktop Document IPC & Sync (5 Tests)', () => {
    it('F6.1: Document serialization contract matches Rust DocumentRoot deserializer', async () => {
      const uiDocState = {
        title: 'חוזה סנכרון IPC',
        templateType: 'gemara',
        flows: {
          gemara: [{ id: 'p1', styleId: 'body', text: 'טקסט מסונכרן בין אלקטרון לראסט.' }]
        }
      };

      const docRoot = docBridgeMod.documentStateToDocumentRoot(uiDocState);
      const inJson = createTempPath('ipc_sync_in_', '.json');
      const outJson = createTempPath('ipc_sync_out_', '.json');
      fs.writeFileSync(inJson, JSON.stringify(docRoot), 'utf-8');

      const res = await execTokCli(['typeset-document', inJson, outJson]);
      assert.equal(res.code, 0, `tok-cli must accept serialized DocumentRoot: ${res.stderr}`);

      const pages = JSON.parse(fs.readFileSync(outJson, 'utf-8'));
      assert.ok(Array.isArray(pages), 'Output must be array of PageLayoutBox');
    });

    it('F6.2: typeset-document emits well-formed PageLayoutBox array with pt coordinates', async () => {
      const doc = buildDocumentRoot({
        title: 'Coordinate Validation',
        templateType: 'prose',
        flows: {
          main: ['בדיקת קואורדינטות נקודות pt של תיבות הפריסה.']
        }
      });
      const inJson = createTempPath('ipc_coords_in_', '.json');
      const outJson = createTempPath('ipc_coords_out_', '.json');
      fs.writeFileSync(inJson, JSON.stringify(doc), 'utf-8');

      const res = await execTokCli(['typeset-document', inJson, outJson]);
      assert.equal(res.code, 0);

      const pages = JSON.parse(fs.readFileSync(outJson, 'utf-8'));
      const p0 = pages[0];
      assert.ok(typeof p0.dimensions.width === 'number' && p0.dimensions.width > 0, 'Page width must be positive number');
      assert.ok(typeof p0.dimensions.height === 'number' && p0.dimensions.height > 0, 'Page height must be positive number');
      assert.ok(p0.frames[0].rect.x > 0, 'Frame X coordinate must be positive');
      assert.ok(p0.frames[0].rect.y > 0, 'Frame Y coordinate must be positive');
      assert.ok(p0.frames[0].rect.width > 0, 'Frame width must be positive');
      assert.ok(p0.frames[0].rect.height > 0, 'Frame height must be positive');
    });

    it('F6.3: CLI exit code contract (0 on success, non-zero on error)', async () => {
      // 1. Success case
      const validDoc = buildDocumentRoot({ title: 'Success Contract', templateType: 'prose' });
      const inJson = createTempPath('ipc_succ_in_', '.json');
      const outJson = createTempPath('ipc_succ_out_', '.json');
      fs.writeFileSync(inJson, JSON.stringify(validDoc), 'utf-8');

      const okRes = await execTokCli(['typeset-document', inJson, outJson]);
      assert.equal(okRes.code, 0, 'Valid execution must return code 0');

      // 2. Error case (missing file)
      const errRes = await execTokCli(['typeset-document', 'non_existent_file_xyz.json', outJson]);
      assert.notEqual(errRes.code, 0, 'Missing file must return non-zero exit code');
      assert.ok(errRes.stderr.length > 0, 'Stderr must contain informative error description');
    });

    it('F6.4: Stderr error reporting when invalid JSON is supplied', async () => {
      const brokenJsonPath = createTempPath('broken_ipc_', '.json');
      const outJson = createTempPath('broken_ipc_out_', '.json');
      fs.writeFileSync(brokenJsonPath, '{ invalid json syntax: true, missing quotes }', 'utf-8');

      const res = await execTokCli(['typeset-document', brokenJsonPath, outJson]);
      assert.notEqual(res.code, 0, 'Broken JSON must cause non-zero exit code');
      assert.ok(
        res.stderr.toLowerCase().includes('error') || res.stderr.toLowerCase().includes('invalid'),
        `Stderr must describe JSON failure: ${res.stderr}`
      );
    });

    it('F6.5: layoutToPageDescriptors maps CLI output to DOM-ready descriptors', async () => {
      const doc = buildDocumentRoot({
        title: 'Bridge Mapping Test',
        templateType: 'prose',
        flows: {
          main: ['מלל לבדיקת המרת פלט ה-CLI ל-PageDescriptors עבור ה-Renderer.']
        }
      });
      const inJson = createTempPath('ipc_bridge_in_', '.json');
      const outJson = createTempPath('ipc_bridge_out_', '.json');
      fs.writeFileSync(inJson, JSON.stringify(doc), 'utf-8');

      const res = await execTokCli(['typeset-document', inJson, outJson]);
      assert.equal(res.code, 0);

      const layoutBoxes = JSON.parse(fs.readFileSync(outJson, 'utf-8'));
      const descriptors = typesetBridgeMod.layoutToPageDescriptors(layoutBoxes);

      assert.ok(Array.isArray(descriptors), 'Must return array of PageDescriptors');
      assert.ok(descriptors.length >= 1, 'Must have at least 1 page descriptor');
      assert.ok(descriptors[0].widthPt > 0, 'widthPt must be positive');
      assert.ok(descriptors[0].heightPt > 0, 'heightPt must be positive');
      assert.ok(typeof descriptors[0].htmlContent === 'string', 'htmlContent must be string');
      assert.ok(descriptors[0].htmlContent.includes('tok-line'), 'htmlContent must render line elements');
    });
  });
});
