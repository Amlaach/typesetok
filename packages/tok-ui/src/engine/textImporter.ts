/**
 * TypesetOK Document Import Engine (TextImporter).
 *
 * Defines contracts, error classes, and result interfaces for importing
 * real documents (TXT, Markdown, DOCX) into the TypesetOK document pipeline.
 */

import { StoryParagraph, TextSpan } from 'tok-story-editor';
import { generateCrockfordUlid } from './documentBridge';

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
 * Extracts a clean document title from a filename by stripping extensions.
 */
export function cleanDocumentTitle(fileName?: string): string {
  if (!fileName) return 'מסמך מיובא';
  const base = fileName.split(/[\\/]/).pop() || fileName;
  return base.replace(/\.(txt|md|markdown|docx|tok|json)$/i, '').trim() || 'מסמך מיובא';
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
export function parseMarkdownInlineSpans(rawText: string): { cleanText: string; spans: TextSpan[] } {
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
      // Make sure endIdx is not part of a double marker
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

  return { cleanText, spans };
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

  const rawBlocks = clean.split(/\n\s*\n+/);
  const paragraphs: StoryParagraph[] = [];
  let extractedTitle: string | null = null;

  for (const block of rawBlocks) {
    const lines = block.split('\n').map((l) => l.trim()).filter(Boolean);
    if (lines.length === 0) continue;

    const firstLine = lines[0];

    // Heading 1: # Heading
    if (firstLine.startsWith('# ')) {
      const headingText = firstLine.slice(2).trim();
      if (!extractedTitle) extractedTitle = headingText;
      const { cleanText, spans } = parseMarkdownInlineSpans(headingText);
      paragraphs.push(createStoryParagraph(cleanText, 'heading-1', spans));
      continue;
    }

    // Heading 2: ## Heading
    if (firstLine.startsWith('## ')) {
      const headingText = firstLine.slice(3).trim();
      const { cleanText, spans } = parseMarkdownInlineSpans(headingText);
      paragraphs.push(createStoryParagraph(cleanText, 'heading-2', spans));
      continue;
    }

    // Heading 3: ### Heading
    if (firstLine.startsWith('### ')) {
      const headingText = firstLine.slice(4).trim();
      const { cleanText, spans } = parseMarkdownInlineSpans(headingText);
      paragraphs.push(createStoryParagraph(cleanText, 'heading-3', spans));
      continue;
    }

    // Blockquote: > text
    if (firstLine.startsWith('>')) {
      const quoteRaw = lines.map((l) => l.replace(/^>\s*/, '')).join(' ');
      const { cleanText, spans } = parseMarkdownInlineSpans(quoteRaw);
      paragraphs.push(createStoryParagraph(cleanText, 'blockquote', spans));
      continue;
    }

    // List items: - item or * item or 1. item
    const isBulletList = lines.every((l) => /^[-*+]\s+/.test(l));
    const isNumberedList = lines.every((l) => /^\d+\.\s+/.test(l));

    if (isBulletList || isNumberedList) {
      for (const line of lines) {
        const itemRaw = line.replace(/^([-*+]|\d+\.)\s+/, '');
        const { cleanText, spans } = parseMarkdownInlineSpans(itemRaw);
        paragraphs.push(createStoryParagraph(cleanText, 'list-item', spans));
      }
      continue;
    }

    // Standard paragraph: join consecutive lines with space
    const joined = lines.join(' ');
    const { cleanText, spans } = parseMarkdownInlineSpans(joined);
    paragraphs.push(createStoryParagraph(cleanText, options?.defaultStyleId || 'default-body', spans));
  }

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

