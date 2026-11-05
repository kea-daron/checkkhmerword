import Link from "next/link";
import { Suspense } from "react";
import { NavLinks } from "./NavLinks";

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-30 border-b border-line bg-paper/90 backdrop-blur supports-[backdrop-filter]:bg-paper/75">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
        <Link href="/" className="group flex items-center gap-3">
          <span
            aria-hidden
            className="km flex h-9 w-9 items-center justify-center rounded-lg bg-accent text-accent-ink text-lg font-semibold shadow-card transition-transform group-hover:-rotate-3"
          >
            ក
          </span>
          <span className="flex flex-col leading-tight">
            <span className="text-base font-semibold tracking-tight">KhmerWord</span>
            <span className="km-ui text-[11px] text-ink-2">វចនានុក្រមខ្មែរ ជួន ណាត</span>
          </span>
        </Link>
        <Suspense fallback={<div className="h-8 w-64" aria-hidden />}>
          <NavLinks />
        </Suspense>
      </div>
    </header>
  );
}
