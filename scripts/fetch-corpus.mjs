#!/usr/bin/env node
/**
 * Fetch script (optional): downloads two public, word-segmented Khmer sentence
 * corpora so `npm run build:phrases` can count how words follow each other in
 * real text. The dictionary alone says whether a word exists; these counts let
 * the checker tell that in «ការបណ្ដុះបណ្ដា…» the word after បណ្ដុះ is almost
 * always បណ្ដាល, never បណ្ដា.
 *
 *   Asian Language Treebank, Khmer (NICT / NIPTICT)   ~20,000 news sentences
 *     https://www2.nict.go.jp/astrec-att/member/mutiyama/ALT/
 *   khPOS (Ye Kyaw Thu et al.)                        ~12,000 sentences
 *     https://github.com/ye-kyaw-thu/khPOS
 *
 *   Output (data/raw/corpus/, git-ignored):
 *     alt-km.txt    one sentence per line, words separated by spaces
 *     khpos.txt     same format (POS tags removed, compound joins kept)
 *     LICENSE.txt   attribution and terms
 *
 * Both corpora are licensed CC BY-NC-SA 4.0 (attribution, non-commercial,
 * share-alike). They never enter the repository: only the word-pair counts
 * derived from them go into data/generated/phrases.json, and if you publish
 * that file with these corpora included, the same terms apply to it. Run
 * `npm run build:phrases` without this step to use the dictionary text only.
 *
 * Usage: node scripts/fetch-corpus.mjs [--force]
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { unzip } from "./lib/zip.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "..");
const outDir = path.join(root, "data", "raw", "corpus");
const force = process.argv.includes("--force");

const UA = "KhmerWord data fetch (+https://github.com/kea-daron)";
const ALT_ZIP = "https://www2.nict.go.jp/astrec-att/member/mutiyama/ALT/km-nova-181101.zip";
const ALT_TOK = "km-nova-181101/data_km.km-tok.nova";
const KHPOS = "https://raw.githubusercontent.com/ye-kyaw-thu/khPOS/master/corpus-draft-ver-1.0/data/after-replace/train.all2";

const LICENSE = `Khmer sentence corpora used for phrase statistics (data/generated/phrases.json)

1. Asian Language Treebank (ALT), Khmer part — NICT and NIPTICT
   ${ALT_ZIP}
   "NOVA Tokenized/POS-tagged Khmer ALT", Masao Utiyama, 2018. Translations of
   English Wikinews articles (CC BY 2.5). License: CC BY-NC-SA 4.0
   https://creativecommons.org/licenses/by-nc-sa/4.0/
   Please cite: Riza et al., "Introduction of the Asian Language Treebank", O-COCOSDA 2016.

2. khPOS — Ye Kyaw Thu, Vichet Chea, Yoshinori Sagisaka
   https://github.com/ye-kyaw-thu/khPOS
   License: CC BY-NC-SA 4.0
   Please cite: "Comparison of Six POS Tagging Methods on 12K Sentences Khmer
   Language POS Tagged Corpus", 2017.

Only word and word-pair counts derived from these files are used by KhmerWord.
`;

async function download(url) {
  process.stdout.write(`Downloading ${url} ... `);
  const res = await fetch(url, { headers: { "user-agent": UA } });
  if (!res.ok) throw new Error(`Failed to download ${url}: ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  console.log(`done (${(buf.length / 1024 / 1024).toFixed(1)} MB)`);
  return buf;
}

function fresh(file) {
  return !force && fs.existsSync(file) && fs.statSync(file).size > 0;
}

/** ALT: "SNT.80188.1<TAB>word word word ។" -> "word word word ។" */
async function fetchAlt() {
  const target = path.join(outDir, "alt-km.txt");
  if (fresh(target)) return console.log(`Using cached ${path.relative(root, target)}`);
  const files = unzip(await download(ALT_ZIP));
  const tok = files.get(ALT_TOK);
  if (!tok) throw new Error(`${ALT_TOK} missing from the archive; it has: ${[...files.keys()].join(", ")}`);
  const lines = [];
  for (const line of tok.toString("utf8").split("\n")) {
    const tab = line.indexOf("\t");
    const sent = (tab >= 0 ? line.slice(tab + 1) : line).trim();
    if (sent) lines.push(sent.replace(/\s+/g, " "));
  }
  fs.writeFileSync(target, lines.join("\n") + "\n");
  console.log(`  wrote corpus/alt-km.txt (${lines.length.toLocaleString()} sentences)`);
}

/** khPOS: "ក្រៅ_ពី/IN នោះ/DT …" -> "ក្រៅពី នោះ …" (_ and ~ join the parts of one word). */
async function fetchKhpos() {
  const target = path.join(outDir, "khpos.txt");
  if (fresh(target)) return console.log(`Using cached ${path.relative(root, target)}`);
  const text = (await download(KHPOS)).toString("utf8");
  const lines = [];
  for (const line of text.split("\n")) {
    const words = line
      .trim()
      .split(/\s+/)
      .filter(Boolean)
      .map((t) => {
        const slash = t.lastIndexOf("/");
        const w = slash > 0 ? t.slice(0, slash) : t;
        return w.replace(/[_~]/g, "");
      })
      .filter(Boolean);
    if (words.length) lines.push(words.join(" "));
  }
  fs.writeFileSync(target, lines.join("\n") + "\n");
  console.log(`  wrote corpus/khpos.txt (${lines.length.toLocaleString()} sentences)`);
}

async function main() {
  fs.mkdirSync(outDir, { recursive: true });
  await fetchAlt();
  await fetchKhpos();
  fs.writeFileSync(path.join(outDir, "LICENSE.txt"), LICENSE);
  console.log("Now run: npm run build:phrases");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
