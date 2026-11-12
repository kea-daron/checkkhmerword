#!/usr/bin/env node
/**
 * Build script: counts how Khmer words follow each other in real text, so the
 * checker can judge a word by its neighbours and not only by whether it exists.
 *
 * ការបណ្ដុះបណ្ដា is made of valid headwords (ការ, បណ្ដុះ, បណ្ដា), but in text
 * បណ្ដុះ is followed by បណ្ដាល and practically never by បណ្ដា. Word and
 * word-pair counts from the sources below make that visible.
 *
 *   Input
 *     data/generated/entries.json, sbbic.json     lexicon (words are split the way the checker splits them)
 *     data/generated/defs.json                    Chuon Nath definitions (always)
 *     data/generated/khmerdict/km.json            khmerdict's definitions + example sentences (if fetched)
 *     data/raw/corpus/*.txt                       sentence corpora from `npm run fetch:corpus` (if fetched)
 *
 *   Output (data/generated/phrases.json)
 *     { meta: { sources, sentences, tokens, builtAt, minBigram },
 *       uni: { word: count },        words seen at least once
 *       bi:  { "a b": count } }      adjacent pairs seen at least `minBigram` times
 *
 * Usage: node scripts/build-phrases.mjs [--min-bigram=N]
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { normalizeKey } from "../src/lib/khmer/normalize.ts";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "..");
const genDir = path.join(root, "data", "generated");
const corpusDir = path.join(root, "data", "raw", "corpus");

const minBigram = Number((process.argv.find((a) => a.startsWith("--min-bigram=")) ?? "=2").split("=")[1]) || 2;

const readJson = (f) => JSON.parse(fs.readFileSync(f, "utf8"));

// --------------------------------------------------------------------------
// Lexicon and segmentation (mirrors src/lib/dict/check.ts)
// --------------------------------------------------------------------------

const dict = new Set();
for (const e of readJson(path.join(genDir, "entries.json"))) {
  const k = normalizeKey(e.word);
  if (k) dict.add(k);
}
const sbbic = new Set();
for (const w of readJson(path.join(genDir, "sbbic.json"))) {
  const k = normalizeKey(w);
  if (k && !dict.has(k)) sbbic.add(k);
}

const MAX_PART_LENGTH = 14;
const MAX_DP_LENGTH = 60;
const isIndependentVowel = (cp) => cp >= 0x17a3 && cp <= 0x17b3;

function lookup(key) {
  if (dict.has(key)) return "dict";
  if (sbbic.has(key)) return "sbbic";
  if (key.length > 1 && key.endsWith("ៗ")) return lookup(key.slice(0, -1));
  return null;
}

function partCost(status, len) {
  if (status === "dict") return len <= 2 ? 1.15 : 1;
  if (status === "sbbic") return len <= 2 ? 2.6 : 2.2;
  return 3;
}

/** Cheapest cover of `key` with known words (same costs as the checker). */
function dpCover(key, allowSbbic) {
  const cps = [...key];
  const n = cps.length;
  if (n === 0 || n > MAX_DP_LENGTH) return null;
  const best = new Array(n + 1).fill(null);
  best[0] = { cost: 0, from: 0, part: "" };
  for (let i = 1; i <= n; i++) {
    for (let j = Math.max(0, i - MAX_PART_LENGTH); j < i; j++) {
      const prev = best[j];
      if (!prev) continue;
      const len = i - j;
      if (len < 2 && !isIndependentVowel(cps[j].codePointAt(0))) continue;
      const chunk = cps.slice(j, i).join("");
      const status = lookup(chunk);
      if (!status || (status === "sbbic" && !allowSbbic)) continue;
      const total = prev.cost + partCost(status, len);
      if (!best[i] || total < best[i].cost) best[i] = { cost: total, from: j, part: chunk };
    }
  }
  if (!best[n]) return null;
  const parts = [];
  for (let i = n; i > 0; i = best[i].from) parts.unshift(best[i].part);
  return parts;
}

/**
 * The atoms the checker would see for one word: a headword stays whole, an
 * SBBIC compound becomes its headword parts (បណ្ដុះបណ្ដាល -> បណ្ដុះ បណ្ដាល),
 * anything else is covered with known words. `null` marks an unknown word.
 */
const atomCache = new Map();
function atomize(key) {
  if (atomCache.has(key)) return atomCache.get(key);
  let out;
  if (dict.has(key)) out = [key];
  else if (key.length > 1 && key.endsWith("ៗ") && lookup(key.slice(0, -1))) out = atomize(key.slice(0, -1)); // សាមញ្ញៗ counts as សាមញ្ញ
  else if (sbbic.has(key)) {
    const cover = dpCover(key, false);
    out = cover && cover.length >= 2 && cover.length <= 4 ? cover : [key];
  } else {
    const cover = dpCover(key, true);
    out = cover ? cover.flatMap((p) => (p === key || dict.has(p) ? [p] : atomize(p) ?? [p])) : null;
  }
  atomCache.set(key, out);
  return out;
}

const KHMER_RUN = /[ក-៝​‌‍]+/g;
const WORD_CHAR = /^[ក-៝]+$/;
let segmenter = null;

/** Words of an unsegmented Khmer run: ICU pieces, merged (up to 3) when the lexicon knows the whole. */
function segmentRun(run) {
  segmenter ??= new Intl.Segmenter("km", { granularity: "word" });
  const pieces = [];
  for (const s of segmenter.segment(run)) {
    const k = normalizeKey(s.segment);
    if (k && WORD_CHAR.test(k)) pieces.push(k);
    else if (s.segment.trim()) pieces.push(null); // a sign on its own: breaks the chain
  }
  const words = [];
  for (let i = 0; i < pieces.length; ) {
    if (pieces[i] === null) {
      words.push(null);
      i++;
      continue;
    }
    let took = 1;
    for (let k = Math.min(3, pieces.length - i); k >= 2; k--) {
      const slice = pieces.slice(i, i + k);
      if (slice.includes(null)) continue;
      if (lookup(slice.join(""))) {
        took = k;
        break;
      }
    }
    words.push(pieces.slice(i, i + took).join(""));
    i += took;
  }
  return words;
}

