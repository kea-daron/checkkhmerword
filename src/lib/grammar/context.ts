import "server-only";
import { getStore } from "@/lib/dict/store";
import type { CheckToken, GrammarIssue, IssueSeverity, PhraseEvidence } from "@/lib/dict/types";
import { normalizeKey, toCodePoints } from "@/lib/khmer/normalize";
import { ruleInfo } from "./catalog";

/**
 * The unit the grammar rules look at. Tokens from the checker are flattened:
 * a token with known parts becomes one atom per part, invisible separators
 * (zero-width spaces) become `zw` atoms so rules can match across them, and
 * digits become `num` atoms.
 */
export type Atom = {
  text: string;
  /** `normalizeKey(text)` for word atoms, "" otherwise. */
  key: string;
  start: number;
  end: number;
  kind: "word" | "num" | "space" | "zw" | "punct" | "other";
  /** Dictionary entry ids when the atom is a headword. */
  ids?: number[];
  unknown?: boolean;
};

export type Sentence = {
  /** First atom index. */
  from: number;
  /** One past the last atom index (the terminal, if any, is at `to - 1`). */
  to: number;
  /** Index of the ។ ៕ ? ! atom that closes the sentence, if there is one. */
  terminal?: number;
};

const TERMINAL = /[។៕?!]/;
const ZW_ONLY = /^[​‌‍﻿]+$/;
const DIGITS = /^[0-9០-៩]+$/;

export function buildAtoms(tokens: CheckToken[]): Atom[] {
  const atoms: Atom[] = [];
  let pos = 0;
  for (const t of tokens) {
    const start = pos;
    pos += t.text.length;
    if (t.kind === "space") {
      atoms.push({ text: t.text, key: "", start, end: pos, kind: ZW_ONLY.test(t.text) ? "zw" : "space" });
    } else if (t.kind === "punct") {
      atoms.push({ text: t.text, key: "", start, end: pos, kind: "punct" });
    } else if (t.kind === "other") {
      atoms.push({ text: t.text, key: DIGITS.test(t.text) ? t.text : "", start, end: pos, kind: DIGITS.test(t.text) ? "num" : "other" });
    } else if (t.parts) {
      // Compound tokens, and SBBIC phrases such as មិនទៅ or ឬទេ, are matched word by word.
      let p = start;
      for (const part of t.parts) {
        const e = p + part.text.length;
        atoms.push({ text: part.text, key: normalizeKey(part.text), start: p, end: e, kind: "word", ids: part.ids });
        p = e;
      }
    } else {
      atoms.push({ text: t.text, key: normalizeKey(t.text), start, end: pos, kind: "word", ids: t.ids, unknown: t.status === "unknown" });
    }
  }
  return atoms;
}

export function splitSentences(atoms: Atom[]): Sentence[] {
  const out: Sentence[] = [];
  let from = 0;
  for (let i = 0; i < atoms.length; i++) {
    const a = atoms[i];
    if (a.kind === "punct" && TERMINAL.test(a.text)) {
      out.push({ from, to: i + 1, terminal: i });
      from = i + 1;
    } else if (a.kind === "space" && a.text.includes("\n")) {
      if (i > from) out.push({ from, to: i });
      from = i + 1;
    }
  }
  if (from < atoms.length) out.push({ from, to: atoms.length });
  return out;
}

const SEVERITY_RANK: Record<IssueSeverity, number> = { error: 0, warning: 1, hint: 2 };

export type IssueOptions = {
  severity?: IssueSeverity;
  message?: string;
  messageEn?: string;
  evidence?: PhraseEvidence;
};

/** A whole word token as the checker delivered it, before splitting into atoms. */
export type WordSpan = { text: string; key: string; start: number; end: number; status: CheckToken["status"] };

export class Context {
  readonly atoms: Atom[];
  readonly sentences: Sentence[];
  /** Word tokens with their offsets (a phrase token like សំរាប់ is one span even when its atoms are សំ + រាប់). */
  readonly words: WordSpan[] = [];
  readonly issues: GrammarIssue[] = [];

  constructor(
    readonly text: string,
    tokens: CheckToken[],
  ) {
    this.atoms = buildAtoms(tokens);
    this.sentences = splitSentences(this.atoms);
    let pos = 0;
    for (const t of tokens) {
      if (t.kind === "word") this.words.push({ text: t.text, key: normalizeKey(t.text), start: pos, end: pos + t.text.length, status: t.status });
      pos += t.text.length;
    }
  }

  // ---- navigation -------------------------------------------------------

  /** Index of the next word/num atom after `i`, skipping invisible separators (and spaces when `acrossSpace`). */
  next(i: number, acrossSpace = false): number {
    for (let j = i + 1; j < this.atoms.length; j++) {
      const k = this.atoms[j].kind;
      if (k === "zw" || (acrossSpace && k === "space")) continue;
      return k === "word" || k === "num" ? j : -1;
    }
    return -1;
  }

  prev(i: number, acrossSpace = false): number {
    for (let j = i - 1; j >= 0; j--) {
      const k = this.atoms[j].kind;
      if (k === "zw" || (acrossSpace && k === "space")) continue;
      return k === "word" || k === "num" ? j : -1;
    }
    return -1;
  }

