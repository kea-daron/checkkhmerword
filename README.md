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
- **Grammar rules** – 30 deterministic rules run over the segmented text, most
  of them from the [SBBIC Khmer grammar checker rule list](https://sbbic.org/current-projects/khmer-grammar-checker-rules)
  and the [SBBIC Student's Guide to Khmer Grammar](https://sbbic.org/current-projects/khmer-grammar):
  និង/នឹង (ហើយនិង, ជាមួយនឹង, រវាង…និង), ពី/ពីរ, កាលពី, ឡើង/លើង, ដែល/ដែរ, នៅ/នូវ,
  ចង់ vs ចង់បាន, verb + ថា, គឺជា, the people classifier នាក់, ទេ at the end of a
  negative sentence, ? after a question, dictionary spellings of SBBIC's variant
  forms, and spacing/punctuation around ។ ៗ ។ល។. Four more come from the guide
  *ច្បាប់វេយ្យាករណ៍និងការសរសេរប្រយោគភាសាខ្មែរ* (sentence structure): the future marker
  នឹង after a subject, បាន/នឹង against the time word, adjective after noun, and
  register (ឆាន់ / សោយ / ពិសា, និមន្ត). Issues are underlined in blue
  with an explanation in Khmer and English and a one-click fix; the full list
  with examples is on `/about#grammar` and in `src/lib/grammar/catalog.ts`.
- **Phrase context** – a real word that does not fit its neighbours. ការបណ្ដុះបណ្ដា
  passes a word-by-word check (ការ, បណ្ដុះ and បណ្ដា are all headwords) but the
  phrase needs បណ្ដាល. After the dictionary pass the checker reads each word
  with the word before and after it and tests every word one letter away:
  does neighbour + candidate form a compound the lexicon knows
  (បណ្ដុះបណ្ដាល is one), and how often do the two pairs occur in Khmer text
  (បណ្ដុះ បណ្ដាល 57×, បណ្ដុះ បណ្ដា 2×)? The counts come from
  `npm run build:phrases` (see below). Issues are underlined in yellow and show
  the phrase, its meaning and both counts; a known compound is a warning, pair
  counts alone give a hint that is never applied automatically.
- **Sentence review (optional)** – one click sends the text to Google's Gemini
  API, which reads whole sentences and flags grammar, word choice, missing words
  and punctuation, not just unknown words. Needs a `GEMINI_API_KEY`.
- **khmerdict.com data (optional)** – `npm run fetch:khmerdict` imports the
  dictionary bundle that [khmerdict.com](https://khmerdict.com/) ships to its
  own web app (the site has no HTTP API). That adds English → Khmer lookup in
  the search box, a khmerdict card on every entry page (pronunciation, example
  sentence, etymology, sub-entries), extra results for Khmer queries, and
  khmerdict's list of common misspellings as checker suggestions. Every result
  links back to khmerdict.com.
- **Browse by letter**, word of the day, dark mode, and a small **JSON API**.

## Getting started

```bash
npm install
npm run build:data   # converts data/raw/*.csv → data/generated/*.json (downloads raw files if missing)
npm run dev          # http://localhost:3000
```

`data/generated/` is committed, so `build:data` only needs to run again if you
update the raw data.

### khmerdict.com data (optional)

```bash
npm run fetch:khmerdict   # downloads khmerdict.com's dict-<hash>.zip → data/generated/khmerdict/*.json (~24 MB)
```

The script reads the homepage to find the current archive, unpacks it with a
small built-in ZIP reader (no extra dependencies) and writes `en.json`
(54,879 English → Khmer entries), `km.json` (41,075 Khmer entries, 13,454 of
them sub-entries the SPICE CSV does not have), `assist.json` (2,020
misspelling → spelling pairs) and `meta.json`. Pass `--force` to re-download.
Without these files the app runs exactly as before: the English mode of the
search box explains how to install them and `/api/khmerdict/search` answers 503.

The Chuon Nath text is the Buddhist Institute's 1967 dictionary; the
English–Khmer list and the typing aids are published by khmerdict.com without a
stated license, so check with the site before redistributing them (for example
before committing `data/generated/khmerdict/` to a public repository).

### Phrase statistics (which word fits the phrase)

```bash
npm run build:phrases     # counts word pairs → data/generated/phrases.json (~6 MB)
npm run fetch:corpus      # optional, first: two public sentence corpora → data/raw/corpus/ (git-ignored)
```

`build:phrases` segments text the way the checker does and counts words and
adjacent word pairs from the Chuon Nath definitions (always), khmerdict's
definitions and example sentences (when fetched) and whatever
`data/raw/corpus/*.txt` holds. `fetch:corpus` downloads the Khmer part of the
[Asian Language Treebank](https://www2.nict.go.jp/astrec-att/member/mutiyama/ALT/)
(NICT / NIPTICT, ~20,000 news sentences) and
[khPOS](https://github.com/ye-kyaw-thu/khPOS) (~12,000 sentences). Both are
CC BY-NC-SA 4.0: the sentences never enter the repository, only pair counts do,
and if you publish `phrases.json` built with them those terms apply to it.
With all four sources the counts cover about 2.1 million words. Without the
file the phrase check is simply off.

How a word gets flagged (`src/lib/context/check.ts`): it must be two letters
or longer, not one of the most frequent grammatical words, and not part of a
compound the checker already recognised; the candidate must be a lexicon word
one code point away (for a two-letter word only a dropped letter counts, as in
កា for ការ, the candidate must be at least 10× as frequent, and a known compound
must confirm it 100+ times with the written pair never seen); the written pair may occur at most 1/20 as often as the
candidate's; no side may prefer the written word; neighbours that belong to a
compound of their own (ជា in ជាលំដាប់, the parts of កម្ពុជា), names after
titles and place-name heads (លោក, ខេត្ត, ស្ទឹង …) are not used as evidence; and
if the letters as written already contain the candidate (មករ+ហូត holds រហូត)
nothing is reported, since only the word split differs. Scores compare
association strength (smoothed pointwise mutual information), so a rare but
legitimate word is not penalised for being rare. On unseen Wikipedia text this
flags roughly one word in 500, most of them genuine typos; the corpora contain
typos of their own (ALT writes បណ្ដុះបណ្ដា twice), which is why a small count
for the written pair is tolerated.

## Adding a grammar rule

1. Describe it in `src/lib/grammar/catalog.ts` (id, names, severity, type, example, source).
2. Implement it in `src/lib/grammar/rules.ts` as a function over the `Context`
   (word atoms with dictionary ids, sentences, literal matching across the
   checker's segmentation) and add it to `GRAMMAR_RULES`.
3. Severity: `error` for rules with no exceptions (auto-applied by "កែទាំងអស់"),
   `warning` for likely mistakes, `hint` for rules with known exceptions (never
   applied automatically).

### Sentence review with Google Gemini (optional)

The dictionary checker can only say whether a word exists. For whole-sentence
checking the app can call Google's Gemini API through the official
[`@google/genai`](https://www.npmjs.com/package/@google/genai) SDK.

1. Create a free API key at <https://aistudio.google.com/apikey>.
2. Copy `.env.example` to `.env.local` and set `GEMINI_API_KEY=…`
   (`GEMINI_MODEL` optionally picks another model; the default is `gemini-3.1-pro-preview`
   with thinking level `high`, which needs a paid plan: on a Free Tier key it answers
   429 "limit: 0" and the app falls back to `gemini-3.5-flash`, then `gemini-3.5-flash-lite`,
   automatically. `GEMINI_THINKING_LEVEL` sets `minimal | low | medium | high`).
3. Restart `npm run dev` (or rebuild for production: the home page reads the
   setting when it is rendered). A **ពិនិត្យប្រយោគ (Gemini)** button appears in
   the checker toolbar.

Text sent for review leaves your server and goes to Google. Without a key the
button is hidden and `/api/review` answers 503; everything else keeps working
offline.

## JSON API

Issues from the phrase check use the rule id `phrase-context` and carry an
`evidence` object (phrase, written form, kind, meaning, example, counts).

| Method | Path                                   | Description                                             |
| ------ | -------------------------------------- | ------------------------------------------------------- |
| GET    | `/api/search?q=សេចក្ដី&limit=20`        | Ranked results with match type and excerpt              |
| GET    | `/api/word/9452`                       | Full entry (raw + parsed definition, IPA, homographs)   |
| POST   | `/api/check` `{"text":"…"}`            | Tokens with status (`dict`/`sbbic`/`compound`/`unknown`) and suggestions. `GET ?text=` also works |
| GET    | `/api/khmerdict/search?q=freedom`      | khmerdict.com data: Latin query → English–Khmer entries; Khmer query → khmerdict entries (pronunciation, example, etymology, sub-entries). 503 until `npm run fetch:khmerdict` has run |
| POST   | `/api/review` `{"text":"…"}`           | Sentence review by Google Gemini: `issues[]` (`text`, `suggestion`, `reason`, `type`), `summary`, `corrected`. 503 without `GEMINI_API_KEY` |

## Project layout

```
scripts/build-data.mjs     raw CSV/TXT → compact JSON
scripts/build-phrases.mjs  word and word-pair counts → data/generated/phrases.json
scripts/fetch-corpus.mjs   optional ALT + khPOS sentence corpora → data/raw/corpus/ (git-ignored)
scripts/fetch-khmerdict.mjs optional khmerdict.com bundle → data/generated/khmerdict/
data/raw/                  upstream files (git-ignored, auto-downloaded)
data/generated/            entries.json, defs.json, sbbic.json, ipa.json, meta.json, phrases.json
src/lib/khmer/normalize.ts Khmer normalisation & helpers
src/lib/dict/              store (in-memory indexes), search, check, suggest, definition parser
src/lib/grammar/           SBBIC rule engine (catalog, context, rules)
src/lib/context/           phrase-context check: pair counts, candidates, scoring
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
