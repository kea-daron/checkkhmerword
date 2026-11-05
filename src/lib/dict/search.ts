import "server-only";
import { khmerCollator, normalizeKey, toCodePoints } from "@/lib/khmer/normalize";
import { excerpt } from "./definition";
import { getDefinition, getStore } from "./store";
import { levenshtein } from "./suggest";
import type { MatchType, SearchResponse, SearchResult } from "./types";

/** Index of the first sorted key that is >= prefix. */
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

export function search(query: string, limit = 30): SearchResponse {
  const s = getStore();
  const key = normalizeKey(query);
  const empty: SearchResponse = { query, normalized: key, total: 0, results: [] };
  if (!key) return empty;

  const collator = khmerCollator();
  const picked = new Map<number, MatchType>();
  const order: number[] = [];
  const add = (id: number, match: MatchType) => {
    if (picked.has(id)) return;
    picked.set(id, match);
    order.push(id);
  };

  // 1. exact (strict spelling first, then normalized equivalents)
  const exactIds = s.byKey.get(key) ?? [];
  const strict = exactIds.filter((id) => s.byId.get(id)!.word === query.trim());
  for (const id of strict) add(id, "exact");
  for (const id of exactIds) add(id, "exact");

  // 2. prefix matches, shortest first
  const prefixIds: number[] = [];
  for (let i = lowerBound(s.sortedKeys, key); i < s.sortedKeys.length; i++) {
    const k = s.sortedKeys[i];
    if (!k.startsWith(key)) break;
    if (k === key) continue;
    for (const id of s.byKey.get(k)!) prefixIds.push(id);
    if (prefixIds.length > 400) break;
  }
  prefixIds.sort((a, b) => {
    const wa = s.byId.get(a)!.word;
    const wb = s.byId.get(b)!.word;
    return wa.length - wb.length || collator.compare(wa, wb);
  });
  for (const id of prefixIds) add(id, "prefix");

  // 3. substring matches (only worth it for queries of 2+ code points)
  if (order.length < limit && toCodePoints(key).length >= 2) {
    const containsIds: number[] = [];
    for (const k of s.sortedKeys) {
      if (k.length <= key.length || !k.includes(key)) continue;
      for (const id of s.byKey.get(k)!) if (!picked.has(id)) containsIds.push(id);
      if (containsIds.length > 300) break;
    }
    containsIds.sort((a, b) => {
      const wa = s.byId.get(a)!.word;
      const wb = s.byId.get(b)!.word;
      return wa.length - wb.length || collator.compare(wa, wb);
    });
    for (const id of containsIds) add(id, "contains");
  }

  // 4. fuzzy matches when we still have little to show
  if (order.length < Math.min(limit, 8)) {
    const target = toCodePoints(key);
    const max = target.length <= 3 ? 1 : 2;
    const fuzzy: { id: number; d: number; len: number }[] = [];
    for (const k of s.sortedKeys) {
      if (Math.abs(k.length - key.length) > max + 1) continue;
      const cps = toCodePoints(k);
      if (Math.abs(cps.length - target.length) > max) continue;
      const d = levenshtein(target, cps, max);
      if (d > max) continue;
      for (const id of s.byKey.get(k)!) if (!picked.has(id)) fuzzy.push({ id, d, len: cps.length });
    }
    fuzzy.sort((a, b) => a.d - b.d || a.len - b.len);
    for (const f of fuzzy) add(f.id, "fuzzy");
  }

  const results: SearchResult[] = order.slice(0, limit).map((id) => {
    const e = s.byId.get(id)!;
    return {
      id,
      word: e.word,
      pos: e.pos,
      match: picked.get(id)!,
      excerpt: excerpt(getDefinition(id) ?? ""),
    };
  });

  return { query, normalized: key, total: order.length, results };
}

/** Exact lookup (normalized). */
export function lookup(word: string): number[] {
  return getStore().byKey.get(normalizeKey(word)) ?? [];
}
