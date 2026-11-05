import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { cacheLife } from "next/cache";
import { ModeTabs } from "@/components/ModeTabs";
import { SearchBox } from "@/components/SearchBox";
import { PosBadge } from "@/components/PosBadge";
import { excerpt } from "@/lib/dict/definition";
import { getDefinition, getLetters, getStore, getTodayEntry } from "@/lib/dict/store";

export const metadata: Metadata = {
  title: "វចនានុក្រម · Dictionary",
  description: "Search the Chuon Nath Khmer Dictionary with spelling-tolerant matching.",
};

export default function SearchPage() {
  const { meta } = getStore();
  return (
    <div className="mx-auto max-w-6xl px-4 sm:px-6">
      <section className="pt-10 pb-6 text-center sm:pt-14">
        <h1 className="km text-4xl font-semibold leading-tight text-ink sm:text-5xl">វចនានុក្រមខ្មែរ ជួន ណាត</h1>
        <p className="km-ui mt-3 text-base text-ink-2 sm:text-lg">ស្វែងរកពាក្យ និងនិយមន័យ · {meta.entries.toLocaleString()} ពាក្យ</p>
        <p className="mt-1 text-sm text-ink-3">Look up any word in the Chuon Nath Dictionary (1967). Cross-references inside definitions are links.</p>
      </section>

      <div className="mb-8">
        <ModeTabs active="search" />
      </div>

      <div className="mx-auto max-w-3xl">
        <Suspense fallback={<div className="h-16 rounded-2xl border border-line bg-paper-2" />}>
          <SearchBox />
        </Suspense>
      </div>

      <section className="mt-12 grid gap-5 lg:grid-cols-2">
        <Suspense fallback={<div className="rounded-2xl border border-line bg-paper-2 p-6 shadow-card" />}>
          <WordOfTheDay />
        </Suspense>
        <div className="rounded-2xl border border-line bg-paper-2 p-6 shadow-card">
          <p className="km-ui text-xs font-semibold uppercase tracking-wide text-accent">រុករកតាមអក្សរ · Browse</p>
          <LetterCloud />
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
      <p className="km-ui text-xs font-semibold uppercase tracking-wide text-accent">ពាក្យប្រចាំថ្ងៃ · Word of the day</p>
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
