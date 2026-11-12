import "server-only";
import { excerpt } from "@/lib/dict/definition";
import { getDefinition, getStore } from "@/lib/dict/store";
import type { IssueSeverity, PhraseEvidence } from "@/lib/dict/types";
import type { Context } from "@/lib/grammar/context";
import { normalizeKey, toCodePoints } from "@/lib/khmer/normalize";
import { lookupKhmer } from "@/lib/khmerdict/store";
import { biCount, candidates, getPhraseStore, uniCount, type PhraseStore } from "./store";

/**
 * Phrase-context check: a word that exists in the dictionary but does not fit
 * the words around it.
 *
 * «ការបណ្ដុះបណ្ដា» passes a word-by-word check (ការ, បណ្ដុះ and បណ្ដា are all
 * headwords) yet the phrase is wrong: it needs បណ្ដាល. The spelling checker
 * cannot see that, so this pass looks at each word together with the word
 * before and the word after it, and asks two questions of every word that is
 * one letter away:
 *
 *   1. Does the neighbour + candidate form a word the lexicon knows as a unit
 *      (បណ្ដុះ + បណ្ដាល = បណ្ដុះបណ្ដាល, an SBBIC compound), while
 *      neighbour + written word does not?
 *   2. In the reference texts (dictionary definitions, example sentences and
 *      the ALT / khPOS sentence corpora), how often does each pair occur?
 *      បណ្ដុះ បណ្ដាល 57 times, បណ្ដុះ បណ្ដា 2 times.
 *
 * The comparison uses association strength (how much more often the pair
 * occurs than chance), so a rare but legitimate word is not penalised for
 * being rare: an unseen pair scores the same whichever word is in it, and the
 * gain comes only from pairs the texts actually contain. The check never
 * reports a word whose written pair is itself common.
 */

export const PHRASE_RULE = "phrase-context";

/** One-letter words are particles; the SBBIC rules cover those. */
const MIN_WORD_CP = 2;
/**
 * A two-letter word is one vowel swap from a dozen others (សុ/សា, ដី/បី), so
 * for those only a dropped letter counts (កា for ការ), and only when the
 * candidate is this many times more frequent than what was written, with a
 * known compound the texts confirm at least CONFIRMED times and never show as written.
 */
const SHORT_WORD_CP = 2;
const SHORT_WORD_RATIO = 10;
/** The most frequent words (ដែល, ជា, ការ, បាន …) are grammatical and never replaced by statistics. */
const MAX_WORD_COUNT = 4000;
/** Log-odds a candidate needs over the written word: with a known compound, and with pair counts only. */
const MIN_GAIN_LEXICON = Math.log(4);
const MIN_GAIN_CORPUS = Math.log(20);
/** A side "strongly" prefers the candidate when its pair is seen at least this often and 5× the written pair. */
const STRONG = 3;
/** The written pair may occur at most this fraction as often as the candidate's (corpora contain typos too). */
const WRITTEN_RATIO = 1 / 20;
/** Titles and place-name heads: the word after them is usually a name (ស្ទឹងស្រែង is a river), which no corpus can judge. */
const NAME_HEADS = new Set(
  ["លោក", "លោកស្រី", "អ្នកស្រី", "កញ្ញា", "អ្នកនាង", "ឯកឧត្តម", "សម្តេច", "ព្រះ", "ព្រះនាម", "ឈ្មោះ", "នាម", "ភូមិ", "ឃុំ", "ស្រុក", "ខេត្ត", "ក្រុង", "សង្កាត់", "ខណ្ឌ", "ស្ទឹង", "ទន្លេ", "បឹង", "ភ្នំ", "កោះ", "វត្ត", "ផ្លូវ"].map(normalizeKey),
);
/** A compound after a very frequent word still counts when the texts confirm it this often and never show the written pair. */
const CONFIRMED = 100;

type Side = { neighbour: string; written: number; candidate: number; compound?: "dictionary" | "sbbic" };

/**
 * How much more often `a b` occurs than chance would give (add-one smoothed
 * pointwise mutual information). An unseen pair scores about zero whatever the
 * words, so the comparison is driven by pairs the texts really contain.
 */
