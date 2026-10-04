// Mirrors crates/tok-typeset/src/gematria.rs so page numbers in the UI match the engine.

const GERESH = '׳';
const GERSHAYIM = '״';

const TABOO: Record<number, string> = {
  270: 'ער',
  272: 'ערב',
  275: 'ערה',
  298: 'חרצ',
  304: 'דש',
  344: 'שדמ',
  359: 'נטש',
  698: 'תרחצ',
  744: 'תשדמ',
};

const TENS = ['', 'י', 'כ', 'ל', 'מ', 'נ', 'ס', 'ע', 'פ', 'צ'];
const UNITS = ['', 'א', 'ב', 'ג', 'ד', 'ה', 'ו', 'ז', 'ח', 'ט'];

function sub1000(num: number): string {
  if (TABOO[num]) return TABOO[num];
  let s = '';
  while (num >= 400) {
    s += 'ת';
    num -= 400;
  }
  if (num >= 300) { s += 'ש'; num -= 300; }
  else if (num >= 200) { s += 'ר'; num -= 200; }
  else if (num >= 100) { s += 'ק'; num -= 100; }
  if (num === 15) return s + 'טו';
  if (num === 16) return s + 'טז';
  return s + TENS[Math.floor(num / 10)] + UNITS[num % 10];
}

function punctuate(letters: string): string {
  if (letters.length <= 1) return letters ? letters + GERESH : '';
  return letters.slice(0, -1) + GERSHAYIM + letters.slice(-1);
}

/**
 * Hebrew numeral with geresh/gershayim and taboo substitutions:
 * 1 → א׳, 15 → ט״ו, 115 → קט״ו, 270 → ע״ר, 304 → ד״ש, 5784 → ה׳תשפ״ד.
 */
export function toHebrewGematria(num: number): string {
  if (!Number.isFinite(num) || num < 1) return '';
  const n = Math.floor(num);
  let thousands = Math.floor(n / 1000);
  const rest = n % 1000;
  let out = '';
  if (thousands > 0) {
    while (thousands >= 1000) {
      out += 'תתר';
      thousands -= 1000;
    }
    out += sub1000(thousands) + GERESH;
  }
  return out + (rest > 0 ? punctuate(sub1000(rest)) : '');
}
