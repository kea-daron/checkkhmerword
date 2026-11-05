import type { Metadata } from "next";
import Link from "next/link";
import { KHMER_CONSONANTS, KHMER_INDEPENDENT_VOWELS } from "@/lib/khmer/normalize";
import { getLetters } from "@/lib/dict/store";

export const metadata: Metadata = {
  title: "Browse · រុករក",
  description: "Browse the Chuon Nath dictionary by first letter.",
};

export default function BrowsePage() {
  const counts = new Map(getLetters().map((l) => [l.letter, l.count]));
  const consonants = KHMER_CONSONANTS.filter((c) => counts.has(c));
  const vowels = KHMER_INDEPENDENT_VOWELS.filter((v) => counts.has(v));
  const other = counts.get("#") ?? 0;

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 sm:py-14">
      <header className="mb-8">
        <p className="km-ui text-sm font-medium uppercase tracking-[0.2em] text-accent">រុករកតាមអក្សរ</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">Browse by letter</h1>
        <p className="mt-2 text-ink-2">Entries are grouped by their first consonant or independent vowel, in dictionary order.</p>
      </header>

      <LetterGrid title="Consonants · ព្យញ្ជនៈ" letters={consonants} counts={counts} />
      <LetterGrid title="Independent vowels · ស្រៈពេញតួ" letters={vowels} counts={counts} />
      {other > 0 && (
        <p className="mt-8 text-sm text-ink-2">
          <Link href="/browse/%23" className="text-accent underline underline-offset-4">{other} entries</Link> start with a sign or punctuation.
        </p>
      )}
    </div>
  );
}

function LetterGrid({ title, letters, counts }: { title: string; letters: readonly string[]; counts: Map<string, number> }) {
  return (
    <section className="mb-10">
      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-ink-2">{title}</h2>
      <ul className="grid grid-cols-4 gap-2 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-11">
        {letters.map((l) => (
          <li key={l}>
            <Link
              href={`/browse/${encodeURIComponent(l)}`}
              className="group flex flex-col items-center rounded-xl border border-line bg-paper-2 py-3 transition hover:border-accent hover:shadow-card"
            >
              <span className="km text-3xl text-ink group-hover:text-accent">{l}</span>
              <span className="mt-1 text-xs text-ink-3">{counts.get(l)?.toLocaleString()}</span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
