import type { Metadata } from "next";
import Link from "next/link";
import { POS_LEGEND } from "@/lib/dict/pos";
import { getStore } from "@/lib/dict/store";

export const metadata: Metadata = {
  title: "About",
  description: "About KhmerWord: data source, license, abbreviations and the JSON API.",
};

export default function AboutPage() {
  const { meta } = getStore();
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

      <Section id="api" title="JSON API">
        <p>Three read-only endpoints back the UI and are free to use.</p>
        <dl className="mt-3 space-y-4">
          <Endpoint method="GET" path="/api/search?q=សេចក្ដី&limit=20" desc="Ranked search results with match type and excerpt." />
          <Endpoint method="GET" path="/api/word/9452" desc="Full entry: headword, part of speech, IPA, raw and parsed definition, homographs." />
          <Endpoint method="POST" path="/api/check" desc={'Body: {"text": "…"} (max 5,000 chars). Returns tokens with status and suggestions. GET with ?text= also works.'} />
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
