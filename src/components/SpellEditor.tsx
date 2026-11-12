"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { CheckResponse, CheckToken, GrammarIssue, IssueSeverity, IssueType, PhraseEvidence } from "@/lib/dict/types";

const MAX = 5000;
const SAMPLE = "សួស្តី តើអ្នសុខសប្បាជាទេ?";

type Checked = { text: string; result: CheckResponse };
type Span = { token: CheckToken; index: number; start: number; end: number };
/** A replacement the user made from a suggestion, which can be undone. */
type Fix = { id: number; start: number; end: number; from: string; to: string };
type Edit = { start: number; end: number; from: string; to: string };
type PopoverTarget = { kind: "token"; index: number } | { kind: "issue"; index: number } | { kind: "fix"; id: number };
/** `top` places the box under the word; `bottom` (from the editor's bottom edge) places it above. */
type Popover = PopoverTarget & { left: number; top?: number; bottom?: number };

/** Room the popover needs below a word before it flips above it. */
const POPOVER_ROOM = 260;
type Piece = { key: number; text: string; tokenIndex?: number; issueIndex?: number; fixId?: number; cls: string };

const EDITOR_CLASS =
  "km w-full px-5 py-4 text-lg leading-[2.1] sm:px-6 sm:text-xl whitespace-pre-wrap [overflow-wrap:break-word] [word-break:normal]";
const FIX_CLASS = "border-b-2 border-ok bg-ok-soft/60";
const ISSUE_CLASS: Record<IssueSeverity, string> = {
  error: "border-b-2 border-grammar bg-grammar-soft/60",
  warning: "border-b-2 border-grammar bg-grammar-soft/40",
  hint: "border-b-2 border-dotted border-grammar",
};
/** The phrase-context check (src/lib/context) is styled apart from the grammar rules. */
const PHRASE_RULE = "phrase-context";
const PHRASE_CLASS: Record<IssueSeverity, string> = {
  error: "border-b-2 border-phrase-line bg-phrase-soft/60",
  warning: "border-b-2 border-phrase-line bg-phrase-soft/50",
  hint: "border-b-2 border-dotted border-phrase-line",
};
const isPhrase = (it: GrammarIssue) => it.rule === PHRASE_RULE;
const issueClass = (it: GrammarIssue) => (isPhrase(it) ? PHRASE_CLASS : ISSUE_CLASS)[it.severity];
const SEVERITY_LABEL: Record<IssueSeverity, string> = { error: "កំហុស", warning: "គួរកែ", hint: "សូមពិនិត្យ" };
const KIND_LABEL: Record<PhraseEvidence["kind"], string> = {
  dictionary: "ពាក្យក្នុងវចនានុក្រម",
  sbbic: "ពាក្យផ្សំដែលស្គាល់ (SBBIC)",
  corpus: "តាមស្ថិតិគូពាក្យ",
};
/** Identifies an issue across re-checks so an ignored one stays ignored. */
const issueKey = (it: GrammarIssue) => `${it.rule}\u0000${it.text}`;

/**
 * Position `p` after `edits` (sorted, non-overlapping) are applied. An edit
 * ending exactly at `p` moves it only when `after` is set, so a word typed
 * right after a fix is not absorbed into it.
 */
function mapPos(p: number, edits: Edit[], after: boolean): number {
  let d = 0;
  for (const e of edits) {
    const delta = e.to.length - (e.end - e.start);
    if (e.end < p || (after && e.end === p)) d += delta;
    else if (e.start < p) return e.start + d + e.to.length;
    else break;
  }
  return p + d;
}

