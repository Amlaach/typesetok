/**
 * TypesetOK Document Import Engine (TextImporter).
 *
 * Defines contracts, error classes, and result interfaces for importing
 * real documents (TXT, Markdown, DOCX) into the TypesetOK document pipeline.
 */

import { StoryParagraph, TextSpan } from 'tok-story-editor';

const CROCKFORD_ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';

export function generateCrockfordUlid(seedTime: number = Date.now()): string {
  let timeStr = '';
  let t = Math.max(0, Math.floor(seedTime));
  for (let i = 0; i < 10; i++) {
    const mod = t % 32;
    timeStr = CROCKFORD_ALPHABET[mod] + timeStr;
    t = Math.floor(t / 32);
  }

  let randStr = '';
  for (let i = 0; i < 16; i++) {
    const rand = Math.floor(Math.random() * 32);
    randStr += CROCKFORD_ALPHABET[rand];
  }

  return timeStr + randStr;
}

export type SupportedImportFormat = 'txt' | 'md' | 'markdown' | 'docx';

export type ImportErrorCode =
  | 'UNSUPPORTED_FORMAT'
  | 'EMPTY_DOCUMENT'
  | 'CORRUPTED_FILE'
  | 'ENCODING_ERROR'
  | 'IO_ERROR'
  | 'INVALID_STRUCTURE';

export class DocumentImportError extends Error {
  public readonly code: ImportErrorCode;
  public readonly fileName?: string;
  public readonly userMessage: string;

  constructor(code: ImportErrorCode, message: string, userMessage?: string, fileName?: string) {
    super(message);
    this.name = 'DocumentImportError';
    this.code = code;
    this.fileName = fileName;
    this.userMessage = userMessage || message;
  }
}

export interface ImportOptions {
  fileName?: string;
  format?: SupportedImportFormat;
  defaultStyleId?: string;
  headingStylePrefix?: string;
  targetFlowId?: string;
}

export interface ImportResult {
  title: string;
  paragraphs: StoryParagraph[];
  format: SupportedImportFormat;
  detectedLanguage: 'he' | 'en' | 'mixed';
  detectedDirection: 'rtl' | 'ltr';
  wordCount: number;
  paragraphCount: number;
  metadata?: Record<string, unknown>;
}

/**
 * Detects whether text is primarily Hebrew (RTL) or Latin (LTR).
 */
export function detectTextDirection(text: string): 'rtl' | 'ltr' {
  if (!text) return 'rtl';
  const hebrewMatches = (text.match(/[\u0590-\u05FF]/g) || []).length;
  const latinMatches = (text.match(/[a-zA-Z]/g) || []).length;
  return hebrewMatches >= latinMatches ? 'rtl' : 'ltr';
}

/**
 * Detects whether text is Hebrew, English, or Mixed.
 */
export function detectTextLanguage(text: string): 'he' | 'en' | 'mixed' {
  if (!text) return 'he';
  const hebrewMatches = (text.match(/[\u0590-\u05FF]/g) || []).length;
  const latinMatches = (text.match(/[a-zA-Z]/g) || []).length;
  if (hebrewMatches > 0 && latinMatches > 0) return 'mixed';
  if (hebrewMatches > 0) return 'he';
  return 'en';
}

/**
 * Extracts a clean document title from a filename by stripping extensions and replacing underscores.
 */
export function cleanDocumentTitle(fileName?: string): string {
  if (!fileName) return 'מסמך ללא שם';
  const base = fileName.split(/[\\/]/).pop() || fileName;
  const stripped = base.replace(/\.(txt|md|markdown|docx|tok|json)$/i, '').replace(/_+/g, ' ').trim();
  return stripped || 'מסמך ללא שם';
}

/**
 * Helper to create a new StoryParagraph with a valid Crockford ULID.
 */
export function createStoryParagraph(
  text: string,
  styleId = 'default-body',
  spans?: TextSpan[]
): StoryParagraph {
  return {
    id: generateCrockfordUlid(),
    styleId,
    text,
    spans: spans && spans.length > 0 ? spans : undefined
  };
}

