/**
 * TypesetOK (TOK) - Professional Story Editor Semantic Types & Span Utilities.
 *
 * Provides semantic character formatting, text span mapping, paragraph style
 * patches, and lossless range operations.
 */

export interface CharacterFormat {
  characterStyleId?: string;
  fontFamily?: string;
  fontSizePt?: number;
  fontWeight?: number; // 400 = regular, 700 = bold
  italic?: boolean;
  underline?: boolean;
  trackingEm?: number;
  color?: string;
}

export interface TextSpan {
  start: number; // Unicode character offset (inclusive)
  end: number;   // Unicode character offset (exclusive)
  format: CharacterFormat;
}

export interface ParagraphStylePatch {
  fontFamily?: string;
  fontWeight?: number;
  fontSizePt?: number;
  lineHeightPt?: number;
  spaceBeforePt?: number;
  spaceAfterPt?: number;
  firstLineIndentPt?: number;
  indentStartPt?: number;
  indentEndPt?: number;
  alignment?: 'Justified' | 'Right' | 'Left' | 'Center';
  direction?: 'Rtl' | 'Ltr';
}

export interface StoryParagraph {
  id: string;
  styleId: string;
  text: string;
  spans?: TextSpan[];
  patch?: ParagraphStylePatch;
}

export interface StorySelection {
  paraId: string;
  start: number; // char offset within paraId
  end: number;   // char offset within paraId
  isCollapsed: boolean;
  anchorParaId?: string;
  anchorOffset?: number;
  focusParaId?: string;
  focusOffset?: number;
}


/** Check if format has any non-empty properties */
export function isFormatEmpty(fmt?: CharacterFormat | null): boolean {
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

/** Equality comparison for two character formats */
export function areFormatsEqual(a?: CharacterFormat | null, b?: CharacterFormat | null): boolean {
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

/** Brings a span list into canonical form: sorted, clamped, merged, no overlaps. */
export function normalizeSpans(spans: TextSpan[], textLen: number): TextSpan[] {
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

/** Extracts formatting spans falling within [start, end) re-based to offset 0 */
export function spansInRange(spans: TextSpan[], start: number, end: number): TextSpan[] {
  return spans
    .filter((s) => s.end > start && s.start < end)
    .map((s) => ({
      start: Math.max(0, s.start - start),
      end: Math.min(end - start, s.end - start),
      format: { ...s.format }
    }));
}

/** Adjusts spans after removing characters in [start, end) */
export function removeSpanRange(
  spans: TextSpan[],
  start: number,
  end: number,
  textLenBefore: number
): TextSpan[] {
  const removed = Math.max(0, end - start);
  const shifted: TextSpan[] = [];

  for (const s of spans) {
    if (s.end <= start) {
      shifted.push({ ...s });
    } else if (s.start >= end) {
      shifted.push({ start: s.start - removed, end: s.end - removed, format: { ...s.format } });
    } else {
      // Span overlaps removed range
      const newStart = Math.min(s.start, start);
      const newEnd = s.end <= end ? start : s.end - removed;
      if (newStart < newEnd) {
        shifted.push({ start: newStart, end: newEnd, format: { ...s.format } });
      }
    }
  }

  return normalizeSpans(shifted, Math.max(0, textLenBefore - removed));
}

/** Adjusts spans after inserting text at offset */
export function insertSpanRange(
  spans: TextSpan[],
  offset: number,
  insertLen: number,
  insertedSpans: TextSpan[],
  textLenBefore: number
): TextSpan[] {
  const out: TextSpan[] = [];
  for (const s of spans) {
    if (s.end <= offset) {
      out.push({ ...s });
    } else if (s.start >= offset) {
      out.push({ start: s.start + insertLen, end: s.end + insertLen, format: { ...s.format } });
    } else {
      // Split span surrounding insertion point
      out.push({ start: s.start, end: offset, format: { ...s.format } });
      out.push({ start: offset + insertLen, end: s.end + insertLen, format: { ...s.format } });
    }
  }

  for (const s of insertedSpans) {
    const start = Math.max(0, Math.min(insertLen, s.start));
    const end = Math.max(0, Math.min(insertLen, s.end));
    if (start < end) {
      out.push({ start: offset + start, end: offset + end, format: { ...s.format } });
    }
  }

  return normalizeSpans(out, textLenBefore + insertLen);
}

/** Applies character formatting over [start, end) */
export function formatRangeInSpans(
  spans: TextSpan[],
  start: number,
  end: number,
  format: CharacterFormat,
  textLen: number
): TextSpan[] {
  if (start >= end || isFormatEmpty(format)) return [...spans];
  const copy = spans.map((s) => ({ ...s, format: { ...s.format } }));
  copy.push({ start, end, format });
  return normalizeSpans(copy, textLen);
}

/** Clears character formatting over [start, end) */
export function clearRangeInSpans(
  spans: TextSpan[],
  start: number,
  end: number,
  textLen: number
): TextSpan[] {
  if (start >= end) return [...spans];
  const out: TextSpan[] = [];
  for (const s of spans) {
    if (s.end <= start || s.start >= end) {
      out.push({ ...s });
    } else {
      if (s.start < start) {
        out.push({ start: s.start, end: start, format: { ...s.format } });
      }
      if (s.end > end) {
        out.push({ start: end, end: s.end, format: { ...s.format } });
      }
    }
  }
  return normalizeSpans(out, textLen);
}
