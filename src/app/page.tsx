import Link from "next/link";
import { Suspense } from "react";
import { cacheLife } from "next/cache";
import { SearchBox } from "@/components/SearchBox";
import { PosBadge } from "@/components/PosBadge";
import { excerpt } from "@/lib/dict/definition";
import { getDefinition, getLetters, getStore, getTodayEntry } from "@/lib/dict/store";

export default function HomePage() {
  const { meta } = getStore();
  return (
    <div className="mx-auto max-w-6xl px-4 sm:px-6">
      <section className="pt-12 pb-10 sm:pt-20 sm:pb-14">
        <div className="mx-auto max-w-3xl text-center">
          <p className="km-ui text-sm font-medium uppercase tracking-[0.2em] text-accent">វចនានុក្រមខ្មែរ · ជួន ណាត · ១៩៦៧</p>
          <h1 className="km mt-3 text-4xl font-semibold leading-tight text-ink sm:text-5xl">
            ពិនិត្យ និង ស្វែងរកពាក្យខ្មែរ
          </h1>
          <p className="mt-3 text-base text-ink-2 sm:text-lg">
            Check and look up Khmer words in the Chuon Nath Dictionary.{" "}
            <span className="whitespace-nowrap">{meta.entries.toLocaleString()} entries</span>, cross-linked and
            searchable with spelling-tolerant matching.
          </p>
        </div>
        <div className="mx-auto mt-8 max-w-3xl">
          <Suspense fallback={<div className="h-16 rounded-2xl border border-line bg-paper-2" />}>
            <SearchBox />
          </Suspense>
        </div>
      </section>

      <section className="grid gap-5 lg:grid-cols-3">
        <Link
          href="/check"
          className="group relative overflow-hidden rounded-2xl border border-line bg-paper-2 p-6 shadow-card transition hover:border-accent/60"
        >
          <span className="absolute -right-6 -top-6 km text-[7rem] leading-none text-accent/10 transition group-hover:text-accent/20">៛</span>
          <p className="text-xs font-semibold uppercase tracking-wide text-accent">Check text · ពិនិត្យអត្ថបទ</p>
          <h2 className="mt-2 text-xl font-semibold">Paste a paragraph, spot unknown words</h2>
          <p className="mt-2 text-sm text-ink-2">
            Khmer is written without spaces. We segment your text, verify each word against the dictionary and the
            SBBIC spelling list, and suggest close matches for anything we don&apos;t recognise.
          </p>
          <span className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-accent">
            Open the checker <span aria-hidden>→</span>
          </span>
        </Link>

        <Suspense fallback={<div className="rounded-2xl border border-line bg-paper-2 p-6 shadow-card" />}>
          <WordOfTheDay />
        </Suspense>

        <div className="rounded-2xl border border-line bg-paper-2 p-6 shadow-card">
          <p className="text-xs font-semibold uppercase tracking-wide text-accent">Browse · រុករក</p>
          <h2 className="mt-2 text-xl font-semibold">By first letter</h2>
          <LetterCloud />
        </div>
      </section>

      <section className="mt-14 grid gap-8 border-t border-line pt-10 text-sm text-ink-2 sm:grid-cols-3">
        <div>
          <p className="font-semibold text-ink">Spelling-tolerant search</p>
          <p className="mt-1">
            Zero-width spaces, <span className="km">ាំ/ំា</span> ordering, legacy <span className="km">េី/ើ</span>, and{" "}
            <span className="km">្ដ/្ត</span> are normalised so you still find the word.
          </p>
        </div>
        <div>
          <p className="font-semibold text-ink">Cross-referenced definitions</p>
          <p className="mt-1">
            Every word inside a definition that has its own entry is a link, exactly as the SPICE data encodes it.
          </p>
        </div>
        <div>
          <p className="font-semibold text-ink">Open data, open API</p>
          <p className="mt-1">
            Dictionary data by the Open Institute (LGPL 2.1).{" "}
            <Link href="/about#api" className="text-accent underline underline-offset-4">
              JSON endpoints
            </Link>{" "}
            for search and checking are available.
          </p>
        </div>
      </section>
    </div>
  );
}

async function WordOfTheDay() {
  "use cache";
  cacheLife("hours");
  const e = getTodayEntry();
  const def = getDefinition(e.id) ?? "";
  return (
    <Link href={`/word/${e.id}`} className="group rounded-2xl border border-line bg-paper-2 p-6 shadow-card transition hover:border-accent/60">
      <p className="text-xs font-semibold uppercase tracking-wide text-accent">Word of the day · ពាក្យប្រចាំថ្ងៃ</p>
      <div className="mt-2 flex flex-wrap items-baseline gap-2">
        <span className="km text-3xl font-semibold text-ink group-hover:text-accent">{e.word}</span>
        {e.pos && <PosBadge pos={e.pos} />}
      </div>
      <p className="km mt-2 line-clamp-3 text-sm text-ink-2">{excerpt(def, 160)}</p>
    </Link>
  );
}

function LetterCloud() {
  const letters = getLetters().filter((l) => l.letter !== "#");
  return (
    <div className="km mt-3 flex flex-wrap gap-1.5">
      {letters.map((l) => (
        <Link
          key={l.letter}
          href={`/browse/${encodeURIComponent(l.letter)}`}
          title={`${l.count.toLocaleString()} entries`}
          className="flex h-9 w-9 items-center justify-center rounded-lg border border-line bg-paper text-lg text-ink transition hover:border-accent hover:text-accent"
        >
          {l.letter}
        </Link>
      ))}
    </div>
  );
}