/**
 * Decodes raw buffer bytes into string with BOM and encoding detection.
 */
export function decodeTextBuffer(raw: Uint8Array | ArrayBuffer | string): string {
  if (typeof raw === 'string') return raw;
  const bytes = raw instanceof Uint8Array ? raw : new Uint8Array(raw);
  if (bytes.length === 0) return '';

  // Check for UTF-8 BOM: 0xEF, 0xBB, 0xBF
  if (bytes.length >= 3 && bytes[0] === 0xEF && bytes[1] === 0xBB && bytes[2] === 0xBF) {
    const decoder = new TextDecoder('utf-8');
    return decoder.decode(bytes.subarray(3));
  }

  // Check for UTF-16LE BOM: 0xFF, 0xFE
  if (bytes.length >= 2 && bytes[0] === 0xFF && bytes[1] === 0xFE) {
    const decoder = new TextDecoder('utf-16le');
    return decoder.decode(bytes.subarray(2));
  }

  // Check for UTF-16BE BOM: 0xFE, 0xFF
  if (bytes.length >= 2 && bytes[0] === 0xFE && bytes[1] === 0xFF) {
    const decoder = new TextDecoder('utf-16be');
    return decoder.decode(bytes.subarray(2));
  }

  // Check for null bytes indicating binary file
  let nullCount = 0;
  const sampleLen = Math.min(bytes.length, 512);
  for (let i = 0; i < sampleLen; i++) {
    if (bytes[i] === 0) nullCount++;
  }
  if (nullCount > sampleLen * 0.1) {
    throw new DocumentImportError(
      'CORRUPTED_FILE',
      'The file appears to be a binary format or unsupported encoding',
      'הקובץ שנבחר הוא קובץ בינארי או בעל קידוד לא נתמך'
    );
  }

  // Standard UTF-8 decode
  const decoder = new TextDecoder('utf-8', { fatal: false });
  return decoder.decode(bytes);
}

/**
 * Imports plain text (.txt) into structured StoryParagraph array.
 */
export function importPlainText(
  content: string | Uint8Array | ArrayBuffer,
  options?: ImportOptions
): ImportResult {
  const text = decodeTextBuffer(content).replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const clean = text.trim();

  if (!clean) {
    throw new DocumentImportError(
      'EMPTY_DOCUMENT',
      'The text document is empty',
      'קובץ הטקסט שנבחר ריק מתוכן',
      options?.fileName
    );
  }

  // Split on double newlines for paragraph preservation
  const rawParagraphs = clean.split(/\n\s*\n+/);
  const paragraphs: StoryParagraph[] = [];

  for (const rawP of rawParagraphs) {
    const trimmed = rawP.replace(/[ \t]+/g, ' ').trim();
    if (!trimmed) continue;
    paragraphs.push(createStoryParagraph(trimmed, options?.defaultStyleId || 'default-body'));
  }

  if (paragraphs.length === 0) {
    throw new DocumentImportError(
      'EMPTY_DOCUMENT',
      'No valid paragraphs found in text document',
      'לא נמצאו פסקאות תקינות במסמך',
      options?.fileName
    );
  }

  const title = cleanDocumentTitle(options?.fileName);
  const detectedDirection = detectTextDirection(clean);
  const detectedLanguage = detectTextLanguage(clean);
  const wordCount = (clean.match(/\S+/g) || []).length;

  return {
    title,
    paragraphs,
    format: 'txt',
    detectedLanguage,
    detectedDirection,
    wordCount,
    paragraphCount: paragraphs.length
  };
}

/**
 * Parses inline markdown tokens (bold, italic, code) into plain text and rich TextSpans.
 */