  /** The atom right after `i` that is not invisible, whatever its kind (or null at the end). */
  after(i: number): Atom | null {
    for (let j = i + 1; j < this.atoms.length; j++) if (this.atoms[j].kind !== "zw") return this.atoms[j];
    return null;
  }

  isWord(i: number): boolean {
    return i >= 0 && this.atoms[i].kind === "word";
  }

  keyAt(i: number): string {
    return i >= 0 && i < this.atoms.length ? this.atoms[i].key : "";
  }

  /**
   * Match `literal` starting at word atom `i`, joining following word atoms
   * (across invisible separators only). Returns the index of the last atom
   * consumed, or -1. A literal may be one headword or several.
   */
  literalAt(i: number, literal: string): number {
    const want = normalizeKey(literal);
    if (!want || !this.isWord(i)) return -1;
    let joined = "";
    let j = i;
    while (j >= 0 && j < this.atoms.length) {
      joined += this.atoms[j].key;
      if (joined === want) return j;
      if (!want.startsWith(joined)) return -1;
      j = this.next(j);
    }
    return -1;
  }

  /** Every occurrence of `literal` as [first atom, last atom]. */
  findLiteral(literal: string): [number, number][] {
    const out: [number, number][] = [];
    for (let i = 0; i < this.atoms.length; i++) {
      if (this.atoms[i].kind !== "word") continue;
      const end = this.literalAt(i, literal);
      if (end >= 0) {
        out.push([i, end]);
        i = end;
      }
    }
    return out;
  }

  /** Try each literal at `i`; returns [last atom, literal] for the longest match. */
  anyLiteralAt(i: number, literals: readonly string[]): [number, string] | null {
    let best: [number, string] | null = null;
    for (const lit of literals) {
      const end = this.literalAt(i, lit);
      if (end >= 0 && (!best || end > best[0])) best = [end, lit];
    }
    return best;
  }

  sentenceOf(i: number): Sentence | undefined {
    return this.sentences.find((s) => i >= s.from && i < s.to);
  }

  /** Word atoms of a sentence (or any atom range), in order. */
  wordsIn(from: number, to: number): number[] {
    const out: number[] = [];
    for (let i = from; i < to; i++) if (this.atoms[i].kind === "word" || this.atoms[i].kind === "num") out.push(i);
    return out;
  }

  // ---- dictionary --------------------------------------------------------

  /** Part-of-speech labels of the headwords behind atom `i` (empty when unknown or unlabelled). */
  pos(i: number): string[] {
    const ids = this.atoms[i]?.ids;
    if (!ids) return [];
    const s = getStore();
    const out: string[] = [];
    for (const id of ids) {
      const p = s.byId.get(id)?.pos;
      if (!p) return []; // one unlabelled homograph: we cannot tell
      out.push(p.replace(/\s+/g, " ").trim());
    }
    return out;
  }

  /** Every sense of the word is a plain noun (ន.) and none is a verb or particle. */
  isNounOnly(i: number): boolean {
    const pos = this.pos(i);
    return pos.length > 0 && pos.every((p) => p.startsWith("ន.") && !/កិ\.|និ\.|គុ\./.test(p));
  }

  isHeadword(key: string): boolean {
    return getStore().byKey.has(key);
  }

  // ---- reporting ---------------------------------------------------------

  /** Report a match of `rule` covering atoms `from..to` (inclusive). */
  report(rule: string, from: number, to: number, suggestions: string[], opts: IssueOptions = {}): void {
    this.reportRange(rule, this.atoms[from].start, this.atoms[to].end, suggestions, opts);
  }

  reportRange(rule: string, start: number, end: number, suggestions: string[], opts: IssueOptions = {}): void {
    const info = ruleInfo(rule);
    if (!info) throw new Error(`Unknown grammar rule: ${rule}`);
    const text = this.text.slice(start, end);
    const uniq = [...new Set(suggestions.filter((s) => s !== text))];
    this.issues.push({
      rule,
      type: info.type,
      severity: opts.severity ?? info.severity,
      start,
      end,
      text,
      suggestions: uniq,
      message: opts.message ?? info.name,
      messageEn: opts.messageEn ?? info.nameEn,
      ...(opts.evidence ? { evidence: opts.evidence } : {}),
    });
  }

  /**
   * Issues sorted by position with overlaps resolved: the more severe (then
   * the earlier) one wins. Issues inside misspelt words are dropped, since the
   * spelling checker already marks those.
   */
  finalize(): GrammarIssue[] {
    const unknown = this.atoms.filter((a) => a.unknown);
    const ranked = [...this.issues].sort(
      (a, b) => SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity] || a.start - b.start || a.end - b.end,
    );
    const kept: GrammarIssue[] = [];
    for (const it of ranked) {
      if (it.rule !== "variant-spelling" && unknown.some((u) => it.start < u.end && u.start < it.end)) continue;
      if (kept.some((k) => it.start < k.end && k.start < it.end)) continue;
      kept.push(it);
    }
    return kept.sort((a, b) => a.start - b.start);
  }
}

export const cpLength = (s: string) => toCodePoints(s).length;
