/**
 * TypesetOK (TOK) - Hebrew-Aware Find & Replace Engine.
 *
 * Supports case-sensitivity, whole word matching, and Niqqud/Te'amim-insensitive
 * search with exact character boundary mapping and span preservation.
 */

import { StoryParagraph } from './types.js';


export interface FindOptions {
  query: string;
  matchCase?: boolean;
  ignoreNiqqud?: boolean;
  wholeWord?: boolean;
}

export interface FindResult {
  paraId: string;
  paraIndex: number;
  start: number; // Unicode character offset in paragraph
  end: number;   // Unicode character offset in paragraph
  matchedText: string;
}

/** Determines if a character is a Hebrew combining mark (Niqqud or Ta'amim) */
export function isHebrewMark(ch: string): boolean {
  if (!ch) return false;
  const cp = ch.codePointAt(0);
  if (cp === undefined) return false;
  // 0x0591 - 0x05AF: Hebrew Cantillation marks (Ta'amim)
  // 0x05B0 - 0x05C7: Hebrew Points (Niqqud), Dagesh, Rafe, Shin/Sin dots, Puncta
  return (cp >= 0x0591 && cp <= 0x05AF) || (cp >= 0x05B0 && cp <= 0x05C7);
}

/** Strips Niqqud and Te'amim from a Hebrew string */
export function stripHebrewMarks(text: string): string {
  return Array.from(text)
    .filter((ch) => !isHebrewMark(ch))
    .join('');
}

interface MappedString {
  stripped: string;
  origIndices: number[]; // Index in original char array for each stripped char
  chars: string[];
}

function buildMappedString(text: string, ignoreNiqqud: boolean): MappedString {
  const chars = Array.from(text);
  if (!ignoreNiqqud) {
    return {
      stripped: text,
      origIndices: chars.map((_, i) => i),
      chars
    };
  }

  const strippedChars: string[] = [];
  const origIndices: number[] = [];

  for (let i = 0; i < chars.length; i++) {
    const ch = chars[i];
    if (!isHebrewMark(ch)) {
      strippedChars.push(ch);
      origIndices.push(i);
    }
  }

  return {
    stripped: strippedChars.join(''),
    origIndices,
    chars
  };
}

/**
 * Finds all occurrences of the query across given paragraphs.
 */
export function findAllInParagraphs(
  paragraphs: StoryParagraph[],
  options: FindOptions
): FindResult[] {
  const results: FindResult[] = [];
  if (!options.query) return results;

  const matchCase = Boolean(options.matchCase);
  const ignoreNiqqud = Boolean(options.ignoreNiqqud);
  const wholeWord = Boolean(options.wholeWord);

  let targetQuery = ignoreNiqqud ? stripHebrewMarks(options.query) : options.query;
  if (!targetQuery) return results;

  if (!matchCase) {
    targetQuery = targetQuery.toLowerCase();
  }

  const queryChars = Array.from(targetQuery);
  const queryLen = queryChars.length;

  for (let paraIndex = 0; paraIndex < paragraphs.length; paraIndex++) {
    const para = paragraphs[paraIndex];
    const text = para.text || '';
    if (!text) continue;

    const mapped = buildMappedString(text, ignoreNiqqud);
    let searchSource = mapped.stripped;
    if (!matchCase) {
      searchSource = searchSource.toLowerCase();
    }

    const sourceChars = Array.from(searchSource);
    let searchFrom = 0;

    while (searchFrom <= sourceChars.length - queryLen) {
      const foundIdx = searchSource.indexOf(targetQuery, searchFrom);
      if (foundIdx === -1) break;

      // Check whole word boundary if requested
      let isWordValid = true;
      if (wholeWord) {
        const charBefore = foundIdx > 0 ? sourceChars[foundIdx - 1] : ' ';
        const charAfter =
          foundIdx + queryLen < sourceChars.length ? sourceChars[foundIdx + queryLen] : ' ';
        const isBeforeWord = /[\p{L}\p{N}]/u.test(charBefore);
        const isAfterWord = /[\p{L}\p{N}]/u.test(charAfter);
        if (isBeforeWord || isAfterWord) {
          isWordValid = false;
        }
      }

      if (isWordValid) {
        let origStart: number;
        let origEnd: number;

        if (ignoreNiqqud) {
          origStart = mapped.origIndices[foundIdx];
          const lastCharIndex = foundIdx + queryLen - 1;
          const origLastChar = mapped.origIndices[lastCharIndex];

          // Include any combining marks directly following the last character
          let endIdx = origLastChar + 1;
          while (endIdx < mapped.chars.length && isHebrewMark(mapped.chars[endIdx])) {
            endIdx++;
          }
          origEnd = endIdx;
        } else {
          origStart = foundIdx;
          origEnd = foundIdx + queryLen;
        }

        const matchedText = mapped.chars.slice(origStart, origEnd).join('');
        results.push({
          paraId: para.id,
          paraIndex,
          start: origStart,
          end: origEnd,
          matchedText
        });
      }

      searchFrom = foundIdx + 1;
    }
  }

  return results;
}

/**
 * Finds the next occurrence starting after (or at) the specified paragraph and offset.
 */
export function findNextInParagraphs(
  paragraphs: StoryParagraph[],
  fromParaId: string,
  fromOffset: number,
  options: FindOptions
): FindResult | null {
  const all = findAllInParagraphs(paragraphs, options);
  if (all.length === 0) return null;

  const currentParaIndex = paragraphs.findIndex((p) => p.id === fromParaId);
  const searchParaIdx = currentParaIndex >= 0 ? currentParaIndex : 0;

  // Look for match after current cursor
  for (const match of all) {
    if (
      match.paraIndex > searchParaIdx ||
      (match.paraIndex === searchParaIdx && match.start >= fromOffset)
    ) {
      return match;
    }
  }

  // Wrap around to first match
  return all[0];
}

/**
 * Finds the previous occurrence before the specified paragraph and offset.
 */
export function findPrevInParagraphs(
  paragraphs: StoryParagraph[],
  fromParaId: string,
  fromOffset: number,
  options: FindOptions
): FindResult | null {
  const all = findAllInParagraphs(paragraphs, options);
  if (all.length === 0) return null;

  const currentParaIndex = paragraphs.findIndex((p) => p.id === fromParaId);
  const searchParaIdx = currentParaIndex >= 0 ? currentParaIndex : paragraphs.length - 1;

  // Search in reverse for match before current cursor
  for (let i = all.length - 1; i >= 0; i--) {
    const match = all[i];
    if (
      match.paraIndex < searchParaIdx ||
      (match.paraIndex === searchParaIdx && match.end <= fromOffset)
    ) {
      return match;
    }
  }

  // Wrap around to last match
  return all[all.length - 1];
}
