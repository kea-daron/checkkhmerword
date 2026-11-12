import "server-only";
import fs from "node:fs";
import path from "node:path";
import { normalizeKey } from "@/lib/khmer/normalize";

/**
 * In-memory indexes over the khmerdict.com data in data/generated/khmerdict/.
 * The files are optional: everything here degrades to "not available" when
 * `npm run fetch:khmerdict` has not been run, and the rest of the app keeps
 * working from the SPICE data alone.
 */

export type KdMeta = {
  en: number;
  km: number;
  corr: number;
  zip: string;
  fetchedAt: string;
  source: string;
};

/** Record shapes written by scripts/fetch-khmerdict.mjs. */
export type EnRecord = { w: string; def: string; pos?: string; notes?: string; ex?: string };
export type KmRecord = {
  id: number;
  word: string;
  head: string;
  level: 1 | 2;
  sub?: string;
  pron?: string;
  pos?: string;
  def: string;
  ex?: string;
  src?: string;
  rem?: string;
  notes?: string;
};

type EnStore = {
  entries: EnRecord[];
  /** `entries[i].w.toLowerCase()`, in the same (sorted) order. */
  lower: string[];
};

type KmStore = {
  entries: KmRecord[];
  byId: Map<number, KmRecord>;
  /** normalized word -> indexes into `entries` */
  byKey: Map<string, number[]>;
  sortedKeys: string[];
};

const DATA_DIR = path.join(process.cwd(), "data", "generated", "khmerdict");
const file = (name: string) => path.join(DATA_DIR, name);

function readJson<T>(name: string): T {
  return JSON.parse(fs.readFileSync(file(name), "utf8")) as T;
}

let available: boolean | null = null;
let meta: KdMeta | null = null;
let en: EnStore | null = null;
let km: KmStore | null = null;
let corrections: Map<string, string> | null = null;

/** True once the data files exist. A negative answer is re-checked on each call so a later fetch is picked up in dev. */
export function isKhmerDictAvailable(): boolean {
  if (available) return true;
  available = ["meta.json", "en.json", "km.json"].every((n) => fs.existsSync(file(n)));
  return available;
}

export function getKhmerDictMeta(): KdMeta | null {
  if (!isKhmerDictAvailable()) return null;
  return (meta ??= readJson<KdMeta>("meta.json"));
}

export function getEnglishStore(): EnStore {
  if (en) return en;
  const entries = readJson<EnRecord[]>("en.json");
  const lower = entries.map((e) => e.w.toLowerCase());
  return (en = { entries, lower });
}

export function getKhmerStore(): KmStore {
  if (km) return km;
  const entries = readJson<KmRecord[]>("km.json");
  const byId = new Map<number, KmRecord>();
  const byKey = new Map<string, number[]>();
  entries.forEach((e, i) => {
    byId.set(e.id, e);
    const key = normalizeKey(e.word);
    const list = byKey.get(key);
    if (list) list.push(i);
    else byKey.set(key, [i]);
  });
  const sortedKeys = [...byKey.keys()].sort();
  return (km = { entries, byId, byKey, sortedKeys });
}

/** Khmer entries whose headword (or sub-entry word) normalizes to `word`'s key. Main entries first. */
export function lookupKhmer(word: string): KmRecord[] {
  if (!isKhmerDictAvailable()) return [];
  const s = getKhmerStore();
  const idx = s.byKey.get(normalizeKey(word)) ?? [];
  return idx.map((i) => s.entries[i]).sort((a, b) => a.level - b.level || a.id - b.id);
}

/**
 * khmerdict.com's "common corrections": what users typed, and the entry they
 * then opened (typo -> spelling). Keys are normalized like the app's indexes.
 */
export function getCorrections(): Map<string, string> {
  if (corrections) return corrections;
  corrections = new Map();
  if (!isKhmerDictAvailable() || !fs.existsSync(file("assist.json"))) return corrections;
  const { corr } = readJson<{ corr: Record<string, string> }>("assist.json");
  for (const [typo, fix] of Object.entries(corr)) {
    const k = normalizeKey(typo);
    if (k && k !== normalizeKey(fix)) corrections.set(k, fix);
  }
  return corrections;
}
