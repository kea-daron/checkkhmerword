import "server-only";
import {
  KHMER_DIGIT,
  hasKhmer,
  isKhmerWord,
  normalizeKey,
  stripInvisible,
  toCodePoints,
} from "@/lib/khmer/normalize";
import { getStore } from "./store";
import { suggest } from "./suggest";
import type { CheckPart, CheckResponse, CheckSummary, CheckToken, Suggestion } from "./types";

const MAX_TEXT = 5000;
const MAX_MERGE = 3;
const MAX_PARTS = 4;
const MAX_DP_LENGTH = 60; // code points
const MAX_PART_LENGTH = 14; // code points
const MAX_RUN_SUGGEST = 16; // code points

let segmenter: Intl.Segmenter | null = null;
function getSegmenter(): Intl.Segmenter {
  return (segmenter ??= new Intl.Segmenter("km", { granularity: "word" }));
}

type Raw = { text: string; kind: CheckToken["kind"] };
type Unit = { text: string; status: "dict" | "sbbic" | "unknown"; ids?: number[] };

function classify(seg: Intl.SegmentData): Raw {
  const text = seg.segment;
  if (!seg.isWordLike) {
    if (/^\s+$/.test(text)) return { text, kind: "space" };
    return { text, kind: "punct" };
  }
  if (KHMER_DIGIT.test(text) || !hasKhmer(text)) return { text, kind: "other" };
  if (!isKhmerWord(text)) return { text, kind: "other" };
  return { text, kind: "word" };
}

function classifyWord(text: string): Unit {
  const s = getStore();
  const key = normalizeKey(text);
  const ids = s.byKey.get(key);
  if (ids) return { text, status: "dict", ids };
  if (s.sbbic.has(key)) return { text, status: "sbbic" };
  return { text, status: "unknown" };
}

const isIndependentVowel = (cp: number) => cp >= 0x17a3 && cp <= 0x17b3;

/**
 * Cost of one part in a segmentation. Dictionary words are cheapest, SBBIC
 * words cost a little more than two dictionary words would, and very short
 * parts carry a small penalty so splits are not made frivolously.
 */
function partCost(status: Unit["status"], len: number): number {
  if (status === "dict") return len <= 2 ? 1.15 : 1;
  if (status === "sbbic") return len <= 2 ? 2.6 : 2.2;
  return 3;
}

/**
 * Cover `text` with known words using dynamic programming (minimum `partCost`).
 * Parts must be at least two code points, or a single independent vowel, so a
 * misspelt word cannot be "explained" as a string of single letters.
 */
function dpCover(text: string, allowSbbic: boolean): { parts: Unit[]; cost: number } | null {
  const s = getStore();
  const cps = [...text];
  const n = cps.length;
  if (n === 0 || n > MAX_DP_LENGTH) return null;

  type Cell = { cost: number; from: number; unit: Unit };
  const best = new Array<Cell | null>(n + 1).fill(null);
  best[0] = { cost: 0, from: 0, unit: { text: "", status: "dict" } };

  for (let i = 1; i <= n; i++) {
    for (let j = Math.max(0, i - MAX_PART_LENGTH); j < i; j++) {
      const prev = best[j];
      if (!prev) continue;
      const len = i - j;
      if (len < 2 && !isIndependentVowel(cps[j].codePointAt(0)!)) continue;
      const chunk = cps.slice(j, i).join("");
      const key = normalizeKey(chunk);
      if (!key) continue;
      let unit: Unit | null = null;
      const ids = s.byKey.get(key);
      if (ids) unit = { text: chunk, status: "dict", ids };
      else if (allowSbbic && s.sbbic.has(key)) unit = { text: chunk, status: "sbbic" };
      if (!unit) continue;
      const total = prev.cost + partCost(unit.status, len);
      const cur = best[i];
      if (!cur || total < cur.cost) best[i] = { cost: total, from: j, unit };
    }
  }

  const end = best[n];
  if (!end) return null;
  const parts: Unit[] = [];
  let i = n;
  while (i > 0) {
    const c = best[i]!;
    parts.unshift(c.unit);
    i = c.from;
  }
  return { parts, cost: end.cost };
}

function toPart(p: Unit): CheckPart {
  return p.status === "dict" ? { text: p.text, status: "dict", ids: p.ids } : { text: p.text, status: "sbbic" };
}

function toToken(u: Unit): CheckToken {
  if (u.status === "dict") return { text: u.text, kind: "word", status: "dict", ids: u.ids };
  if (u.status === "sbbic") {
    // An accepted spelling that is not a headword. Keep it intact (splitting
    // e.g. កម្ពុជា into កម្ពុ + ជា would mislead) but point at the headwords
    // it is built from, when a clean dictionary-only cover exists.
    const cover = dpCover(u.text, false);
    if (cover && cover.parts.length >= 2 && cover.parts.length <= MAX_PARTS) {
      return { text: u.text, kind: "word", status: "sbbic", parts: cover.parts.map(toPart) };
    }
    return { text: u.text, kind: "word", status: "sbbic" };
  }
  return unknownToken(u.text);
}

function unknownToken(text: string): CheckToken {
  const cover = dpCover(text, true);
  if (cover && cover.parts.length >= 2 && cover.parts.length <= MAX_PARTS) {
    return { text, kind: "word", status: "compound", parts: cover.parts.map(toPart) };
  }
  const key = normalizeKey(text);
  const suggestions = toCodePoints(key).length >= 2 ? suggest(key, 5) : [];
  return { text, kind: "word", status: "unknown", suggestions };
}

