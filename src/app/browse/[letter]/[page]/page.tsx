import type { Metadata } from "next";
import { LetterList, pageCount } from "@/components/LetterList";
import { getLetters } from "@/lib/dict/store";

export async function generateStaticParams() {
  const out: { letter: string; page: string }[] = [];
  for (const l of getLetters()) {
    const pages = pageCount(l.letter);
    for (let p = 2; p <= pages; p++) out.push({ letter: l.letter, page: String(p) });
  }
  return out;
}

export async function generateMetadata({ params }: PageProps<"/browse/[letter]/[page]">): Promise<Metadata> {
  const { letter, page } = await params;
  const l = decodeURIComponent(letter);
  return { title: `${l} · page ${page} · Browse`, description: `Chuon Nath dictionary entries starting with ${l}, page ${page}.` };
}

export default async function LetterPageN({ params }: PageProps<"/browse/[letter]/[page]">) {
  const { letter, page } = await params;
  return <LetterList letter={decodeURIComponent(letter)} page={Number(page)} />;
}
