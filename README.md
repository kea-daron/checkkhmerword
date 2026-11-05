# KhmerWord · វចនានុក្រមខ្មែរ ជួន ណាត

A fast, open web app for **checking and looking up Khmer words** in the
Chuon Nath Khmer Dictionary (Buddhist Institute, 1967), built with Next.js.

Data: [interscript/khmer-dict-spice](https://github.com/interscript/khmer-dict-spice)
(Khmer Choun Nath Dictionary digitised by the Open Institute under the
USAID-funded SPICE program, LGPL 2.1).

## Features

- **Search** – exact, prefix, substring and fuzzy matching over 17,328 headwords,
  with Khmer-aware normalisation (zero-width spaces, `ាំ/ំា`, `េី/ើ`, `្ដ/្ត`, …).
- **Entry pages** – headword, part of speech, IPA (where available), and the full
  definition with every cross-reference rendered as a link, plus homographs and
  previous/next navigation.
- **Text checker** – paste a paragraph; words are segmented with ICU, verified
  against the dictionary and the SBBIC spelling list, and unknown words get
  edit-distance suggestions you can apply with one click.
- **Browse by letter**, word of the day, dark mode, and a small **JSON API**.

## Getting started

```bash
npm install
npm run build:data   # converts data/raw/*.csv → data/generated/*.json (downloads raw files if missing)
npm run dev          # http://localhost:3000
```

`data/generated/` is committed, so `build:data` only needs to run again if you
update the raw data.

## JSON API

| Method | Path                                   | Description                                             |
| ------ | -------------------------------------- | ------------------------------------------------------- |
| GET    | `/api/search?q=សេចក្ដី&limit=20`        | Ranked results with match type and excerpt              |
| GET    | `/api/word/9452`                       | Full entry (raw + parsed definition, IPA, homographs)   |
| POST   | `/api/check` `{"text":"…"}`            | Tokens with status (`dict`/`sbbic`/`compound`/`unknown`) and suggestions. `GET ?text=` also works |

## Project layout

```
scripts/build-data.mjs     raw CSV/TXT → compact JSON
data/raw/                  upstream files (git-ignored, auto-downloaded)
data/generated/            entries.json, defs.json, sbbic.json, ipa.json, meta.json
src/lib/khmer/normalize.ts Khmer normalisation & helpers
src/lib/dict/              store (in-memory indexes), search, check, suggest, definition parser
src/app/                   routes: /, /word/[id], /check, /browse, /browse/[letter], /about, /api/*
src/components/            SearchBox, TextChecker, DefinitionView, …
```

## Deploying

Any Node host works (`npm run build && npm start`). On Vercel the JSON data is
traced into the serverless bundle via `outputFileTracingIncludes` in
`next.config.ts`.

## Credits & license

- Dictionary: សម្ដេចព្រះសង្ឃរាជ ជួន ណាត, ពុទ្ធសាសនបណ្ឌិត្យ (1967).
- Digitisation: [Open Institute](https://www.open.org.kh), SPICE program (USAID). LGPL 2.1 — see `data/raw/LICENSE`.
- SBBIC Khmer word list and IPA table: bundled in the upstream repository.
- Application code: MIT.
