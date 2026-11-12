#!/usr/bin/env node
/**
 * Fetch script: imports the dictionary data that https://khmerdict.com ships
 * to its own web app and converts it into compact JSON for this project.
 *
 * khmerdict.com has no HTTP API. The site is an offline-first single-page app:
 * the browser downloads one zip (/assets/dict-<hash>.zip) and searches it in a
 * web worker. This script finds that zip from the homepage HTML, downloads it,
 * and unpacks the three files inside:
 *
 *     db.json      Khmer → Khmer (Chuon Nath, 41,075 entries incl. sub-entries;
 *                  separate pronunciation / example / etymology fields)
 *     en.json      English → Khmer (54,879 entries)
 *     assist.json  typing aids derived from site usage: popular words,
 *                  common corrections, confusion weights, prefix suggestions
 *
 *   Input  (data/raw/khmerdict/, downloaded if missing):
 *     dict-<hash>.zip
 *
 *   Output (data/generated/khmerdict/):
 *     en.json      [{ w, def, pos?, notes?, ex? }]          sorted by w (lowercase)
 *     km.json      [{ id, word, head, level, sub?, pron?, pos?, def, ex?, src?, rem?, notes? }]
 *     assist.json  { corr: { typo: fix } }
 *     meta.json    { en, km, corr, zip, fetchedAt, source }
 *
 * Usage: node scripts/fetch-khmerdict.mjs [--force]
 *
 * The data is © its respective owners (the Chuon Nath text is the Buddhist
 * Institute's 1967 dictionary; the English–Khmer list and the typing aids are
 * published by khmerdict.com without a stated license). Check with the site
 * before redistributing it.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { unzip } from "./lib/zip.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "..");
const rawDir = path.join(root, "data", "raw", "khmerdict");
const outDir = path.join(root, "data", "generated", "khmerdict");

const SITE = "https://khmerdict.com/";
const UA = "KhmerWord data fetch (+https://github.com/kea-daron)";
const force = process.argv.includes("--force");

async function discoverZipUrl() {
  const res = await fetch(SITE, { headers: { "user-agent": UA } });
  if (!res.ok) throw new Error(`Failed to load ${SITE}: ${res.status}`);
  const html = await res.text();
  const m = html.match(/href="(\/assets\/dict-[^"]+\.zip)"/);
  if (!m) throw new Error("Could not find the dictionary zip link on the homepage; the site layout may have changed.");
  return new URL(m[1], SITE).toString();
}

async function ensureZip() {
  fs.mkdirSync(rawDir, { recursive: true });
  const url = await discoverZipUrl();
  const name = path.basename(new URL(url).pathname);
  const target = path.join(rawDir, name);
  if (!force && fs.existsSync(target) && fs.statSync(target).size > 0) {
    console.log(`Using cached ${path.relative(root, target)}`);
    return { file: target, url, name };
  }
  process.stdout.write(`Downloading ${url} ... `);
  const res = await fetch(url, { headers: { "user-agent": UA } });
  if (!res.ok) throw new Error(`Failed to download ${url}: ${res.status}`);
  fs.writeFileSync(target, Buffer.from(await res.arrayBuffer()));
  console.log(`done (${(fs.statSync(target).size / 1024 / 1024).toFixed(1)} MB)`);
  return { file: target, url, name };
}


const clean = (s) => (typeof s === "string" ? s.replace(/\s+/g, " ").trim() : "");
const put = (obj, key, value) => {
  const v = clean(value);
  if (v) obj[key] = v;
};

function convertEnglish(list) {
  const out = [];
  for (const e of list) {
    const w = clean(e.main);
    const def = clean(e.definition);
    if (!w || !def) continue;
    const rec = { w, def };
    put(rec, "pos", e.part_of_speech);
    put(rec, "notes", e.notes);
    put(rec, "ex", e.example);
    out.push(rec);
  }
  out.sort((a, b) => {
    const la = a.w.toLowerCase();
    const lb = b.w.toLowerCase();
    return la < lb ? -1 : la > lb ? 1 : a.w < b.w ? -1 : a.w > b.w ? 1 : 0;
  });
  return out;
}

function convertKhmer(list) {
  const out = [];
  for (const e of list) {
    const head = clean(e.main);
    const word = clean(e.subword) || head;
    const def = clean(e.definition);
    if (!Number.isInteger(e.id) || !word || !def) continue;
    const rec = { id: e.id, word, head, level: e.level === 2 ? 2 : 1 };
    put(rec, "sub", e.subscript);
    put(rec, "pron", e.pronunciation);
    put(rec, "pos", e.part_of_speech);
    rec.def = def;
    put(rec, "ex", e.example);
    put(rec, "src", e.source);
    put(rec, "rem", e.remark);
    put(rec, "notes", e.notes);
    out.push(rec);
  }
  out.sort((a, b) => a.id - b.id);
  return out;
}

function convertAssist(a) {
  const corr = {};
  for (const [typo, fix] of Object.entries(a?.corr ?? {})) {
    const t = clean(typo);
    const f = clean(fix);
    if (t && f && t !== f) corr[t] = f;
  }
  return { corr };
}

async function main() {
  const { file, url, name } = await ensureZip();
  const files = unzip(fs.readFileSync(file));
  const read = (n) => {
    const b = files.get(n);
    if (!b) throw new Error(`${n} missing from ${name}; archive has: ${[...files.keys()].join(", ")}`);
    return JSON.parse(b.toString("utf8"));
  };

  const en = convertEnglish(read("en.json"));
  const km = convertKhmer(read("db.json"));
  const assist = convertAssist(files.has("assist.json") ? read("assist.json") : null);

  fs.mkdirSync(outDir, { recursive: true });
  const write = (n, data) => {
    const f = path.join(outDir, n);
    fs.writeFileSync(f, JSON.stringify(data));
    console.log(`  wrote khmerdict/${n.padEnd(12)} ${(fs.statSync(f).size / 1024).toFixed(0).padStart(7)} KB`);
  };
  const meta = {
    en: en.length,
    km: km.length,
    corr: Object.keys(assist.corr).length,
    zip: url,
    fetchedAt: new Date().toISOString(),
    source: SITE,
  };
  console.log(`English→Khmer: ${en.length}, Khmer entries: ${km.length}, corrections: ${meta.corr}`);
  write("en.json", en);
  write("km.json", km);
  write("assist.json", assist);
  write("meta.json", meta);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
