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
