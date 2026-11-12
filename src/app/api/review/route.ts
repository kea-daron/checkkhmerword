import type { NextRequest } from "next/server";
import { MAX_REVIEW_TEXT, ReviewError, isReviewEnabled, reviewText } from "@/lib/review/gemini";

/**
 * POST { text } -> sentence-level review by Google Gemini.
 * 503 when GEMINI_API_KEY is not configured on the server.
 */
export async function POST(req: NextRequest) {
  if (!isReviewEnabled()) {
    return Response.json({ error: "Sentence review is not enabled: set GEMINI_API_KEY on the server." }, { status: 503 });
  }
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: 'Body must be JSON: {"text": "…"}' }, { status: 400 });
  }
  const text = (body as { text?: unknown })?.text;
  if (typeof text !== "string" || !text.trim()) {
    return Response.json({ error: "Provide a non-empty `text` string." }, { status: 400 });
  }
  if (text.length > MAX_REVIEW_TEXT) {
    return Response.json({ error: `Text too long (max ${MAX_REVIEW_TEXT} characters).` }, { status: 413 });
  }
  try {
    return Response.json(await reviewText(text));
  } catch (e) {
    if (e instanceof ReviewError) {
      const status = e.code === "disabled" ? 503 : e.code === "quota" ? 429 : 502;
      console.error(`[api/review] ${e.code}: ${e.message}`);
      const error =
        e.code === "upstream"
          ? "Gemini request failed."
          : e.code === "quota"
            ? "No Gemini model is available on this API key's plan (quota limit 0). Enable billing or set GEMINI_MODEL to a model your plan allows."
            : e.message;
      return Response.json({ error, code: e.code }, { status });
    }
    throw e;
  }
}
