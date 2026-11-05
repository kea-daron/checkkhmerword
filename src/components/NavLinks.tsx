"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/", en: "Search", km: "ស្វែងរក" },
  { href: "/check", en: "Check text", km: "ពិនិត្យអត្ថបទ" },
  { href: "/browse", en: "Browse", km: "រុករក" },
  { href: "/about", en: "About", km: "អំពី" },
] as const;

export function NavLinks() {
  const pathname = usePathname();
  return (
    <nav aria-label="Main" className="flex items-center gap-1 text-sm">
      {LINKS.map((l) => {
        const active = l.href === "/" ? pathname === "/" || pathname.startsWith("/word") : pathname.startsWith(l.href);
        return (
          <Link
            key={l.href}
            href={l.href}
            aria-current={active ? "page" : undefined}
            className={`rounded-md px-2.5 py-1.5 transition-colors sm:px-3 ${
              active ? "bg-paper-3 text-ink" : "text-ink-2 hover:bg-paper-2 hover:text-ink"
            }`}
          >
            <span className="hidden sm:inline">{l.en}</span>
            <span className="km-ui sm:hidden">{l.km}</span>
          </Link>
        );
      })}
    </nav>
  );
}
