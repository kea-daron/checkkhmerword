import Image from "next/image";
import Link from "next/link";
import { Suspense } from "react";
import { NavLinks } from "./NavLinks";
import { ThemeToggle } from "./ThemeToggle";

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-30 border-b border-line bg-paper/90 backdrop-blur supports-[backdrop-filter]:bg-paper/75">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
        <Link href="/" className="group flex items-center gap-3">
          <Image
            src="/images/logo.webp"
            alt=""
            width={56}
            height={36}
            priority
            className="h-9 w-auto rounded-md shadow-card transition-transform group-hover:-rotate-3"
          />
          <span className="flex flex-col leading-tight">
            <span className="text-base font-semibold tracking-tight">KhmerWord</span>
            <span className="km-ui text-[11px] text-ink-2">វចនានុក្រមខ្មែរ ជួន ណាត</span>
          </span>
        </Link>
        <div className="flex items-center gap-2 sm:gap-3">
          <Suspense fallback={<div className="h-8 w-64" aria-hidden />}>
            <NavLinks />
          </Suspense>
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}