/** Apply `edits` to `text`; shift surviving fixes and record the new ones. */
function applyEdits(
  text: string,
  fixes: Fix[],
  edits: Edit[],
  record: "manual" | null,
  nextId: () => number,
): { text: string; fixes: Fix[] } {
  const sorted = [...edits].sort((a, b) => a.start - b.start);
  let out = "";
  let pos = 0;
  const added: Fix[] = [];
  for (const e of sorted) {
    out += text.slice(pos, e.start);
    if (record) added.push({ id: nextId(), start: out.length, end: out.length + e.to.length, from: e.from, to: e.to });
    out += e.to;
    pos = e.end;
  }
  out += text.slice(pos);
  const kept = fixes
    .filter((f) => !sorted.some((e) => f.start < e.end && e.start < f.end))
    .map((f) => ({ ...f, start: mapPos(f.start, sorted, true), end: mapPos(f.end, sorted, false) }));
  return { text: out, fixes: [...kept, ...added].sort((a, b) => a.start - b.start) };
}

/** The single edit that turns `prev` into `next` (common prefix/suffix trimmed). */
function diffEdit(prev: string, next: string): Edit {
  const max = Math.min(prev.length, next.length);
  let p = 0;
  while (p < max && prev[p] === next[p]) p++;
  let s = 0;
  while (s < max - p && prev[prev.length - 1 - s] === next[next.length - 1 - s]) s++;
  return { start: p, end: prev.length - s, from: prev.slice(p, prev.length - s), to: next.slice(p, next.length - s) };
}

/** Split the text at every token, issue and fix boundary so each piece has one style. */
function buildPieces(text: string, spans: Span[], issues: GrammarIssue[], fixes: Fix[], showSbbic: boolean): Piece[] {
  const cuts = new Set<number>([0, text.length]);
  for (const s of spans) {
    cuts.add(s.start);
    cuts.add(s.end);
  }
  for (const it of issues) {
    cuts.add(it.start);
    cuts.add(it.end);
  }
  for (const f of fixes) {
    cuts.add(f.start);
    cuts.add(f.end);
  }
  const bounds = [...cuts].sort((a, b) => a - b);
  const pieces: Piece[] = [];
  let si = 0;
  let gi = 0;
  let fi = 0;
  for (let i = 0; i + 1 < bounds.length; i++) {
    const a = bounds[i];
    const b = bounds[i + 1];
    while (si < spans.length && spans[si].end <= a) si++;
    while (gi < issues.length && issues[gi].end <= a) gi++;
    while (fi < fixes.length && fixes[fi].end <= a) fi++;
    const span = si < spans.length && spans[si].start <= a && b <= spans[si].end ? spans[si] : undefined;
    const issue = gi < issues.length && issues[gi].start <= a && b <= issues[gi].end ? gi : undefined;
    const fix = fi < fixes.length && fixes[fi].start <= a && b <= fixes[fi].end ? fixes[fi] : undefined;
    // A misspelling outranks a grammar mark on the same letters; a fix shows only where nothing else does.
    const tokenCls = span ? markClass(span.token, showSbbic) : "";
    const cls = tokenCls || (issue !== undefined ? issueClass(issues[issue]) : "") || (fix ? FIX_CLASS : "");
    pieces.push({ key: a, text: text.slice(a, b), tokenIndex: span?.index, issueIndex: issue, fixId: fix?.id, cls });
  }
  return pieces;
}

