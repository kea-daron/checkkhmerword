import "server-only";
import { ApiError, GoogleGenAI, ThinkingLevel as GenAiThinkingLevel } from "@google/genai";
import type { ReviewIssue, ReviewIssueType, ReviewResponse } from "./types";

/**
 * Sentence-level review with Google's Gemini API (@google/genai).
 *
 * The dictionary checker in `@/lib/dict/check` can only say whether each word
 * exists. Gemini reads the whole sentence, so it can also flag a real word used
 * in the wrong place, a missing word, or wrong punctuation. It is optional:
 * without GEMINI_API_KEY the feature is simply off.
 */

/**
 * Preferred and fallback models. The preferred one is Gemini 3.1 Pro with
 * thinking level "high" (the AI Studio "3.1 Pro / Thinking level: High" setting).
 * On a Free Tier key the Pro models answer 429 with "limit: 0", so the request
 * falls through to the Flash models, which support the same thinking levels.
 * Measured 2026-11-10 (Free Tier): gemini-3.5-flash answers in ~3-7 s,
 * 3.5-flash-lite in ~2-8 s but noisier; 3.8-flash hung, 3.7-flash returned 503.
 */
export const DEFAULT_MODEL = "gemini-3.1-pro-preview";
const FALLBACK_MODELS = ["gemini-3.5-flash", "gemini-3.5-flash-lite"];
export const MAX_REVIEW_TEXT = 5000;
/** Wall-clock budget per model attempt; without it a stuck model hangs the request forever. */
export const REQUEST_TIMEOUT_MS = 45_000;
/** How long a model that answered "limit: 0" (not on this plan) is skipped before being retried. */
const PLAN_LIMIT_MEMO_MS = 10 * 60_000;

export type ThinkingLevel = "minimal" | "low" | "medium" | "high";
const THINKING_LEVELS: ThinkingLevel[] = ["minimal", "low", "medium", "high"];
export const DEFAULT_THINKING_LEVEL: ThinkingLevel = "high";

const ISSUE_TYPES: ReviewIssueType[] = ["spelling", "grammar", "word-choice", "punctuation", "spacing"];

export function reviewModel(): string {
  return process.env.GEMINI_MODEL?.trim() || DEFAULT_MODEL;
}

/** GEMINI_THINKING_LEVEL (minimal | low | medium | high); anything else means the default. */
export function reviewThinkingLevel(): ThinkingLevel {
  const raw = process.env.GEMINI_THINKING_LEVEL?.trim().toLowerCase();
  return (THINKING_LEVELS as string[]).includes(raw ?? "") ? (raw as ThinkingLevel) : DEFAULT_THINKING_LEVEL;
}

/** The configured model first, then the fallbacks it is not already. */
export function reviewModels(): string[] {
  return [...new Set([reviewModel(), ...FALLBACK_MODELS])];
}

export function isReviewEnabled(): boolean {
  return Boolean(process.env.GEMINI_API_KEY?.trim());
}

let client: GoogleGenAI | null = null;
function getClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) throw new ReviewError("disabled", "GEMINI_API_KEY is not set.");
  return (client ??= new GoogleGenAI({ apiKey }));
}

export class ReviewError extends Error {
  constructor(
    public code: "disabled" | "upstream" | "quota" | "malformed",
    message: string,
  ) {
    super(message);
  }
}

/** Overloaded, rate-limited or unreachable: worth trying the next model. */
function isTransient(e: unknown): boolean {
  if (e instanceof ApiError) return [408, 429, 500, 502, 503, 504].includes(e.status);
  return !(e instanceof ReviewError); // network error, timeout, abort
}

/** A 429 whose quota line reads "limit: 0" is a plan limit, not a burst: this model is not on the key's plan. */
function isPlanLimited(e: unknown): boolean {
  return e instanceof ApiError && e.status === 429 && /limit:\s*0\b/.test(e.message);
}

/** Models that answered "limit: 0", with the time until they are worth trying again. */
const planLimitedUntil = new Map<string, number>();

const SYSTEM_PROMPT = `You are an expert Khmer (ភាសាខ្មែរ) proofreader.
Review the user's Khmer text for spelling, grammar, word choice, word order, missing or extra words, spacing and punctuation.
Follow standard Khmer orthography as in the Chuon Nath dictionary (វចនានុក្រមខ្មែរ សម្ដេចព្រះសង្ឃរាជ ជួន ណាត).

Rules:
- Only report real mistakes. Do not rewrite style, do not change meaning, do not add content.
- "text" must be copied EXACTLY from the input (same characters, no added spaces) so it can be found and replaced.
- Keep each issue as short as possible: the smallest span that must change.
- Treat these as the same, never report them: ាំ/ំា order, េី/ើ, េា/ោ, ្ដ/្ត, ឲ/ឱ, zero-width spaces.
- Proper names, loanwords and transliterations are not mistakes unless clearly misspelt.
- "reason" and "summary" are written in Khmer, one short sentence each.
- "corrected" is the full input with every issue fixed and nothing else changed.
- If the text is fine, return an empty "issues" array and the input unchanged as "corrected".`;

