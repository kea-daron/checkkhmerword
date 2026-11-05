#!/usr/bin/env node
/**
 * Build script: converts the raw SPICE / Open Institute Chuon Nath dictionary
 * data into compact JSON files consumed by the app.
 *
 *   Input  (data/raw/, downloaded from interscript/khmer-dict-spice if missing):
 *     kh_dictionary.csv   _id,word,definition  (17,328 entries)
 *     SBBICkm_KH.txt      SBBIC Khmer word list (spell-check lexicon)
 *     ipa_dic.txt         word<TAB>/ipa/
 *
 *   Output (data/generated/):
 *     entries.json   [{ id, word, pos }]
 *     defs.json      { [id]: definition }   (link markup kept: <"id">text/a)
 *     sbbic.json     [word, ...]           (words NOT already in the dictionary)
 *     ipa.json       { [word]: [ipa, ...] }
 *     meta.json      { entries, sbbic, ipa, builtAt, source }
 *
 * Usage: node scripts/build-data.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "..");
const rawDir = path.join(root, "data", "raw");
const outDir = path.join(root, "data", "generated");

const SOURCE_REPO = "https://github.com/interscript/khmer-dict-spice";
const RAW_BASE =
  "https://raw.githubusercontent.com/interscript/khmer-dict-spice/master/";
const RAW_FILES = [
  "kh_dictionary.csv",
  "SBBICkm_KH.txt",
  "ipa_dic.txt",
  "LICENSE",
];

async function ensureRaw() {
  fs.mkdirSync(rawDir, { recursive: true });
  for (const name of RAW_FILES) {
    const target = path.join(rawDir, name);
    if (fs.existsSync(target) && fs.statSync(target).size > 0) continue;
    const url = RAW_BASE + name;
    process.stdout.write(`Downloading ${url} ... `);
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Failed to download ${url}: ${res.status}`);
    fs.writeFileSync(target, Buffer.from(await res.arrayBuffer()));
    console.log("done");
  }
}

/** Minimal RFC 4180 CSV parser (handles quoted fields with commas/newlines). */
function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = "";
  let i = 0;
  let inQuotes = false;
  const n = text.length;
  while (i < n) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i += 2;
          continue;
        }
        inQuotes = false;
        i++;
        continue;
      }
      field += ch;
      i++;
      continue;
    }
    if (ch === '"') {
      inQuotes = true;
      i++;
      continue;
    }
    if (ch === ",") {
      row.push(field);
      field = "";
      i++;
      continue;
    }
    if (ch === "\r") {
      i++;
      continue;
    }
    if (ch === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
      i++;
      continue;
    }
    field += ch;
    i++;
  }
  if (field.length || row.length) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

/** Strip the key-only noise so `normalize` on both sides agrees. */
function stripInvisible(s) {
  return s.replace(/[​‌‍﻿]/g, "");
}

/** Extract a part-of-speech abbreviation such as "ន." or "កិ. វិ." from the head of a definition. */
function extractPos(def) {
  const head = def.slice(0, 80);
  const m = head.match(/\(([ក-៿.\s]{1,14}\.)\)/);
  if (!m) return null;
  return m[1].replace(/\s+/g, " ").trim();
}

function cleanDefinition(def) {
  return def
    .replace(/\\n/g, "\n")
    .replace(/\\\(/g, "(")
    .replace(/\r/g, "")
    .trim();
}

async function main() {
  await ensureRaw();
  fs.mkdirSync(outDir, { recursive: true });

  // ---- dictionary --------------------------------------------------------
  const csv = fs.readFileSync(path.join(rawDir, "kh_dictionary.csv"), "utf8");
  const rows = parseCsv(csv);
  const header = rows.shift();
  if (!header || header[0] !== "_id" || header[1] !== "word") {
    throw new Error(`Unexpected CSV header: ${JSON.stringify(header)}`);
  }

  const entries = [];
  const defs = {};
  const dictKeys = new Set();
  for (const r of rows) {
    if (r.length < 3) continue;
    const id = Number(r[0]);
    const word = r[1].replace(/\s+/g, " ").trim();
    const def = cleanDefinition(r.slice(2).join(","));
    if (!Number.isFinite(id) || !word) continue;
    const pos = extractPos(def);
    entries.push(pos ? { id, word, pos } : { id, word });
    defs[id] = def;
    dictKeys.add(stripInvisible(word).replace(/[\s\-!?.,]+$/g, "").replace(/\s+/g, ""));
  }
  entries.sort((a, b) => a.id - b.id);

  // ---- SBBIC word list ----------------------------------------------------
  const sbbicRaw = fs.readFileSync(path.join(rawDir, "SBBICkm_KH.txt"), "utf8");
  const sbbicSet = new Set();
  for (const line of sbbicRaw.split(/\r?\n/)) {
    const w = stripInvisible(line).trim();
    if (!w || !/[ក-៿]/.test(w)) continue;
    if (dictKeys.has(w)) continue; // already covered by the dictionary
    sbbicSet.add(w);
  }
  const sbbic = [...sbbicSet].sort();

  // ---- IPA ----------------------------------------------------------------
  const ipaRaw = fs.readFileSync(path.join(rawDir, "ipa_dic.txt"), "utf8");
  const ipa = {};
  for (const line of ipaRaw.split(/\r?\n/)) {
    const [w, p] = line.split("\t");
    if (!w || !p) continue;
    const word = stripInvisible(w).trim();
    const pron = p.trim();
    if (!word || !pron) continue;
    const list = (ipa[word] ??= []);
    if (!list.includes(pron)) list.push(pron);
  }

  // ---- write --------------------------------------------------------------
  const meta = {
    entries: entries.length,
    maxId: entries.reduce((m, e) => Math.max(m, e.id), 0),
    sbbic: sbbic.length,
    ipa: Object.keys(ipa).length,
    builtAt: new Date().toISOString(),
    source: SOURCE_REPO,
    license: "LGPL-2.1",
  };
  const write = (name, data) => {
    const file = path.join(outDir, name);
    fs.writeFileSync(file, JSON.stringify(data));
    const kb = (fs.statSync(file).size / 1024).toFixed(0);
    console.log(`  wrote ${name.padEnd(14)} ${kb.padStart(7)} KB`);
  };
  console.log(`Entries: ${entries.length}, SBBIC extra words: ${sbbic.length}, IPA: ${meta.ipa}`);
  write("entries.json", entries);
  write("defs.json", defs);
  write("sbbic.json", sbbic);
  write("ipa.json", ipa);
  write("meta.json", meta);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
