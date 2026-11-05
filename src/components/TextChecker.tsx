"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import type { CheckResponse, CheckToken, TokenStatus } from "@/lib/dict/types";

const SAMPLE =
  "ខ្ញុំស្រឡាញ់ភាសាខ្មែរណាស់ ហើយខ្ញុំចង់រៀនសរសេរឲ្យបានត្រឹមត្រូវ។ វចនានុក្រមសម្ដេចជួនណាតជាឯកសារសំខាន់សម្រាប់សិស្សានុសិស្ស និងអ្នកស្រាវជ្រាវ។ តើពាក្យនេះសរសេរដូចម្ដេច: សេចក្តី ឬ សេចក្ដី?";

const STATUS: Record<
  TokenStatus,
  { en: string; km: string; chip: string; mark: string }
> = {
  dict: { en: "In Chuon Nath", km: "មានក្នុងវចនានុក្រម", chip: "bg-ok-soft text-ok", mark: "decoration-ok/60" },
  sbbic: { en: "Spelling list only", km: "មានតែក្នុងបញ្ជីអក្ខរាវិរុទ្ធ", chip: "bg-info-soft text-info", mark: "bg-info-soft/60 decoration-info/60" },
  compound: { en: "Compound of known words", km: "ផ្សំពីពាក្យស្គាល់", chip: "bg-warn-soft text-warn", mark: "bg-warn-soft decoration-warn" },
  unknown: { en: "Not found", km: "រកមិនឃើញ", chip: "bg-bad-soft text-bad", mark: "bg-bad-soft decoration-bad decoration-wavy" },
};