function assoc(s: PhraseStore, a: string, b: string): number {
  const expected = (uniCount(s, a) * uniCount(s, b)) / s.total;
  return Math.log((biCount(s, a, b) + 1) / (expected + 1));
}

/** `candidate` is `written` with one letter inserted somewhere (កា -> ការ). */
function isDroppedLetter(written: string, candidate: string): boolean {
  const c = [...candidate];
  if (c.length !== [...written].length + 1) return false;
  for (let i = 0; i < c.length; i++) if (c.slice(0, i).join("") + c.slice(i + 1).join("") === written) return true;
  return false;
}

function inLexicon(key: string): "dictionary" | "sbbic" | undefined {
  const st = getStore();
  if (st.byKey.has(key)) return "dictionary";
  if (st.sbbic.has(key)) return "sbbic";
  return undefined;
}

/** A short meaning and example for a phrase or word: khmerdict's split entry first, then the Chuon Nath text. */
function gloss(phrase: string): Pick<PhraseEvidence, "id" | "gloss" | "example"> {
  const key = normalizeKey(phrase);
  const id = getStore().byKey.get(key)?.[0];
  for (const e of lookupKhmer(phrase)) {
    if (!e.def) continue;
    const def = e.def.replace(/[​‌‍]/g, "").replace(/\s*:\s*$/, "").trim();
    return { id, gloss: def.length > 180 ? def.slice(0, 180).trimEnd() + "…" : def, example: e.ex?.replace(/[​‌‍]/g, "") };
  }
  const raw = id !== undefined ? getDefinition(id) : undefined;
  return { id, gloss: raw ? excerpt(raw, 180) : undefined };
}

