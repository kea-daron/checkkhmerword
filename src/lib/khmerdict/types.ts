/**
 * Types for the khmerdict.com data set (imported by `npm run fetch:khmerdict`).
 * Shared by the server store and the client components, so no `server-only`.
 */

export type KdMatch = "exact" | "prefix" | "contains";

/** One English → Khmer entry. */
export type KdEnResult = {
  word: string;
  pos?: string;
  /** Khmer gloss, comma-separated senses. */
  definition: string;
  example?: string;
  /** Inflections or usage notes, e.g. "abode, abided, abiding, abides". */
  notes?: string;
  match: KdMatch;
  /** Deep link to the same word on khmerdict.com. */
  url: string;
};

/** One Khmer → Khmer entry (Chuon Nath, with khmerdict.com's field split). */
export type KdKmResult = {
  /** khmerdict.com's own id; unrelated to this app's `/word/:id` ids. */
  id: number;
  word: string;
  /** Main headword; for a sub-entry (level 2) the entry it is listed under. */
  head: string;
  level: 1 | 2;
  pronunciation?: string;
  pos?: string;
  definition: string;
  example?: string;
  /** Etymology as printed, e.g. "(បា.)" Pali, "(សំ.)" Sanskrit. */
  source?: string;
  remark?: string;
  notes?: string;
  match: KdMatch;
  url: string;
};

export type KdSearchResponse =
  | { source: "khmerdict.com"; lang: "en"; query: string; total: number; results: KdEnResult[] }
  | { source: "khmerdict.com"; lang: "km"; query: string; normalized: string; total: number; results: KdKmResult[] };

export const KHMERDICT_SITE = "https://khmerdict.com/";

/** The site opens the word in its path: https://khmerdict.com/<word>. */
export function khmerdictUrl(word: string): string {
  return KHMERDICT_SITE + encodeURIComponent(word);
}
