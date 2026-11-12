import type { Metadata } from "next";
import Link from "next/link";
import { POS_LEGEND } from "@/lib/dict/pos";
import { getStore } from "@/lib/dict/store";
import { getKhmerDictMeta } from "@/lib/khmerdict/store";
import { RULES, SOURCE_LABEL } from "@/lib/grammar/catalog";
import type { RuleSource } from "@/lib/grammar/catalog";
import { getPhraseMeta } from "@/lib/context/store";

export const metadata: Metadata = {
  title: "About",
  description: "About KhmerWord: data source, license, abbreviations and the JSON API.",
};

export default function AboutPage() {
  const { meta } = getStore();
  const kd = getKhmerDictMeta();
  const phrases = getPhraseMeta();
  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6 sm:py-14">
      <header className="mb-10">
        <p className="km-ui text-sm font-medium uppercase tracking-[0.2em] text-accent">អំពីគម្រោង</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">About KhmerWord</h1>
        <p className="mt-3 text-ink-2">
          KhmerWord is a fast, open web interface for the <strong className="text-ink">Chuon Nath Khmer Dictionary</strong>, the
          first modern monolingual dictionary of the Khmer language, revised by Samdech Sangharaja Chuon Nath (1883–1969)
          and published by the Buddhist Institute of Cambodia in 1967.
        </p>
      </header>

      <Section id="data" title="Data source">
        <p>
          The dictionary text was digitised by the{" "}
          <A href="https://www.open.org.kh">Open Institute</A> as part of the USAID-funded SPICE program and is
          redistributed by <A href="https://github.com/interscript/khmer-dict-spice">interscript/khmer-dict-spice</A>.
          This site uses that data unchanged apart from format conversion.
        </p>
        <ul className="mt-3 grid gap-2 sm:grid-cols-3">
          <Stat label="Dictionary entries" value={meta.entries} />
          <Stat label="Extra SBBIC words" value={meta.sbbic} />
          <Stat label="IPA transcriptions" value={meta.ipa} />
        </ul>
        <p className="mt-3">
          The SBBIC word list (used only for the text checker) comes from the Society for Better Books in Cambodia&apos;s
          Khmer spell-checking project, bundled in the same repository. IPA transcriptions cover a small subset of entries.
        </p>
        <h3 className="mt-6 mb-2 font-semibold text-ink">khmerdict.com</h3>
        <p>
          <A href="https://khmerdict.com/">khmerdict.com</A> has no public API: it is an offline-first app that ships its whole
          dictionary to the browser as one archive. <code className="font-mono text-sm">npm run fetch:khmerdict</code> imports that
          archive, which adds English → Khmer lookup, khmerdict&apos;s split of each Chuon Nath entry into pronunciation, example
          and etymology (including sub-entries listed under a headword), and its list of common misspellings, used as extra
          suggestions in the checker. Every result links back to the site. The English–Khmer list and the typing aids are
          published there without a stated license; ask the site before redistributing them.
        </p>
        {kd ? (
          <ul className="mt-3 grid gap-2 sm:grid-cols-3">
            <Stat label="English → Khmer entries" value={kd.en} />
            <Stat label="khmerdict Khmer entries" value={kd.km} />
            <Stat label="Common corrections" value={kd.corr} />
          </ul>
        ) : (
          <p className="mt-3 text-sm text-ink-3">Not installed on this server.</p>
        )}
      </Section>

      <Section id="license" title="License">
        <p>
          As described by the Open Institute, the dictionary data is offered under the{" "}
          <A href="https://www.gnu.org/licenses/old-licenses/lgpl-2.1.html">GNU LGPL 2.1</A>. The original source is
          available from the{" "}
          <A href="https://sourceforge.net/projects/spiceproject/files/Khmer%20Choun%20Nath%20Dictionary/">SPICE SourceForge page</A>.
          A scanned PDF of the 1967 edition is on the{" "}
          <A href="https://archive.org/details/buddhist_institute_khmer_dictionary1967/">Internet Archive</A>.
        </p>
      </Section>

      <Section id="matching" title="How matching works">
        <ul className="list-disc space-y-1.5 pl-5">
          <li>Queries and headwords are NFC-normalised; zero-width spaces, joiners and trailing punctuation are ignored.</li>
          <li>
            Common encoding variants are folded: <span className="km">ំ+ា → ាំ</span>, <span className="km">ំ+ុ → ុំ</span>,{" "}
            <span className="km">េ+ី → ើ</span>, <span className="km">េ+ា → ោ</span>, and coeng <span className="km">្ដ</span> is
            treated like <span className="km">្ត</span>.
          </li>
          <li>Search ranks exact matches, then prefixes, then substrings, then similar words (edit distance ≤ 2).</li>
          <li>
            The text checker segments Khmer with the ICU word-break dictionary, merges adjacent pieces when the
            dictionary lists them as one headword, and splits unknown tokens into known words where possible.
          </li>
        </ul>
      </Section>

      <Section id="grammar" title="Grammar rules">
        <p>
          Besides looking words up, the checker runs {RULES.length} grammar, word-choice, spacing and punctuation rules over
          the segmented text. Most come from the Society for Better Books in Cambodia&apos;s{" "}
          <A href={SOURCE_LABEL["sbbic-rules"].url!}>Khmer grammar checker rule list</A> and Nathan Wells&apos;{" "}
          <A href={SOURCE_LABEL["sbbic-grammar"].url!}>Student&apos;s Guide to Khmer Grammar</A>; the sentence-structure rules (tense markers, adjective order,
          register) follow the guide <span lang="km">{SOURCE_LABEL["grammar-guide"].label}</span>; the rest are general
          typographic checks. Rules without known exceptions are reported as <Sev s="error" />, likely mistakes as{" "}
          <Sev s="warning" />, and rules with known exceptions as <Sev s="hint" />, which are never applied automatically.
          Issues are underlined in blue in the editor; click one for the explanation and a one-click fix.
        </p>
        <table className="mt-4 w-full text-sm">
          <thead>
            <tr className="border-b border-line text-left text-xs uppercase tracking-wide text-ink-3">
              <th className="py-2 pr-3 font-medium">Rule</th>
              <th className="py-2 pr-3 font-medium">Example</th>
              <th className="py-2 font-medium">Source</th>
            </tr>
          </thead>
          <tbody>
            {RULES.map((r) => (
              <tr key={r.id} className="border-b border-line/70 align-top">
                <td className="py-2.5 pr-3">
                  <p className="km font-medium text-ink">{r.name}</p>
                  <p className="mt-0.5 text-ink-2">{r.about}</p>
                  <p className="mt-1 flex flex-wrap items-center gap-1.5">
                    <Sev s={r.severity} />
                    <code className="font-mono text-xs text-ink-3">{r.id}</code>
                  </p>
                </td>
                <td className="min-w-[12rem] py-2.5 pr-3">
                  {r.example && (
                    <>
                      <s className="km block text-ink-3">{r.example.wrong}</s>
                      <span className="km block text-ink">{r.example.right}</span>
                    </>
                  )}
                </td>
                <td className="py-2.5 text-xs text-ink-2">
                  <SourceLink source={r.source} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="mt-3 text-sm text-ink-2">
          Khmer is written without spaces between words, so the rules match on the checker&apos;s word segmentation; a
          rule can only fire when the words around it were recognised. False positives are easiest to avoid on hints:
          dismiss one with “មិនអើពើ” and it stays dismissed for that text.
        </p>
      </Section>

      <Section id="abbreviations" title="Abbreviations">
        <p className="mb-3">Labels as printed in the dictionary. Only the common ones are expanded here.</p>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-line text-left text-xs uppercase tracking-wide text-ink-3">
              <th className="py-2 pr-4 font-medium">Label</th>
              <th className="py-2 pr-4 font-medium">Khmer</th>
              <th className="py-2 font-medium">English</th>
            </tr>
          </thead>
          <tbody>
            {Object.entries(POS_LEGEND).map(([abbr, info]) => (
              <tr key={abbr} className="border-b border-line/70">
                <td className="km-ui py-2 pr-4 font-medium text-ink">{abbr}</td>
                <td className="km py-2 pr-4">{info.km}</td>
                <td className="py-2 text-ink-2">{info.en}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Section>

      <Section id="phrases" title="Phrase context: which word fits the phrase">
        <p>
          A word-by-word check accepts <span className="km">ការបណ្ដុះបណ្ដា</span>, because <span className="km">ការ</span>,{" "}
          <span className="km">បណ្ដុះ</span> and <span className="km">បណ្ដា</span> are all headwords; only the phrase is wrong, it
          needs <span className="km">បណ្ដាល</span>. So after the dictionary pass the checker reads each word together with the word
          before and after it. For every word that is one letter away it asks two things:
        </p>
        <ul className="mt-3 list-disc space-y-1.5 pl-5">
          <li>
            Does neighbour + candidate form a word the lexicon knows as a unit, while neighbour + written word does not?{" "}
            <span className="km">បណ្ដុះ + បណ្ដាល</span> is the SBBIC compound <span className="km">បណ្ដុះបណ្ដាល</span>;{" "}
            <span className="km">បណ្ដុះបណ្ដា</span> is nothing. This is reported as a <Sev s="warning" />.
          </li>
          <li>
            How often does each pair occur in Khmer text? The counts come from the dictionary definitions, khmerdict&apos;s example
            sentences and two public sentence corpora (table below). The written pair must be rare next to the candidate&apos;s, and when
            only the counts speak (no known compound) the words on both sides must agree; that is reported as a <Sev s="hint" /> and
            never applied automatically.
          </li>
        </ul>
        <p className="mt-3">
          The comparison uses association strength (how much more often a pair occurs than chance would give), so a rare but
          legitimate word is not penalised for being rare, and words that belong to a compound of their own, names after titles,
          particles and the most frequent grammatical words are left alone. Each issue shows the phrase it is based on, its
          meaning when a dictionary has one, and both counts, so you can judge the evidence yourself.
        </p>
        {phrases ? (
          <>
            <ul className="mt-3 grid gap-2 sm:grid-cols-3">
              <Stat label="Words counted" value={phrases.tokens} />
              <Stat label="Distinct words" value={phrases.words} />
              <Stat label={`Word pairs (seen ≥ ${phrases.minBigram}×)`} value={phrases.bigrams} />
            </ul>
            <table className="mt-4 w-full text-sm">
              <thead>
                <tr className="border-b border-line text-left text-xs uppercase tracking-wide text-ink-3">
                  <th className="py-2 pr-3 font-medium">Source</th>
                  <th className="py-2 pr-3 font-medium">Sentences</th>
                  <th className="py-2 pr-3 font-medium">Words</th>
                  <th className="py-2 font-medium">License</th>
                </tr>
              </thead>
              <tbody>
                {phrases.sources.map((src) => (
                  <tr key={src.name} className="border-b border-line/70">
                    <td className="py-2 pr-3 text-ink">{src.name}</td>
                    <td className="py-2 pr-3">{src.sentences.toLocaleString()}</td>
                    <td className="py-2 pr-3">{src.tokens.toLocaleString()}</td>
                    <td className="py-2 text-ink-3">{src.license}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        ) : (
          <p className="mt-3 text-sm text-ink-3">
            Not built on this server: run <code className="font-mono">npm run build:phrases</code>.
          </p>
        )}
        <p className="mt-3">
          <code className="font-mono text-sm">npm run build:phrases</code> counts the dictionary text (and khmerdict&apos;s data when
          fetched). <code className="font-mono text-sm">npm run fetch:corpus</code> first adds the{" "}
          <A href="https://www2.nict.go.jp/astrec-att/member/mutiyama/ALT/">Asian Language Treebank</A> (Khmer, NICT / NIPTICT, ~20,000
          news sentences) and <A href="https://github.com/ye-kyaw-thu/khPOS">khPOS</A> (~12,000 sentences), both CC BY-NC-SA 4.0: the
          sentences stay out of the repository, only pair counts are kept, and those terms then apply to the counts. The corpora
          contain mistakes of their own (ALT writes <span className="km">បណ្ដុះបណ្ដា</span> twice), which is why a written pair is allowed
          a small count.
        </p>
      </Section>

      <Section id="api" title="JSON API">
        <p>Four read-only endpoints back the UI and are free to use. A fifth, sentence review with Google Gemini, is available when the server has a <code className="font-mono">GEMINI_API_KEY</code>.</p>
        <dl className="mt-3 space-y-4">
          <Endpoint method="GET" path="/api/search?q=សេចក្ដី&limit=20" desc="Ranked search results with match type and excerpt." />
          <Endpoint method="GET" path="/api/word/9452" desc="Full entry: headword, part of speech, IPA, raw and parsed definition, homographs." />
          <Endpoint
            method="POST"
            path="/api/check"
            desc={
              'Body: {"text": "…"} (max 5,000 chars). Returns tokens with status and suggestions, plus "issues": grammar rule matches with rule id, type, severity, start/end offsets, suggestions and a message in Khmer and English. Issues from the phrase-context check (rule "phrase-context") carry "evidence": the phrase, its meaning and the pair counts. GET with ?text= also works.'
            }
          />
          <Endpoint
            method="GET"
            path="/api/khmerdict/search?q=freedom"
            desc="khmerdict.com data: a Latin query searches English → Khmer, a Khmer query returns khmerdict's entries with pronunciation, example and etymology. 503 until the data is fetched."
          />
          <Endpoint
            method="POST"
            path="/api/review"
            desc={'Body: {"text": "…"}. Whole-sentence review by Google Gemini: issues (text, suggestion, reason, type), a summary and the corrected text. 503 when not configured.'}
          />
        </dl>
        <p className="mt-3 text-sm text-ink-2">
          Try it: <Link className="font-mono text-accent" href="/api/search?q=ធម៌">/api/search?q=ធម៌</Link>
        </p>
      </Section>

      <Section id="credits" title="Credits">
        <p className="km">
          សូមថ្លែងអំណរគុណចំពោះ Open Institute, កម្មវិធី SPICE, ពុទ្ធសាសនបណ្ឌិត្យ និង អ្នកដែលបានរួមចំណែកធ្វើឲ្យវចនានុក្រមនេះអាចប្រើបានជាឌីជីថល។
        </p>
        <p className="mt-2">
          Built with Next.js. Typeset in Kantumruy Pro and Noto Serif Khmer. Data built {new Date(meta.builtAt).toISOString().slice(0, 10)}.
        </p>
      </Section>
    </div>
  );
}

function Section({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  return (
    <section id={id} className="mb-10 scroll-mt-24 text-ink-2">
      <h2 className="mb-3 text-xl font-semibold text-ink">{title}</h2>
      {children}
    </section>
  );
}

function A({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" className="text-accent underline underline-offset-4 hover:text-accent-strong">
      {children}
    </a>
  );
}

function Sev({ s }: { s: "error" | "warning" | "hint" }) {
  const label = { error: "error", warning: "warning", hint: "hint" }[s];
  const cls = s === "hint" ? "bg-paper-3 text-ink-2" : "bg-grammar-soft text-grammar";
  return <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${cls}`}>{label}</span>;
}

function SourceLink({ source }: { source: RuleSource }) {
  const { label, url } = SOURCE_LABEL[source];
  return url ? <A href={url}>{label}</A> : <span>{label}</span>;
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <li className="rounded-xl border border-line bg-paper-2 px-4 py-3">
      <p className="text-2xl font-semibold text-ink">{value.toLocaleString()}</p>
      <p className="text-xs text-ink-3">{label}</p>
    </li>
  );
}

function Endpoint({ method, path, desc }: { method: string; path: string; desc: string }) {
  return (
    <div className="rounded-xl border border-line bg-paper-2 p-4">
      <dt className="flex flex-wrap items-center gap-2 font-mono text-sm">
        <span className="rounded bg-accent-soft px-1.5 py-0.5 text-xs font-semibold text-accent">{method}</span>
        <span className="break-all text-ink">{path}</span>
      </dt>
      <dd className="mt-1.5 text-sm text-ink-2">{desc}</dd>
    </div>
  );
}
