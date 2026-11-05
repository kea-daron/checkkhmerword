import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { cacheLife } from "next/cache";
import { DefinitionView } from "@/components/DefinitionView";
import { PosBadge } from "@/components/PosBadge";
import { excerpt } from "@/lib/dict/definition";
import { firstLetter } from "@/lib/khmer/normalize";
import {
  getDefinition,
  getEntry,
  getHomographs,
  getIpa,
  getNeighbours,
} from "@/lib/dict/store";

export async function generateMetadata({ params }: PageProps<"/word/[id]">): Promise<Metadata> {
  const { id } = await params;
  const entry = getEntry(Number(id));
  if (!entry) return { title: "Not found" };
  const def = getDefinition(entry.id) ?? "";
  return {
    title: entry.word,
    description: excerpt(def, 160),
  };
}

// The static shell streams immediately; the entry resolves inside Suspense.
// Malformed or out-of-range ids are rejected with a real 404 in src/proxy.ts.
export default function WordPage({ params }: PageProps<"/word/[id]">) {
  return (
    <Suspense fallback={<EntrySkeleton />}>
      <EntryLoader params={params} />
    </Suspense>
  );
}

async function EntryLoader({ params }: { params: PageProps<"/word/[id]">["params"] }) {
  const { id } = await params;
  return <Entry id={id} />;
}

async function Entry({ id }: { id: string }) {
  "use cache";
  cacheLife("max");

  const numeric = Number(id);
  const entry = Number.isInteger(numeric) ? getEntry(numeric) : undefined;
  if (!entry) notFound();

  const def = getDefinition(entry.id) ?? "";
  const ipa = getIpa(entry.word);
  const homographs = getHomographs(entry.id);
  const { prev, next } = getNeighbours(entry.id);
  const letter = firstLetter(entry.word);

  return (
    <article className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-12">
      <nav aria-label="Breadcrumb" className="mb-6 flex flex-wrap items-center gap-2 text-sm text-ink-2">
        <Link href="/" className="hover:text-ink">Search</Link>
        <span aria-hidden>/</span>
        {letter ? (
          <Link href={`/browse/${encodeURIComponent(letter)}`} className="km hover:text-ink">{letter}</Link>
        ) : (
          <Link href="/browse" className="hover:text-ink">Browse</Link>
        )}
        <span aria-hidden>/</span>
        <span className="km text-ink">{entry.word}</span>
      </nav>

      <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_16rem]">
        <div className="min-w-0">
          <header className="border-b border-line pb-6">
            <div className="flex flex-wrap items-end gap-x-4 gap-y-2">
              <h1 className="km text-5xl font-semibold leading-tight text-ink sm:text-6xl">{entry.word}</h1>
              {entry.pos && <PosBadge pos={entry.pos} size="md" />}
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-3 text-sm text-ink-2">
              {ipa.length > 0 && (
                <span className="flex flex-wrap items-center gap-1.5">
                  <span className="text-ink-3">IPA</span>
                  {ipa.map((p) => (
                    <span key={p} className="rounded-md bg-paper-2 px-2 py-0.5 font-mono text-ink">{p}</span>
                  ))}
                </span>
              )}
              <span className="text-ink-3">Entry #{entry.id}</span>
              <Link
                href={`/?text=${encodeURIComponent(entry.word)}`}
                className="text-accent underline decoration-dotted underline-offset-4 hover:decoration-solid"
              >
                Check in text
              </Link>
            </div>
            {homographs.length > 0 && (
              <p className="mt-3 flex flex-wrap items-center gap-2 text-sm text-ink-2">
                <span>Also:</span>
                {homographs.map((h) => (
                  <Link key={h.id} href={`/word/${h.id}`} className="rounded-md border border-line bg-paper-2 px-2 py-0.5 hover:border-accent hover:text-accent">
                    <span className="km">{h.word}</span>
                    {h.pos && <span className="km-ui ml-1.5 text-xs text-ink-3">{h.pos}</span>}
                  </Link>
                ))}
              </p>
            )}
          </header>

          <section className="pt-6" aria-label="Definition">
            <DefinitionView raw={def} currentId={entry.id} />
          </section>

          <nav aria-label="Adjacent entries" className="mt-10 grid grid-cols-2 gap-3 border-t border-line pt-6 text-sm">
            {prev ? (
              <Link href={`/word/${prev.id}`} className="group rounded-xl border border-line bg-paper-2 px-4 py-3 hover:border-accent/60">
                <span className="block text-xs text-ink-3">← Previous</span>
                <span className="km text-lg text-ink group-hover:text-accent">{prev.word}</span>
              </Link>
            ) : <span />}
            {next ? (
              <Link href={`/word/${next.id}`} className="group rounded-xl border border-line bg-paper-2 px-4 py-3 text-right hover:border-accent/60">
                <span className="block text-xs text-ink-3">Next →</span>
                <span className="km text-lg text-ink group-hover:text-accent">{next.word}</span>
              </Link>
            ) : <span />}
          </nav>
        </div>

        <aside className="space-y-4 text-sm lg:sticky lg:top-24 lg:self-start">
          <div className="rounded-2xl border border-line bg-paper-2 p-4">
            <p className="font-semibold text-ink">About this entry</p>
            <p className="mt-2 text-ink-2">
              From the Chuon Nath Khmer Dictionary (Buddhist Institute, 1967). Words underlined with dots link to their own entries.
            </p>
            {entry.pos && (
              <p className="mt-2 text-ink-2">
                <span className="km-ui font-medium text-ink">{entry.pos}</span> is the part-of-speech label as printed. See{" "}
                <Link href="/about#abbreviations" className="text-accent underline underline-offset-4">abbreviations</Link>.
              </p>
            )}
          </div>
          <div className="rounded-2xl border border-line bg-paper-2 p-4">
            <p className="font-semibold text-ink">JSON</p>
            <p className="mt-1 break-all font-mono text-xs text-ink-2">
              <Link href={`/api/word/${entry.id}`} className="hover:text-accent">/api/word/{entry.id}</Link>
            </p>
          </div>
        </aside>
      </div>
    </article>
  );
}

function EntrySkeleton() {
  return (
    <div className="mx-auto max-w-6xl animate-pulse px-4 py-12 sm:px-6">
      <div className="h-4 w-40 rounded bg-paper-3" />
      <div className="mt-8 h-14 w-64 rounded bg-paper-3" />
      <div className="mt-8 space-y-3">
        <div className="h-4 w-full rounded bg-paper-3" />
        <div className="h-4 w-11/12 rounded bg-paper-3" />
        <div className="h-4 w-3/4 rounded bg-paper-3" />
      </div>
    </div>
  );
}
