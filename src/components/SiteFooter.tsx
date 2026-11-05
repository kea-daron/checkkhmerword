import Link from "next/link";

export function SiteFooter() {
  return (
    <footer className="mt-16 border-t border-line bg-paper-2/60">
      <div className="mx-auto grid max-w-6xl gap-6 px-4 py-10 text-sm text-ink-2 sm:grid-cols-3 sm:px-6">
        <div className="space-y-2">
          <p className="font-semibold text-ink">KhmerWord</p>
          <p className="km-ui">
            វចនានុក្រមខ្មែរ របស់សម្ដេចព្រះសង្ឃរាជ ជួន ណាត (ពុទ្ធសាសនបណ្ឌិត្យ ១៩៦៧)
          </p>
          <p>Chuon Nath Khmer Dictionary, Buddhist Institute, 1967 edition.</p>
        </div>
        <div className="space-y-2">
          <p className="font-semibold text-ink">Data</p>
          <p>
            Digitised by the{" "}
            <a className="underline decoration-line-strong underline-offset-4 hover:text-ink" href="https://www.open.org.kh" rel="noopener noreferrer" target="_blank">
              Open Institute
            </a>{" "}
            under the USAID-funded SPICE program; packaged by{" "}
            <a className="underline decoration-line-strong underline-offset-4 hover:text-ink" href="https://github.com/interscript/khmer-dict-spice" rel="noopener noreferrer" target="_blank">
              interscript/khmer-dict-spice
            </a>
            .
          </p>
          <p>Dictionary data licensed under LGPL 2.1.</p>
        </div>
        <div className="space-y-2">
          <p className="font-semibold text-ink">Links</p>
          <ul className="space-y-1">
            <li><Link className="hover:text-ink" href="/about">About &amp; abbreviations</Link></li>
            <li><Link className="hover:text-ink" href="/about#api">JSON API</Link></li>
            <li><Link className="hover:text-ink" href="/browse">Browse by letter</Link></li>
          </ul>
        </div>
      </div>
    </footer>
  );
}
