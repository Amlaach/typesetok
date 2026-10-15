/**
 * TypesetOK (TOK) - Professional Hebrew Text Cleanup & Typography Preparation Engine.
 *
 * Implements robust Hebrew text normalization, typographical quotes/geresh conversion,
 * space and punctuation cleanup, and automatic Dibur HaMatchil run-in heading styling.
 */

import type { TextSpan, CharacterFormat } from 'tok-story-editor';

function isFormatEmpty(fmt?: CharacterFormat | null): boolean {
  if (!fmt) return true;
  return (
    !fmt.characterStyleId &&
    !fmt.fontFamily &&
    fmt.fontSizePt === undefined &&
    fmt.fontWeight === undefined &&
    !fmt.italic &&
    !fmt.underline &&
    fmt.trackingEm === undefined &&
    !fmt.color
  );
}

function areFormatsEqual(a?: CharacterFormat | null, b?: CharacterFormat | null): boolean {
  if (!a && !b) return true;
  if (!a || !b) return false;
  return (
    a.characterStyleId === b.characterStyleId &&
    a.fontFamily === b.fontFamily &&
    a.fontSizePt === b.fontSizePt &&
    a.fontWeight === b.fontWeight &&
    Boolean(a.italic) === Boolean(b.italic) &&
    Boolean(a.underline) === Boolean(b.underline) &&
    a.trackingEm === b.trackingEm &&
    a.color === b.color
  );
}

export function normalizeSpans(spans: TextSpan[], textLen: number = Infinity): TextSpan[] {
  let out: TextSpan[] = [];
  for (const span of spans) {
    const start = Math.max(0, Math.min(textLen, span.start));
    const end = Math.max(0, Math.min(textLen, span.end));
    if (start >= end || isFormatEmpty(span.format)) continue;

    const next: TextSpan[] = [];
    for (const s of out) {
      if (s.end <= start || s.start >= end) {
        next.push(s);
        continue;
      }
      if (s.start < start) {
        next.push({ start: s.start, end: start, format: { ...s.format } });
      }
      if (s.end > end) {
        next.push({ start: end, end: s.end, format: { ...s.format } });
      }
    }
    next.push({ start, end, format: { ...span.format } });
    out = next;
  }

  out.sort((a, b) => a.start - b.start);
  const merged: TextSpan[] = [];
  for (const s of out) {
    const last = merged[merged.length - 1];
    if (last && last.end === s.start && areFormatsEqual(last.format, s.format)) {
      last.end = s.end;
    } else {
      merged.push({ start: s.start, end: s.end, format: { ...s.format } });
    }
  }
  return merged;
}

export function formatRangeInSpans(
  spans: TextSpan[],
  start: number,
  end: number,
  format: CharacterFormat,
  textLen: number = Infinity
): TextSpan[] {
  if (start >= end || isFormatEmpty(format)) return [...spans];
  const copy = spans.map((s) => ({ ...s, format: { ...s.format } }));
  copy.push({ start, end, format });
  return normalizeSpans(copy, textLen);
}

export interface CleanupOptions {
  cleanDoubleSpaces: boolean;
  cleanSpacesBeforePunct: boolean;
  ensureSpaceAfterPunct: boolean;
  normalizeQuotesAndGeresh: boolean;
  collapseEmptyParagraphs: boolean;
  boldDiburHaMatchil: boolean;
  diburDelimiter: 'any' | 'period' | 'colon' | 'dash';
  scope: 'activeFlow' | 'allFlows';
}

export interface CleanupStats {
  doubleSpacesFixed: number;
  spacesBeforePunctFixed: number;
  spacesAfterPunctFixed: number;
  quotesConverted: number;
  gereshConverted: number;
  emptyParagraphsRemoved: number;
  diburHaMatchilBolded: number;
  totalModifications: number;
}

export const DEFAULT_CLEANUP_OPTIONS: CleanupOptions = {
  cleanDoubleSpaces: true,
  cleanSpacesBeforePunct: true,
  ensureSpaceAfterPunct: true,
  normalizeQuotesAndGeresh: true,
  collapseEmptyParagraphs: true,
  boldDiburHaMatchil: true,
  diburDelimiter: 'any',
  scope: 'activeFlow'
};

/**
 * Finds the index of the Dibur HaMatchil delimiter in a paragraph text.
 * Returns -1 if no delimiter is found within the threshold.
 */
export function findDiburDelimiter(text: string, delimiter: CleanupOptions['diburDelimiter'], maxChars = 140): number {
  if (!text || text.length === 0) return -1;
  const searchLimit = Math.min(text.length, maxChars);

  let bestIdx = -1;

  for (let i = 0; i < searchLimit; i++) {
    const ch = text[i];

    if (delimiter === 'period' || delimiter === 'any') {
      if (ch === '.') {
        bestIdx = i;
        break;
      }
    }

    if (delimiter === 'colon' || delimiter === 'any') {
      if (ch === ':' || ch === '׃') {
        bestIdx = i;
        break;
      }
    }

    if (delimiter === 'dash' || delimiter === 'any') {
      if (ch === '–' || ch === '—' || ch === '-') {
        // Ensure it's not a hyphen inside a compound word (requires following space or trailing)
        if (ch === '-' && i + 1 < text.length && text[i + 1] !== ' ') {
          // might be hyphenated word like בית-אל, skip
        } else {
          bestIdx = i;
          break;
        }
      }
    }
  }

  return bestIdx;
}
