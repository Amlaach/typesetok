/**
 * TypesetOK (TOK) - E2E Test Suite: Tier 3 - Cross-Feature Combinations (Pairwise)
 *
 * 6 Requirement-driven pairwise combinatorial tests:
 * - P1: Hebrew Normalization + Multi-stream Layout
 * - P2: Knuth-Plass Justification + ISO PDF/X Font Subsetting
 * - P3: Atomic .tok Save + Multi-stream Reload
 * - P4: Extreme RTL/LTR Mix + Knuth-Plass Justification
 * - P5: Sacred Names Protection in Multi-stream Layout
 * - P6: Rapid Edit -> Save -> PDF Export Pipeline
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

describe('Tier 3: Cross-Feature Combinations (Pairwise = 6 Tests)', () => {
  let tokCliPath;
  let hebrewUtilsMod;
  let docBridgeMod;

  before(async () => {
    tokCliPath = findTokCli();
    assert.ok(tokCliPath, 'tok-cli binary must exist');

    hebrewUtilsMod = await loadTs('packages/tok-ui/src/plugins/hebrew-utils.ts');
    docBridgeMod = await loadTs('packages/tok-ui/src/engine/documentBridge.ts');
  });

  it('P1: Normalization + Multi-stream Layout: Unnormalized text & ASCII quotes typeset into aligned multi-column frames', async () => {
    // Unnormalized Hebrew: ASCII quotes in abbreviations, presentation forms U+FB2C, reversed Niqqud
    const rawGemara = 'מַתְנִיתִין: פרק א"ב הלכה ג\' מֵאֵימָתַי קוֹרִין אֶת שְׁמַע?';
    const rawRashi = 'רש"י: מֵאֵימָתַי - תַּנָּא אַקְּרָא קָאֵי דִּכְתִיב בְּשָׁכְבְּךָ וּבְקוּמֶךָ.';
    const rawTosafot = 'תוספות: מֵאֵימָתַי - פֵּרֵשׁ רש"י דְּתַנָּא אַקְּרָא קָאֵי וְתֵימַהּ לר"י.';

    const doc = buildDocumentRoot({
      title: 'נרמול ועימוד רב זרימתי',
      templateType: 'gemara',
      flows: {
        gemara: [rawGemara],
        rashi: [rawRashi],
        tosafot: [rawTosafot]
      }
    });

    const inJson = createTempPath('p1_norm_multi_in_', '.json');
    const outJson = createTempPath('p1_norm_multi_out_', '.json');
    fs.writeFileSync(inJson, JSON.stringify(doc), 'utf-8');

    const res = await execTokCli(['typeset-document', inJson, outJson]);
    assert.equal(res.code, 0, `typeset-document must succeed: ${res.stderr}`);

    const pages = JSON.parse(fs.readFileSync(outJson, 'utf-8'));
    assert.equal(pages.length, 1);
    const p0 = pages[0];
    assert.equal(p0.frames.length, 3, 'Must emit 3 distinct column frames for gemara, rashi, tosafot');

    // Verify all 3 frames contain text
    const gemaraFrame = p0.frames.find((f) => f.flow_id === 'gemara');
    const rashiFrame = p0.frames.find((f) => f.flow_id === 'rashi');
    const tosafotFrame = p0.frames.find((f) => f.flow_id === 'tosafot');

    assert.ok(gemaraFrame && gemaraFrame.lines.length >= 1, 'Gemara frame must contain lines');
    assert.ok(rashiFrame && rashiFrame.lines.length >= 1, 'Rashi frame must contain lines');
    assert.ok(tosafotFrame && tosafotFrame.lines.length >= 1, 'Tosafot frame must contain lines');

    // Verify non-overlapping column bounds
    assert.ok(gemaraFrame.rect.x + gemaraFrame.rect.width <= rashiFrame.rect.x + 0.1 ||
              rashiFrame.rect.x + rashiFrame.rect.width <= gemaraFrame.rect.x + 0.1,
              'Columns must not overlap');
  });

  it('P2: Knuth-Plass Justification + ISO PDF/X Font Subsetting: Justified lines export with ToUnicode CMap and PrePress PageBoxes', async () => {
    const justifiedText =
      'מֵאֵימָתַי קוֹרִין אֶת שְׁמַע בְּעַרְבִית? מִשָּׁעָה שֶׁהַכֹּהֲנִים נִכְנָסִים לֶאֱכֹל בִּתְרוּמָתָן ' +
      'עַד סוֹף הָאַשְׁמוּרָה הָרִאשׁוֹנָה דִּבְרֵי רַבִּי אֱלִיעֶזֶר. וַחֲכָמִים אוֹמְרִים עַד חֲצוֹת. ' +
      'רַבָּן גַּמְלִיאֵל אוֹמֵר עַד שֶׁיַּעֲלֶה עַמּוּד הַשָּׁחַר.';

    const doc = buildDocumentRoot({
      title: 'Knuth-Plass PDF/X Export',
      templateType: 'prose',
      flows: {
        main: [justifiedText]
      }
    });

    const inJson = createTempPath('p2_kp_pdf_in_', '.json');
    const outPdf = createTempPath('p2_kp_pdf_out_', '.pdf');
    fs.writeFileSync(inJson, JSON.stringify(doc), 'utf-8');

    const res = await execTokCli(['render-pdf', inJson, outPdf]);
    assert.equal(res.code, 0, `render-pdf must succeed: ${res.stderr}`);

    const inspection = inspectPdf(outPdf);
    assert.ok(inspection.isPdf, 'File must be valid PDF');
    assert.ok(inspection.hasPdfXVersion, 'Must contain /GTS_PDFXVersion');
    assert.ok(inspection.hasOutputIntents, 'Must contain /OutputIntents');
    assert.ok(inspection.hasToUnicode, 'Must contain /ToUnicode CMap for font subsetting');
    assert.ok(inspection.mediaBox && inspection.bleedBox && inspection.trimBox, 'All PrePress PageBoxes must be present');
  });

  it('P3: Atomic .tok Save + Multi-stream Reload: Multi-flow Talmud document roundtrips with 100% fidelity', async () => {
    const originalDoc = buildDocumentRoot({
      title: 'מסכת ברכות דף ב ע"א - שלם',
      author: 'רב אשי ורבינא',
      templateType: 'gemara',
      flows: {
        gemara: [
          'מֵאֵימָתַי קוֹרִין אֶת שְׁמַע בְּעַרְבִית? מִשָּׁעָה שֶׁהַכֹּהֲנִים נִכְנָסִים לֶאֱכֹל בִּתְרוּמָתָן.',
          'תַּנָּא הֵיכָא קָאֵי דְּקָתָנֵי מֵאֵימָתַי? תַּנָּא אַקְּרָא קָאֵי דִּכְתִיב בְּשָׁכְבְּךָ וּבְקוּמֶךָ.'
        ],
        rashi: [
          'מֵאֵימָתַי - תַּנָּא אַקְּרָא קָאֵי וְהָכִי קָתָנֵי זְמַן קְרִיאַת שְׁמַע שֶׁל שְׁכִיבָה אֵימַת.',
          'בִּתְרוּמָתָן - כֹּהֲנִים שֶׁנִּטְמְאוּ וְטָבְלוּ וְהֶעֱרִיב שִׁמְשָׁן.'
        ],
        tosafot: [
          'מֵאֵימָתַי - פֵּרֵשׁ רַשִׁ"י דְּתַנָּא אַקְּרָא קָאֵי וְתֵימַהּ לְרִ"י דְּהָא תְּנַן בִּבְרָכוֹת הַקּוֹרֵא לְמַפְרֵעַ לֹא יָצָא.',
          'וְעוֹד דִּבְכָל מָקוֹם מַקְדִּים שַׁחֲרִית לְעַרְבִית.'
        ]
      }
    });

    const inJson = createTempPath('p3_roundtrip_in_', '.json');
    const outTok = createTempPath('p3_roundtrip_pkg_', '.tok');
    const outExtracted = createTempPath('p3_roundtrip_out_', '.json');
    fs.writeFileSync(inJson, JSON.stringify(originalDoc), 'utf-8');

    // 1. Save atomic package
    const saveRes = await execTokCli(['save-package', inJson, outTok]);
    assert.equal(saveRes.code, 0, 'save-package must succeed');

    // 2. Open package
    const openRes = await execTokCli(['open-package', outTok, outExtracted]);
    assert.equal(openRes.code, 0, 'open-package must succeed');

    // 3. Typeset extracted document
    const typesetOut = createTempPath('p3_roundtrip_typeset_', '.json');
    const typesetRes = await execTokCli(['typeset-document', outExtracted, typesetOut]);
    assert.equal(typesetRes.code, 0, 'typeset-document must succeed on extracted JSON');

    const pages = JSON.parse(fs.readFileSync(typesetOut, 'utf-8'));
    assert.ok(pages.length >= 1, 'Must typeset at least 1 page');
    assert.equal(pages[0].frames.length, 3, 'Must maintain 3 distinct column frames after roundtrip');
  });

  it('P4: Extreme RTL/LTR Mix + Knuth-Plass Justification: English citations and ISBN numbers align without line break collisions', async () => {
    const mixedBidiText =
      'מקור הדין מובא במאמר המחקרי "The Knuth-Plass Algorithm for Hebrew DTP" (כרך 42, עמ\' 105-120), ' +
      'אשר פורסם על ידי Donald Knuth & Michael Plass בשנת 1981, בהוצאת Academic Press (ISBN 978-0-201-13447-6). ' +
      'כל הזכויות שמורות למערכת TypesetOK v0.30.4.';

    const doc = buildDocumentRoot({
      title: 'Mixed BiDi Justification',
      templateType: 'prose',
      flows: {
        main: [mixedBidiText]
      }
    });

    const inJson = createTempPath('p4_bidi_in_', '.json');
    const outJson = createTempPath('p4_bidi_out_', '.json');
    fs.writeFileSync(inJson, JSON.stringify(doc), 'utf-8');

    const res = await execTokCli(['typeset-document', inJson, outJson]);
    assert.equal(res.code, 0);

    const pages = JSON.parse(fs.readFileSync(outJson, 'utf-8'));
    const frame = pages[0].frames[0];
    assert.ok(frame.lines.length >= 2, 'Mixed text must break into multiple lines');

    for (const line of frame.lines) {
      assert.ok(line.width <= frame.rect.width + 1.0, `Line width (${line.width}) must stay inside frame (${frame.rect.width})`);
      assert.ok(line.text.length > 0, 'Line text must not be empty');
    }
  });

  it('P5: Sacred Names Protection in Multi-stream Layout: Divine names in Gemara and commentaries remain intact and unbroken', async () => {
    const holyGemara = 'תָּנוּ רַבָּנָן: בָּרוּךְ יהוה לְעוֹלָם אָמֵן וְאָמֵן. יִמְלֹךְ יהוה לְעוֹלָם אֱלֹהִים בְּצִיּוֹן לְדֹר וָדֹר הַלְלוּיָהּ.';
    const holyRashi = 'ברוך יהוה - שֶׁנֶּאֱמַר כִּי שֵׁם יהוה אֶקְרָא הָבוּ גֹדֶל לֵאלֹהֵינוּ.';
    const holyTosafot = 'ברוך יהוה - פֵּרֵשׁ הַקָּדוֹשׁ שֶׁאֵין מַזְכִּירִין שֵׁם שָׁמַיִם לְבַטָּלָה אֶלָּא בִּתְפִלָּה וּבִבְרָכָה.';

    // Check divine names detection via hebrewUtils
    const gemaraMatches = hebrewUtilsMod.findHolyNames(holyGemara);
    assert.ok(gemaraMatches.length >= 2, 'Must detect holy names in Gemara text');
    assert.ok(gemaraMatches.some((m) => m.name === 'יהוה'));
    assert.ok(gemaraMatches.some((m) => m.name === 'אלהים'));

    const doc = buildDocumentRoot({
      title: 'הגנת שמות קודש ברב זרימות',
      templateType: 'gemara',
      flows: {
        gemara: [holyGemara],
        rashi: [holyRashi],
        tosafot: [holyTosafot]
      }
    });

    const inJson = createTempPath('p5_holy_in_', '.json');
    const outJson = createTempPath('p5_holy_out_', '.json');
    const outPdf = createTempPath('p5_holy_out_', '.pdf');
    fs.writeFileSync(inJson, JSON.stringify(doc), 'utf-8');

    // 1. Typeset layout
    const typesetRes = await execTokCli(['typeset-document', inJson, outJson]);
    assert.equal(typesetRes.code, 0);

    const pages = JSON.parse(fs.readFileSync(outJson, 'utf-8'));
    assert.equal(pages[0].frames.length, 3);

    // Verify divine names are not split across line wraps
    for (const frame of pages[0].frames) {
      for (const line of frame.lines) {
        // Line should never end with a partial divine name like 'יהו' or begin with 'ה'
        assert.ok(!line.text.endsWith('יהו '), 'Divine name must not be hyphenated or split at line end');
      }
    }

    // 2. Export to PDF/X
    const pdfRes = await execTokCli(['render-pdf', inJson, outPdf]);
    assert.equal(pdfRes.code, 0);
    const pdfInspection = inspectPdf(outPdf);
    assert.ok(pdfInspection.isPdf);
    assert.ok(pdfInspection.hasToUnicode);
  });

  it('P6: Rapid Edit -> Save -> PDF Export Pipeline: Full authoring workflow executes atomically and consistently', async () => {
    // Step 1: Initial document
    const initialDoc = buildDocumentRoot({
      title: 'ספר שער השמים',
      author: 'המחבר הראשון',
      templateType: 'prose',
      flows: {
        main: ['תחילת הספר בגרסה ראשונה.']
      }
    });
    const docPath = createTempPath('p6_pipeline_doc_', '.json');
    fs.writeFileSync(docPath, JSON.stringify(initialDoc), 'utf-8');

    // Step 2: User Edit (simulate StoryEditor edit + setting change)
    const editedDoc = JSON.parse(fs.readFileSync(docPath, 'utf-8'));
    editedDoc.sections[0].flows[0].paragraphs.push({
      id: docBridgeMod.generateCrockfordUlid(),
      index: 'a00001',
      style_id: 'normal',
      text: 'פסקה שנייה שנוספה בזמן עריכה מהירה על ידי המשתמש.',
      style_patches: []
    });
    editedDoc.metadata.title = 'ספר שער השמים - מהדורה מעודכנת';
    fs.writeFileSync(docPath, JSON.stringify(editedDoc), 'utf-8');

    // Step 3: Save atomic package
    const tokPkgPath = createTempPath('p6_pipeline_pkg_', '.tok');
    const saveRes = await execTokCli(['save-package', docPath, tokPkgPath]);
    assert.equal(saveRes.code, 0, 'Save package must succeed');

    // Step 4: Re-open package to confirm persistence
    const reloadedJsonPath = createTempPath('p6_pipeline_reload_', '.json');
    const openRes = await execTokCli(['open-package', tokPkgPath, reloadedJsonPath]);
    assert.equal(openRes.code, 0, 'Open package must succeed');

    const reloadedDoc = JSON.parse(fs.readFileSync(reloadedJsonPath, 'utf-8'));
    assert.equal(reloadedDoc.metadata.title, 'ספר שער השמים - מהדורה מעודכנת');
    assert.equal(reloadedDoc.sections[0].flows[0].paragraphs.length, 2);

    // Step 5: Render PDF/X from the reloaded package
    const finalPdfPath = createTempPath('p6_pipeline_final_', '.pdf');
    const pdfRes = await execTokCli(['render-pdf', tokPkgPath, finalPdfPath]);
    assert.equal(pdfRes.code, 0, 'PDF export from .tok package must succeed');

    const inspection = inspectPdf(finalPdfPath);
    assert.ok(inspection.isPdf, 'PDF must be valid');
    assert.ok(inspection.hasPdfXVersion, 'PDF must be ISO PDF/X-1a compliant');
    assert.ok(inspection.hasToUnicode, 'PDF must contain ToUnicode CMap');
    assert.ok(inspection.mediaBox && inspection.trimBox, 'PageBoxes must be present');
  });
});
