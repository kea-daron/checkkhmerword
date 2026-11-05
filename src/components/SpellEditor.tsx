"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { CheckResponse, CheckToken } from "@/lib/dict/types";

const MAX = 5000;
const SAMPLE =
  "ដើម្បីស្វែងរក និងពិនិត្យអក្ខរាវិរុទ្ធ អ្នកអាចវាយអត្ថបទខ្មែរនៅទីនេះ។ ពាក្យណាដែលរកមិនឃើញក្នុងវចនានុក្រមសម្ដេចជួនណាត នឹងត្រូវគូសបន្ទាត់ក្រហម ដូចជា វចនានុក្រុម ឬ សេចក្ដីស្រឡាញ។ ចុចលើពាក្យនោះដើម្បីមើលការណែនាំ។";

type Checked = { text: string; result: CheckResponse };
type Span = { token: CheckToken; index: number; start: number; end: number };
type Popover = { index: number; left: number; top: number };

const EDITOR_CLASS =
  "km w-full px-5 py-4 text-lg leading-[2.1] sm:px-6 sm:text-xl whitespace-pre-wrap [overflow-wrap:break-word] [word-break:normal]";

export function SpellEditor() {
  const params = useSearchParams();
  const [text, setText] = useState(() => params.get("text") ?? "");
  const [checked, setChecked] = useState<Checked | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showSbbic, setShowSbbic] = useState(false);
  const [popover, setPopover] = useState<Popover | null>(null);
  const [copied, setCopied] = useState(false);

  const areaRef = useRef<HTMLTextAreaElement>(null);
  const backdropRef = useRef<HTMLDivElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const reqId = useRef(0);

  const run = useCallback(async (value: string) => {
    const id = ++reqId.current;
    if (!value.trim()) {
      setChecked(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/check", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ text: value }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const result = (await res.json()) as CheckResponse;
      if (id !== reqId.current) return;
      setChecked({ text: value, result });
      setError(null);
    } catch {
      if (id === reqId.current) setError("មិនអាចពិនិត្យបានទេ សូមព្យាយាមម្ដងទៀត។");
    } finally {
      if (id === reqId.current) setLoading(false);
    }
  }, []);

  // Live checking: wait for a pause in typing.
  useEffect(() => {
    if (!text.trim() || checked?.text === text) return;
    const t = setTimeout(() => void run(text), 450);
    return () => clearTimeout(t);
  }, [text, checked, run]);

  // Auto-grow the textarea so the mirror never needs to scroll separately.
  useLayoutEffect(() => {
    const area = areaRef.current;
    if (!area) return;
    area.style.height = "0px";
    area.style.height = `${area.scrollHeight}px`;
  }, [text]);

  const live = checked !== null && checked.text === text;
  const result = live ? checked.result : null;

  const spans = useMemo<Span[]>(() => {
    if (!result) return [];
    let pos = 0;
    return result.tokens.map((token, index) => {
      const start = pos;
      pos += token.text.length;
      return { token, index, start, end: pos };
    });
  }, [result]);

  const isMarked = useCallback(
    (t: CheckToken) => t.kind === "word" && (t.status === "unknown" || (showSbbic && (t.status === "sbbic" || t.status === "compound"))),
    [showSbbic],
  );

  function onChange(value: string) {
    setText(value);
    setPopover(null);
    if (!value.trim()) setChecked(null);
  }

  function updatePopover() {
    const area = areaRef.current;
    const wrap = wrapRef.current;
    if (!area || !wrap || !live) return setPopover(null);
    if (area.selectionStart !== area.selectionEnd) return setPopover(null);
    const pos = area.selectionStart;
    const span = spans.find((s) => isMarked(s.token) && pos >= s.start && pos <= s.end);
    if (!span) return setPopover(null);
    const el = backdropRef.current?.querySelector<HTMLElement>(`[data-i="${span.index}"]`);
    if (!el) return setPopover(null);
    const rect = el.getClientRects()[0] ?? el.getBoundingClientRect();
    const w = wrap.getBoundingClientRect();
    setPopover({ index: span.index, left: Math.max(0, rect.left - w.left), top: rect.bottom - w.top + 6 });
  }

  function replaceSpan(span: Span, word: string) {
    const next = text.slice(0, span.start) + word + text.slice(span.end);
    setText(next);
    setPopover(null);
    void run(next);
    requestAnimationFrame(() => {
      const area = areaRef.current;
      if (!area) return;
      area.focus();
      const caret = span.start + word.length;
      area.setSelectionRange(caret, caret);
    });
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      areaRef.current?.select();
    }
  }

  const unknownSpans = spans.filter((s) => s.token.status === "unknown");
  const errorCount = result?.summary.unknown ?? 0;
  const active = popover ? spans[popover.index] : null;

  return (
    <div className="space-y-5">
      <div className="overflow-hidden rounded-2xl border border-line bg-paper-2 shadow-card">
        {/* Toolbar */}
        <div className="flex flex-wrap items-center gap-3 border-b border-line px-4 py-3 sm:px-6">
          <h2 className="km-ui text-lg font-semibold text-ink">ទម្រង់សម្រាប់ពិនិត្យអក្ខរាវិរុទ្ធ</h2>
          {result && (
            <span
              className={`km-ui rounded-full px-3 py-0.5 text-sm font-medium ${
                errorCount ? "bg-bad-soft text-bad" : "bg-ok-soft text-ok"
              }`}
            >
              {errorCount ? `កំហុស ${errorCount}` : "គ្មានកំហុស ✓"}
            </span>
          )}
          {loading && <span className="km-ui text-sm text-ink-3">កំពុងពិនិត្យ…</span>}
          <div className="ml-auto flex flex-wrap items-center gap-2">
            <label className="km-ui flex cursor-pointer select-none items-center gap-1.5 rounded-lg px-2 py-1.5 text-sm text-ink-2 hover:bg-paper-3">
              <input type="checkbox" className="accent-accent" checked={showSbbic} onChange={(e) => setShowSbbic(e.target.checked)} />
              បង្ហាញពាក្យក្រៅវចនានុក្រម
            </label>
            <ToolButton onClick={copy} icon={<ClipboardIcon />} label={copied ? "បានចម្លង" : "ចម្លង"} disabled={!text} />
            <ToolButton
              onClick={() => {
                onChange("");
                areaRef.current?.focus();
              }}
              icon={<TrashIcon />}
              label="លុប"
              disabled={!text}
            />
            <ToolButton
              onClick={() => {
                onChange(SAMPLE);
                void run(SAMPLE);
              }}
              icon={<SparkIcon />}
              label="ឧទាហរណ៍"
            />
          </div>
        </div>

        {/* Editor: a transparent textarea over a mirror that carries the underlines */}
        <div ref={wrapRef} className="relative">
          <div ref={backdropRef} aria-hidden className={`${EDITOR_CLASS} pointer-events-none absolute inset-0 overflow-hidden text-ink`}>
            {live
              ? spans.map((s) => (
                  <span key={s.index} data-i={s.index} className={markClass(s.token, showSbbic)}>
                    {s.token.text}
                  </span>
                ))
              : text}
            {"​"}
          </div>
          <textarea
            ref={areaRef}
            lang="km"
            value={text}
            onChange={(e) => onChange(e.target.value.slice(0, MAX))}
            onSelect={updatePopover}
            onKeyDown={(e) => {
              if (e.key === "Escape") setPopover(null);
            }}
            onBlur={(e) => {
              if (!(e.relatedTarget instanceof HTMLElement && e.relatedTarget.closest("[data-popover]"))) setPopover(null);
            }}
            rows={1}
            spellCheck={false}
            maxLength={MAX}
            placeholder="វាយ ឬបិទភ្ជាប់អត្ថបទខ្មែរនៅទីនេះ…"
            aria-label="អត្ថបទខ្មែរសម្រាប់ពិនិត្យ"
            className={`${EDITOR_CLASS} relative block min-h-[45vh] resize-none overflow-hidden bg-transparent text-transparent caret-ink outline-none placeholder:text-ink-3`}
          />

          {popover && active && (
            <div
              data-popover
              role="dialog"
              style={{ left: popover.left, top: popover.top }}
              className="fade-up absolute z-20 max-w-[22rem] rounded-xl border border-line bg-paper px-3 py-2.5 text-sm shadow-card"
            >
              <SuggestionBox span={active} onReplace={(w) => replaceSpan(active, w)} />
            </div>
          )}
        </div>

        {/* Status line */}
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-line px-4 py-2.5 text-sm text-ink-2 sm:px-6">
          <span className="km-ui">
            {error
              ? error
              : !text.trim()
                ? "វាយអត្ថបទ ឬចុច «ឧទាហរណ៍» ដើម្បីសាកល្បង"
                : !live
                  ? "កំពុងពិនិត្យ…"
                  : errorCount
                    ? `រកឃើញពាក្យដែលមិនមានក្នុងវចនានុក្រមចំនួន (${errorCount}) · ចុចលើពាក្យគូសក្រហមដើម្បីមើលការណែនាំ`
                    : "មិនឃើញកំហុសអក្ខរាវិរុទ្ធទេ ✓"}
          </span>
          <span className="text-ink-3">
            {text.length.toLocaleString()} / {MAX.toLocaleString()}
          </span>
        </div>
      </div>

      {result && (
        <div className="fade-up space-y-5">
          <Stats result={result} />
          {unknownSpans.length > 0 && (
            <section className="space-y-3">
              <h3 className="km-ui text-sm font-semibold text-ink-2">ពាក្យដែលរកមិនឃើញក្នុងវចនានុក្រម · Not found</h3>
              <ul className="grid gap-2 sm:grid-cols-2">
                {dedupe(unknownSpans).map((s) => (
                  <li key={s.index} className="flex flex-wrap items-center gap-2 rounded-xl border border-line bg-paper-2 px-4 py-2.5">
                    <span className="km text-lg font-semibold text-bad">{s.token.text}</span>
                    {s.token.suggestions?.length ? (
                      <>
                        <span className="text-xs text-ink-3">→</span>
                        {s.token.suggestions.map((g) => (
                          <button
                            key={g.word}
                            type="button"
                            onClick={() => replaceAll(s.token.text, g.word)}
                            title={g.id ? "ពាក្យក្នុងវចនានុក្រម · ចុចដើម្បីជំនួសទាំងអស់" : "ពាក្យក្នុងបញ្ជីអក្ខរាវិរុទ្ធ · ចុចដើម្បីជំនួសទាំងអស់"}
                            className={`km rounded-md border px-2 py-0.5 text-base transition hover:border-accent hover:text-accent ${
                              g.id ? "border-line-strong bg-paper" : "border-dashed border-line text-ink-2"
                            }`}
                          >
                            {g.word}
                          </button>
                        ))}
                      </>
                    ) : (
                      <span className="km-ui text-xs text-ink-3">គ្មានការណែនាំ</span>
                    )}
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
      )}
    </div>
  );

  function replaceAll(from: string, to: string) {
    const next = text.split(from).join(to);
    setText(next);
    setPopover(null);
    void run(next);
  }
}

function markClass(t: CheckToken, showSbbic: boolean): string {
  if (t.kind !== "word") return "";
  if (t.status === "unknown") return "border-b-2 border-bad bg-bad-soft/40";
  if (showSbbic && t.status === "sbbic") return "border-b border-dotted border-info";
  if (showSbbic && t.status === "compound") return "border-b border-dotted border-warn";
  return "";
}

function dedupe(spans: Span[]): Span[] {
  const seen = new Set<string>();
  return spans.filter((s) => (seen.has(s.token.text) ? false : (seen.add(s.token.text), true)));
}

function SuggestionBox({ span, onReplace }: { span: Span; onReplace: (word: string) => void }) {
  const t = span.token;
  if (t.status === "unknown") {
    return (
      <div className="space-y-1.5">
        <p className="km-ui text-xs font-medium text-bad">មិនមានក្នុងវចនានុក្រម ជួន ណាត</p>
        {t.suggestions?.length ? (
          <>
            <p className="km-ui text-xs text-ink-3">តើអ្នកចង់សរសេរ…</p>
            <div className="flex flex-wrap gap-1">
              {t.suggestions.map((g) => (
                <button
                  key={g.word}
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => onReplace(g.word)}
                  className={`km rounded-md border px-2 py-0.5 text-base hover:border-accent hover:text-accent ${
                    g.id ? "border-line-strong bg-paper-2" : "border-dashed border-line text-ink-2"
                  }`}
                >
                  {g.word}
                </button>
              ))}
            </div>
          </>
        ) : (
          <p className="km-ui text-xs text-ink-2">គ្មានពាក្យស្រដៀងទេ</p>
        )}
      </div>
    );
  }
  const label =
    t.status === "sbbic" ? "មានក្នុងបញ្ជីអក្ខរាវិរុទ្ធ (SBBIC) តែមិនមែនជាពាក្យក្នុងវចនានុក្រម ជួន ណាត" : "ផ្សំពីពាក្យដែលស្គាល់";
  return (
    <div className="space-y-1.5">
      <p className={`km-ui text-xs font-medium ${t.status === "sbbic" ? "text-info" : "text-warn"}`}>{label}</p>
      {t.parts && (
        <p className="flex flex-wrap items-center gap-1">
          <span className="km-ui text-xs text-ink-3">ផ្សំពី</span>
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
        </p>
      )}
    </div>
  );
}

function Stats({ result }: { result: CheckResponse }) {
  const s = result.summary;
  const items: { label: string; value: number; cls: string }[] = [
    { label: "ពាក្យសរុប", value: s.words, cls: "bg-paper-3 text-ink" },
    { label: "ក្នុងវចនានុក្រម", value: s.dict, cls: "bg-ok-soft text-ok" },
    { label: "បញ្ជីអក្ខរាវិរុទ្ធ", value: s.sbbic, cls: "bg-info-soft text-info" },
    { label: "ផ្សំពីពាក្យស្គាល់", value: s.compound, cls: "bg-warn-soft text-warn" },
    { label: "រកមិនឃើញ", value: s.unknown, cls: "bg-bad-soft text-bad" },
  ];
  return (
    <div className="flex flex-wrap gap-2 text-sm">
      {items.map((it) => (
        <span key={it.label} className={`km-ui rounded-full px-3 py-1 ${it.cls}`}>
          {it.label} {it.value.toLocaleString()}
        </span>
      ))}
    </div>
  );
}

function ToolButton({
  onClick,
  icon,
  label,
  disabled,
}: {
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="km-ui inline-flex items-center gap-1.5 rounded-lg border border-line bg-paper px-3 py-1.5 text-sm font-medium text-ink transition hover:border-accent hover:text-accent disabled:cursor-not-allowed disabled:opacity-40"
    >
      {icon}
      {label}
    </button>
  );
}

function ClipboardIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="8" y="2" width="8" height="4" rx="1" />
      <path d="M8 4H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2h-2" />
    </svg>
  );
}
function TrashIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14" />
    </svg>
  );
}
function SparkIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 3v4M12 17v4M3 12h4M17 12h4M5.6 5.6l2.8 2.8M15.6 15.6l2.8 2.8M5.6 18.4l2.8-2.8M15.6 8.4l2.8-2.8" />
    </svg>
  );
}
