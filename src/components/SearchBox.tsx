"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";
import type { MatchType, SearchResponse } from "@/lib/dict/types";

const MATCH_LABEL: Record<MatchType, { en: string; km: string; cls: string }> = {
  exact: { en: "exact", km: "ត្រូវគ្នា", cls: "bg-ok-soft text-ok" },
  prefix: { en: "starts with", km: "ផ្ដើមដោយ", cls: "bg-info-soft text-info" },
  contains: { en: "contains", km: "មាន", cls: "bg-paper-3 text-ink-2" },
  fuzzy: { en: "similar", km: "ស្រដៀង", cls: "bg-warn-soft text-warn" },
};

const EXAMPLES = ["សេចក្ដី", "ធម៌", "ស្រឡាញ់", "វចនានុក្រម", "កណ្ដាល", "ប្រាជ្ញា"];

export function SearchBox({ autoFocus = true }: { autoFocus?: boolean }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const initial = params.get("q") ?? "";

  const [query, setQuery] = useState(initial);
  const [data, setData] = useState<SearchResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [active, setActive] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const listId = useId();

  function updateQuery(value: string) {
    setQuery(value);
    if (!value.trim()) {
      setData(null);
      setLoading(false);
      setError(null);
      setActive(-1);
    }
  }

  // Debounced fetch
  useEffect(() => {
    const q = query.trim();
    if (!q) return;
    const ctrl = new AbortController();
    const t = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(q)}&limit=30`, { signal: ctrl.signal });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = (await res.json()) as SearchResponse;
        setData(json);
        setError(null);
        setActive(json.results.length ? 0 : -1);
      } catch (e) {
        if ((e as Error).name !== "AbortError") setError("Search failed. Please try again.");
      } finally {
        if (!ctrl.signal.aborted) setLoading(false);
      }
    }, 120);
    return () => {
      ctrl.abort();
      clearTimeout(t);
    };
  }, [query]);

  // Keep the URL in sync so results are shareable
  useEffect(() => {
    const q = query.trim();
    const current = params.get("q") ?? "";
    if (q === current) return;
    const t = setTimeout(() => {
      router.replace(q ? `${pathname}?q=${encodeURIComponent(q)}` : pathname, { scroll: false });
    }, 400);
    return () => clearTimeout(t);
  }, [query, params, pathname, router]);

  const results = data?.results ?? [];

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!results.length) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((a) => (a + 1) % results.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) => (a - 1 + results.length) % results.length);
    } else if (e.key === "Enter" && active >= 0) {
      e.preventDefault();
      router.push(`/word/${results[active].id}`);
    } else if (e.key === "Escape") {
      updateQuery("");
    }
  }

  return (
    <div className="w-full">
      <div className="relative">
        <svg
          aria-hidden
          viewBox="0 0 24 24"
          className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-ink-3"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <circle cx="11" cy="11" r="7" />
          <path d="m20 20-3.5-3.5" />
        </svg>
        <input
          ref={inputRef}
          type="search"
          inputMode="search"
          lang="km"
          autoFocus={autoFocus}
          autoComplete="off"
          spellCheck={false}
          value={query}
          onChange={(e) => updateQuery(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder="វាយពាក្យខ្មែរ…  type a Khmer word"
          aria-label="Search the dictionary"
          aria-controls={listId}
          aria-activedescendant={active >= 0 && results[active] ? `${listId}-${results[active].id}` : undefined}
          className="km-ui w-full rounded-2xl border border-line-strong bg-paper-2 py-4 pl-12 pr-12 text-lg text-ink shadow-card outline-none transition placeholder:text-ink-3 focus:border-accent focus:ring-4 focus:ring-accent/15 sm:text-xl"
        />
        {query && (
          <button
            type="button"
            onClick={() => {
              updateQuery("");
              inputRef.current?.focus();
            }}
            aria-label="Clear"
            className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full p-1.5 text-ink-3 hover:bg-paper-3 hover:text-ink"
          >
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M6 6l12 12M18 6 6 18" />
            </svg>
          </button>
        )}
      </div>

      {!query.trim() && (
        <div className="mt-4 flex flex-wrap items-center gap-2 text-sm text-ink-2">
          <span>Try:</span>
          {EXAMPLES.map((w) => (
            <button
              key={w}
              type="button"
              onClick={() => updateQuery(w)}
              className="km rounded-full border border-line bg-paper-2 px-3 py-0.5 text-base text-ink hover:border-accent hover:text-accent"
            >
              {w}
            </button>
          ))}
        </div>
      )}

      {query.trim() && (
        <div className="mt-5" aria-live="polite">
          <div className="mb-2 flex items-center justify-between px-1 text-xs text-ink-3">
            <span>
              {loading && !data ? "Searching…" : data ? `${data.total.toLocaleString()} result${data.total === 1 ? "" : "s"}` : ""}
              {data && data.normalized !== data.query.trim() && data.normalized && (
                <span className="ml-2">
                  · normalised as <span className="km text-ink-2">{data.normalized}</span>
                </span>
              )}
            </span>
            <span className="hidden sm:inline">↑ ↓ to move · Enter to open</span>
          </div>

          {error && <p className="rounded-xl border border-bad/30 bg-bad-soft px-4 py-3 text-sm text-bad">{error}</p>}

          {data && results.length === 0 && !loading && (
            <div className="fade-up rounded-2xl border border-dashed border-line-strong px-5 py-8 text-center">
              <p className="km text-lg">រកមិនឃើញ</p>
              <p className="mt-1 text-sm text-ink-2">
                No entry matches <span className="km text-ink">{data.query}</span>. Try{" "}
                <Link href={`/check?text=${encodeURIComponent(data.query)}`} className="text-accent underline underline-offset-4">
                  checking it as text
                </Link>{" "}
                for spelling suggestions.
              </p>
            </div>
          )}

          {results.length > 0 && (
            <ul id={listId} role="listbox" className="fade-up divide-y divide-line overflow-hidden rounded-2xl border border-line bg-paper-2 shadow-card">
              {results.map((r, i) => {
                const m = MATCH_LABEL[r.match];
                return (
                  <li key={r.id} id={`${listId}-${r.id}`} role="option" aria-selected={i === active}>
                    <Link
                      href={`/word/${r.id}`}
                      onMouseEnter={() => setActive(i)}
                      className={`flex items-start gap-3 px-4 py-3 transition-colors sm:px-5 ${
                        i === active ? "bg-accent-soft/70" : "hover:bg-paper-3/60"
                      }`}
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="km text-xl font-semibold leading-snug text-ink">{r.word}</span>
                          {r.pos && <span className="km-ui rounded-md bg-paper-3 px-1.5 text-[11px] text-ink-2">{r.pos}</span>}
                          <span className={`rounded-md px-1.5 py-px text-[10px] font-medium uppercase tracking-wide ${m.cls}`} title={m.km}>
                            {m.en}
                          </span>
                        </div>
                        {r.excerpt && <p className="km mt-0.5 line-clamp-2 text-sm text-ink-2">{r.excerpt}</p>}
                      </div>
                      <span aria-hidden className="mt-2 text-ink-3">→</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
