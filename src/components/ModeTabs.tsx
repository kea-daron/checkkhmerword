import Link from "next/link";

const TABS = [
  { key: "check", href: "/", km: "ពិនិត្យអក្ខរាវិរុទ្ធ", en: "Spell check" },
  { key: "search", href: "/search", km: "វចនានុក្រម", en: "Dictionary" },
  { key: "browse", href: "/browse", km: "រុករកតាមអក្សរ", en: "Browse" },
] as const;

export type Mode = (typeof TABS)[number]["key"];

export function ModeTabs({ active }: { active: Mode }) {
  return (
    <nav aria-label="Mode" className="flex justify-center">
      <div className="inline-flex overflow-hidden rounded-xl border border-line bg-paper-2 p-1 shadow-card">
        {TABS.map((t) => {
          const on = t.key === active;
          return (
            <Link
              key={t.key}
              href={t.href}
              aria-current={on ? "page" : undefined}
              className={`km-ui flex flex-col items-center rounded-lg px-4 py-2 text-base font-medium transition sm:px-6 ${
                on ? "bg-accent text-accent-ink shadow-card" : "text-ink-2 hover:bg-paper-3 hover:text-ink"
              }`}
            >
              {t.km}
              <span className={`text-[10px] font-normal uppercase tracking-wide ${on ? "text-accent-ink/80" : "text-ink-3"}`}>{t.en}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