/**
 * Resolve a run of adjacent Khmer word tokens (no spaces or punctuation between them).
 */
function resolveRun(tokens: string[]): CheckToken[] {
  // 1. Merge adjacent tokens when the concatenation is itself a headword.
  const s = getStore();
  const merged: string[] = [];
  for (let i = 0; i < tokens.length; ) {
    let took = 1;
    let joined = tokens[i];
    for (let k = 2; k <= MAX_MERGE && i + k - 1 < tokens.length; k++) {
      joined += tokens[i + k - 1];
      if (s.byKey.has(normalizeKey(joined))) took = k;
    }
    merged.push(tokens.slice(i, i + took).join(""));
    i += took;
  }

  const units = merged.map(classifyWord);
  const hasUnknown = units.some((u) => u.status === "unknown");
  const runText = merged.join("");

  // 2. Everything is known: keep ICU's segmentation.
  if (!hasUnknown) return units.map(toToken);

  // 3. A short run with something unknown is most likely one misspelt word that
  //    ICU shattered: look for a close dictionary headword for the whole run.
  const runLen = toCodePoints(runText).length;
  if (runLen <= MAX_RUN_SUGGEST && merged.length <= 4) {
    const close = closeHeadwords(runText, runLen <= 4 ? 1 : 2);
    if (close.length) return [{ text: runText, kind: "word", status: "unknown", suggestions: close }];
  }

  // 4. General case: group known stretches and unknown stretches.
  //    An unknown stretch may absorb one known neighbour when the combination is
  //    within edit distance 1 of a headword (e.g. "វចនា|នុក្|រុម" -> "វចនានុក្រុម").
  type Group = { kind: "known"; units: Unit[] } | { kind: "unknown"; text: string; suggestions: Suggestion[] };
  const groups: Group[] = [];
  let i = 0;
  while (i < units.length) {
    if (units[i].status !== "unknown") {
      const last = groups[groups.length - 1];
      if (last && last.kind === "known") last.units.push(units[i]);
      else groups.push({ kind: "known", units: [units[i]] });
      i++;
      continue;
    }
    let j = i;
    while (j < units.length && units[j].status === "unknown") j++;

    const text = (a: number, b: number) => units.slice(a, b).map((u) => u.text).join("");
    const tryWindow = (a: number, b: number, maxDistance?: number): Suggestion[] => {
      const t = text(a, b);
      if (toCodePoints(t).length > MAX_RUN_SUGGEST) return [];
      return closeHeadwords(t, maxDistance);
    };

    const prevGroup = groups[groups.length - 1];
    const canLeft = prevGroup?.kind === "known" && prevGroup.units.length > 0;
    const canRight = j < units.length;

    let from = i;
    let to = j;
    let suggestions = tryWindow(i, j);
    if (!suggestions.length && canLeft) {
      const s = tryWindow(i - 1, j, 1);
      if (s.length) {
        suggestions = s;
        from = i - 1;
      }
    }
    if (!suggestions.length && canRight) {
      const s = tryWindow(i, j + 1, 1);
      if (s.length) {
        suggestions = s;
        to = j + 1;
      }
    }
    if (!suggestions.length && canLeft && canRight) {
      const s = tryWindow(i - 1, j + 1, 1);
      if (s.length) {
        suggestions = s;
        from = i - 1;
        to = j + 1;
      }
    }
    if (from < i && prevGroup?.kind === "known") {
      prevGroup.units.pop();
      if (prevGroup.units.length === 0) groups.pop();
    }
    groups.push({ kind: "unknown", text: text(from, to), suggestions });
    i = to;
  }

  const out: CheckToken[] = [];
  for (const g of groups) {
    if (g.kind === "known") out.push(...g.units.map(toToken));
    else if (g.suggestions.length) out.push({ text: g.text, kind: "word", status: "unknown", suggestions: g.suggestions });
    else out.push(unknownToken(g.text));
  }
  return out;
}

/** Dictionary headwords (only) within edit distance of `text`. */
function closeHeadwords(text: string, maxDistance?: number): Suggestion[] {
  const key = normalizeKey(text);
  if (toCodePoints(key).length < 2) return [];
  return suggest(key, 5, maxDistance).filter((x) => x.id !== undefined);
}

export function checkText(input: string): CheckResponse {
  const text = stripInvisible(input.normalize("NFC")).slice(0, MAX_TEXT);

  const raws: Raw[] = [];
  for (const seg of getSegmenter().segment(text)) raws.push(classify(seg));

  const tokens: CheckToken[] = [];
  for (let i = 0; i < raws.length; ) {
    if (raws[i].kind !== "word") {
      tokens.push({ text: raws[i].text, kind: raws[i].kind });
      i++;
      continue;
    }
    let j = i;
    while (j < raws.length && raws[j].kind === "word") j++;
    tokens.push(...resolveRun(raws.slice(i, j).map((r) => r.text)));
    i = j;
  }

  const summary: CheckSummary = { words: 0, dict: 0, sbbic: 0, compound: 0, unknown: 0 };
  for (const t of tokens) {
    if (t.kind !== "word" || !t.status) continue;
    summary.words++;
    summary[t.status]++;
  }

  return { tokens, summary };
}
