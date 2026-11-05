import Link from "next/link";
import { notFound } from "next/navigation";
import { getEntriesByLetter, getLetters } from "@/lib/dict/store";

export const PAGE_SIZE = 200;

export function pageCount(letter: string): number {
  return Math.max(1, Math.ceil(getEntriesByLetter(letter).length / PAGE_SIZE));
}

function letterHref(letter: string, page: number) {
  const base = `/browse/${encodeURIComponent(letter)}`;
  return page <= 1 ? base : `${base}/${page}`;
}

export function LetterList({ letter, page }: { letter: string; page: number }) {
  const letters = getLetters();
  const idx = letters.findIndex((x) => x.letter === letter);
  if (idx < 0) notFound();
  const all = getEntriesByLetter(letter);
  const pages = Math.max(1, Math.ceil(all.length / PAGE_SIZE));
  if (!Number.isInteger(page) || page < 1 || page > pages) notFound();

  const start = (page - 1) * PAGE_SIZE;
  const entries = all.slice(start, start + PAGE_SIZE);
  const prevLetter = letters[idx - 1];
  const nextLetter = letters[idx + 1];
  const label = letter === "#" ? "Other" : letter;

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 sm:py-14">
      <nav aria-label="Breadcrumb" className="mb-6 flex items-center gap-2 text-sm text-ink-2">
        <Link href="/browse" className="hover:text-ink">Browse</Link>
        <span aria-hidden>/</span>
        <span className="km text-ink">{label}</span>
        {pages > 1 && (
          <>
            <span aria-hidden>/</span>
            <span>Page {page}</span>
          </>
        )}
      </nav>

      <header className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div className="flex items-end gap-4">
          <span className="km flex h-20 w-20 items-center justify-center rounded-2xl bg-accent text-5xl text-accent-ink shadow-card">
            {letter === "#" ? "៚" : letter}
          </span>
          <div>
            <h1 className="text-3xl font-semibold tracking-tight">{all.length.toLocaleString()} entries</h1>
            <p className="text-ink-2">
              {letter === "#" ? "Headwords starting with a sign or punctuation" : <>Starting with <span className="km text-ink">{letter}</span></>}
              {pages > 1 && (
                <span className="text-ink-3">
                  {" "}· showing {start + 1}–{Math.min(start + PAGE_SIZE, all.length)}
                </span>
              )}
            </p>
          </div>
        </div>
        <div className="flex gap-2 text-sm">
          {prevLetter && (
            <Link href={letterHref(prevLetter.letter, 1)} className="rounded-lg border border-line bg-paper-2 px-3 py-1.5 hover:border-accent">
              ← <span className="km">{prevLetter.letter}</span>
            </Link>
          )}
          {nextLetter && (
            <Link href={letterHref(nextLetter.letter, 1)} className="rounded-lg border border-line bg-paper-2 px-3 py-1.5 hover:border-accent">
              <span className="km">{nextLetter.letter}</span> →
            </Link>
          )}
        </div>
      </header>

      {pages > 1 && <Pager letter={letter} page={page} pages={pages} all={all.map((e) => e.word)} />}

      <ul className="columns-2 gap-x-8 sm:columns-3 lg:columns-4">
        {entries.map((e) => (
          <li key={e.id} className="break-inside-avoid">
            <Link href={`/word/${e.id}`} className="flex items-baseline justify-between gap-2 rounded-md px-2 py-1 hover:bg-paper-2">
              <span className="km text-lg text-ink">{e.word}</span>
              {e.pos && <span className="km-ui shrink-0 text-xs text-ink-3">{e.pos}</span>}
            </Link>
          </li>
        ))}
      </ul>

      {pages > 1 && (
        <div className="mt-8">
          <Pager letter={letter} page={page} pages={pages} all={all.map((e) => e.word)} />
        </div>
      )}
    </div>
  );
}

/** Page links labelled with the first headword of each page, so the pager doubles as an index. */
function Pager({ letter, page, pages, all }: { letter: string; page: number; pages: number; all: string[] }) {
  return (
    <nav aria-label="Pages" className="mb-6 flex flex-wrap gap-1.5 text-sm">
      {Array.from({ length: pages }, (_, i) => i + 1).map((p) => {
        const first = all[(p - 1) * PAGE_SIZE] ?? "";
        const active = p === page;
        return (
          <Link
            key={p}
            href={letterHref(letter, p)}
            aria-current={active ? "page" : undefined}
            title={`Page ${p}`}
            className={`km rounded-md border px-2.5 py-1 ${
              active ? "border-accent bg-accent-soft text-ink" : "border-line bg-paper-2 text-ink-2 hover:border-accent hover:text-ink"
            }`}
          >
            {first}
          </Link>
        );
      })}
    </nav>
  );
}
