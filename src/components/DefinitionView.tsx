import Link from "next/link";
import { parseDefinition } from "@/lib/dict/definition";
import { PosBadge } from "./PosBadge";

export function DefinitionView({ raw, currentId }: { raw: string; currentId?: number }) {
  const { lines } = parseDefinition(raw);
  return (
    <div className="km space-y-4 text-[1.05rem] text-ink sm:text-lg">
      {lines.map((segs, li) => (
        <p key={li}>
          {segs.map((s, si) => {
            if (s.t === "text") return <span key={si}>{s.v}</span>;
            if (s.t === "pos")
              return (
                <span key={si} className="mx-0.5 align-middle">
                  <PosBadge pos={s.v} />
                </span>
              );
            if (s.id === currentId) return <span key={si} className="font-semibold text-accent">{s.v}</span>;
            return (
              <Link
                key={si}
                href={`/word/${s.id}`}
                className="rounded-sm underline decoration-line-strong decoration-dotted underline-offset-[5px] transition-colors hover:bg-accent-soft hover:decoration-accent"
              >
                {s.v}
              </Link>
            );
          })}
        </p>
      ))}
    </div>
  );
}
