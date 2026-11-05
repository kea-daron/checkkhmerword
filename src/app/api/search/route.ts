import type { NextRequest } from "next/server";
import { search } from "@/lib/dict/search";

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get("q") ?? "";
  const limitRaw = Number(req.nextUrl.searchParams.get("limit") ?? 30);
  const limit = Number.isFinite(limitRaw) ? Math.min(Math.max(1, Math.floor(limitRaw)), 100) : 30;
  if (q.length > 200) {
    return Response.json({ error: "Query too long (max 200 characters)." }, { status: 400 });
  }
  return Response.json(search(q, limit), {
    headers: { "cache-control": "public, max-age=0, s-maxage=86400, stale-while-revalidate=604800" },
  });
}
