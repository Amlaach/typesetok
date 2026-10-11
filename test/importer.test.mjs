import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import zlib from 'node:zlib';

import {
  decodeTextBuffer,
  importPlainText,
  importMarkdown,
  parseMarkdownInlineSpans,
  extractDocxXml,
  parseDocxXml,
  importDocx,
  importDocument,
  detectTextDirection,
  detectTextLanguage,
  cleanDocumentTitle,
  DocumentImportError
} from '../packages/tok-ui/dist/engine/textImporter.js';

import {
  importResultToDocumentState,
  importResultToDocumentRoot,
  isValidUlid
} from '../packages/tok-ui/dist/engine/documentBridge.js';

describe('Phase 3 Import: Text, Markdown and DOCX Importers', () => {

  describe('1. Text Direction & Language Detection', () => {
    it('detects Hebrew direction and language correctly', () => {
      const hebrewText = 'בְּרֵאשִׁית בָּרָא אֱלֹהִים אֵת הַשָּׁמַיִם וְאֵת הָאָרֶץ';
      assert.equal(detectTextDirection(hebrewText), 'rtl');
      assert.equal(detectTextLanguage(hebrewText), 'he');
    });

    it('detects English direction and language correctly', () => {
      const englishText = 'In the beginning God created the heaven and the earth.';
      assert.equal(detectTextDirection(englishText), 'ltr');
      assert.equal(detectTextLanguage(englishText), 'en');
    });

    it('detects mixed language with dominant Hebrew', () => {
      const mixedText = 'ספר התניא מאת רבי שניאור זלמן מלאדי (Rabbi Shneur Zalman of Liadi).';
      assert.equal(detectTextDirection(mixedText), 'rtl');
      assert.equal(detectTextLanguage(mixedText), 'mixed');
    });

    it('cleans document title from file extensions and symbols', () => {
      assert.equal(cleanDocumentTitle('ספר_התניא_מהדורה_חדשה.tok'), 'ספר התניא מהדורה חדשה');
      assert.equal(cleanDocumentTitle('my_hebrew_book.docx'), 'my hebrew book');
      assert.equal(cleanDocumentTitle(''), 'מסמך ללא שם');
    });
  });

  describe('2. Plain Text (TXT) Importer', () => {
    it('imports UTF-8 plain text with paragraphs and preserves Hebrew niqqud', () => {
      const txt = `בְּרֵאשִׁית בָּרָא אֱלֹהִים אֵת הַשָּׁמַיִם וְאֵת הָאָרֶץ:

וְהָאָרֶץ הָיְתָה תֹהוּ וָבֹהוּ וְחֹשֶׁךְ עַל־פְּנֵי תְהוֹם:

וַיֹּאמֶר אֱלֹהִים יְהִי אוֹר וַיְהִי־אוֹר:`;

      const result = importPlainText(txt, { fileName: 'בראשית.txt' });
      assert.equal(result.format, 'txt');
      assert.equal(result.title, 'בראשית');
      assert.equal(result.paragraphCount, 3);
      assert.equal(result.detectedDirection, 'rtl');
      assert.equal(result.detectedLanguage, 'he');
      assert(result.paragraphs[0].text.includes('בְּרֵאשִׁית'));
      assert(result.paragraphs[2].text.includes('וַיְהִי־אוֹר'));
    });

    it('decodes UTF-16LE text buffer with BOM', () => {
      const original = 'שלום עליכם ומזל טוב לכל המסובין';
      const buf = Buffer.alloc(2 + original.length * 2);
      // UTF-16LE BOM: 0xFF, 0xFE
      buf[0] = 0xFF;
      buf[1] = 0xFE;
      for (let i = 0; i < original.length; i++) {
        buf.writeUInt16LE(original.charCodeAt(i), 2 + i * 2);
      }

      const decoded = decodeTextBuffer(new Uint8Array(buf));
      assert.equal(decoded, original);

      const result = importPlainText(buf, { fileName: 'utf16_test.txt' });
      assert.equal(result.paragraphs.length, 1);
      assert.equal(result.paragraphs[0].text, original);
    });

    it('throws EMPTY_DOCUMENT for empty text or whitespace-only files', () => {
      assert.throws(() => {
        importPlainText('   \n\n\t  ', { fileName: 'empty.txt' });
      }, (err) => {
        return err instanceof DocumentImportError && err.code === 'EMPTY_DOCUMENT';
      });
    });

    it('throws CORRUPTED_FILE for binary files containing null bytes', () => {
      const corruptBytes = new Uint8Array([0x48, 0x65, 0x6C, 0x6C, 0x00, 0x00, 0x00, 0x6F]);
      assert.throws(() => {
        importPlainText(corruptBytes, { fileName: 'corrupt.bin' });
      }, (err) => {
        return err instanceof DocumentImportError && err.code === 'CORRUPTED_FILE';
      });
    });
  });

  describe('3. Markdown (MD) Importer', () => {
    it('parses inline markdown spans: bold, italic, bold-italic and code', () => {
      const raw = 'טקסט רגיל **טקסט מודגש** עוד רגיל *טקסט נטוי* וגם ***מודגש ונטוי*** ו־`קוד`.';
      const { text, spans } = parseMarkdownInlineSpans(raw);

      assert.equal(text, 'טקסט רגיל טקסט מודגש עוד רגיל טקסט נטוי וגם מודגש ונטוי ו־קוד.');
      assert.equal(spans.length, 4);

      // Bold
      assert.equal(spans[0].format.fontWeight, 700);
      assert.equal(text.slice(spans[0].start, spans[0].end), 'טקסט מודגש');

      // Italic
      assert.equal(spans[1].format.italic, true);
      assert.equal(text.slice(spans[1].start, spans[1].end), 'טקסט נטוי');

      // Bold + Italic
      assert.equal(spans[2].format.fontWeight, 700);
      assert.equal(spans[2].format.italic, true);
      assert.equal(text.slice(spans[2].start, spans[2].end), 'מודגש ונטוי');

      // Monospace code
      assert.equal(spans[3].format.fontFamily, 'monospace');
      assert.equal(text.slice(spans[3].start, spans[3].end), 'קוד');
    });

    it('parses structured markdown with headings, blockquotes, lists and paragraphs', () => {
      const md = `# פרק ראשון: הלכות תלמוד תורה

## הלכה א׳
כל איש מישראל **חייב** בתלמוד תורה, בין עני ובין עשיר.

> וְהָיוּ הַדְּבָרִים הָאֵלֶּה אֲשֶׁר אָנֹכִי מְצַוְּךָ הַיּוֹם עַל־לְבָבֶךָ.

### פירוט הזמנים
- שחרית
- ערבית
- חצות הלילה`;

      const result = importMarkdown(md, { fileName: 'הלכות_תלמוד_תורה.md' });
      assert.equal(result.format, 'md');
      assert.equal(result.title, 'פרק ראשון: הלכות תלמוד תורה');
      assert.equal(result.paragraphs.length, 8);

      assert.equal(result.paragraphs[0].styleId, 'heading-1');
      assert.equal(result.paragraphs[0].text, 'פרק ראשון: הלכות תלמוד תורה');

      assert.equal(result.paragraphs[1].styleId, 'heading-2');
      assert.equal(result.paragraphs[1].text, 'הלכה א׳');

      assert.equal(result.paragraphs[2].styleId, 'default-body');
      assert(result.paragraphs[2].spans && result.paragraphs[2].spans.length > 0);
      assert.equal(result.paragraphs[2].spans[0].format.fontWeight, 700);

      assert.equal(result.paragraphs[3].styleId, 'blockquote');
      assert(result.paragraphs[3].text.includes('וְהָיוּ הַדְּבָרִים'));

      assert.equal(result.paragraphs[4].styleId, 'heading-3');
      assert.equal(result.paragraphs[5].styleId, 'list-item');
      assert.equal(result.paragraphs[6].styleId, 'list-item');
    });

    it('throws EMPTY_DOCUMENT on empty markdown', () => {
      assert.throws(() => {
        importMarkdown('', { fileName: 'blank.md' });
      }, (err) => {
        return err instanceof DocumentImportError && err.code === 'EMPTY_DOCUMENT';
      });
    });
  });

  describe('4. DOCX Document Importer', () => {
    // Helper to generate a minimal in-memory DOCX zip buffer
    function buildMockDocxZip(documentXml) {
      const xmlBuffer = Buffer.from(documentXml, 'utf-8');
      const deflated = zlib.deflateRawSync(xmlBuffer);
      const entryName = 'word/document.xml';
      const nameBuf = Buffer.from(entryName, 'utf-8');

      // Local file header (30 bytes + filename + extra + compressed data)
      const header = Buffer.alloc(30);
      header.writeUInt32LE(0x04034b50, 0); // PK\x03\x04
      header.writeUInt16LE(20, 4); // version needed
      header.writeUInt16LE(0, 6); // general purpose bit flag
      header.writeUInt16LE(8, 8); // compression method (deflate)
      header.writeUInt16LE(0, 10); // file time
      header.writeUInt16LE(0, 12); // file date
      header.writeUInt32LE(0x12345678, 14); // crc-32 (dummy)
      header.writeUInt32LE(deflated.length, 18); // compressed size
      header.writeUInt32LE(xmlBuffer.length, 22); // uncompressed size
      header.writeUInt16LE(nameBuf.length, 26); // file name length
      header.writeUInt16LE(0, 28); // extra field length

      return Buffer.concat([header, nameBuf, deflated]);
    }

    it('extracts word/document.xml from DOCX zip archive and parses paragraphs and spans', () => {
      const docXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body>
    <w:p>
      <w:pPr>
        <w:pStyle w:val="Heading1"/>
      </w:pPr>
      <w:r>
        <w:t>שער ראשון: יסודות העימוד העברי</w:t>
      </w:r>
    </w:p>
    <w:p>
      <w:r>
        <w:t>זהו משפט פתיחה עם </w:t>
      </w:r>
      <w:r>
        <w:rPr>
          <w:b/>
        </w:rPr>
        <w:t>מילה מודגשת</w:t>
      </w:r>
      <w:r>
        <w:t> וגם </w:t>
      </w:r>
      <w:r>
        <w:rPr>
          <w:i/>
        </w:rPr>
        <w:t>מילה נטויה</w:t>
      </w:r>
      <w:r>
        <w:t>.</w:t>
      </w:r>
    </w:p>
  </w:body>
</w:document>`;

      const docxBytes = buildMockDocxZip(docXml);
      const extractedXml = extractDocxXml(docxBytes);
      assert(extractedXml.includes('שער ראשון: יסודות העימוד העברי'));

      const result = importDocx(docxBytes, { fileName: 'עימוד_עברי.docx' });
      assert.equal(result.format, 'docx');
      assert.equal(result.title, 'עימוד עברי');
      assert.equal(result.paragraphCount, 2);
      assert.equal(result.paragraphs[0].styleId, 'heading-1');
      assert.equal(result.paragraphs[0].text, 'שער ראשון: יסודות העימוד העברי');

      const p2 = result.paragraphs[1];
      assert.equal(p2.text, 'זהו משפט פתיחה עם מילה מודגשת וגם מילה נטויה.');
      assert.equal(p2.spans?.length, 2);

      // Verify bold span
      assert.equal(p2.spans[0].format.fontWeight, 700);
      assert.equal(p2.text.slice(p2.spans[0].start, p2.spans[0].end), 'מילה מודגשת');

      // Verify italic span
      assert.equal(p2.spans[1].format.italic, true);
      assert.equal(p2.text.slice(p2.spans[1].start, p2.spans[1].end), 'מילה נטויה');
    });

    it('rejects corrupt or non-zip files when importing DOCX', () => {
      const fakeDocx = new Uint8Array([0x01, 0x02, 0x03, 0x04, 0x05, 0x06]);
      assert.throws(() => {
        importDocx(fakeDocx, { fileName: 'corrupt.docx' });
      }, (err) => {
        return err instanceof DocumentImportError && err.code === 'CORRUPTED_FILE';
      });
    });

    it('rejects zip archive missing word/document.xml', () => {
      // ZIP with only a dummy entry
      const nameBuf = Buffer.from('other_file.txt', 'utf-8');
      const dataBuf = Buffer.from('dummy data', 'utf-8');
      const header = Buffer.alloc(30);
      header.writeUInt32LE(0x04034b50, 0);
      header.writeUInt16LE(20, 4);
      header.writeUInt16LE(0, 6);
      header.writeUInt16LE(0, 8); // uncompressed
      header.writeUInt32LE(dataBuf.length, 18);
      header.writeUInt32LE(dataBuf.length, 22);
      header.writeUInt16LE(nameBuf.length, 26);
      header.writeUInt16LE(0, 28);
      const invalidZip = Buffer.concat([header, nameBuf, dataBuf]);

      assert.throws(() => {
        importDocx(invalidZip, { fileName: 'invalid_structure.docx' });
      }, (err) => {
        return err instanceof DocumentImportError && err.code === 'INVALID_STRUCTURE';
      });
    });
  });

  describe('5. Unified importDocument Routing', () => {
    it('routes TXT files correctly via filename and content', () => {
      const res = importDocument('שלום עולם', { fileName: 'test.txt' });
      assert.equal(res.format, 'txt');
      assert.equal(res.paragraphCount, 1);
    });

    it('routes Markdown files correctly via filename and content', () => {
      const res = importDocument('# כותרת\nפסקה עם **הדגשה**', { fileName: 'test.md' });
      assert.equal(res.format, 'md');
      assert.equal(res.paragraphCount, 2);
    });

    it('auto-detects Markdown from header markup even without extension', () => {
      const res = importDocument('# כותרת ללא סיומת\nתוכן הפסקה');
      assert.equal(res.format, 'md');
    });
  });

  describe('6. Integration with Document Bridge & tok-core Model', () => {
    it('converts ImportResult into valid MultiFlowDocumentState and DocumentRootJson', () => {
      const md = `# ספר המוסר

איזהו חכם? **הרואה את הנולד**.

איזהו גיבור? **הכובש את יצרו**.`;

      const importResult = importMarkdown(md, { fileName: 'ספר_המוסר.md' });
      const docState = importResultToDocumentState(importResult, 'prose');

      assert.equal(docState.title, 'ספר המוסר');
      assert.equal(docState.templateType, 'prose');
      assert.equal(docState.flows.gemara.length, 3);
      assert.equal(docState.flows.rashi.length, 0);
      assert.equal(docState.flows.tosafot.length, 0);

      // Verify DocumentRootJson conversion
      const docRoot = importResultToDocumentRoot(importResult, 'prose');
      assert.equal(docRoot.metadata.title, 'ספר המוסר');
      assert.equal(docRoot.metadata.progression, 'Rtl');
      assert.equal(docRoot.metadata.primary_language, 'he');
      assert(isValidUlid(docRoot.id));

      const sec = docRoot.sections[0];
      assert(sec && sec.flows.length >= 1);
      const flow = sec.flows[0];
      assert.equal(flow.paragraphs.length, 3);
      assert(isValidUlid(flow.paragraphs[0].id));
      assert(flow.paragraphs[1].spans && flow.paragraphs[1].spans.length > 0);
      assert.equal(flow.paragraphs[1].spans[0].format.font_weight, 700);
    });
  });

});
