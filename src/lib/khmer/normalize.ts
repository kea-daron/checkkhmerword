/**
 * Khmer text normalization helpers.
 *
 * `normalizeKey` produces the lookup key used by every index in the app.
 * It is deliberately lenient: it strips invisible characters and trailing
 * punctuation and folds a handful of well-known encoding variants so that a
 * word typed slightly differently from the dictionary still matches.
 */

/** Zero-width space / non-joiner / joiner / BOM and Khmer invisible vowels. */
const INVISIBLE = /[​‌‍﻿឴឵]/g;

/** Punctuation the dictionary attaches to headwords: "កម្ម--", "ជិត!", "ថី?". */
const TRAILING_PUNCT = /[\s\-!?.,:;៖។៕]+$/g;

export const KHMER_CHAR = /[ក-៿᧠-᧿]/;
export const KHMER_DIGIT = /^[០-៩]+$/;

export function hasKhmer(s: string): boolean {
  return KHMER_CHAR.test(s);
}

/** True when the string is made only of Khmer letters/signs (no digits, no Latin). */
export function isKhmerWord(s: string): boolean {
  if (!s) return false;
  for (const ch of s) {
    const cp = ch.codePointAt(0)!;
    if (cp >= 0x1780 && cp <= 0x17dd) continue; // letters, vowels, signs
    if (cp === 0x200b || cp === 0x200c || cp === 0x200d) continue;
    return false;
  }
  return true;
}

export function normalizeKey(input: string): string {
  let s = input.normalize("NFC").replace(INVISIBLE, "").replace(/\s+/g, "");
  s = s.replace(TRAILING_PUNCT, "");
  // Vowel-sign ordering variants.
  s = s.replace(/ំា/g, "ាំ"); // ំ + ា  -> ាំ
  s = s.replace(/ំុ/g, "ុំ"); // ំ + ុ  -> ុំ
  // Legacy two-part vowels typed as separate signs.
  s = s.replace(/េី/g, "ើ"); // េ + ី -> ើ
  s = s.replace(/េា/g, "ោ"); // េ + ា -> ោ
  s = s.replace(/េះ/g, "េះ"); // keep េះ as is
  // Coeng DA / coeng TA are routinely interchanged when typing.
  s = s.replace(/្ដ/g, "្ត");
  // ឲ (U+17B2) is a glyph variant of ឱ (U+17B1); the dictionary uses ឱ (e.g. ឱ្យ).
  s = s.replace(/ឲ/g, "ឱ");
  // Deprecated independent vowel ឣ/ឤ -> អ/អា (rare, but harmless).
  s = s.replace(/ឣ/g, "អ").replace(/ឤ/g, "អា");
  return s;
}

/** Strips invisible characters only, keeping punctuation and spaces. */
export function stripInvisible(s: string): string {
  return s.replace(INVISIBLE, "");
}

/** Khmer consonants (ក..អ) followed by independent vowels (ឥ..ឳ) in dictionary order. */
export const KHMER_CONSONANTS = [
  "ក", "ខ", "គ", "ឃ", "ង",
  "ច", "ឆ", "ជ", "ឈ", "ញ",
  "ដ", "ឋ", "ឌ", "ឍ", "ណ",
  "ត", "ថ", "ទ", "ធ", "ន",
  "ប", "ផ", "ព", "ភ", "ម",
  "យ", "រ", "ល", "វ",
  "ស", "ហ", "ឡ", "អ",
] as const;

export const KHMER_INDEPENDENT_VOWELS = [
  "ឥ", "ឦ", "ឧ", "ឩ", "ឪ", "ឫ", "ឬ", "ឭ", "ឮ", "ឯ", "ឰ", "ឱ", "ឳ",
] as const;

/** First "letter" of a headword for browsing, or null when it is not a Khmer letter. */
export function firstLetter(word: string): string | null {
  const s = stripInvisible(word).trim();
  if (!s) return null;
  const cp = s.codePointAt(0)!;
  if (cp >= 0x1780 && cp <= 0x17b3) return String.fromCodePoint(cp);
  return null;
}

let collator: Intl.Collator | null = null;
export function khmerCollator(): Intl.Collator {
  return (collator ??= new Intl.Collator("km"));
}

export function toCodePoints(s: string): number[] {
  const out: number[] = [];
  for (const ch of s) out.push(ch.codePointAt(0)!);
  return out;
}
