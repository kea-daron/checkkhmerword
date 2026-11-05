import Link from "next/link";
import { Suspense } from "react";
import { ModeTabs } from "@/components/ModeTabs";
import { SpellEditor } from "@/components/SpellEditor";
import { getStore } from "@/lib/dict/store";

export default function HomePage() {
  const { meta } = getStore();
  return (
    <div className="mx-auto max-w-6xl px-4 sm:px-6">
      <section className="pt-10 pb-6 text-center sm:pt-14">
        <h1 className="km text-4xl font-semibold leading-tight text-ink sm:text-5xl">ពិនិត្យអក្ខរាវិរុទ្ធខ្មែរ</h1>
        <p className="km-ui mt-3 text-base text-ink-2 sm:text-lg">
          តាមវចនានុក្រមខ្មែរ សម្ដេចព្រះសង្ឃរាជ ជួន ណាត (ពុទ្ធសាសនបណ្ឌិត្យ ១៩៦៧) · {meta.entries.toLocaleString()} ពាក្យ
        </p>
        <p className="mt-1 text-sm text-ink-3">Khmer spell check against the Chuon Nath Dictionary. Words not in the dictionary are underlined in red.</p>
      </section>

      <div className="mb-6">
        <ModeTabs active="check" />
      </div>

      <Suspense fallback={<div className="min-h-[45vh] rounded-2xl border border-line bg-paper-2" />}>
        <SpellEditor />
      </Suspense>

      <section className="mt-12 grid gap-6 border-t border-line pt-8 text-sm text-ink-2 sm:grid-cols-3">
        <div>
          <p className="km-ui font-semibold text-ink">ពិនិត្យភ្លាមៗពេលវាយ</p>
          <p className="km-ui mt-1">
            អត្ថបទត្រូវបានកាត់ជាពាក្យដោយស្វ័យប្រវត្តិ ហើយពាក្យនីមួយៗត្រូវបានផ្ទៀងផ្ទាត់ជាមួយវចនានុក្រម និងបញ្ជីអក្ខរាវិរុទ្ធ SBBIC។
          </p>
        </div>
        <div>
          <p className="km-ui font-semibold text-ink">អត់ឱនចំពោះការវាយខុសតូចតាច</p>
          <p className="km-ui mt-1">
            ដកឃ្លាមិនឃើញ, លំដាប់ <span className="km">ាំ/ំា</span>, <span className="km">េី/ើ</span>, <span className="km">្ដ/្ត</span> និង{" "}
            <span className="km">ឲ/ឱ</span> ត្រូវបានធ្វើឲ្យស្មើគ្នាដោយស្វ័យប្រវត្តិ។
          </p>
        </div>
        <div>
          <p className="km-ui font-semibold text-ink">ភ្ជាប់ទៅវចនានុក្រមផ្ទាល់</p>
          <p className="km-ui mt-1">
            ស្វែងរកនិយមន័យពេញនៅផ្ទាំង{" "}
            <Link href="/search" className="text-accent underline underline-offset-4">
              វចនានុក្រម
            </Link>{" "}
            ឬប្រើ{" "}
            <Link href="/about#api" className="text-accent underline underline-offset-4">
              JSON API
            </Link>
            ។
          </p>
        </div>
      </section>
    </div>
  );
}
