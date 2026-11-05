import Link from "next/link";

export default function NotFound() {
  return (
    <div className="mx-auto flex max-w-xl flex-col items-center px-4 py-24 text-center">
      <span className="km text-7xl text-accent/40">៙</span>
      <h1 className="km mt-4 text-3xl font-semibold">រកមិនឃើញទំព័រនេះទេ</h1>
      <p className="mt-2 text-ink-2">This page or entry does not exist.</p>
      <Link href="/" className="mt-6 rounded-lg bg-accent px-4 py-2 text-sm font-medium text-accent-ink hover:bg-accent-strong">
        Back to search
      </Link>
    </div>
  );
}
