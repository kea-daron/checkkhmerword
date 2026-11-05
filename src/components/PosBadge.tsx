import { describePos } from "@/lib/dict/pos";

export function PosBadge({ pos, size = "sm" }: { pos: string; size?: "sm" | "md" }) {
  const info = describePos(pos);
  const title = info ? `${info.km} · ${info.en}` : "abbreviation as printed in the dictionary";
  return (
    <span
      title={title}
      className={`km-ui inline-flex shrink-0 items-center rounded-md border border-line-strong/70 bg-paper-2 font-medium text-ink-2 ${
        size === "md" ? "px-2 py-0.5 text-sm" : "px-1.5 py-px text-[11px]"
      }`}
    >
      {pos}
      {info && size === "md" && <span className="ml-1.5 font-normal text-ink-3">{info.en}</span>}
    </span>
  );
}
