import "server-only";
import { hasKhmer, khmerCollator, normalizeKey } from "@/lib/khmer/normalize";
import { getEnglishStore, getKhmerStore, type EnRecord, type KmRecord } from "./store";
import { khmerdictUrl, type KdEnResult, type KdKmResult, type KdMatch, type KdSearchResponse } from "./types";

function lowerBound(keys: string[], prefix: string): number {
  let lo = 0;
  let hi = keys.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (keys[mid] < prefix) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}

/** Most substring scans stop long before this; it bounds the worst case ("a"). */
const CONTAINS_SCAN_CAP = 200;

function toEn(e: EnRecord, match: KdMatch): KdEnResult {
  const r: KdEnResult = { word: e.w, definition: e.def, match, url: khmerdictUrl(e.w) };
  if (e.pos) r.pos = e.pos;
  if (e.ex) r.example = e.ex;
  if (e.notes) r.notes = e.notes;
  return r;
}

function toKm(e: KmRecord, match: KdMatch): KdKmResult {
  const r: KdKmResult = { id: e.id, word: e.word, head: e.head, level: e.level, definition: e.def, match, url: khmerdictUrl(e.word) };
  if (e.pron) r.pronunciation = e.pron;
  if (e.pos) r.pos = e.pos;
  if (e.ex) r.example = e.ex;
  if (e.src) r.source = e.src;
  if (e.rem) r.remark = e.rem;
  if (e.notes) r.notes = e.notes;
  return r;
}

/** English → Khmer: exact, then prefix (shortest first), then substring. */
export function searchEnglish(query: string, limit = 30): KdSearchResponse {
  const q = query.trim().toLowerCase().replace(/\s+/g, " ");
  const s = getEnglishStore();
  const results: KdEnResult[] = [];
  if (!q) return { source: "khmerdict.com", lang: "en", query, total: 0, results };

  const picked = new Set<number>();
  const add = (i: number, match: KdMatch) => {
    if (picked.has(i)) return;
    picked.add(i);
    results.push(toEn(s.entries[i], match));
  };

  const start = lowerBound(s.lower, q);
  for (let i = start; i < s.lower.length && s.lower[i] === q; i++) add(i, "exact");

  const prefix: number[] = [];
  for (let i = start; i < s.lower.length && s.lower[i].startsWith(q); i++) {
    if (s.lower[i] !== q) prefix.push(i);
    if (prefix.length > 400) break;
  }
  prefix.sort((a, b) => s.lower[a].length - s.lower[b].length || (s.lower[a] < s.lower[b] ? -1 : 1));
  for (const i of prefix) add(i, "prefix");

  if (results.length < limit && q.length >= 3) {
    let found = 0;
    for (let i = 0; i < s.lower.length && found < CONTAINS_SCAN_CAP; i++) {
      if (picked.has(i) || !s.lower[i].includes(q)) continue;
      add(i, "contains");
      found++;
    }
  }

  return { source: "khmerdict.com", lang: "en", query, total: results.length, results: results.slice(0, limit) };
}

/** Khmer → Khmer over khmerdict.com's entries, including sub-entries the SPICE data lacks. */
export function searchKhmer(query: string, limit = 30): KdSearchResponse {
  const key = normalizeKey(query);
  const s = getKhmerStore();
  const results: KdKmResult[] = [];
  const base = { source: "khmerdict.com" as const, lang: "km" as const, query, normalized: key };
  if (!key) return { ...base, total: 0, results };

  const collator = khmerCollator();
  const picked = new Set<number>();
  const add = (i: number, match: KdMatch) => {
    if (picked.has(i)) return;
    picked.add(i);
    results.push(toKm(s.entries[i], match));
  };

  const exact = [...(s.byKey.get(key) ?? [])].sort((a, b) => s.entries[a].level - s.entries[b].level || a - b);
  for (const i of exact) add(i, "exact");

  const prefix: number[] = [];
  for (let k = lowerBound(s.sortedKeys, key); k < s.sortedKeys.length && s.sortedKeys[k].startsWith(key); k++) {
    if (s.sortedKeys[k] === key) continue;
    prefix.push(...s.byKey.get(s.sortedKeys[k])!);
    if (prefix.length > 400) break;
  }
  prefix.sort((a, b) => {
    const wa = s.entries[a].word;
    const wb = s.entries[b].word;
    return wa.length - wb.length || collator.compare(wa, wb) || a - b;
  });
  for (const i of prefix) add(i, "prefix");

  if (results.length < limit && key.length >= 2) {
    let found = 0;
    for (let k = 0; k < s.sortedKeys.length && found < CONTAINS_SCAN_CAP; k++) {
      const sk = s.sortedKeys[k];
      if (sk.length <= key.length || !sk.includes(key) || sk.startsWith(key)) continue;
      for (const i of s.byKey.get(sk)!) add(i, "contains");
      found++;
    }
  }

  return { ...base, total: results.length, results: results.slice(0, limit) };
}

/** Picks the direction from the script of the query. */
export function searchKhmerDict(query: string, limit = 30): KdSearchResponse {
  return hasKhmer(query) ? searchKhmer(query, limit) : searchEnglish(query, limit);
}