export function parseMarkdownInlineSpans(rawText: string): { text: string; cleanText: string; spans: TextSpan[] } {
  let cleanText = '';
  const spans: TextSpan[] = [];
  let i = 0;

  while (i < rawText.length) {
    // Check for bold-italic ***text*** or ___text___
    if (
      (rawText.startsWith('***', i) || rawText.startsWith('___', i)) &&
      rawText.indexOf(rawText.slice(i, i + 3), i + 3) !== -1
    ) {
      const marker = rawText.slice(i, i + 3);
      const endIdx = rawText.indexOf(marker, i + 3);
      const inner = rawText.slice(i + 3, endIdx);
      const start = cleanText.length;
      cleanText += inner;
      const end = cleanText.length;
      spans.push({ start, end, format: { fontWeight: 700, italic: true } });
      i = endIdx + 3;
      continue;
    }

    // Check for bold **text** or __text__
    if (
      (rawText.startsWith('**', i) || rawText.startsWith('__', i)) &&
      rawText.indexOf(rawText.slice(i, i + 2), i + 2) !== -1
    ) {
      const marker = rawText.slice(i, i + 2);
      const endIdx = rawText.indexOf(marker, i + 2);
      const inner = rawText.slice(i + 2, endIdx);
      const start = cleanText.length;
      cleanText += inner;
      const end = cleanText.length;
      spans.push({ start, end, format: { fontWeight: 700 } });
      i = endIdx + 2;
      continue;
    }

    // Check for italic *text* or _text_
    if (
      (rawText[i] === '*' || rawText[i] === '_') &&
      i + 1 < rawText.length &&
      rawText[i + 1] !== ' ' &&
      rawText.indexOf(rawText[i], i + 1) !== -1
    ) {
      const marker = rawText[i];
      const endIdx = rawText.indexOf(marker, i + 1);
      if (rawText[endIdx + 1] !== marker && rawText[endIdx - 1] !== ' ') {
        const inner = rawText.slice(i + 1, endIdx);
        const start = cleanText.length;
        cleanText += inner;
        const end = cleanText.length;
        spans.push({ start, end, format: { italic: true } });
        i = endIdx + 1;
        continue;
      }
    }

    // Check for inline code `text`
    if (rawText[i] === '`' && rawText.indexOf('`', i + 1) !== -1) {
      const endIdx = rawText.indexOf('`', i + 1);
      const inner = rawText.slice(i + 1, endIdx);
      const start = cleanText.length;
      cleanText += inner;
      const end = cleanText.length;
      spans.push({ start, end, format: { fontFamily: 'monospace' } });
      i = endIdx + 1;
      continue;
    }

    cleanText += rawText[i];
    i++;
  }

  return { text: cleanText, cleanText, spans };
}

/**
 * Imports Markdown document (.md) preserving headings, lists, quotes, and inline styles.
 */
