import type { Metadata } from "next";
import { Suspense } from "react";
import { TextChecker } from "@/components/TextChecker";

export const metadata: Metadata = {
  title: "Check text · ពិនិត្យអត្ថបទ",
  description: "Paste Khmer text and verify each word against the Chuon Nath dictionary and the SBBIC spelling list.",
};

export default function CheckPage() {
  return (
    <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6 sm:py-14">
      <header className="mb-8">
        <p className="km-ui text-sm font-medium uppercase tracking-[0.2em] text-accent">ពិនិត្យអត្ថបទ</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">Check Khmer text</h1>
        <p className="mt-2 max-w-2xl text-ink-2">
          Words are segmented automatically and looked up in the Chuon Nath dictionary. Unknown words get spelling
          suggestions; click a suggestion to replace it and re-check.
        </p>
      </header>
      <Suspense fallback={<div className="h-48 rounded-2xl border border-line bg-paper-2" />}>
        <TextChecker />
      </Suspense>
    </div>
  );
}
