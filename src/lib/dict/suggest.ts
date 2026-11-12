import "server-only";
import { khmerCollator, toCodePoints } from "@/lib/khmer/normalize";
import { getStore } from "./store";
import type { Suggestion } from "./types";

export type EditCosts = {
  /** replace an element of `a` */
  sub: number;
  /** drop an element of `a` */
  del: number;
  /** add an element that is only in `b` */
  ins: number;
};
const UNIT_COSTS: EditCosts = { sub: 1, del: 1, ins: 1 };

/**
 * Levenshtein distance from `a` to `b` with an upper bound.
 * Returns `max + 1` as soon as the distance is known to exceed `max`.
 * Costs are all 1 unless given; `del`/`ins` are relative to `a`.
 */
export function levenshtein<T>(a: T[], b: T[], max: number, costs: EditCosts = UNIT_COSTS): number {
  if (Math.abs(b.length - a.length) > max) return max + 1;
  let prev = new Array<number>(a.length + 1);
  let cur = new Array<number>(a.length + 1);
  for (let i = 0; i <= a.length; i++) prev[i] = i * costs.del;
  for (let j = 1; j <= b.length; j++) {
    cur[0] = j * costs.ins;
    let rowMin = cur[0];
    const bj = b[j - 1];
    for (let i = 1; i <= a.length; i++) {
      const cost = a[i - 1] === bj ? 0 : costs.sub;
      cur[i] = Math.min(prev[i] + costs.ins, cur[i - 1] + costs.del, prev[i - 1] + cost);
      if (cur[i] < rowMin) rowMin = cur[i];
    }
    if (rowMin > max) return max + 1;
    [prev, cur] = [cur, prev];
  }
  return prev[a.length];
}

/** Dependent vowels, coeng, and diacritic signs that attach to the preceding base letter. */
function isCombining(cp: number): boolean {
  return (cp >= 0x17b6 && cp <= 0x17d3) || cp === 0x17dd;
}

/**
 * Split a word into Khmer orthographic clusters: a base letter together with
 * its coeng consonants, dependent vowels and signs (e.g. "ខឹង" -> ["ខឹ", "ង"]).
 * A consonant and its vowel are one unit of spelling, so suggestions are
 * measured in clusters and never swap a vowel for an unrelated letter.
 */
export function toClusters(word: string): string[] {
  const out: string[] = [];
  let cur = "";
  let afterCoeng = false;
  for (const ch of word) {
    const cp = ch.codePointAt(0)!;
    if (cur && (afterCoeng || isCombining(cp))) {
      cur += ch;
    } else {
      if (cur) out.push(cur);
      cur = ch;
    }
    afterCoeng = cp === 0x17d2;
  }
  if (cur) out.push(cur);
  return out;
}

/** The word's base letters only: consonants with every vowel and sign removed. */
export function toSkeleton(word: string): string[] {
  const out: string[] = [];
  for (const ch of word) if (!isCombining(ch.codePointAt(0)!)) out.push(ch);
  return out;
}

/**
 * Rewriting or dropping a typed cluster costs a little more than adding one, so
 * a candidate that keeps the typed clusters intact ("ខឹ" -> "ខឹង") ranks above
 * one that changes a cluster ("ខឹ" -> "ខួ") or loses one ("ខង" -> "ខ"). The
 * integer part is still the plain cluster edit distance, which the cap uses.
 */
const CLUSTER_COSTS: EditCosts = { sub: 1.01, del: 1.01, ins: 1 };

let sbbicSorted: string[] | null = null;
function sortedSbbic(): string[] {
  return (sbbicSorted ??= [...getStore().sbbic].sort());
}

function lowerBound(arr: string[], key: string): number {
  let lo = 0;
  let hi = arr.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (arr[mid] < key) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}

/** Punctuation the dictionary prints after some headwords ("កម្ម--", "ថី?"); never part of a suggestion. */
const HEADWORD_PUNCT = /[\s\-!?.,:;៖។៕]+$/;

/** The headword spelled as printed for a normalized key, or the key itself for SBBIC words. */
function display(key: string): { word: string; id?: number } {
  const s = getStore();
  const ids = s.byKey.get(key);
  if (ids) return { word: s.byId.get(ids[0])!.word.replace(HEADWORD_PUNCT, ""), id: ids[0] };
  return { word: key };
}