export function importMarkdown(
  content: string | Uint8Array | ArrayBuffer,
  options?: ImportOptions
): ImportResult {
  const text = decodeTextBuffer(content).replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const clean = text.trim();

  if (!clean) {
    throw new DocumentImportError(
      'EMPTY_DOCUMENT',
      'The Markdown document is empty',
      'קובץ ה-Markdown שנבחר ריק מתוכן',
      options?.fileName
    );
  }

  const lines = text.split('\n');
  const paragraphs: StoryParagraph[] = [];
  let currentParaLines: string[] = [];
  let extractedTitle: string | null = null;

  function flushParagraph() {
    if (currentParaLines.length === 0) return;
    const joined = currentParaLines.join(' ').trim();
    currentParaLines = [];
    if (!joined) return;
    const { cleanText, spans } = parseMarkdownInlineSpans(joined);
    paragraphs.push(createStoryParagraph(cleanText, options?.defaultStyleId || 'default-body', spans));
  }

  for (let idx = 0; idx < lines.length; idx++) {
    const rawLine = lines[idx];
    const trimmed = rawLine.trim();

    if (!trimmed) {
      flushParagraph();
      continue;
    }

    // Heading 1
    if (/^#\s+/.test(trimmed)) {
      flushParagraph();
      const headingText = trimmed.replace(/^#\s+/, '').trim();
      if (!extractedTitle) extractedTitle = headingText;
      const { cleanText, spans } = parseMarkdownInlineSpans(headingText);
      paragraphs.push(createStoryParagraph(cleanText, 'heading-1', spans));
      continue;
    }

    // Heading 2
    if (/^##\s+/.test(trimmed)) {
      flushParagraph();
      const headingText = trimmed.replace(/^##\s+/, '').trim();
      const { cleanText, spans } = parseMarkdownInlineSpans(headingText);
      paragraphs.push(createStoryParagraph(cleanText, 'heading-2', spans));
      continue;
    }

    // Heading 3
    if (/^###\s+/.test(trimmed)) {
      flushParagraph();
      const headingText = trimmed.replace(/^###\s+/, '').trim();
      const { cleanText, spans } = parseMarkdownInlineSpans(headingText);
      paragraphs.push(createStoryParagraph(cleanText, 'heading-3', spans));
      continue;
    }

    // Blockquote
    if (/^>\s*/.test(trimmed)) {
      flushParagraph();
      const quoteText = trimmed.replace(/^>\s*/, '').trim();
      const { cleanText, spans } = parseMarkdownInlineSpans(quoteText);
      paragraphs.push(createStoryParagraph(cleanText, 'blockquote', spans));
      continue;
    }

    // List item
    if (/^([-*+]|\d+\.)\s+/.test(trimmed)) {
      flushParagraph();
      const itemText = trimmed.replace(/^([-*+]|\d+\.)\s+/, '').trim();
      const { cleanText, spans } = parseMarkdownInlineSpans(itemText);
      paragraphs.push(createStoryParagraph(cleanText, 'list-item', spans));
      continue;
    }

    currentParaLines.push(trimmed);
  }
  flushParagraph();

  if (paragraphs.length === 0) {
    throw new DocumentImportError(
      'EMPTY_DOCUMENT',
      'No readable paragraphs found in Markdown document',
      'לא נמצאו פסקאות תקינות במסמך ה-Markdown',
      options?.fileName
    );
  }

  const title = extractedTitle || cleanDocumentTitle(options?.fileName);
  const detectedDirection = detectTextDirection(clean);
  const detectedLanguage = detectTextLanguage(clean);
  const wordCount = (clean.match(/\S+/g) || []).length;

  return {
    title,
    paragraphs,
    format: 'md',
    detectedLanguage,
    detectedDirection,
    wordCount,
    paragraphCount: paragraphs.length
  };
}

/**
 * Decodes standard XML entities.
 */
function decodeXmlEntities(str: string): string {
  return str
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)))
    .replace(/&#([0-9]+);/g, (_, dec) => String.fromCharCode(parseInt(dec, 10)));
}

/**
 * Extracts raw uncompressed word/document.xml from a DOCX zip archive buffer.
 */
export function extractDocxXml(raw: Uint8Array | ArrayBuffer): string {
  const bytes = raw instanceof Uint8Array ? raw : new Uint8Array(raw);
  if (bytes.length < 30) {
    throw new DocumentImportError(
      'CORRUPTED_FILE',
      'The file is too small to be a valid DOCX package',
      'קובץ ה-DOCX קטן מדי או פגום'
    );
  }

  // Check PK\x03\x04 signature
  if (bytes[0] !== 0x50 || bytes[1] !== 0x4B || bytes[2] !== 0x03 || bytes[3] !== 0x04) {
    throw new DocumentImportError(
      'CORRUPTED_FILE',
      'Invalid ZIP signature in DOCX file',
      'מבנה קובץ ה-DOCX פגום (חתימת ZIP שגויה)'
    );
  }

  let offset = 0;
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);

  while (offset + 30 <= bytes.length) {
    const sig = view.getUint32(offset, true);
    if (sig !== 0x04034b50) {
      // End of local file headers or central directory reached
      break;
    }

    const compressionMethod = view.getUint16(offset + 8, true);
    const compressedSize = view.getUint32(offset + 18, true);
    const uncompressedSize = view.getUint32(offset + 22, true);
    const fileNameLen = view.getUint16(offset + 26, true);
    const extraFieldLen = view.getUint16(offset + 28, true);

    const fileNameBytes = bytes.subarray(offset + 30, offset + 30 + fileNameLen);
    const entryName = new TextDecoder('utf-8').decode(fileNameBytes);
    const dataStart = offset + 30 + fileNameLen + extraFieldLen;

    if (entryName === 'word/document.xml') {
      const entryBytes = bytes.subarray(dataStart, dataStart + compressedSize);
      if (compressionMethod === 0) {
        // Stored uncompressed
        return new TextDecoder('utf-8').decode(entryBytes);
      } else if (compressionMethod === 8) {
        // Deflated
        try {
          let zlib: any = null;
          if (typeof (globalThis as any).require === 'function') {
            try { zlib = (globalThis as any).require('zlib'); } catch {}
          }
          if (!zlib && typeof process !== 'undefined' && typeof (process as any).getBuiltinModule === 'function') {
            try { zlib = (process as any).getBuiltinModule('node:zlib') || (process as any).getBuiltinModule('zlib'); } catch {}
          }

          if (zlib && typeof zlib.inflateRawSync === 'function') {
            const inflated = zlib.inflateRawSync(entryBytes);
            return new TextDecoder('utf-8').decode(inflated);
          }
          throw new Error('zlib decompression is not available in current environment');
        } catch (e: any) {
          throw new DocumentImportError(
            'CORRUPTED_FILE',
            `Failed to decompress word/document.xml: ${e?.message}`,
            'שגיאה בפריסת תוכן ה-DOCX'
          );
        }
      } else {
        throw new DocumentImportError(
          'UNSUPPORTED_FORMAT',
          `Unsupported ZIP compression method: ${compressionMethod}`,
          'שיטת דחיסה לא נתמכת בקובץ DOCX'
        );
      }
    }

    offset = dataStart + compressedSize;
  }

  throw new DocumentImportError(
    'INVALID_STRUCTURE',
    'word/document.xml not found in DOCX package',
    'לא נמצא תוכן מסמך תקין (word/document.xml) בתוך קובץ ה-DOCX'
  );
}

