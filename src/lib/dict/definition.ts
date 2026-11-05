import type { DefinitionSegment, ParsedDefinition } from "./types";

/** Cross-reference markup used by the SPICE data: <"1234">text/a */
const LINK_RE = /<"(\d+)">([\s\S]*?)\/a/g;
/** Part-of-speech / usage tags such as (ន.) (កិ. វិ.) (ព. កា.) */
const POS_RE = /\(([ក-៿.\s]{1,14}\.)\)/g;

function splitPos(text: string, out: DefinitionSegment[]) {
  let last = 0;
  POS_RE.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = POS_RE.exec(text))) {
    if (m.index > last) out.push({ t: "text", v: text.slice(last, m.index) });
    out.push({ t: "pos", v: m[1].replace(/\s+/g, " ").trim() });
    last = m.index + m[0].length;
  }
  if (last < text.length) out.push({ t: "text", v: text.slice(last) });
}

export function parseDefinition(raw: string): ParsedDefinition {
  const lines = raw.split("\n").map((line) => {
    const segs: DefinitionSegment[] = [];
    let last = 0;
    LINK_RE.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = LINK_RE.exec(line))) {
      if (m.index > last) splitPos(line.slice(last, m.index), segs);
      segs.push({ t: "link", v: m[2], id: Number(m[1]) });
      last = m.index + m[0].length;
    }
    if (last < line.length) splitPos(line.slice(last), segs);
    return segs;
  });
  return { lines };
}

/** Definition with all markup removed. */
export function toPlainText(raw: string): string {
  return raw.replace(LINK_RE, "$2").replace(/\s+/g, " ").trim();
}

/** A short preview for lists and metadata. Invisible characters are removed. */
export function excerpt(raw: string, max = 110): string {
  const plain = toPlainText(raw).replace(/[​‌‍]/g, "");
  if (plain.length <= max) return plain;
  const cut = plain.slice(0, max);
  const stop = Math.max(cut.lastIndexOf(" "), cut.lastIndexOf("។"), cut.lastIndexOf(","));
  return (stop > max * 0.6 ? cut.slice(0, stop) : cut).trimEnd() + "…";
}