// --------------------------------------------------------------------------
// Counting
// --------------------------------------------------------------------------

const uni = new Map();
const bi = new Map();
const stats = { sentences: 0, tokens: 0 };
const bump = (m, k) => m.set(k, (m.get(k) ?? 0) + 1);

/** Count one sentence given as human-segmented words (null = unknown / break). */
function countWords(words) {
  const atoms = [];
  for (const w of words) {
    const a = w === null ? null : atomize(w);
    if (a === null) atoms.push(null);
    else atoms.push(...a);
  }
  if (!atoms.some(Boolean)) return;
  stats.sentences++;
  let prev = null;
  for (const a of atoms) {
    if (a === null) {
      prev = null;
      continue;
    }
    stats.tokens++;
    bump(uni, a);
    if (prev !== null) bump(bi, `${prev} ${a}`);
    prev = a;
  }
}

const SENTENCE_END = /[។៕?!\n:;]/;

/**
 * Count free text. Khmer runs are split on zero-width spaces (how the
 * dictionaries mark word breaks); a piece the lexicon does not know as one
 * word is segmented with ICU. Sentence punctuation ends a chain.
 */
function countText(text) {
  for (const sentence of text.split(SENTENCE_END)) {
    const words = [];
    const runs = sentence.match(KHMER_RUN) ?? [];
    let last = 0;
    for (const run of runs) {
      const at = sentence.indexOf(run, last);
      // Anything but whitespace between two runs (digits, Latin, commas) breaks the chain.
      if (words.length && sentence.slice(last, at).trim()) words.push(null);
      last = at + run.length;
      for (const piece of run.split(/[​‌‍]+/)) {
        const k = normalizeKey(piece);
        if (!k) continue;
        if (lookup(k)) words.push(k);
        else words.push(...segmentRun(k));
      }
    }
    if (words.length) countWords(words);
  }
}

const sources = [];
function source(name, license, fn) {
  const before = { ...stats };
  fn();
  const s = { name, license, sentences: stats.sentences - before.sentences, tokens: stats.tokens - before.tokens };
  sources.push(s);
  console.log(`  ${name.padEnd(28)} ${s.sentences.toLocaleString().padStart(9)} sentences ${s.tokens.toLocaleString().padStart(11)} words`);
}

const LINK_RE = /<"(\d+)">([^<]*?)\/a/g;

source("Chuon Nath definitions", "LGPL-2.1 (SPICE / Open Institute)", () => {
  const defs = readJson(path.join(genDir, "defs.json"));
  for (const raw of Object.values(defs)) countText(raw.replace(LINK_RE, "$2"));
});

const kmFile = path.join(genDir, "khmerdict", "km.json");
if (fs.existsSync(kmFile)) {
  source("khmerdict.com entries", "khmerdict.com (no stated license)", () => {
    for (const e of readJson(kmFile)) {
      if (e.def) countText(e.def);
      if (e.ex) countText(e.ex);
    }
  });
} else console.log("  (khmerdict data not fetched: skipping its definitions and examples)");

if (fs.existsSync(corpusDir)) {
  const names = { "alt-km.txt": ["Asian Language Treebank (km)", "CC BY-NC-SA 4.0"], "khpos.txt": ["khPOS", "CC BY-NC-SA 4.0"] };
  for (const file of fs.readdirSync(corpusDir).filter((f) => f.endsWith(".txt") && f !== "LICENSE.txt").sort()) {
    const [name, license] = names[file] ?? [file, "see data/raw/corpus"];
    source(name, license, () => {
      for (const line of fs.readFileSync(path.join(corpusDir, file), "utf8").split("\n")) {
        if (!line.trim()) continue;
        const words = [];
        for (const tok of line.split(/\s+/)) {
          const k = normalizeKey(tok);
          if (!k) continue;
          if (!WORD_CHAR.test(k)) {
            words.push(null); // digits, Latin, punctuation
            continue;
          }
          if (lookup(k)) words.push(k);
          else words.push(...segmentRun(k));
        }
        countWords(words);
      }
    });
  }
} else console.log("  (no data/raw/corpus: run `npm run fetch:corpus` for sentence corpora)");

// --------------------------------------------------------------------------
// Write
// --------------------------------------------------------------------------

const uniOut = {};
for (const [w, c] of [...uni].sort((a, b) => b[1] - a[1])) uniOut[w] = c;
const biOut = {};
let kept = 0;
for (const [k, c] of [...bi].sort((a, b) => b[1] - a[1])) {
  if (c < minBigram) break;
  biOut[k] = c;
  kept++;
}
const meta = { sources, sentences: stats.sentences, tokens: stats.tokens, words: uni.size, bigrams: kept, minBigram, builtAt: new Date().toISOString() };
const out = path.join(genDir, "phrases.json");
fs.writeFileSync(out, JSON.stringify({ meta, uni: uniOut, bi: biOut }));
console.log(
  `Words: ${uni.size.toLocaleString()}, pairs: ${bi.size.toLocaleString()} (kept ${kept.toLocaleString()} with count ≥ ${minBigram})\n` +
    `  wrote phrases.json ${(fs.statSync(out).size / 1024).toFixed(0)} KB`,
);
