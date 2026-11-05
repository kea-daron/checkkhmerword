import type { NextRequest } from "next/server";
import { parseDefinition, toPlainText } from "@/lib/dict/definition";
import { getDefinition, getEntry, getHomographs, getIpa } from "@/lib/dict/store";

export async function GET(_req: NextRequest, ctx: RouteContext<"/api/word/[id]">) {
  const { id } = await ctx.params;
  const numeric = Number(id);
  const entry = Number.isInteger(numeric) ? getEntry(numeric) : undefined;
  if (!entry) return Response.json({ error: "Entry not found." }, { status: 404 });
  const raw = getDefinition(entry.id) ?? "";
  return Response.json(
    {
      id: entry.id,
      word: entry.word,
      pos: entry.pos ?? null,
      ipa: getIpa(entry.word),
      definition: toPlainText(raw),
      definitionRaw: raw,
      definitionParsed: parseDefinition(raw).lines,
      homographs: getHomographs(entry.id),
      source: "Chuon Nath Khmer Dictionary (Buddhist Institute, 1967) via SPICE / Open Institute, LGPL-2.1",
    },
    { headers: { "cache-control": "public, max-age=0, s-maxage=604800, stale-while-revalidate=2592000" } },
  );
}
