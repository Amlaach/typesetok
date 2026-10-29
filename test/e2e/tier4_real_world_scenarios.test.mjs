/**
 * TypesetOK (TOK) - E2E Test Suite: Tier 4 - Real-World Application Scenarios
 *
 * 5 Comprehensive workload scenario tests:
 * - Scenario 1: Full Talmud Page (Berakhot 2a layout with Gemara, Rashi, Tosafot)
 * - Scenario 2: Long Hebrew Prose Book (multi-page with niqqud, header/footer, chapter styles)
 * - Scenario 3: Liturgical Hymn with Sacred Names Protection (Piyyut with divine names intact)
 * - Scenario 4: Multi-column Document with Footnotes & Anchors
 * - Scenario 5: Full Lifecycle Roundtrip (Story text -> .tok save -> reload -> typeset -> PDF output)
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

describe('Tier 4: Real-World Application Scenarios (5 Workload Tests)', () => {
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
  // Scenario 1: Full Talmud Page (Berakhot 2a)
  // ==========================================================================
  it('Scenario 1: Full Talmud Page (Berakhot 2a layout with Gemara, Rashi, Tosafot)', async () => {
    const gemaraText1 =
      'מַתְנִיתִין: מֵאֵימָתַי קוֹרִין אֶת שְׁמַע בְּעַרְבִית? מִשָּׁעָה שֶׁהַכֹּהֲנִים נִכְנָסִים לֶאֱכֹל בִּתְרוּמָתָן, ' +
      'עַד סוֹף הָאַשְׁמוּרָה הָרִאשׁוֹנָה, דִּבְרֵי רַבִּי אֱלִיעֶזֶר. וַחֲכָמִים אוֹמְרִים: עַד חֲצוֹת. ' +
      'רַבָּן גַּמְלִיאֵל אוֹמֵר: עַד שֶׁיַּעֲלֶה עַמּוּד הַשָּׁחַר.';

    const gemaraText2 =
      'גְּמָרָא: תַּנָּא הֵיכָא קָאֵי דְּקָתָנֵי מֵאֵימָתַי? וְתוּ, מַאי שְׁנָא דְּתָנֵי בְּעַרְבִית בְּרֵישָׁא, ' +
      'לִתְנֵי דְּשַׁחֲרִית בְּרֵישָׁא? תַּנָּא אַקְּרָא קָאֵי, דִּכְתִיב: בְּשָׁכְבְּךָ וּבְקוּמֶךָ, ' +
      'וְהָכִי קָתָנֵי: זְמַן קְרִיאַת שְׁמַע דִּשְׁכִיבָה אֵימַת? מִשָּׁעָה שֶׁהַכֹּהֲנִים נִכְנָסִים לֶאֱכֹל בִּתְרוּמָתָן.';

    const rashiText1 =
      'מֵאֵימָתַי - תַּנָּא אַקְּרָא קָאֵי, דִּכְתִיב בְּשָׁכְבְּךָ וּבְקוּמֶךָ, וְהָכִי קָתָנֵי זְמַן קְרִיאַת שְׁמַע שֶׁל שְׁכִיבָה אֵימַת.';

    const rashiText2 =
      'בִּתְרוּמָתָן - כֹּהֲנִים שֶׁנִּטְמְאוּ וְטָבְלוּ וְהֶעֱרִיב שִׁמְשָׁן וְהִגִּיעַ עֵת לֶאֱכֹל בִּתְרוּמָה.';

    const tosafotText1 =
      'מֵאֵימָתַי - פֵּרֵשׁ רַשִׁ"י דְּתַנָּא אַקְּרָא קָאֵי, וְתֵימַהּ לְרִ"י דְּהָא תְּנַן בְּמַסֶּכֶת בְּרָכוֹת הַקּוֹרֵא לְמַפְרֵעַ לֹא יָצָא, ' +
      'וְעוֹד דִּבְכָל מָקוֹם מַקְדִּים תְּפִלַּת שַׁחֲרִית לִתְפִלַּת עַרְבִית.';

    const tosafotText2 =
      'וְאוֹמֵר רִ"י דְּקָרָא דִּבְשָׁכְבְּךָ וּבְקוּמֶךָ הוּא עִקַּר הַמִּצְוָה, וּלְכָךְ שָׁנָה סֵדֶר הַבְּרִיאָה שֶׁהָעֶרֶב קוֹדֵם לַבֹּקֶר.';

    const doc = buildDocumentRoot({
      title: 'תלמוד בבלי - ברכות דף ב ע"א',
      author: 'רב אשי ורבינא',
      templateType: 'gemara',
      flows: {
        gemara: [gemaraText1, gemaraText2],
        rashi: [rashiText1, rashiText2],
        tosafot: [tosafotText1, tosafotText2]
      }
    });

    const inJson = createTempPath('scen1_talmud_in_', '.json');
    const outJson = createTempPath('scen1_talmud_out_', '.json');
    const outPdf = createTempPath('scen1_talmud_out_', '.pdf');
    fs.writeFileSync(inJson, JSON.stringify(doc), 'utf-8');

    // 1. Typeset document
    const typesetRes = await execTokCli(['typeset-document', inJson, outJson]);
    assert.equal(typesetRes.code, 0, `Talmud typesetting must succeed: ${typesetRes.stderr}`);

    const pages = JSON.parse(fs.readFileSync(outJson, 'utf-8'));
    assert.ok(pages.length >= 1, 'Must emit Talmud page');
    const page0 = pages[0];
    assert.equal(page0.frames.length, 3, 'Talmud page must have exactly 3 frames');

    const gemaraFrame = page0.frames.find((f) => f.flow_id === 'gemara');
    const rashiFrame = page0.frames.find((f) => f.flow_id === 'rashi');
    const tosafotFrame = page0.frames.find((f) => f.flow_id === 'tosafot');

    assert.ok(gemaraFrame && gemaraFrame.lines.length >= 2, 'Gemara frame must contain lines');
    assert.ok(rashiFrame && rashiFrame.lines.length >= 2, 'Rashi frame must contain lines');
    assert.ok(tosafotFrame && tosafotFrame.lines.length >= 2, 'Tosafot frame must contain lines');

    // Verify non-overlapping columns
    const columns = [gemaraFrame, rashiFrame, tosafotFrame].sort((a, b) => a.rect.x - b.rect.x);
    assert.ok(columns[0].rect.x + columns[0].rect.width <= columns[1].rect.x + 0.1);
    assert.ok(columns[1].rect.x + columns[1].rect.width <= columns[2].rect.x + 0.1);

    // 2. Render to ISO PDF/X-1a
    const pdfRes = await execTokCli(['render-pdf', inJson, outPdf]);
    assert.equal(pdfRes.code, 0);

    const pdfInspection = inspectPdf(outPdf);
    assert.ok(pdfInspection.isPdf);
    assert.ok(pdfInspection.hasPdfXVersion);
    assert.ok(pdfInspection.hasToUnicode);
    assert.ok(pdfInspection.mediaBox && pdfInspection.trimBox);
  });

  // ==========================================================================
  // Scenario 2: Long Hebrew Prose Book
  // ==========================================================================
  it('Scenario 2: Long Hebrew Prose Book (multi-page with niqqud, header/footer, chapter styles)', async () => {
    const chapters = [
      'הַקְדָּמַת הַמְּחַבֵּר: אָמַר הַמְּחַבֵּר, הַכַּוָּנָה בְּחִבּוּר זֶה אֵינָהּ לְלַמֵּד לִבְנֵי הָאָדָם אֶת אֲשֶׁר אֵינָם יוֹדְעִים, ' +
      'אֶלָּא לְהַזְכִּירָם אֶת הַיָּדוּעַ לָהֶם כְּבָר וּמְפֻרְסָם אֶצְלָם פִּרְסוּם גָּדוֹל.',
      'פֶּרֶק א׳ - בְּבֵאוּר כְּלַל חוֹבַת הָאָדָם בְּעוֹלָמוֹ: יְסוֹד הַחֲסִידוּת וְשֹׁרֶשׁ הָעֲבוֹדָה הַתְּמִימָה הוּא, ' +
      'שֶׁיִּתְבָּרֵר וְיִתְאַמֵּת אֵצֶל הָאָדָם מַה חוֹבָתוֹ בְּעוֹלָמוֹ וּלְמַה צָּרִיךְ שֶׁיָּשִׂים מַבָּטוֹ וּמְגַמָּתוֹ בְּכָל אֲשֶׁר הוּא עָמֵל כָּל יְמֵי חַיָּיו.',
      'פֶּרֶק ב׳ - בְּבֵאוּר מִדַּת הַזְּהִירוּת: הִנֵּה עִנְיַן הַזְּהִירוּת הוּא, שֶׁיְּהֵא הָאָדָם נִזְהָר בְּמַעֲשָׂיו וּמִתְבּוֹנֵן בִּדְרָכָיו, ' +
      'הֲטוֹבִים הֵם אִם לֹא, כְּדֵי שֶׁלֹּא יַנִּיחַ נַפְשׁוֹ בְּסַכָּנַת הָאֲבַדּוֹן חַס וְשָׁלוֹם.',
      'פֶּרֶק ג׳ - בְּחֶלְקֵי הַזְּהִירוּת: מֵהֶם הַדְּבָרִים אֲשֶׁר עַל הָאָדָם לְהִתְרַחֵק מֵהֶם מְאֹד מְאֹד, כְּגוֹן הַגַּאֲוָה וְהַכַּעַס וְהַקִּנְאָה.'
    ];

    // Build an authentic multi-page prose document (70 paragraphs)
    const bookParagraphs = [];
    for (let i = 0; i < 70; i++) {
      const baseText = chapters[i % chapters.length];
      bookParagraphs.push(`[סעיף ${i + 1}] ${baseText}`);
    }

    const doc = buildDocumentRoot({
      title: 'ספר מסילת ישרים המנוקד',
      author: 'רבי משה חיים לוצאטו (רמח"ל)',
      templateType: 'prose',
      flows: {
        main: bookParagraphs
      }
    });

    const inJson = createTempPath('scen2_prose_in_', '.json');
    const outJson = createTempPath('scen2_prose_out_', '.json');
    const outPdf = createTempPath('scen2_prose_out_', '.pdf');
    fs.writeFileSync(inJson, JSON.stringify(doc), 'utf-8');

    // 1. Typeset document
    const typesetRes = await execTokCli(['typeset-document', inJson, outJson]);
    assert.equal(typesetRes.code, 0);

    const pages = JSON.parse(fs.readFileSync(outJson, 'utf-8'));
    assert.ok(pages.length >= 2, `Prose book must paginate into >= 2 pages (got ${pages.length})`);

    // Verify sequential folios
    assert.equal(pages[0].page_number_gematria, 'א׳');
    assert.equal(pages[1].page_number_gematria, 'ב׳');

    // 2. Render to ISO PDF/X-1a
    const pdfRes = await execTokCli(['render-pdf', inJson, outPdf]);
    assert.equal(pdfRes.code, 0);

    const pdfBuf = fs.readFileSync(outPdf);
    assert.ok(pdfBuf.length > 5000, 'Multi-page book PDF must be substantial');
  });

  // ==========================================================================
  // Scenario 3: Liturgical Hymn with Sacred Names Protection
  // ==========================================================================
  it('Scenario 3: Liturgical Hymn with Sacred Names Protection (Piyyut with divine names intact)', async () => {
    const piyyutVerses = [
      'אֲדוֹן עוֹלָם אֲשֶׁר מָלַךְ, בְּטֶרֶם כָּל יְצִיר נִבְרָא.',
      'לְעֵת נַעֲשָׂה בְחֶפְצוֹ כֹּל, אֲזַי מֶלֶךְ שְׁמוֹ נִקְרָא.',
      'וְאַחֲרֵי כִּכְלוֹת הַכֹּל, לְבַדּוֹ יִמְלֹךְ נוֹרָא.',
      'וְהוּא הָיָה וְהוּא הֹוֶה, וְהוּא יִהְיֶה בְּתִפְאָרָה.',
      'וְהוּא אֶחָד וְאֵין שֵׁנִי, לְהַמְשִׁיל לוֹ לְהַחְבִּירָה.',
      'בְּלִי רֵאשִׁית בְּלִי תַכְלִית, וְלוֹ הָעֹז וְהַמִּשְׂרָה.',
      'וְהוּא אֵלִי וְחַי גֹּאֲלִי, וְצוּר חֶבְלִי בְּעֵת צָרָה.',
      'וְהוּא נִסִּי וּמָנוֹס לִי, מְנָת כּוֹסִי בְּיוֹם אֶקְרָא.',
      'בְּיָדוֹ אַפְקִיד רוּחִי, בְּעֵת אִישַׁן וְאָעִירָה.',
      'וְעִם רוּחִי גְּוִיָּתִי, יהוה לִי וְלֹא אִירָא.'
    ];

    // Divine names detection test
    const holyNamesInPiyyut = hebrewUtilsMod.findHolyNames(piyyutVerses.join(' '));
    assert.ok(holyNamesInPiyyut.length >= 1, 'Must detect holy name in Piyyut');
    assert.equal(holyNamesInPiyyut[0].name, 'יהוה');

    const doc = buildDocumentRoot({
      title: 'פיוט אדון עולם עם הגנת שמות קודש',
      templateType: 'prose',
      flows: {
        main: piyyutVerses
      }
    });

    const inJson = createTempPath('scen3_piyyut_in_', '.json');
    const outJson = createTempPath('scen3_piyyut_out_', '.json');
    const outPdf = createTempPath('scen3_piyyut_out_', '.pdf');
    fs.writeFileSync(inJson, JSON.stringify(doc), 'utf-8');

    // Typeset layout
    const typesetRes = await execTokCli(['typeset-document', inJson, outJson]);
    assert.equal(typesetRes.code, 0);

    const pages = JSON.parse(fs.readFileSync(outJson, 'utf-8'));
    assert.ok(pages.length >= 1);

    // Verify divine names are not broken across lines
    const lastLine = pages[0].frames[0].lines.at(-1);
    assert.ok(lastLine.text.includes('יהוה'), 'Last line must contain intact Tetragrammaton');
    assert.ok(!lastLine.text.includes('יה-וה'), 'Tetragrammaton must not be hyphenated');

    // Render to PDF
    const pdfRes = await execTokCli(['render-pdf', inJson, outPdf]);
    assert.equal(pdfRes.code, 0);

    const inspection = inspectPdf(outPdf);
    assert.ok(inspection.isPdf);
    assert.ok(inspection.hasToUnicode);
  });

  // ==========================================================================
  // Scenario 4: Multi-column Document with Footnotes & Anchors
  // ==========================================================================
  it('Scenario 4: Multi-column Document with Footnotes & Anchors', async () => {
    const mainParagraphs = [
      'סעיף ראשון בספר המרכזי עם הפניה להערת שוליים ראשונה בתחתית הדף.',
      'סעיף שני הממשיך את המהלך המחקרי וכולל מראי מקומות נוספים בגוף הטקסט.',
      'סעיף שלישי המסכם את הפרק ומפנה למקורות תורניים בהערות.'
    ];

    const footnoteParagraphs = [
      '1. עיין שו"ע אורח חיים סימן רל"ה סעיף א\', ובמשנה ברורה שם.',
      '2. מקור הדין במסכת ברכות דף ב ע"א, וברמב"ם פרק א\' מהלכות קריאת שמע.'
    ];

    const doc = buildDocumentRoot({
      title: 'ספר הלכתי עם הערות שוליים',
      templateType: 'gemara',
      flows: {
        gemara: mainParagraphs,
        notes: footnoteParagraphs
      }
    });

    const inJson = createTempPath('scen4_notes_in_', '.json');
    const outJson = createTempPath('scen4_notes_out_', '.json');
    fs.writeFileSync(inJson, JSON.stringify(doc), 'utf-8');

    const res = await execTokCli(['typeset-document', inJson, outJson]);
    assert.equal(res.code, 0);

    const pages = JSON.parse(fs.readFileSync(outJson, 'utf-8'));
    assert.ok(pages.length >= 1);
    const p0 = pages[0];

    const mainFrame = p0.frames.find((f) => f.flow_id === 'gemara' || f.flow_id === 'main');
    const notesFrame = p0.frames.find((f) => f.flow_id === 'notes');

    assert.ok(mainFrame, 'Main text frame must exist');
    assert.ok(notesFrame, 'Footnotes frame must exist');
    assert.ok(mainFrame.lines.length >= 1, 'Main text must have lines');
    assert.ok(notesFrame.lines.length >= 1, 'Footnotes must have lines');
  });

  // ==========================================================================
  // Scenario 5: Full Lifecycle Roundtrip
  // ==========================================================================
  it('Scenario 5: Full Lifecycle Roundtrip (Story text -> .tok save -> reload -> typeset -> PDF output)', async () => {
    // 1. Story text input
    const initialStory = {
      title: 'מחזור תפילה מהודר',
      templateType: 'gemara',
      flows: {
        gemara: [
          { id: 'p-gem-1', styleId: 'style-gemara-main', text: 'שְׁמַע יִשְׂרָאֵל יהוה אֱלֹהֵינוּ יהוה אֶחָד.' },
          { id: 'p-gem-2', styleId: 'style-gemara-main', text: 'בָּרוּךְ שֵׁם כְּבוֹד מַלְכוּתוֹ לְעוֹלָם וָעֶד.' }
        ],
        rashi: [
          { id: 'p-rash-1', styleId: 'style-rashi-body', text: 'שְׁמַע יִשְׂרָאֵל - ה׳ שֶׁהוּא אֱלֹהֵינוּ עַתָּה, עָתִיד לִהְיוֹת ה׳ אֶחָד.' }
        ],
        tosafot: [
          { id: 'p-tos-1', styleId: 'style-tosafot-body', text: 'שְׁמַע יִשְׂרָאֵל - צָרִיךְ לְהַאֲרִיךְ בְּדָלֶ"ת שֶׁל אֶחָד כְּדֵי שֶׁיַּמְלִיכֵהוּ בַּשָּׁמַיִם וּבָאָרֶץ.' }
        ]
      }
    };

    // 2. Convert to DocumentRoot via UI DocumentBridge
    const docRoot = docBridgeMod.documentStateToDocumentRoot(initialStory, { author: 'סופר דת"ם' });
    const initialJsonPath = createTempPath('scen5_initial_', '.json');
    fs.writeFileSync(initialJsonPath, JSON.stringify(docRoot, null, 2), 'utf-8');

    // 3. Save atomic .tok package
    const tokPkgPath = createTempPath('scen5_package_', '.tok');
    const saveRes = await execTokCli(['save-package', initialJsonPath, tokPkgPath]);
    assert.equal(saveRes.code, 0, 'save-package must succeed');

    // 4. Verify ZIP package integrity
    const pkgInspection = inspectZipPackage(tokPkgPath);
    assert.ok(pkgInspection.hasManifest, 'Must contain manifest');
    assert.ok(pkgInspection.hasDocument, 'Must contain document JSON');
    assert.equal(pkgInspection.manifest.title, 'מחזור תפילה מהודר');

    // 5. Open and extract package
    const extractedJsonPath = createTempPath('scen5_extracted_', '.json');
    const openRes = await execTokCli(['open-package', tokPkgPath, extractedJsonPath]);
    assert.equal(openRes.code, 0, 'open-package must succeed');

    // 6. Typeset layout from reloaded package
    const layoutJsonPath = createTempPath('scen5_layout_', '.json');
    const typesetRes = await execTokCli(['typeset-document', extractedJsonPath, layoutJsonPath]);
    assert.equal(typesetRes.code, 0, 'typeset-document must succeed on extracted JSON');

    const pages = JSON.parse(fs.readFileSync(layoutJsonPath, 'utf-8'));
    assert.ok(pages.length >= 1, 'Must emit pages');
    assert.equal(pages[0].frames.length, 3, 'Must maintain 3 column frames');

    // 7. Render final ISO PDF/X-1a
    const finalPdfPath = createTempPath('scen5_final_', '.pdf');
    const pdfRes = await execTokCli(['render-pdf', tokPkgPath, finalPdfPath]);
    assert.equal(pdfRes.code, 0, 'render-pdf must succeed on .tok package');

    const pdfInspection = inspectPdf(finalPdfPath);
    assert.ok(pdfInspection.isPdf);
    assert.ok(pdfInspection.hasPdfXVersion);
    assert.ok(pdfInspection.hasToUnicode);
    assert.ok(pdfInspection.mediaBox && pdfInspection.bleedBox && pdfInspection.trimBox);
    assert.ok(pdfInspection.byteLength > 2000, 'Final PDF must have valid size');
  });
});