export function SpellEditor() {
  const params = useSearchParams();
  const [text, setText] = useState(() => params.get("text") ?? "");
  const [checked, setChecked] = useState<Checked | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  /** SBBIC-only and compound words are not marked; only words missing from every list are. */
  const showSbbic = false;
  const [popover, setPopover] = useState<Popover | null>(null);
  const [copied, setCopied] = useState(false);
  const [fixes, setFixes] = useState<Fix[]>([]);
  /** Grammar issues the user dismissed (rule + text), kept across re-checks. */
  const [ignoredIssues, setIgnoredIssues] = useState<ReadonlySet<string>>(() => new Set());

  const areaRef = useRef<HTMLTextAreaElement>(null);
  const backdropRef = useRef<HTMLDivElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const reqId = useRef(0);
  const fixId = useRef(0);

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

  /** Grammar issues for the current text, minus the ones the user dismissed. */
  const issues = useMemo<GrammarIssue[]>(
    () => (result ? result.issues.filter((it) => !ignoredIssues.has(issueKey(it))) : []),
    [result, ignoredIssues],
  );

  const pieces = useMemo(() => buildPieces(text, live ? spans : [], issues, fixes, showSbbic), [text, live, spans, issues, fixes, showSbbic]);

  /** The user typed: keep fixes that the edit did not touch, in their new positions. */
  function onChange(value: string) {
    const edit = diffEdit(text, value);
    setFixes(applyEdits(text, fixes, [edit], null, () => 0).fixes);
    setText(value);
    setPopover(null);
    if (!value.trim()) {
      setChecked(null);
      setFixes([]);
    }
  }

  function reset(value: string) {
    setText(value);
    setFixes([]);
    setPopover(null);
    if (!value.trim()) setChecked(null);
  }

  /**
   * Apply replacements to the text and re-check. The caret stays on the same
   * character, or goes to `caretAt` (which also focuses the editor).
   */
  function commit(edits: Edit[], record: "manual" | null, caretAt?: number, base: Fix[] = fixes): string {
    if (!edits.length) return text;
    const area = areaRef.current;
    const sorted = [...edits].sort((a, b) => a.start - b.start);
    const focused = !!area && document.activeElement === area;
    const caret = caretAt ?? mapPos(area?.selectionStart ?? 0, sorted, true);
    const applied = applyEdits(text, base, sorted, record, () => ++fixId.current);
    setText(applied.text);
    setFixes(applied.fixes);
    setPopover(null);
    void run(applied.text);
    if (focused || caretAt !== undefined) {
      requestAnimationFrame(() => {
        const a = areaRef.current;
        if (!a) return;
        if (caretAt !== undefined) a.focus();
        a.setSelectionRange(caret, caret);
      });
    }
    return applied.text;
  }

  function updatePopover() {
    const area = areaRef.current;
    const wrap = wrapRef.current;
    if (!area || !wrap) return setPopover(null);
    if (area.selectionStart !== area.selectionEnd) return setPopover(null);
    const pos = area.selectionStart;
    const within = (s: { start: number; end: number }) => pos >= s.start && pos <= s.end;
    const errSpan = live ? spans.find((s) => s.token.status === "unknown" && within(s)) : undefined;
    const issueAt = errSpan ? -1 : issues.findIndex(within);
    const fix = fixes.find(within);
    const span = errSpan ?? (live && !fix && issueAt < 0 ? spans.find((s) => isMarked(s.token) && within(s)) : undefined);
    let target: PopoverTarget;
    let selector: string;
    if (span) {
      target = { kind: "token", index: span.index };
      selector = `[data-i="${span.index}"]`;
    } else if (issueAt >= 0) {
      target = { kind: "issue", index: issueAt };
      selector = `[data-g="${issueAt}"]`;
    } else if (fix) {
      target = { kind: "fix", id: fix.id };
      selector = `[data-c="${fix.id}"]`;
    } else return setPopover(null);
    const el = backdropRef.current?.querySelector<HTMLElement>(selector);
    if (!el) return setPopover(null);
    const rect = el.getClientRects()[0] ?? el.getBoundingClientRect();
    const w = wrap.getBoundingClientRect();
    const left = Math.max(0, rect.left - w.left);
    const below = rect.bottom + POPOVER_ROOM <= window.innerHeight || rect.top - POPOVER_ROOM < 0;
    setPopover(below ? { ...target, left, top: rect.bottom - w.top + 6 } : { ...target, left, bottom: w.bottom - rect.top + 6 });
  }

  function replaceSpan(span: Span, word: string) {
    commit([{ start: span.start, end: span.end, from: span.token.text, to: word }], "manual", span.start + word.length);
  }

  function applyIssue(it: GrammarIssue, to: string) {
    commit([{ start: it.start, end: it.end, from: it.text, to }], "manual", it.start + to.length);
  }

  /** Apply the first suggestion of every error and warning in `list` (hints are left for the reader). */
  function applyAllIssues(list: GrammarIssue[]) {
    const edits = list.filter((it) => it.severity !== "hint" && it.suggestions.length).map((it) => ({ start: it.start, end: it.end, from: it.text, to: it.suggestions[0] }));
    commit(edits, "manual");
  }

  function ignoreIssue(it: GrammarIssue) {
    setIgnoredIssues((prev) => new Set(prev).add(issueKey(it)));
    setPopover(null);
  }

  function undoFix(f: Fix) {
    commit(
      [{ start: f.start, end: f.end, from: f.to, to: f.from }],
      null,
      f.start + f.from.length,
      fixes.filter((x) => x.id !== f.id),
    );
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
  const phraseIssues = issues.filter(isPhrase);
  const grammarIssues = issues.filter((it) => !isPhrase(it));
  const fixable = (list: GrammarIssue[]) => list.filter((it) => it.severity !== "hint" && it.suggestions.length).length;
  const activeSpan = popover?.kind === "token" ? spans[popover.index] : null;
  const activeIssue = popover?.kind === "issue" ? issues[popover.index] : null;
  const activeFix = popover?.kind === "fix" ? fixes.find((f) => f.id === popover.id) : null;

  return (
    <div className="space-y-5">
      <div className="rounded-2xl border border-line bg-paper-2 shadow-card">
        {/* Toolbar */}
        <div className="flex flex-wrap items-center gap-3 rounded-t-2xl border-b border-line px-4 py-3 sm:px-6">
          <h2 className="km-ui text-lg font-semibold text-ink">ទម្រង់សម្រាប់ពិនិត្យអក្ខរាវិរុទ្ធ</h2>
          {result && (
            <span
              className={`km-ui rounded-lg border border-line bg-paper px-3 py-1.5 text-sm font-medium ${
                errorCount ? "text-bad" : "text-ok"
              }`}
            >
              {errorCount ? `កំហុស ${errorCount}` : "គ្មានកំហុស ✓"}
            </span>
          )}
          {result && grammarIssues.length > 0 && (
            <span className="km-ui rounded-lg border border-line bg-paper px-3 py-1.5 text-sm font-medium text-grammar">វេយ្យាករណ៍ {grammarIssues.length}</span>
          )}
          {result && phraseIssues.length > 0 && (
            <span className="km-ui rounded-lg border border-line bg-paper px-3 py-1.5 text-sm font-medium text-phrase">អត្ថន័យឃ្លា {phraseIssues.length}</span>
          )}
          {fixes.length > 0 && (
            <span className="km-ui rounded-lg border border-line bg-paper px-3 py-1.5 text-sm font-medium text-ok">បានកែ {fixes.length}</span>
          )}
          {loading && <span className="km-ui text-sm text-ink-3">កំពុងពិនិត្យ…</span>}
          <div className="ml-auto flex flex-wrap items-center gap-2">
            <ToolButton onClick={copy} icon={<ClipboardIcon />} label={copied ? "បានចម្លង" : "ចម្លង"} disabled={!text} />
            <ToolButton
              onClick={() => {
                reset("");
                areaRef.current?.focus();
              }}
              icon={<TrashIcon />}
              label="លុប"
              disabled={!text}
            />
            <ToolButton
              onClick={() => {
                reset(SAMPLE);
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
            {pieces.map((p) => (
              <span key={p.key} data-i={p.tokenIndex} data-g={p.issueIndex} data-c={p.fixId} className={p.cls}>
                {p.text}
              </span>
            ))}
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

          {popover && (activeSpan || activeIssue || activeFix) && (
            <div
              data-popover
              role="dialog"
              style={{ left: popover.left, top: popover.top, bottom: popover.bottom }}
              className="fade-up absolute z-20 max-w-[24rem] rounded-xl border border-line bg-paper px-3 py-2.5 text-sm shadow-card"
            >
              {activeSpan ? (
                <SuggestionBox span={activeSpan} onReplace={(w) => replaceSpan(activeSpan, w)} />
              ) : activeIssue ? (
                <IssueBox issue={activeIssue} onApply={(to) => applyIssue(activeIssue, to)} onIgnore={() => ignoreIssue(activeIssue)} />
              ) : activeFix ? (
                <FixBox fix={activeFix} onUndo={() => undoFix(activeFix)} />
              ) : null}
            </div>
          )}
        </div>

        {/* Status line */}
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-b-2xl border-t border-line px-4 py-2.5 text-sm text-ink-2 sm:px-6">
          <span className="km-ui text-bad">{error}</span>
          <span className="text-ink-3">
            {text.length.toLocaleString()} / {MAX.toLocaleString()}
          </span>
        </div>
      </div>

      {result && (
        <div className="fade-up space-y-5">
          <Stats result={result} />
          {phraseIssues.length > 0 && (
            <section className="space-y-3">
              <div className="flex flex-wrap items-center gap-3">
                <h3 className="km-ui text-sm font-semibold text-ink-2">អត្ថន័យឃ្លា · Phrase context</h3>
                {fixable(phraseIssues) > 1 && (
                  <button
                    type="button"
                    onClick={() => applyAllIssues(phraseIssues)}
                    className="km-ui rounded-lg bg-phrase px-3 py-1 text-sm font-medium text-white transition hover:opacity-90"
                  >
                    កែទាំងអស់ ({fixable(phraseIssues)})
                  </button>
                )}
                <Link href="/about#phrases" className="km-ui ml-auto text-xs text-ink-3 underline underline-offset-4 hover:text-accent">
                  របៀបដែលវាដឹង
                </Link>
              </div>
              <p className="km-ui text-sm text-ink-3">
                ពាក្យទាំងនេះមានក្នុងវចនានុក្រម តែមិនសមនឹងពាក្យនៅជុំវិញវា។ ការណែនាំផ្អែកលើបញ្ជីពាក្យផ្សំ និងស្ថិតិគូពាក្យពីអត្ថបទខ្មែរ ដូច្នេះសូមពិនិត្យអត្ថន័យមុនពេលទទួលយក។
              </p>
              <ul className="grid gap-2 sm:grid-cols-2">
                {phraseIssues.map((it, i) => (
                  <IssueItem key={`${it.start}-${it.rule}`} issue={it} n={i + 1} onFocus={focusAt} onApply={applyIssue} onIgnore={ignoreIssue} />
                ))}
              </ul>
            </section>
          )}
          {grammarIssues.length > 0 && (
            <section className="space-y-3">
              <div className="flex flex-wrap items-center gap-3">
                <h3 className="km-ui text-sm font-semibold text-ink-2">វេយ្យាករណ៍ និងវណ្ណយុត្តិ · Grammar</h3>
                {fixable(grammarIssues) > 1 && (
                  <button
                    type="button"
                    onClick={() => applyAllIssues(grammarIssues)}
                    className="km-ui rounded-lg bg-grammar px-3 py-1 text-sm font-medium text-white transition hover:opacity-90"
                  >
                    កែទាំងអស់ ({fixable(grammarIssues)})
                  </button>
                )}
                <Link href="/about#grammar" className="km-ui ml-auto text-xs text-ink-3 underline underline-offset-4 hover:text-accent">
                  អំពីច្បាប់ទាំងនេះ
                </Link>
              </div>
              <ul className="grid gap-2 sm:grid-cols-2">
                {grammarIssues.map((it, i) => (
                  <IssueItem key={`${it.start}-${it.rule}`} issue={it} n={i + 1} onFocus={focusAt} onApply={applyIssue} onIgnore={ignoreIssue} />
                ))}
              </ul>
            </section>
          )}
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
    const edits = unknownSpans.filter((s) => s.token.text === from).map((s) => ({ start: s.start, end: s.end, from, to }));
    commit(edits, "manual");
  }

  /** Put the caret at `pos` so the popover for that spot opens. */
  function focusAt(pos: number) {
    const a = areaRef.current;
    if (!a) return;
    a.focus();
    a.setSelectionRange(pos, pos);
    requestAnimationFrame(updatePopover);
  }
}

function IssueBox({ issue, onApply, onIgnore }: { issue: GrammarIssue; onApply: (to: string) => void; onIgnore: () => void }) {
  const phrase = isPhrase(issue);
  return (
    <div className="space-y-2">
      <p className={`km-ui flex items-center gap-1.5 text-xs font-medium ${phrase ? "text-phrase" : "text-grammar"}`}>
        {SEVERITY_LABEL[issue.severity]} · {phrase ? "អត្ថន័យឃ្លា" : ISSUE_LABEL[issue.type]}
      </p>
      {issue.evidence ? (
        <>
          <p className="km text-sm text-ink">
            ក្នុងឃ្លានេះ «{issue.text}» ទំនងជា <span className="font-semibold text-phrase">«{issue.suggestions[0]}»</span>
          </p>
          <EvidenceBox e={issue.evidence} />
        </>
      ) : (
        <>
          <p className="km text-sm text-ink">{issue.message}</p>
          <p className="text-xs text-ink-3">{issue.messageEn}</p>
        </>
      )}
      <div className="flex flex-wrap items-center gap-1.5">
        {issue.suggestions.map((to) => (
          <button
            key={to}
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => onApply(to)}
            className="km rounded-md border border-line-strong bg-paper-2 px-2 py-0.5 text-base hover:border-accent hover:text-accent"
          >
            {to.trim() || "␣"}
          </button>
        ))}
        <button
          type="button"
          onMouseDown={(e) => e.preventDefault()}
          onClick={onIgnore}
          className="km-ui ml-auto rounded-md px-2 py-0.5 text-xs text-ink-3 hover:bg-paper-3 hover:text-ink"
        >
          មិនអើពើ
        </button>
      </div>
    </div>
  );
}

/** The phrase behind a phrase-context suggestion: what it means and how often the texts use it. */
function EvidenceBox({ e, compact = false }: { e: PhraseEvidence; compact?: boolean }) {
  return (
    <div className={`space-y-1 rounded-lg border border-line bg-paper-2 px-2.5 py-2 ${compact ? "text-sm" : ""}`}>
      <p className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
        <span className="km text-base font-semibold text-phrase">{e.phrase}</span>
        <span className="km-ui text-xs text-ink-3">{KIND_LABEL[e.kind]}</span>
        {e.id !== undefined && (
          <Link href={`/word/${e.id}`} onMouseDown={(ev) => ev.preventDefault()} className="km-ui text-xs text-ink-3 underline underline-offset-4 hover:text-accent">
            វចនានុក្រម
          </Link>
        )}
      </p>
      {e.gloss && <p className="km text-sm text-ink-2">{e.gloss}</p>}
      {e.example && !compact && <p className="km text-sm text-ink-3">ឧ. {e.example}</p>}
      <p className="km-ui text-xs text-ink-3">
        ក្នុងអត្ថបទគំរូ៖ «{e.phrase}» {e.seen.toLocaleString()} ដង · «{e.written}» {e.seenWritten.toLocaleString()} ដង
      </p>
    </div>
  );
}

function IssueItem({
  issue: it,
  n,
  onFocus,
  onApply,
  onIgnore,
}: {
  issue: GrammarIssue;
  n: number;
  onFocus: (pos: number) => void;
  onApply: (it: GrammarIssue, to: string) => void;
  onIgnore: (it: GrammarIssue) => void;
}) {
  const phrase = isPhrase(it);
  const chip = it.severity === "hint" ? "bg-paper-3 text-ink-2" : phrase ? "bg-phrase-soft text-phrase" : "bg-grammar-soft text-grammar";
  return (
    <li className="flex flex-col gap-1.5 rounded-xl border border-line bg-paper-2 px-4 py-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className={`km-ui rounded-full px-2 py-0.5 text-xs ${chip}`}>
          {SEVERITY_LABEL[it.severity]} · {phrase ? "អត្ថន័យឃ្លា" : ISSUE_LABEL[it.type]}
        </span>
        <button
          type="button"
          onClick={() => onFocus(it.start)}
          title="ទៅកាន់កន្លែងនេះក្នុងអត្ថបទ"
          className={`km text-lg underline decoration-dotted underline-offset-4 hover:text-accent ${phrase ? "text-phrase" : "text-grammar"}`}
        >
          {it.text.trim() || "␣"}
        </button>
        {it.suggestions.length > 0 && <span className="text-xs text-ink-3">→</span>}
        {it.suggestions.map((to) => (
          <button
            key={to}
            type="button"
            onClick={() => onApply(it, to)}
            className="km rounded-md border border-line-strong bg-paper px-2 py-0.5 text-base transition hover:border-accent hover:text-accent"
          >
            {to.trim() || "␣"}
          </button>
        ))}
        <button
          type="button"
          onClick={() => onIgnore(it)}
          className="km-ui ml-auto rounded-md px-2 py-0.5 text-xs text-ink-3 transition hover:bg-paper-3 hover:text-ink"
          aria-label={`មិនអើពើ ${n}`}
        >
          មិនអើពើ
        </button>
      </div>
      {it.evidence ? <EvidenceBox e={it.evidence} compact /> : <p className="km text-sm text-ink-2">{it.message}</p>}
    </li>
  );
}

function FixBox({ fix, onUndo }: { fix: Fix; onUndo: () => void }) {
  return (
    <div className="space-y-2">
      <p className="km-ui flex items-center gap-1.5 text-xs font-medium text-ok">
        <BoltIcon />
        បានជំនួស
      </p>
      <p className="km flex flex-wrap items-center gap-2 text-lg">
        <s className="text-ink-3 decoration-bad">{fix.from}</s>
        <span className="text-ink-3">→</span>
        <span className="font-semibold text-ok">{fix.to}</span>
      </p>
      <button
        type="button"
        onMouseDown={(e) => e.preventDefault()}
        onClick={onUndo}
        className="km-ui flex w-full items-center justify-center gap-1.5 rounded-lg border border-line-strong bg-paper-2 px-3 py-1.5 text-sm text-ink transition hover:border-accent hover:text-accent"
      >
        <UndoIcon />
        ត្រឡប់ទៅ <span className="km font-semibold">{fix.from}</span>
      </button>
    </div>
  );
}

function markClass(t: CheckToken, showSbbic: boolean): string {
  if (t.kind !== "word") return "";
  if (t.status === "unknown") return "border-b-2 border-bad bg-bad-soft/40";
  if (showSbbic && t.status === "sbbic") return "border-b border-dotted border-info";
  if (showSbbic && t.status === "compound") return "border-b border-dashed border-warn-line";
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
                  title={g.id ? "ពាក្យក្នុងវចនានុក្រម" : "ពាក្យក្នុងបញ្ជីអក្ខរាវិរុទ្ធ"}
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
      {t.gloss && <p className="km text-sm text-ink-2">{t.gloss}</p>}
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
  return (
    <div className="flex flex-wrap gap-2 text-sm">
      <span className="km-ui rounded-full bg-paper-3 px-3 py-1 text-ink">ពាក្យសរុប {result.summary.words.toLocaleString()}</span>
    </div>
  );
}

const ISSUE_LABEL: Record<IssueType, string> = {
  spelling: "អក្ខរាវិរុទ្ធ",
  grammar: "វេយ្យាករណ៍",
  "word-choice": "ជម្រើសពាក្យ",
  punctuation: "វណ្ណយុត្តិ",
  spacing: "ដកឃ្លា",
};

function ToolButton({
  onClick,
  icon,
  label,
  disabled,
  accent,
}: {
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
  disabled?: boolean;
  accent?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`km-ui inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm font-medium transition hover:border-accent hover:text-accent disabled:cursor-not-allowed disabled:opacity-40 ${
        accent ? "border-ok/50 bg-ok-soft text-ok hover:border-ok hover:text-ok" : "border-line bg-paper text-ink"
      }`}
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
function BoltIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="currentColor">
      <path d="M13 2 4 14h6l-1 8 9-12h-6l1-8z" />
    </svg>
  );
}
function UndoIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 14 4 9l5-5" />
      <path d="M4 9h10a6 6 0 0 1 0 12h-3" />
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
