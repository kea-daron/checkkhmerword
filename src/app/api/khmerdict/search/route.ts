import type { NextRequest } from "next/server";
import { searchKhmerDict } from "@/lib/khmerdict/search";
import { isKhmerDictAvailable } from "@/lib/khmerdict/store";

/**
 * GET /api/khmerdict/search?q=…&limit=…
 *
 * Searches the data set khmerdict.com publishes to its own web app (there is
 * no HTTP API on that site; see scripts/fetch-khmerdict.mjs). A Latin query
 * searches English → Khmer, a Khmer query searches the Khmer entries.
 */
export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get("q") ?? "";
  const limitRaw = Number(req.nextUrl.searchParams.get("limit") ?? 30);
  const limit = Number.isFinite(limitRaw) ? Math.min(Math.max(1, Math.floor(limitRaw)), 100) : 30;
  if (q.length > 200) {
    return Response.json({ error: "Query too long (max 200 characters)." }, { status: 400 });
  }
  if (!isKhmerDictAvailable()) {
    return Response.json(
      { error: "khmerdict.com data is not installed on this server. Run `npm run fetch:khmerdict`." },
      { status: 503, headers: { "cache-control": "no-store" } },
    );
  }
  return Response.json(searchKhmerDict(q, limit), {
    headers: { "cache-control": "public, max-age=0, s-maxage=86400, stale-while-revalidate=604800" },
  });
}