/**
 * Parses word/document.xml string into structured StoryParagraphs with formatting spans.
 */
export function parseDocxXml(xml: string, options?: ImportOptions): ImportResult {
  const pRegex = /<w:p(?:[\s\S]*?)<\/w:p>/g;
  const paragraphs: StoryParagraph[] = [];
  let match: RegExpExecArray | null;

  while ((match = pRegex.exec(xml)) !== null) {
    const pXml = match[0];

    // Determine paragraph style from <w:pStyle w:val="..."/>
    let styleId = options?.defaultStyleId || 'default-body';
    const styleMatch = /<w:pStyle[^>]*?w:val="([^"]+)"/i.exec(pXml);
    if (styleMatch) {
      const val = styleMatch[1].toLowerCase();
      if (val.includes('heading1') || val.includes('heading 1') || val === '1') {
        styleId = 'heading-1';
      } else if (val.includes('heading2') || val.includes('heading 2') || val === '2') {
        styleId = 'heading-2';
      } else if (val.includes('heading3') || val.includes('heading 3') || val === '3') {
        styleId = 'heading-3';
      } else if (val.includes('quote') || val.includes('ציטוט')) {
        styleId = 'blockquote';
      }
    }

    // Check for list item: <w:numPr>
    if (/<w:numPr[\s>]/.test(pXml)) {
      styleId = 'list-item';
    }

    // Parse runs <w:r>
    const rRegex = /<w:r(?:[\s\S]*?)<\/w:r>/g;
    let rMatch: RegExpExecArray | null;
    let fullParaText = '';
    const spans: TextSpan[] = [];

    while ((rMatch = rRegex.exec(pXml)) !== null) {
      const rXml = rMatch[0];

      // Extract run properties <w:rPr>
      const isBold = /<w:b(?:\s|\/|>)/.test(rXml) && !/<w:b\s+w:val="(?:0|false|none)"/i.test(rXml);
      const isItalic = /<w:i(?:\s|\/|>)/.test(rXml) && !/<w:i\s+w:val="(?:0|false|none)"/i.test(rXml);
      const isUnderline = /<w:u(?:\s|\/|>)/.test(rXml) && !/<w:u\s+w:val="(?:0|false|none)"/i.test(rXml);

      // Extract text <w:t>
      const tRegex = /<w:t(?:[^>]*)>([\s\S]*?)<\/w:t>/g;
      let tMatch: RegExpExecArray | null;
      let runText = '';
      while ((tMatch = tRegex.exec(rXml)) !== null) {
        runText += decodeXmlEntities(tMatch[1]);
      }

      if (runText) {
        const start = fullParaText.length;
        fullParaText += runText;
        const end = fullParaText.length;

        if (isBold || isItalic || isUnderline) {
          spans.push({
            start,
            end,
            format: {
              fontWeight: isBold ? 700 : undefined,
              italic: isItalic ? true : undefined,
              underline: isUnderline ? true : undefined
            }
          });
        }
      }
    }

    const trimmed = fullParaText.replace(/[ \t]+/g, ' ').trim();
    if (trimmed) {
      paragraphs.push(createStoryParagraph(trimmed, styleId, spans));
    }
  }

  if (paragraphs.length === 0) {
    throw new DocumentImportError(
      'EMPTY_DOCUMENT',
      'The DOCX document contains no text paragraphs',
      'קובץ ה-DOCX אינו מכיל פסקאות טקסט',
      options?.fileName
    );
  }

  const allText = paragraphs.map((p) => p.text).join('\n');
  const title = cleanDocumentTitle(options?.fileName);
  const detectedDirection = detectTextDirection(allText);
  const detectedLanguage = detectTextLanguage(allText);
  const wordCount = (allText.match(/\S+/g) || []).length;

  return {
    title,
    paragraphs,
    format: 'docx',
    detectedLanguage,
    detectedDirection,
    wordCount,
    paragraphCount: paragraphs.length
  };
}

