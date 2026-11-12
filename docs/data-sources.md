# Public Khmer language data for KhmerWord

Surveyed 2026-11-06. Everything here is publicly downloadable. Licenses are
copied from the source page on that date; re-check before shipping anything
derived from a source, and keep non-commercial (NC) or unlicensed material out
of committed artefacts (see "License posture" at the end).

Legend for the **Use** column:
`dict` headwords/definitions · `freq` word frequency · `sent` clean Khmer
sentences for phrase statistics · `seg` segmentation/POS gold · `err` real
spelling errors for evaluation · `names` proper nouns to whitelist.

## 0. Already imported

| Source | What | License | Where |
|---|---|---|---|
| [interscript/khmer-dict-spice](https://github.com/interscript/khmer-dict-spice) | Chuon Nath dictionary (1967), digitised by Open Institute | LGPL 2.1 | `scripts/build-data.mjs` |
| SBBIC word list (`data/raw/SBBICkm_KH.txt`) | ~40k spelling word list, same data as the Hunspell `km_KH` dictionary | see `data/raw/LICENSE` | `data/generated/sbbic.json` |
| [khmerdict.com](https://khmerdict.com) | Definitions + examples shipped by the site | site terms | `scripts/fetch-khmerdict.mjs` |
| [ALT Khmer](https://www2.nict.go.jp/astrec-att/member/mutiyama/ALT/) | 20k translated Wikinews sentences, tokenised + POS | CC BY-NC-SA 4.0 | `scripts/fetch-corpus.mjs` (opt-in) |
| [ye-kyaw-thu/khPOS](https://github.com/ye-kyaw-thu/khPOS) | 12k sentences, manual segmentation + POS | CC BY-NC-SA 4.0 | `scripts/fetch-corpus.mjs` (opt-in) |

## 1. Real spelling errors (evaluation gold)

| Source | Size | License | Use | Notes |
|---|---|---|---|---|
| [seanghay/khmer-spelling-corrections](https://huggingface.co/datasets/seanghay/khmer-spelling-corrections) | 917 pairs (misspelling → headword) | CC BY-SA 4.0 | err | Mined from 3.2M khmerdict.com searches, ≥5 distinct users per pair, ≤2 edits. Best single test set for `suggest.ts` and the checker. Not hand-verified. |
| [seanghay/khmer-character-confusions](https://huggingface.co/datasets/seanghay/khmer-character-confusions) | character confusion pairs | CC BY-SA 4.0 | err | Which letters/vowels Khmer typists swap. Feed into suggestion ranking and normalisation folds. |
| [phonsobon/khmer-spellcheck-pairs-clean-v2](https://huggingface.co/datasets/phonsobon/khmer-spellcheck-pairs-clean-v2) | 1.59M synthetic train pairs; `test_real` 51,915 real pairs | CC BY 4.0 | err, sent | Targets are clean sentences (useful as `sent`). `test_real` mixes seanghay's data with S-Sethisak's unlicensed set, so treat that split as evaluation-only. |
| [phonsobon/khmer-spellcheck-clean](https://huggingface.co/datasets/phonsobon/khmer-spellcheck-clean) | up to 500k synthetic pairs | CC BY 4.0 | err | Older version of the above. |
| [S-Sethisak/khmer-orthography-correction-dataset](https://huggingface.co/datasets/S-Sethisak/khmer-orthography-correction-dataset) | 67k sentence pairs | **none stated** | err | Do not redistribute or build committed data from it. Fine for a private sanity check. |
| [PhonSobon/Khmer-Spelling-Check](https://github.com/PhonSobon/Khmer-Spelling-Check) | open-source spell checker + 44k frequency list | see repo | ref | Comparison baseline; evaluated on the 917 real misspellings. |
| "Khmer Spellchecking: A Holistic Approach" ([ResearchGate](https://www.researchgate.net/publication/391442280_Khmer_Spellchecking_A_Holistic_Approach)) | paper | — | ref | Segmentation + NER + G2P + LM pipeline; authors promised a public benchmark (not found yet). |
| [arXiv 2411.10477](https://arxiv.org/pdf/2411.10477) | survey on Khmer homophone errors | — | ref | Error taxonomy worth mirroring in `grammar/catalog.ts`. |

## 2. Clean Khmer sentences (phrase statistics, false-positive tests)

Permissive sources first. Together they can replace the NC corpora in
`phrases.json` so the generated file could be committed.

| Source | Size | License | Use | Notes |
|---|---|---|---|---|
| [Khmer Wikipedia dump](https://dumps.wikimedia.org/kmwiki/) (`kmwiki`, monthly, latest 20261101) | ~11.5k articles, ~98 MiB text | CC BY-SA 4.0 | sent | Largest permissive edited-Khmer source. Pre-extracted: [sabilmakbar/sea_wiki](https://huggingface.co/datasets/sabilmakbar/sea_wiki) (CC BY-SA 4.0), [ffatty/plaintext-wikipedia-full-khmer](https://huggingface.co/datasets/ffatty/plaintext-wikipedia-full-khmer) (CC BY-SA 3.0). Contains typos itself; the current ≥2 count gate handles that. |
| [Khmer Wiktionary dump](https://dumps.wikimedia.org/kmwiktionary/) (`kmwiktionary`) | small | CC BY-SA 4.0 | dict, sent | Khmer-language entries and examples. |
| [FLORES+](https://huggingface.co/datasets/openlanguagedata/flores_plus) `khm_Khmr` | 997 dev + 1,012 devtest sentences | CC BY-SA 4.0 | sent | Professionally translated. A clean checker should flag ~0 words here: use as a false-positive regression test. |
| [Belebele](https://huggingface.co/datasets/facebook/belebele) `khm_Khmr`, [SIB-200](https://huggingface.co/datasets/Davlan/sib200) `khm_Khmr`, [MASSIVE](https://huggingface.co/datasets/AmazonScience/massive) `km-KH` | ~900 passages / 1k sentences / ~17k short utterances | CC BY-SA 4.0 / CC BY-SA 4.0 / CC BY 4.0 | sent | Human-written or human-translated. MASSIVE is colloquial voice-assistant Khmer (useful register the dictionary lacks). |
| [OpenSLR 42](https://www.openslr.org/42/) Khmer TTS transcripts | 2,906 sentences | CC BY-SA 4.0 | sent | Hand-checked read sentences. |
| [Tatoeba `khm`](https://downloads.tatoeba.org/exports/per_language/khm/) | ~800+ sentences | CC BY 2.0 FR | sent | Small but community-corrected. |
| [OPUS km–en](https://opus.nlpl.eu/results/km&en/corpus-result-table) | total 8.6M pairs | varies | sent | Khmer side only. Clean subsets: KDE4 120k, translatewiki 11.5k, wikimedia 14k, tico-19 3k, TED2020 1k, GNOME, Ubuntu (software/UI vocabulary). Mined subsets are noisy: NLLB 5.86M (ODC-BY), ParaCrawl-Bonus 1.5M, CCAligned 412k, OpenSubtitles 546k (license unclear). |
| [rinabuoy/km-en-pairs](https://huggingface.co/datasets/rinabuoy/km-en-pairs) | 499k pairs | check card | sent | Aggregated parallel data; provenance per pair not given. |
| [Leipzig Corpora Collection, Khmer](https://wortschatz.uni-leipzig.de/en/download/Khmer) | 10k–300k sentence packs (wikipedia / news / community) + word frequency lists | CC BY 4.0 | sent, freq | Site blocks automated fetches (Anubis); download in a browser. Not re-verified this survey. |
| [KhmerText (SourceForge)](https://sourceforge.net/projects/khmertext/files/) | Khmer folktales, Kambuja Soriya journal, manuscripts (ODT) | GPLv3 (project page) | sent | Literary/classical register close to Chuon Nath's. Needs ODT → text extraction. |
| [seanghay/service.gov.kh](https://huggingface.co/datasets/seanghay/service.gov.kh) | government service descriptions | check card | sent | Formal administrative Khmer. |
| [CADT-IDRI/text_summarization](https://huggingface.co/datasets/CADT-IDRI/text_summarization), [Khmer_News_classification](https://huggingface.co/datasets/CADT-IDRI/Khmer_News_classification) | news articles | unlisted / CC BY-NC | sent | From the national digital technology academy. NC or unlicensed: evaluation only. |
| [khmer.voanews.com](https://khmer.voanews.com) | news | US-government work, public domain (check VOA terms for syndicated content) | sent | Would need a polite crawler; not yet attempted. |

### Large web crawls (noisy; use only for low-weight statistics)

Web text contains exactly the errors the checker should catch, so these must
never outvote the dictionary. Useful for unigram frequency and for finding
common modern words missing from Chuon Nath.

| Source | Size | License |
|---|---|---|
| [sovannpanhaseng/khmer-pile](https://huggingface.co/datasets/sovannpanhaseng/khmer-pile) (FineWeb-2 Khmer, re-extracted + filtered) | 627k docs, 813 MB | ODC-BY |
| [HuggingFaceFW/fineweb-2](https://huggingface.co/datasets/HuggingFaceFW/fineweb-2) `khm_Khmr` | larger, raw | ODC-BY |
| [nphearum/khmer-raw-text-3M-v2](https://huggingface.co/datasets/nphearum/khmer-raw-text-3M-v2) | 213k records, 1.06 GB | Apache-2.0 / MIT tag (provenance "publicly available sources": copyright of underlying news is not cleared) |
| [phonsobon/khmer-lm-corpus](https://huggingface.co/datasets/phonsobon/khmer-lm-corpus) | Wikipedia + OSCAR | card says keep private |
| OSCAR / CC-100 / MADLAD-400 / CulturaX / HPLT `km` | older Common Crawl extractions | varies |

## 3. Dictionaries and word lists

| Source | Size | License | Use | Notes |
|---|---|---|---|---|
| Royal Academy of Cambodia, Khmer Dictionary 2022 (NCKL) via [seanghay/khmer-dictionary-44k](https://huggingface.co/datasets/seanghay/khmer-dictionary-44k) | 44,706 entries: word, POS (47 tags), pronunciation, definition, example | **research only, non-commercial** | dict | The modern complement to Chuon Nath: current vocabulary, loanwords, examples. Biggest lexical gain available, but no open license from the Academy. Also [phonsobon/khmer-khmer-dictionary](https://huggingface.co/datasets/phonsobon/khmer-khmer-dictionary) (custom license, cleaned, one row per sense) and [metythorn/khmer-dictionary-dataset-44k-v1](https://huggingface.co/datasets/metythorn/khmer-dictionary-dataset-44k-v1) (claims MIT, same source: the claim is not credible). |
| [khopilot/khmer-lexicon](https://huggingface.co/datasets/khopilot/khmer-lexicon) | 12,653 terms with Khmer definitions | CC BY 4.0 | dict | Provenance not stated on the card; check before trusting the license. |
| [silnrsi/khmerlbdict](https://github.com/silnrsi/khmerlbdict) | SEAlang frequency list, Bible (old + standard) word lists, three book-series frequency lists, **names.txt, places.txt, villages.txt** | MIT | freq, names | The names/places/villages lists are the quickest way to stop flagging proper nouns. Built for line breaking, so entries are segmentation units, not all headwords. |
| [google/language-resources](https://github.com/google/language-resources/tree/master/km/data) `km/data/lexicon.tsv` | 2.8 MB pronunciation lexicon + `prompts.tsv` | repo says data CC BY 4.0 (verify LICENSE) | dict, freq | Mirrored as [seanghay/google-khmer-lexicon](https://huggingface.co/datasets/seanghay/google-khmer-lexicon). Repo archived 2022. |
| [pheasaKhmer/khmer-engine PR #3](https://github.com/pheasaKhmer/khmer-engine/pull/3) | 61,980-word lexicon + frequencies | CC BY 4.0 (derived from Google lexicon) | freq | |
| [seanghay/khmer-search-frequency](https://huggingface.co/datasets/seanghay/khmer-search-frequency) | word search frequency from khmerdict.com | CC BY-SA 4.0 | freq | Real-user demand ranking: good tie-breaker for suggestions. |
| [Wiktionary: Khmer frequency list](https://en.wiktionary.org/wiki/Appendix:Khmer_Frequency_list) | ranked list, downloadable | CC BY-SA | freq | |
| [Crúbadán `km`](http://crubadan.org/languages/km) | word and character n-grams from web crawl | CC BY 4.0 | freq | Site unreachable on survey day. |
| [seanghay/lexicon-kh](https://huggingface.co/datasets/seanghay/lexicon-kh) | lexicon | check card | dict | |
| [mrrtmob/english-khmer-dictionary](https://huggingface.co/datasets/mrrtmob/english-khmer-dictionary), [namae101/edmt-dictionary-english-khmer-llm-translated](https://huggingface.co/datasets/namae101/edmt-dictionary-english-khmer-llm-translated) | EN–KM | CC BY 4.0 / Apache | dict | Bilingual only; the second is machine-translated. |
| Hunspell `km_KH` ([Fedora package](https://dl.fedoraproject.org/pub/alt/releases/23/Cloud/i386/os/repoview/hunspell-km.html)) | SBBIC list in Hunspell form | — | — | Same data already in `data/raw`. |
| [SBBIC](https://sbbic.org/) | word list, spelling checker, keyboard | — | — | Upstream of the SBBIC list; watch for updates. |

## 4. Segmentation and POS gold

| Source | Size | License | Notes |
|---|---|---|---|
| [ye-kyaw-thu/khPOS](https://github.com/ye-kyaw-thu/khPOS) (also [seanghay/khPOS](https://huggingface.co/datasets/seanghay/khPOS)) | 12k sentences | CC BY-NC-SA 4.0 | Already used. Tag set follows Chuon Nath POS. |
| [ALT Khmer POS on Zenodo](https://zenodo.org/records/3937914) (also [SEACrowd/khmer_alt_pos](https://huggingface.co/datasets/SEACrowd/khmer_alt_pos)) | 20k sentences | CC BY-NC-SA 4.0 (metadata says CC BY 4.0) | Already used. |
| Universal Dependencies | — | — | No Khmer treebank exists as of this survey. |
| Tools that bundle lexicons: [seanghay/khmercut](https://github.com/seanghay/khmercut), [VietHoang1512/khmer-nltk](https://github.com/VietHoang1512/khmer-nltk), [Sovichea/khmer_segmenter](https://github.com/Sovichea/khmer_segmenter) (dictionary NC), [back-kh/khmereasytools](https://github.com/back-kh/khmereasytools), [Socret360 joint seg+POS](https://github.com/Socret360/joint-khmer-word-segmentation-and-pos-tagging) | — | varies | Useful to compare segmentation against `dpCover`. |

## 5. Suggested import order

1. **Evaluation set first.** Add `seanghay/khmer-spelling-corrections` (917 real
   pairs) as a test fixture: for each pair, does `checkText` flag the
   misspelling and does `suggest` rank the correction first? Add FLORES+
   devtest (1,012 clean sentences) as the false-positive side of the same test.
2. **Permissive sentence pool** for `scripts/build-phrases.mjs`: kmwiki dump +
   FLORES+ + OpenSLR 42 transcripts + Tatoeba + MASSIVE km-KH + OPUS KDE4 /
   translatewiki / wikimedia Khmer side. All CC BY(-SA) or better, so
   `phrases.json` can be committed. Keep ALT/khPOS opt-in as now.
3. **Proper-noun whitelist** from `khmerlbdict` names/places/villages, loaded as
   a separate status (not "dict") so they are never suggested as corrections.
4. **Frequency** from `khmer-search-frequency` + Google lexicon for suggestion
   ranking; `khmer-character-confusions` for the edit-cost table in `suggest.ts`.
5. **Web crawl** (`khmer-pile`) only for unigram counts and for a report of
   frequent words absent from Chuon Nath + SBBIC (candidate additions).
6. **Royal Academy 2022 dictionary**: decide the license posture first. It is
   usable for private research and evaluation; not for a public deployment
   without permission from the Academy.

## License posture

- Commit only artefacts derived from CC BY / CC BY-SA / MIT / Apache / ODC-BY /
  LGPL sources, and list attributions in `README.md`.
- CC BY-NC-SA (ALT, khPOS, CADT news) and "research only" (RAC 2022) stay
  opt-in via fetch scripts in git-ignored `data/raw/`.
- Unlicensed Hugging Face uploads (S-Sethisak, several speech/news sets) are
  evaluation-only and never redistributed.
