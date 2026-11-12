import { excerpt } from "@/lib/dict/definition";
import { isKhmerDictAvailable, lookupKhmer } from "@/lib/khmerdict/store";
import { khmerdictUrl } from "@/lib/khmerdict/types";

/**
 * Sidebar card on an entry page: what khmerdict.com has for the same
 * headword (pronunciation, example sentence, etymology, sub-entries) and a
 * link to open it there. Renders just the link when the data is not installed.
 */
export function KhmerDictCard({ word }: { word: string }) {
  const url = khmerdictUrl(word);
  const entries = isKhmerDictAvailable() ? lookupKhmer(word) : [];
  const shown = entries.slice(0, 4);
  return (
    <div className="rounded-2xl border border-line bg-paper-2 p-4">
      <div className="flex items-center justify-between gap-2">
        <p className="font-semibold text-ink">khmerdict.com</p>
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-xs text-accent underline decoration-dotted underline-offset-4 hover:decoration-solid"
        >
          Open
          <svg aria-hidden viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M14 4h6v6M20 4l-9 9M19 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1h5" />
          </svg>
        </a>
      </div>
      {shown.length === 0 ? (
        <p className="mt-2 text-ink-2">
          {entries.length === 0 && isKhmerDictAvailable()
            ? "No matching entry in the khmerdict.com data."
            : "Pronunciation, examples and sub-entries from khmerdict.com appear here once its data is fetched."}
        </p>
      ) : (
        <ul className="mt-2 space-y-3">
          {shown.map((e) => (
            <li key={e.id} className="text-ink-2">
              <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                {e.level === 2 && <span className="km text-ink">{e.word}</span>}
                {e.pron && <span className="km text-ink-3">{e.pron}</span>}
                {e.pos && <span className="km-ui rounded-md bg-paper-3 px-1.5 text-[11px]">{e.pos}</span>}
                {e.src && (
                  <span className="km text-xs text-ink-3" title="Etymology as printed">
                    {e.src}
                  </span>
                )}
              </div>
              <p className="km mt-0.5 line-clamp-3">{excerpt(e.def, 140)}</p>
              {e.ex && <p className="km mt-0.5 line-clamp-2 text-ink-3">ឧ. {e.ex}</p>}
            </li>
          ))}
          {entries.length > shown.length && (
            <li className="text-xs text-ink-3">
              +{entries.length - shown.length} more on{" "}
              <a href={url} target="_blank" rel="noopener noreferrer" className="underline underline-offset-4 hover:text-accent">
                khmerdict.com
              </a>
            </li>
          )}
        </ul>
      )}
    </div>
  );
}
