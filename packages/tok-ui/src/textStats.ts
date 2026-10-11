/**
 * High-speed text statistics and word counter utilities.
 * Optimized for Hebrew and multilingual texts with zero-allocation scanning and paragraph-level caching.
 */

export function countWords(text: string): number {
  if (!text) return 0;
  let count = 0;
  let inWord = false;
  const len = text.length;
  for (let i = 0; i < len; i++) {
    const code = text.charCodeAt(i);
    const isWs =
      code <= 32 ||
      code === 160 ||
      code === 0x2000 ||
      code === 0x2001 ||
      code === 0x2002 ||
      code === 0x2003 ||
      code === 0x2028 ||
      code === 0x2029;
    if (!isWs) {
      if (!inWord) {
        count++;
        inWord = true;
      }
    } else {
      inWord = false;
    }
  }
  return count;
}

const wordCountCache = new Map<string, { text: string; count: number }>();

export function getParagraphWordCount(id: string, text: string): number {
  const cached = wordCountCache.get(id);
  if (cached && cached.text === text) {
    return cached.count;
  }
  const count = countWords(text);
  wordCountCache.set(id, { text, count });
  return count;
}

export function clearWordCountCache(): void {
  wordCountCache.clear();
}
