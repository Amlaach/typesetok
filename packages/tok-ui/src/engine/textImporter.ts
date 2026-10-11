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

