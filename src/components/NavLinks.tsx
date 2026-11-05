"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/", km: "ពិនិត្យអក្ខរាវិរុទ្ធ", en: "Spell check", match: (p: string) => p === "/" },
  { href: "/search", km: "វចនានុក្រម", en: "Dictionary", match: (p: string) => p.startsWith("/search") || p.startsWith("/word") },
  { href: "/browse", km: "រុករក", en: "Browse", match: (p: string) => p.startsWith("/browse") },
  { href: "/about", km: "អំពី", en: "About", match: (p: string) => p.startsWith("/about") },
] as const;

export function NavLinks() {
  const pathname = usePathname();
  return (
    <nav aria-label="Main" className="flex items-center gap-1 text-sm">
      {LINKS.map((l) => {
        const active = l.match(pathname);
        return (
          <Link
            key={l.href}
            href={l.href}
            title={l.en}
            aria-current={active ? "page" : undefined}
            className={`km-ui rounded-md px-2.5 py-1.5 text-[15px] transition-colors sm:px-3 ${
              active ? "bg-paper-3 font-medium text-ink" : "text-ink-2 hover:bg-paper-2 hover:text-ink"
            }`}
          >
            {l.km}
          </Link>
        );
      })}
    </nav>
  );
}