const RESPONSE_SCHEMA = {
  type: "object",
  properties: {
    summary: { type: "string" },
    issues: {
      type: "array",
      items: {
        type: "object",
        properties: {
          text: { type: "string" },
          suggestion: { type: "string" },
          reason: { type: "string" },
          type: { type: "string", enum: ISSUE_TYPES },
        },
        required: ["text", "suggestion", "reason", "type"],
      },
    },
    corrected: { type: "string" },
  },
  required: ["summary", "issues", "corrected"],
} as const;

function asString(v: unknown): string {
  return typeof v === "string" ? v : "";
}

/** Keep only issues whose `text` really occurs in the input, so the UI can act on them. */
function sanitize(raw: unknown, input: string): Omit<ReviewResponse, "model"> {
  if (!raw || typeof raw !== "object") throw new ReviewError("malformed", "Model returned no JSON object.");
  const o = raw as Record<string, unknown>;
  const issues: ReviewIssue[] = [];
  const seen = new Set<string>();
  for (const it of Array.isArray(o.issues) ? o.issues : []) {
    if (!it || typeof it !== "object") continue;
    const r = it as Record<string, unknown>;
    const text = asString(r.text);
    const suggestion = asString(r.suggestion);
    if (!text || text === suggestion || !input.includes(text)) continue;
    const key = `${text}\u0000${suggestion}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const type = (ISSUE_TYPES as string[]).includes(asString(r.type)) ? (r.type as ReviewIssueType) : "grammar";
    issues.push({ text, suggestion, reason: asString(r.reason), type });
  }
  return {
    summary: asString(o.summary),
    issues,
    corrected: asString(o.corrected) || input,
  };
}

async function generate(model: string, text: string): Promise<string | undefined> {
  const res = await getClient().models.generateContent({
    model,
    contents: text,
    config: {
      systemInstruction: SYSTEM_PROMPT,
      responseMimeType: "application/json",
      responseJsonSchema: RESPONSE_SCHEMA,
      temperature: 0.1,
      thinkingConfig: { thinkingLevel: reviewThinkingLevel().toUpperCase() as GenAiThinkingLevel },
      httpOptions: { timeout: REQUEST_TIMEOUT_MS },
    },
  });
  return res.text;
}

export async function reviewText(input: string): Promise<ReviewResponse> {
  const text = input.slice(0, MAX_REVIEW_TEXT);
  const models = reviewModels();
  let payload: string | undefined;
  let model = models[0];
  let lastError: unknown;
  let allPlanLimited = true;
  for (const [i, candidate] of models.entries()) {
    model = candidate;
    const next = models[i + 1];
    const skipUntil = planLimitedUntil.get(candidate) ?? 0;
    if (skipUntil > Date.now() && next) continue; // known not to be on this plan; go straight to the fallback
    try {
      payload = await generate(candidate, text);
      lastError = undefined;
      break;
    } catch (e) {
      if (e instanceof ReviewError) throw e;
      lastError = e;
      const message = e instanceof Error ? e.message : String(e);
      if (isPlanLimited(e)) {
        planLimitedUntil.set(candidate, Date.now() + PLAN_LIMIT_MEMO_MS);
        if (!next) break;
        console.warn(`[review] ${candidate} is not on this API key's plan (limit: 0); using ${next}`);
        continue;
      }
      allPlanLimited = false;
      if (!isTransient(e) || !next) break;
      console.warn(`[review] ${candidate} failed (${message.slice(0, 120)}); trying ${next}`);
    }
  }
  if (lastError !== undefined) {
    const message = lastError instanceof Error ? lastError.message : String(lastError);
    if (allPlanLimited && isPlanLimited(lastError)) throw new ReviewError("quota", `${model}: ${message}`);
    throw new ReviewError("upstream", message);
  }
  if (!payload) throw new ReviewError("malformed", "Empty response from Gemini.");
  let parsed: unknown;
  try {
    parsed = JSON.parse(payload);
  } catch {
    throw new ReviewError("malformed", "Gemini did not return valid JSON.");
  }
  return { model, ...sanitize(parsed, text) };
}