/**
 * Imports DOCX document buffer.
 */
export function importDocx(
  content: Uint8Array | ArrayBuffer,
  options?: ImportOptions
): ImportResult {
  const xml = extractDocxXml(content);
  return parseDocxXml(xml, options);
}

/**
 * Unified entry point for importing any supported document file (TXT, Markdown, DOCX).
 */
export function importDocument(
  content: string | Uint8Array | ArrayBuffer,
  options?: ImportOptions
): ImportResult {
  const fileName = options?.fileName || '';
  const ext = fileName.split('.').pop()?.toLowerCase();

  // 1. Explicit format or filename match
  if (options?.format === 'docx' || ext === 'docx') {
    if (typeof content === 'string') {
      throw new DocumentImportError(
        'INVALID_STRUCTURE',
        'DOCX format requires binary buffer input',
        'קובץ DOCX דורש נתונים בינאריים'
      );
    }
    return importDocx(content, options);
  }

  if (options?.format === 'md' || options?.format === 'markdown' || ext === 'md' || ext === 'markdown') {
    return importMarkdown(content, options);
  }

  if (options?.format === 'txt' || ext === 'txt') {
    return importPlainText(content, options);
  }

  // 2. Auto-detect from binary signature
  if (typeof content !== 'string') {
    const bytes = content instanceof Uint8Array ? content : new Uint8Array(content);
    if (bytes.length >= 4 && bytes[0] === 0x50 && bytes[1] === 0x4B && bytes[2] === 0x03 && bytes[3] === 0x04) {
      return importDocx(bytes, options);
    }
  }

  // 3. Auto-detect Markdown vs Plain Text
  const decoded = typeof content === 'string' ? content : decodeTextBuffer(content);
  const hasMarkdownTokens = /^#\s+|\n#\s+|\*\*|__|\n[-*+]\s+/m.test(decoded);
  if (hasMarkdownTokens) {
    return importMarkdown(content, options);
  }

  return importPlainText(content, options);
}


