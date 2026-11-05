import "server-only";
import fs from "node:fs";
import path from "node:path";
import {
  firstLetter,
  khmerCollator,
  normalizeKey,
} from "@/lib/khmer/normalize";
import type { Entry, LetterInfo } from "./types";

export type Meta = {
  entries: number;
  maxId: number;
  sbbic: number;
  ipa: number;
  builtAt: string;
  source: string;
  license: string;
};

export type Store = {
  meta: Meta;
  entries: Entry[];
  byId: Map<number, Entry>;
  /** normalized key -> entry ids (several entries can share a headword) */
  byKey: Map<string, number[]>;
  /** entry id -> normalized key */
  keyOf: Map<number, string>;
  /** all unique normalized keys, sorted by code unit (for prefix ranges) */
  sortedKeys: string[];
  /** SBBIC words that are not dictionary headwords (normalized) */
  sbbic: Set<string>;
  /** normalized key -> IPA transcriptions */
  ipa: Map<string, string[]>;
  letters: LetterInfo[];
  byLetter: Map<string, number[]>;
};

const DATA_DIR = path.join(process.cwd(), "data", "generated");

function readJson<T>(name: string): T {
  return JSON.parse(fs.readFileSync(path.join(DATA_DIR, name), "utf8")) as T;
}

let store: Store | null = null;
let defs: Record<string, string> | null = null;

function build(): Store {
  const meta = readJson<Meta>("meta.json");
  const entries = readJson<Entry[]>("entries.json");
  const sbbicList = readJson<string[]>("sbbic.json");
  const ipaRaw = readJson<Record<string, string[]>>("ipa.json");

  const byId = new Map<number, Entry>();
  const byKey = new Map<string, number[]>();
  const keyOf = new Map<number, string>();
  const byLetter = new Map<string, number[]>();

  for (const e of entries) {
    byId.set(e.id, e);
    const key = normalizeKey(e.word);
    keyOf.set(e.id, key);
    const ids = byKey.get(key);
    if (ids) ids.push(e.id);
    else byKey.set(key, [e.id]);
    const letter = firstLetter(e.word) ?? "#";
    const l = byLetter.get(letter);
    if (l) l.push(e.id);
    else byLetter.set(letter, [e.id]);
  }

  const collator = khmerCollator();
  for (const ids of byLetter.values()) {
    ids.sort((a, b) => collator.compare(byId.get(a)!.word, byId.get(b)!.word));
  }

  const sortedKeys = [...byKey.keys()].sort();

  const sbbic = new Set<string>();
  for (const w of sbbicList) {
    const k = normalizeKey(w);
    if (k && !byKey.has(k)) sbbic.add(k);
  }

  const ipa = new Map<string, string[]>();
  for (const [w, prons] of Object.entries(ipaRaw)) {
    const k = normalizeKey(w);
    const list = ipa.get(k);
    if (list) for (const p of prons) if (!list.includes(p)) list.push(p);
    else ipa.set(k, [...prons]);
  }

  const letters: LetterInfo[] = [...byLetter.entries()]
    .map(([letter, ids]) => ({ letter, count: ids.length }))
    .sort((a, b) => {
      if (a.letter === "#") return 1;
      if (b.letter === "#") return -1;
      return a.letter.codePointAt(0)! - b.letter.codePointAt(0)!;
    });

  return {
    meta,
    entries,
    byId,
    byKey,
    keyOf,
    sortedKeys,
    sbbic,
    ipa,
    letters,
    byLetter,
  };
}

export function getStore(): Store {
  return (store ??= build());
}

export function getDefinition(id: number): string | undefined {
  defs ??= readJson<Record<string, string>>("defs.json");
  return defs[String(id)];
}

export function getEntry(id: number): Entry | undefined {
  return getStore().byId.get(id);
}

export function getIpa(word: string): string[] {
  return getStore().ipa.get(normalizeKey(word)) ?? [];
}

/** Other entries sharing the same normalized headword. */
export function getHomographs(id: number): Entry[] {
  const s = getStore();
  const key = s.keyOf.get(id);
  if (!key) return [];
  return (s.byKey.get(key) ?? [])
    .filter((other) => other !== id)
    .map((other) => s.byId.get(other)!)
    .filter(Boolean);
}

/** Previous / next entries in dictionary (id) order. */
export function getNeighbours(id: number): { prev?: Entry; next?: Entry } {
  const s = getStore();
  const idx = binarySearchId(s.entries, id);
  if (idx < 0) return {};
  return { prev: s.entries[idx - 1], next: s.entries[idx + 1] };
}

function binarySearchId(entries: Entry[], id: number): number {
  let lo = 0;
  let hi = entries.length - 1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    const v = entries[mid].id;
    if (v === id) return mid;
    if (v < id) lo = mid + 1;
    else hi = mid - 1;
  }
  return -1;
}

export function getLetters(): LetterInfo[] {
  return getStore().letters;
}

export function getEntriesByLetter(letter: string): Entry[] {
  const s = getStore();
  return (s.byLetter.get(letter) ?? []).map((id) => s.byId.get(id)!);
}

/** Today's word (UTC day). Call only from a cached scope. */
export function getTodayEntry(): Entry {
  const day = Math.floor(Date.now() / 86_400_000);
  return getEntryForDay(day * 7919);
}

/** Deterministic "word of the day" based on a day index. */
export function getEntryForDay(dayIndex: number): Entry {
  const s = getStore();
  // Prefer entries with a part of speech and a reasonably long definition.
  const pool = s.entries.filter((e) => e.pos && e.word.length >= 2 && e.word.length <= 8);
  return pool[((dayIndex % pool.length) + pool.length) % pool.length];
}
