"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";
import type { MatchType, SearchResponse } from "@/lib/dict/types";
import { excerpt } from "@/lib/dict/definition";
import { hasKhmer, normalizeKey } from "@/lib/khmer/normalize";
import { KHMERDICT_SITE, type KdEnResult, type KdKmResult, type KdSearchResponse } from "@/lib/khmerdict/types";

const MATCH_LABEL: Record<MatchType, { en: string; km: string; cls: string }> = {
  exact: { en: "exact", km: "ត្រូវគ្នា", cls: "bg-accent-soft text-accent" },
  prefix: { en: "starts with", km: "ផ្ដើមដោយ", cls: "bg-info-soft text-info" },
  contains: { en: "contains", km: "មាន", cls: "bg-paper-3 text-ink-2" },
  fuzzy: { en: "similar", km: "ស្រដៀង", cls: "bg-warn-soft text-warn" },
};

const EXAMPLES = ["សេចក្ដី", "ធម៌", "ស្រឡាញ់", "វចនានុក្រម", "freedom", "ប្រាជ្ញា"];

/** How many khmerdict.com extras to show under the Chuon Nath results. */
const KD_EXTRA_LIMIT = 6;

type KdState = { kind: "idle" } | { kind: "ok"; data: KdSearchResponse } | { kind: "missing" } | { kind: "error" };