/**
 * Known words that begin with `key` (what the user may have been about to
 * type), shortest first: "ខឹ" -> ខឹង, ខឹកៗ. `key` must be normalized.
 */
export function completions(key: string, limit = 3, maxExtra = 4): Suggestion[] {
  if (!key) return [];
  const s = getStore();
  const n = toCodePoints(key).length;
  const out: Suggestion[] = [];
  const scan = (arr: string[]) => {
    for (let i = lowerBound(arr, key); i < arr.length && arr[i].startsWith(key); i++) {
      const k = arr[i];
      if (k === key) continue;
      const extra = toCodePoints(k).length - n;
      if (extra > maxExtra) continue;
      out.push({ ...display(k), distance: extra });
    }
  };
  scan(s.sortedKeys);
  scan(sortedSbbic());
  const collator = khmerCollator();
  out.sort((a, b) => a.distance - b.distance || Number(b.id !== undefined) - Number(a.id !== undefined) || collator.compare(a.word, b.word));
  return out.slice(0, limit);
}

/**
 * Known words that `key` begins with (the user typed too far, or glued the
 * next word on), longest first: "ក្រៅពីន" -> ក្រៅពី, ក្រៅ. Cuts fall on
 * cluster boundaries so a vowel is never separated from its consonant, and a
 * one-cluster prefix must be at least three code points (ក្រៅ yes, ជួ no).
 * `key` must be normalized.
 */
export function prefixes(key: string, limit = 3): Suggestion[] {
  const s = getStore();
  const clusters = toClusters(key);
  const total = toCodePoints(key).length;
  const out: Suggestion[] = [];
  for (let i = clusters.length - 1; i >= 1 && out.length < limit; i--) {
    const k = clusters.slice(0, i).join("");
    const len = toCodePoints(k).length;
    if (len < 2 || (i === 1 && len < 3)) continue;
    if (s.byKey.has(k) || s.sbbic.has(k)) out.push({ ...display(k), distance: total - len });
  }
  return out;
}

/**
 * Suggest dictionary headwords (and, as a fallback, SBBIC words) close to `key`.
 * `key` must already be normalized.
 *
 * A candidate must be within `max` edits both by code point and by cluster.
 * Ranking: cluster distance (keeping typed clusters intact wins ties), then
 * same base consonants (a vowel fix beats a consonant change), then code points.
 */
export function suggest(key: string, limit = 6, maxDistance?: number): Suggestion[] {
  const s = getStore();
  const target = toCodePoints(key);
  if (target.length === 0) return [];
  const max = maxDistance ?? (target.length <= 3 ? 1 : target.length <= 6 ? 2 : 3);
  const targetClusters = toClusters(key);
  const targetSkeleton = toSkeleton(key);

  const scored: (Suggestion & { clusterDistance: number; skeletonDistance: number; sameFirst: boolean; lenDiff: number })[] =
    [];

  const consider = (word: string, id?: number, cap = max) => {
    if (Math.abs(word.length - key.length) > cap + 1) return;
    const cps = toCodePoints(word);
    if (Math.abs(cps.length - target.length) > cap) return;
    const d = levenshtein(target, cps, cap);
    if (d > cap || d === 0) return;
    const dc = levenshtein(targetClusters, toClusters(word), cap + 0.5, CLUSTER_COSTS);
    if (dc > cap + 0.5) return;
    scored.push({
      word,
      id,
      distance: d,
      clusterDistance: dc,
      skeletonDistance: levenshtein(targetSkeleton, toSkeleton(word), cap),
      sameFirst: cps[0] === target[0],
      lenDiff: Math.abs(cps.length - target.length),
    });
  };

  for (const k of s.sortedKeys) {
    const ids = s.byKey.get(k)!;
    const entry = s.byId.get(ids[0])!;
    consider(entry.word.replace(HEADWORD_PUNCT, ""), entry.id);
  }
  // Fall back to the broader SBBIC list only with a tighter bound so dictionary words win.
  if (scored.filter((x) => x.distance <= 1).length < limit) {
    for (const w of s.sbbic) consider(w, undefined, Math.min(max, 1));
  }

  const collator = khmerCollator();
  scored.sort(
    (a, b) =>
      a.clusterDistance - b.clusterDistance ||
      Number(b.id !== undefined) - Number(a.id !== undefined) ||
      a.skeletonDistance - b.skeletonDistance ||
      a.distance - b.distance ||
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
