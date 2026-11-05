import type { Metadata } from "next";
import { LetterList } from "@/components/LetterList";
import { getLetters } from "@/lib/dict/store";

export async function generateStaticParams() {
  return getLetters().map((l) => ({ letter: l.letter }));
}

export async function generateMetadata({ params }: PageProps<"/browse/[letter]">): Promise<Metadata> {
  const { letter } = await params;
  const l = decodeURIComponent(letter);
  return { title: `${l} · Browse`, description: `Chuon Nath dictionary entries starting with ${l}.` };
}

export default async function LetterPage({ params }: PageProps<"/browse/[letter]">) {
  const { letter } = await params;
  return <LetterList letter={decodeURIComponent(letter)} page={1} />;
}