export function SearchBox({ autoFocus = true }: { autoFocus?: boolean }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const initial = params.get("q") ?? "";

  const [query, setQuery] = useState(initial);
  const [data, setData] = useState<SearchResponse | null>(null);
  const [kd, setKd] = useState<KdState>({ kind: "idle" });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [active, setActive] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const listId = useId();

  function updateQuery(value: string) {
    setQuery(value);
    if (!value.trim()) {
      setData(null);
      setKd({ kind: "idle" });
      setLoading(false);
      setError(null);
      setActive(-1);
    }
  }

  // Debounced fetch. A Khmer query asks the Chuon Nath index and, alongside it,
  // khmerdict.com's entries; a Latin query is an English → Khmer lookup only.
  useEffect(() => {
    const q = query.trim();
    if (!q) return;
    const ctrl = new AbortController();
    const khmer = hasKhmer(q);
    const t = setTimeout(async () => {
      setLoading(true);
      const kdPromise: Promise<KdState> = fetch(`/api/khmerdict/search?q=${encodeURIComponent(q)}&limit=${khmer ? 20 : 30}`, { signal: ctrl.signal })
        .then(async (res): Promise<KdState> => {
          if (res.status === 503) return { kind: "missing" };
          if (!res.ok) return { kind: "error" };
          return { kind: "ok", data: (await res.json()) as KdSearchResponse };
        })
        .catch((e): KdState => (e instanceof Error && e.name === "AbortError" ? { kind: "idle" } : { kind: "error" }));
      try {
        if (khmer) {
          const res = await fetch(`/api/search?q=${encodeURIComponent(q)}&limit=30`, { signal: ctrl.signal });
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          const json = (await res.json()) as SearchResponse;
          setData(json);
          setError(null);
          setActive(json.results.length ? 0 : -1);
        } else {
          setData(null);
          setError(null);
          setActive(-1);
        }
        const kdState = await kdPromise;
        if (!ctrl.signal.aborted) setKd(kdState);
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
  const englishMode = !!query.trim() && !hasKhmer(query);

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
          placeholder="វាយពាក្យខ្មែរ ឬអង់គ្លេស…  Khmer or English word"
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

      {englishMode && <EnglishResults query={query.trim()} state={kd} loading={loading} onPick={updateQuery} />}

      {query.trim() && !englishMode && (
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
                <Link href={`/?text=${encodeURIComponent(data.query)}`} className="text-accent underline underline-offset-4">
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

          {kd.kind === "ok" && kd.data.lang === "km" && (
            <KhmerDictExtras results={kd.data.results} localWords={results.map((r) => normalizeKey(r.word))} />
          )}
        </div>
      )}
    </div>
  );
}

function ExternalIcon() {
  return (
    <svg aria-hidden viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 4h6v6M20 4l-9 9M19 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1h5" />
    </svg>
  );
}

function KhmerDictLink({ href, children = "khmerdict.com" }: { href: string; children?: React.ReactNode }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-1 text-xs text-ink-3 hover:text-accent"
      title="Open on khmerdict.com"
    >
      {children}
      <ExternalIcon />
    </a>
  );
}

/** Khmer senses are comma-separated; each becomes a chip that searches that word. */
function senses(definition: string): string[] {
  return definition
    .split(/[,;]/)
    .map((s) => s.replace(/[​‌‍]/g, "").trim())
    .filter(Boolean);
}

function EnglishResults({
  query,
  state,
  loading,
  onPick,
}: {
  query: string;
  state: KdState;
  loading: boolean;
  onPick: (word: string) => void;
}) {
  const results: KdEnResult[] = state.kind === "ok" && state.data.lang === "en" ? state.data.results : [];
  return (
    <div className="mt-5" aria-live="polite">
      <div className="mb-2 flex items-center justify-between px-1 text-xs text-ink-3">
        <span>
          {loading && state.kind === "idle" ? "Searching…" : state.kind === "ok" ? `${state.data.total.toLocaleString()} result${state.data.total === 1 ? "" : "s"}` : ""}
          <span className="ml-2">· English → Khmer</span>
        </span>
        <KhmerDictLink href={KHMERDICT_SITE + encodeURIComponent(query)}>Data: khmerdict.com</KhmerDictLink>
      </div>

      {state.kind === "missing" && (
        <div className="rounded-2xl border border-dashed border-line-strong px-5 py-6 text-sm text-ink-2">
          <p>English → Khmer lookup uses the khmerdict.com data set, which is not installed on this server.</p>
          <p className="mt-1">
            Run <code className="rounded bg-paper-3 px-1.5 py-0.5 font-mono text-xs text-ink">npm run fetch:khmerdict</code> and restart.
          </p>
        </div>
      )}
      {state.kind === "error" && <p className="rounded-xl border border-bad/30 bg-bad-soft px-4 py-3 text-sm text-bad">Search failed. Please try again.</p>}

      {state.kind === "ok" && results.length === 0 && !loading && (
        <div className="fade-up rounded-2xl border border-dashed border-line-strong px-5 py-8 text-center">
          <p className="text-lg">Not found</p>
          <p className="mt-1 text-sm text-ink-2">
            No English entry matches <span className="text-ink">{query}</span>.
          </p>
        </div>
      )}

      {results.length > 0 && (
        <ul className="fade-up divide-y divide-line overflow-hidden rounded-2xl border border-line bg-paper-2 shadow-card">
          {results.map((r, i) => {
            const m = MATCH_LABEL[r.match];
            return (
              <li key={`${r.word}-${i}`} className="px-4 py-3 sm:px-5">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-lg font-semibold leading-snug text-ink">{r.word}</span>
                  {r.pos && <span className="rounded-md bg-paper-3 px-1.5 text-[11px] text-ink-2">{r.pos}</span>}
                  <span className={`rounded-md px-1.5 py-px text-[10px] font-medium uppercase tracking-wide ${m.cls}`} title={m.km}>
                    {m.en}
                  </span>
                  <span className="ml-auto">
                    <KhmerDictLink href={r.url} />
                  </span>
                </div>
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {senses(r.definition).map((s, j) => (
                    <button
                      key={`${s}-${j}`}
                      type="button"
                      onClick={() => onPick(s)}
                      title="Look up in the Chuon Nath dictionary"
                      className="km rounded-lg border border-line bg-paper px-2.5 py-0.5 text-base text-ink transition hover:border-accent hover:text-accent"
                    >
                      {s}
                    </button>
                  ))}
                </div>
                {(r.example || r.notes) && (
                  <p className="km mt-1.5 text-sm text-ink-2">
                    {r.example && <span>{r.example.replace(/[​‌‍]/g, "")}</span>}
                    {r.example && r.notes && <span className="mx-1.5 text-ink-3">·</span>}
                    {r.notes && <span className="text-ink-3">{r.notes}</span>}
                  </p>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

/**
 * Entries khmerdict.com has for the same query that the Chuon Nath index did
 * not return, mostly sub-entries (compounds listed under a headword) and
 * their pronunciations and examples.
 */
function KhmerDictExtras({ results, localWords }: { results: KdKmResult[]; localWords: string[] }) {
  const local = new Set(localWords);
  const extras = results.filter((r) => !local.has(normalizeKey(r.word))).slice(0, KD_EXTRA_LIMIT);
  if (!extras.length) return null;
  return (
    <div className="fade-up mt-6">
      <div className="mb-2 flex items-center justify-between px-1 text-xs text-ink-3">
        <span className="km-ui">
          បន្ថែមពី khmerdict.com <span className="ml-1">· more on khmerdict.com</span>
        </span>
        <KhmerDictLink href={KHMERDICT_SITE + encodeURIComponent(extras[0].word)}>Open site</KhmerDictLink>
      </div>
      <ul className="divide-y divide-line overflow-hidden rounded-2xl border border-line bg-paper-2/60">
        {extras.map((r) => (
          <li key={r.id} className="px-4 py-2.5 sm:px-5">
            <div className="flex flex-wrap items-center gap-2">
              <a href={r.url} target="_blank" rel="noopener noreferrer" className="km text-lg font-semibold leading-snug text-ink hover:text-accent">
                {r.word}
              </a>
              {r.level === 2 && (
                <span className="km-ui text-[11px] text-ink-3" title="Sub-entry of">
                  ‹ {r.head}
                </span>
              )}
              {r.pos && <span className="km-ui rounded-md bg-paper-3 px-1.5 text-[11px] text-ink-2">{r.pos}</span>}
              {r.pronunciation && <span className="km text-xs text-ink-3">{r.pronunciation}</span>}
              <span className="ml-auto">
                <KhmerDictLink href={r.url} />
              </span>
            </div>
            <p className="km mt-0.5 line-clamp-2 text-sm text-ink-2">{excerpt(r.definition, 120)}</p>
            {r.example && <p className="km mt-0.5 line-clamp-1 text-sm text-ink-3">ឧ. {r.example}</p>}
          </li>
        ))}
      </ul>
    </div>
  );
}