export function checkPhraseContext(ctx: Context): void {
  const s = getPhraseStore();
  if (!s) return;
  const { atoms } = ctx;

  /** Whole tokens the lexicon knows as one unit (SBBIC compounds): their parts need no second opinion. */
  const insideCompound = (a: { start: number; end: number }) =>
    ctx.words.some((w) => w.status === "sbbic" && w.start <= a.start && a.end <= w.end && (w.start < a.start || a.end < w.end));
  /**
   * The word atom right before/after `i` in the same phrase, or -1. Spaces,
   * digits, punctuation and unknown words end a phrase; so does a neighbour
   * that belongs to a compound of its own (a part of កម្ពុជា, or ជា when the
   * text goes on ជាលំដាប់), since that word is already spoken for.
   */
  const neighbour = (i: number, dir: -1 | 1): number => {
    const j = dir < 0 ? ctx.prev(i) : ctx.next(i);
    if (j < 0 || atoms[j].kind !== "word" || atoms[j].unknown || !atoms[j].key) return -1;
    if (insideCompound(atoms[j])) return -1;
    const k = dir < 0 ? ctx.prev(j) : ctx.next(j);
    if (k >= 0 && atoms[k].kind === "word" && atoms[k].key && inLexicon(dir < 0 ? atoms[k].key + atoms[j].key : atoms[j].key + atoms[k].key)) return -1;
    return j;
  };
  /** Words this common (ជា, មាន, នៅ …) start so many compounds that one of them is no evidence by itself. */
  const specific = (key: string) => uniCount(s, key) < MAX_WORD_COUNT;

  for (let i = 0; i < atoms.length; i++) {
    const atom = atoms[i];
    if (atom.kind !== "word" || atom.unknown || !atom.key) continue;
    const w = atom.key;
    if (toCodePoints(w).length < MIN_WORD_CP || uniCount(s, w) >= MAX_WORD_COUNT || w.endsWith("ៗ")) continue;
    if (insideCompound(atom)) continue;
    const pi = neighbour(i, -1);
    const ni = neighbour(i, 1);
    if (pi < 0 && ni < 0) continue;
    const p = pi >= 0 ? atoms[pi].key : null;
    const n = ni >= 0 ? atoms[ni].key : null;
    if (p && NAME_HEADS.has(p)) continue;

    const short = toCodePoints(w).length <= SHORT_WORD_CP;
    let best: { c: string; gain: number; sides: Side[]; severity: IssueSeverity } | null = null;
    for (const c of candidates(s, w)) {
      if (!inLexicon(c)) continue;
      if (short && (!isDroppedLetter(w, c) || uniCount(s, c) < SHORT_WORD_RATIO * uniCount(s, w))) continue;
      // If the letters as written already contain the candidate (មករ+ហូត holds រហូត), the
      // text is right and only our word split differs: never "fix" that.
      if ((p && (p + w).includes(c)) || (n && (w + n).includes(c))) continue;
      const sides: Side[] = [];
      let gain = 0;
      if (p) {
        const side: Side = { neighbour: p, written: biCount(s, p, w), candidate: biCount(s, p, c) };
        if (!inLexicon(p + w) && (specific(p) || (side.candidate >= CONFIRMED && side.written === 0))) side.compound = inLexicon(p + c);
        gain += assoc(s, p, c) - assoc(s, p, w);
        sides.push(side);
      }
      if (n) {
        const side: Side = { neighbour: n, written: biCount(s, w, n), candidate: biCount(s, c, n) };
        if (!inLexicon(w + n) && (specific(n) || (side.candidate >= CONFIRMED && side.written === 0))) side.compound = inLexicon(c + n);
        gain += assoc(s, c, n) - assoc(s, w, n);
        sides.push(side);
      }
      const written = sides.reduce((t, x) => t + x.written, 0);
      const seen = sides.reduce((t, x) => t + x.candidate, 0);
      // The written pair must be rare next to the candidate's: a phrase the texts use as written is not an error.
      if (written > Math.max(2, seen * WRITTEN_RATIO)) continue;
      // No side may prefer the written word.
      if (sides.some((x) => x.written > x.candidate)) continue;
      const strong = sides.filter((x) => x.candidate >= STRONG && x.candidate >= 5 * x.written).length;
      const compound = sides.some((x) => x.compound);
      if (short && !sides.some((x) => x.compound && x.candidate >= CONFIRMED && x.written === 0)) continue;
      let severity: IssueSeverity;
      // A known compound is a lexicon fact: warning. Pair counts alone are statistics: a hint, and
      // only when the words on both sides agree.
      if (compound && gain >= MIN_GAIN_LEXICON) severity = "warning";
      else if (gain >= MIN_GAIN_CORPUS && sides.length === 2 && strong === 2) severity = "hint";
      else continue;
      if (!best || gain > best.gain) best = { c, gain, sides, severity };
    }
    if (!best) continue;

    // Describe the strongest piece of evidence as a phrase: a known compound first, else the pair seen most often.
    const side =
      best.sides.find((x) => x.compound) ??
      best.sides.reduce((a, b) => (b.candidate - b.written > a.candidate - a.written ? b : a));
    const left = side.neighbour === p && best.sides[0] === side;
    const phrase = left ? side.neighbour + best.c : best.c + side.neighbour;
    const writtenPhrase = left ? side.neighbour + w : w + side.neighbour;
    const kind = side.compound ?? "corpus";
    const evidence: PhraseEvidence = {
      phrase,
      written: writtenPhrase,
      kind,
      seen: side.candidate,
      seenWritten: side.written,
      ...gloss(kind === "corpus" ? best.c : phrase),
    };
    const where = kind === "corpus" ? `ពាក្យ «${best.c}»` : `ឃ្លា «${phrase}»`;
    const message =
      `ក្នុងឃ្លានេះ «${atom.text}» ទំនងជា «${best.c}»៖ ${where}${kind === "sbbic" ? " ជាពាក្យផ្សំដែលស្គាល់" : kind === "dictionary" ? " ជាពាក្យក្នុងវចនានុក្រម" : ""} ` +
      `ហើយ «${phrase}» ឃើញ ${side.candidate} ដងក្នុងអត្ថបទគំរូ ឯ «${writtenPhrase}» ឃើញ ${side.written} ដង។`;
    const messageEn =
      `In this phrase “${atom.text}” is probably “${best.c}”: ` +
      (kind === "corpus" ? "" : `“${phrase}” is a ${kind === "sbbic" ? "known compound" : "dictionary word"}, and `) +
      `“${phrase}” occurs ${side.candidate}× in the reference texts against ${side.written}× for “${writtenPhrase}”.`;
    ctx.report(PHRASE_RULE, i, i, [best.c], { severity: best.severity, message, messageEn, evidence });
  }
}
