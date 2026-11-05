import "server-only";
import { khmerCollator, toCodePoints } from "@/lib/khmer/normalize";
import { getStore } from "./store";
import type { Suggestion } from "./types";

/**
 * Levenshtein distance over code points with an upper bound.
 * Returns `max + 1` as soon as the distance is known to exceed `max`.
 */
export function levenshtein(a: number[], b: number[], max: number): number {
  if (a.length > b.length) [a, b] = [b, a];
  if (b.length - a.length > max) return max + 1;
  let prev = new Array<number>(a.length + 1);
  let cur = new Array<number>(a.length + 1);
  for (let i = 0; i <= a.length; i++) prev[i] = i;
  for (let j = 1; j <= b.length; j++) {
    cur[0] = j;
    let rowMin = cur[0];
    const bj = b[j - 1];
    for (let i = 1; i <= a.length; i++) {
      const cost = a[i - 1] === bj ? 0 : 1;
      cur[i] = Math.min(prev[i] + 1, cur[i - 1] + 1, prev[i - 1] + cost);
      if (cur[i] < rowMin) rowMin = cur[i];
    }
    if (rowMin > max) return max + 1;
    [prev, cur] = [cur, prev];
  }
  return prev[a.length];
}

/**
 * Suggest dictionary headwords (and, as a fallback, SBBIC words) close to `key`.
 * `key` must already be normalized.
 */
export function suggest(key: string, limit = 6, maxDistance?: number): Suggestion[] {
  const s = getStore();
  const target = toCodePoints(key);
  if (target.length === 0) return [];
  const max = maxDistance ?? (target.length <= 3 ? 1 : target.length <= 6 ? 2 : 3);

  const scored: (Suggestion & { sameFirst: boolean; lenDiff: number })[] = [];

  const consider = (word: string, id?: number, cap = max) => {
    if (Math.abs(word.length - key.length) > cap + 1) return;
    const cps = toCodePoints(word);
    if (Math.abs(cps.length - target.length) > cap) return;
    const d = levenshtein(target, cps, cap);
    if (d > cap || d === 0) return;
    scored.push({
      word,
      id,
      distance: d,
      sameFirst: cps[0] === target[0],
      lenDiff: Math.abs(cps.length - target.length),
    });
  };

  for (const k of s.sortedKeys) {
    const ids = s.byKey.get(k)!;
    const entry = s.byId.get(ids[0])!;
    consider(entry.word, entry.id);
  }
  // Fall back to the broader SBBIC list only with a tighter bound so dictionary words win.
  if (scored.filter((x) => x.distance <= 1).length < limit) {
    for (const w of s.sbbic) consider(w, undefined, Math.min(max, 1));
  }

  const collator = khmerCollator();
  scored.sort(
    (a, b) =>
      a.distance - b.distance ||
      Number(b.id !== undefined) - Number(a.id !== undefined) ||
      Number(b.sameFirst) - Number(a.sameFirst) ||
      a.lenDiff - b.lenDiff ||
      collator.compare(a.word, b.word),
  );

  const seen = new Set<string>();
  const out: Suggestion[] = [];
  for (const x of scored) {
    if (seen.has(x.word)) continue;
    seen.add(x.word);
    out.push({ word: x.word, id: x.id, distance: x.distance });
    if (out.length >= limit) break;
  }
  return out;
}
