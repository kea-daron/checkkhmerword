import "server-only";
import fs from "node:fs";
import path from "node:path";
import { levenshtein } from "@/lib/dict/suggest";
import { toCodePoints } from "@/lib/khmer/normalize";

/**
 * Word and word-pair counts from Khmer text (data/generated/phrases.json,
 * built by `npm run build:phrases`). The file is optional: without it the
 * phrase-context check is simply off and the rest of the checker is unchanged.
 */

export type PhraseSource = { name: string; license: string; sentences: number; tokens: number };
export type PhraseMeta = {
  sources: PhraseSource[];
  sentences: number;
  tokens: number;
  words: number;
  bigrams: number;
  minBigram: number;
  builtAt: string;
};

export type PhraseStore = {
  meta: PhraseMeta;
  uni: Map<string, number>;
  bi: Map<string, number>;
  /** Number of word occurrences counted. */
  total: number;
  /** Word with one code point removed (or the word itself) -> words that produce it. */
  neighbours: Map<string, string[]>;
};

/** A word must occur this often in the texts before it is offered as a replacement. */
export const MIN_CANDIDATE_COUNT = 3;

const FILE = path.join(process.cwd(), "data", "generated", "phrases.json");

let store: PhraseStore | null = null;

/** The word and every string made by dropping one of its code points. */
function deletions(word: string): string[] {
  const cps = [...word];
  const out = [word];
  for (let i = 0; i < cps.length; i++) out.push(cps.slice(0, i).join("") + cps.slice(i + 1).join(""));
  return out;
}

export function isPhraseDataAvailable(): boolean {
  return store !== null || fs.existsSync(FILE);
}

/** Loads the counts on first use. `null` until `npm run build:phrases` has produced the file. */
export function getPhraseStore(): PhraseStore | null {
  if (store) return store;
  if (!fs.existsSync(FILE)) return null;
  const raw = JSON.parse(fs.readFileSync(FILE, "utf8")) as { meta: PhraseMeta; uni: Record<string, number>; bi: Record<string, number> };
  const uni = new Map(Object.entries(raw.uni));
  const bi = new Map(Object.entries(raw.bi));
  let total = 0;
  for (const c of uni.values()) total += c;
  const neighbours = new Map<string, string[]>();
  for (const [w, c] of uni) {
    if (c < MIN_CANDIDATE_COUNT) continue;
    for (const k of deletions(w)) {
      const list = neighbours.get(k);
      if (list) list.push(w);
      else neighbours.set(k, [w]);
    }
  }
  return (store = { meta: raw.meta, uni, bi, total, neighbours });
}

export function getPhraseMeta(): PhraseMeta | null {
  return getPhraseStore()?.meta ?? null;
}

export const uniCount = (s: PhraseStore, w: string) => s.uni.get(w) ?? 0;
export const biCount = (s: PhraseStore, a: string, b: string) => s.bi.get(`${a} ${b}`) ?? 0;

/**
 * Words from the texts that are one code point away from `word` (a letter
 * added, dropped or changed) and occur at least `MIN_CANDIDATE_COUNT` times.
 */
export function candidates(s: PhraseStore, word: string): string[] {
  const target = toCodePoints(word);
  const seen = new Set<string>();
  const out: string[] = [];
  for (const k of deletions(word)) {
    for (const w of s.neighbours.get(k) ?? []) {
      if (w === word || seen.has(w)) continue;
      seen.add(w);
      if (levenshtein(target, toCodePoints(w), 1) <= 1) out.push(w);
    }
  }
  return out;
}