export function TextChecker() {
  const params = useSearchParams();
  const [text, setText] = useState(params.get("text") ?? "");
  const [result, setResult] = useState<CheckResponse | null>(null);
  const [checkedText, setCheckedText] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState<number | null>(null);
  const [showAll, setShowAll] = useState(false);
  const areaRef = useRef<HTMLTextAreaElement>(null);

  const run = useCallback(async (value: string) => {
    const t = value.trim();
    if (!t) {
      setResult(null);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/check", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ text: value }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = (await res.json()) as CheckResponse;
      setResult(json);
      setCheckedText(value);
      setOpen(null);
    } catch {
      setError("Could not check the text. Please try again.");
    } finally {
      setLoading(false);
    }
  }, []);

  // Auto-run when arriving with ?text=
  const initialRan = useRef(false);
  useEffect(() => {
    if (initialRan.current) return;
    initialRan.current = true;
    const t = params.get("text");
    if (!t) return;
    const timer = setTimeout(() => void run(t), 0);
    return () => clearTimeout(timer);
  }, [params, run]);

  function onKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
      e.preventDefault();
      void run(text);
    }
  }

  /** Replace the token at index `i` with `word`, update the textarea and re-check. */
  function replaceToken(i: number, word: string) {
    if (!result) return;
    const tokens = result.tokens.map((t, idx) => (idx === i ? { ...t, text: word } : t));
    const next = tokens.map((t) => t.text).join("");
    setText(next);
    void run(next);
  }

  const stale = result !== null && text !== checkedText;
  const unknown = result?.tokens.map((t, i) => ({ t, i })).filter((x) => x.t.status === "unknown") ?? [];

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-line bg-paper-2 shadow-card">
        <textarea
          ref={areaRef}
          lang="km"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={onKeyDown}
          rows={6}
          spellCheck={false}
          placeholder="បិទភ្ជាប់ ឬ វាយអត្ថបទខ្មែរនៅទីនេះ…  paste or type Khmer text here"
          aria-label="Khmer text to check"
          className="km w-full resize-y rounded-t-2xl bg-transparent px-5 py-4 text-lg text-ink outline-none placeholder:text-ink-3"
        />
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line px-4 py-3">
          <div className="flex items-center gap-2 text-xs text-ink-3">
            <span>{text.length.toLocaleString()} / 5,000</span>
            <span className="hidden sm:inline">· ⌘/Ctrl + Enter to check</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                setText(SAMPLE);
                void run(SAMPLE);
              }}
              className="rounded-lg px-3 py-1.5 text-sm text-ink-2 hover:bg-paper-3 hover:text-ink"
            >
              Sample
            </button>
            <button
              type="button"
              onClick={() => {
                setText("");
                setResult(null);
                areaRef.current?.focus();
              }}
              className="rounded-lg px-3 py-1.5 text-sm text-ink-2 hover:bg-paper-3 hover:text-ink"
            >
              Clear
            </button>
            <button
              type="button"
              onClick={() => void run(text)}
              disabled={loading || !text.trim()}
              className="rounded-lg bg-accent px-4 py-1.5 text-sm font-medium text-accent-ink shadow-card transition hover:bg-accent-strong disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loading ? "Checking…" : stale ? "Re-check" : "Check · ពិនិត្យ"}
            </button>
          </div>
        </div>
      </div>

      {error && <p className="rounded-xl border border-bad/30 bg-bad-soft px-4 py-3 text-sm text-bad">{error}</p>}

      {result && (
        <div className={`space-y-6 fade-up ${stale ? "opacity-60" : ""}`}>
          {/* Summary */}
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <span className="rounded-full bg-paper-3 px-3 py-1 font-medium text-ink">
              {result.summary.words.toLocaleString()} words
            </span>
            {(["dict", "sbbic", "compound", "unknown"] as const).map((k) => (
              <span key={k} className={`rounded-full px-3 py-1 ${STATUS[k].chip}`} title={STATUS[k].km}>
                {result.summary[k]} {STATUS[k].en.toLowerCase()}
              </span>
            ))}
            {result.summary.unknown === 0 && result.summary.words > 0 && (
              <span className="km-ui ml-auto text-ok">✓ គ្រប់ពាក្យត្រូវបានស្គាល់ · every word is known</span>
            )}
          </div>

          {/* Annotated text */}
          <div className="km rounded-2xl border border-line bg-paper-2 px-5 py-5 text-lg leading-[2.2] text-ink">
            {result.tokens.map((t, i) => (
              <Token key={i} token={t} index={i} open={open === i} onToggle={() => setOpen(open === i ? null : i)} onReplace={(w) => replaceToken(i, w)} />
            ))}
          </div>

          {/* Unknown words list */}
          {unknown.length > 0 && (
            <section className="space-y-3">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-ink-2">
                Not found · <span className="km-ui normal-case tracking-normal">រកមិនឃើញ</span>
              </h2>
              <ul className="grid gap-2 sm:grid-cols-2">
                {(showAll ? unknown : unknown.slice(0, 12)).map(({ t, i }) => (
                  <li key={i} className="flex flex-wrap items-center gap-2 rounded-xl border border-line bg-paper-2 px-4 py-2.5">
                    <span className="km text-lg font-semibold text-bad">{t.text}</span>
                    {t.suggestions && t.suggestions.length > 0 ? (
                      <>
                        <span className="text-xs text-ink-3">→</span>
                        {t.suggestions.map((s) => (
                          <button
                            key={s.word}
                            type="button"
                            onClick={() => replaceToken(i, s.word)}
                            title={s.id ? "Dictionary entry · click to replace" : "SBBIC word · click to replace"}
                            className={`km rounded-md border px-2 py-0.5 text-base transition hover:border-accent hover:text-accent ${
                              s.id ? "border-line-strong bg-paper" : "border-dashed border-line text-ink-2"
                            }`}
                          >
                            {s.word}
                          </button>
                        ))}
                      </>
                    ) : (
                      <span className="text-xs text-ink-3">no close match</span>
                    )}
                  </li>
                ))}
              </ul>
              {unknown.length > 12 && (
                <button type="button" onClick={() => setShowAll((v) => !v)} className="text-sm text-accent underline underline-offset-4">
                  {showAll ? "Show fewer" : `Show all ${unknown.length}`}
                </button>
              )}
            </section>
          )}

          {/* Legend */}
          <div className="flex flex-wrap gap-x-5 gap-y-2 text-xs text-ink-2">
            {(["dict", "sbbic", "compound", "unknown"] as const).map((k) => (
              <span key={k} className="flex items-center gap-1.5">
                <span className={`km inline-block rounded px-1.5 underline decoration-2 underline-offset-4 ${STATUS[k].mark}`}>ពាក្យ</span>
                {STATUS[k].en}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function Token({
  token: t,
  index,
  open,
  onToggle,
  onReplace,
}: {
  token: CheckToken;
  index: number;
  open: boolean;
  onToggle: () => void;
  onReplace: (word: string) => void;
}) {
  if (t.kind === "space") return <span>{t.text}</span>;
  if (t.kind !== "word" || !t.status) return <span className="text-ink-2">{t.text}</span>;

  const st = STATUS[t.status];
  const base = `rounded px-0.5 underline decoration-2 underline-offset-[6px] ${st.mark}`;

  if (t.status === "dict") {
    return (
      <Link href={`/word/${t.ids![0]}`} className={`${base} hover:bg-ok-soft`} title={`${st.en} · open entry`}>
        {t.text}
      </Link>
    );
  }

  const detail =
    t.status === "compound"
      ? t.parts!.map((p) => p.text).join(" + ")
      : t.status === "sbbic"
        ? t.parts
          ? `${st.en} · ${t.parts.map((p) => p.text).join(" + ")}`
          : st.en
        : t.suggestions && t.suggestions.length
          ? `Did you mean: ${t.suggestions.map((s) => s.word).join(", ")}`
          : st.en;

  return (
    <span className="relative inline-block">
      <button type="button" onClick={onToggle} className={`${base} cursor-pointer`} title={detail} aria-expanded={open} aria-controls={`tok-${index}`}>
        {t.text}
      </button>
      {open && (
        <span
          id={`tok-${index}`}
          role="dialog"
          className="absolute left-0 top-full z-20 mt-1 w-max max-w-[18rem] rounded-xl border border-line bg-paper px-3 py-2 text-sm leading-relaxed shadow-card"
        >
          <span className={`mb-1 block text-[11px] font-medium uppercase tracking-wide ${st.chip} rounded px-1.5 w-fit`}>{st.en}</span>
          {t.status === "sbbic" && t.parts && (
            <span className="mb-1 flex flex-wrap items-center gap-1">
              <span className="text-ink-3">contains</span>
              {t.parts.map((p, i) => (
                <span key={i} className="flex items-center gap-1">
                  {i > 0 && <span className="text-ink-3">+</span>}
                  {p.ids ? (
                    <Link href={`/word/${p.ids[0]}`} className="km underline decoration-dotted underline-offset-4 hover:text-accent">
                      {p.text}
                    </Link>
                  ) : (
                    <span className="km text-ink-2">{p.text}</span>
                  )}
                </span>
              ))}
            </span>
          )}
          {t.status === "compound" && (
            <span className="flex flex-wrap items-center gap-1">
              {t.parts!.map((p, i) => (
                <span key={i} className="flex items-center gap-1">
                  {i > 0 && <span className="text-ink-3">+</span>}
                  {p.ids ? (
                    <Link href={`/word/${p.ids[0]}`} className="km underline decoration-dotted underline-offset-4 hover:text-accent">
                      {p.text}
                    </Link>
                  ) : (
                    <span className="km text-ink-2">{p.text}</span>
                  )}
                </span>
              ))}
            </span>
          )}
          {t.status === "sbbic" && <span className="text-ink-2">Accepted spelling in the SBBIC list, but no Chuon Nath entry.</span>}
          {t.status === "unknown" &&
            (t.suggestions && t.suggestions.length ? (
              <span className="flex flex-wrap gap-1">
                {t.suggestions.map((s) => (
                  <button
                    key={s.word}
                    type="button"
                    onClick={() => onReplace(s.word)}
                    className="km rounded-md border border-line-strong bg-paper-2 px-2 py-0.5 hover:border-accent hover:text-accent"
                  >
                    {s.word}
                  </button>
                ))}
              </span>
            ) : (
              <span className="text-ink-2">No close match found.</span>
            ))}
        </span>
      )}
    </span>
  );
}
