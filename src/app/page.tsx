import Link from "next/link";
import { Suspense } from "react";
import { ModeTabs } from "@/components/ModeTabs";
import { SpellEditor } from "@/components/SpellEditor";
import { getStore } from "@/lib/dict/store";
import { getPhraseMeta } from "@/lib/context/store";

export default function HomePage() {
  const { meta } = getStore();
  const phrases = getPhraseMeta();
  return (
    <div className="mx-auto max-w-6xl px-4 sm:px-6">
      <section className="pt-10 pb-6 text-center sm:pt-14">
        <h1 className="km text-4xl font-semibold leading-tight text-ink sm:text-5xl">ពិនិត្យអក្ខរាវិរុទ្ធខ្មែរ</h1>
        <p className="km-ui mt-3 text-base text-ink-2 sm:text-lg">
          តាមវចនានុក្រមខ្មែរ សម្ដេចព្រះសង្ឃរាជ ជួន ណាត (ពុទ្ធសាសនបណ្ឌិត្យ ១៩៦៧) · {meta.entries.toLocaleString()} ពាក្យ
        </p>
        <p className="km-ui mt-1 text-sm text-ink-3">
          ពិនិត្យអក្ខរាវិរុទ្ធ និងវេយ្យាករណ៍ខ្មែរ។ ពាក្យដែលមិនមានក្នុងវចនានុក្រម ជួន ណាត ត្រូវបានគូសបន្ទាត់ពណ៌ក្រហម; កំហុសវេយ្យាករណ៍ ជម្រើសពាក្យ
          និងវណ្ណយុត្តិ តាមច្បាប់ SBBIC ពណ៌ខៀវ; ពាក្យត្រឹមត្រូវ តែមិនសមនឹងឃ្លា ពណ៌លឿង។
        </p>
      </section>

      <div className="mb-6">
        <ModeTabs active="check" />
      </div>

      <Suspense fallback={<div className="min-h-[45vh] rounded-2xl border border-line bg-paper-2" />}>
        <SpellEditor />
      </Suspense>

      <section className="mt-12 grid gap-6 border-t border-line pt-8 text-sm text-ink-2 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <p className="km-ui font-semibold text-ink">ពិនិត្យភ្លាមៗពេលវាយ</p>
          <p className="km-ui mt-1">
            អត្ថបទត្រូវបានកាត់ជាពាក្យដោយស្វ័យប្រវត្តិ ហើយពាក្យនីមួយៗត្រូវបានផ្ទៀងផ្ទាត់ជាមួយវចនានុក្រម និងបញ្ជីអក្ខរាវិរុទ្ធ SBBIC។
          </p>
        </div>
        <div>
          <p className="km-ui font-semibold text-ink">ពិនិត្យវេយ្យាករណ៍តាមច្បាប់ SBBIC</p>
          <p className="km-ui mt-1">
            និង/នឹង, ចង់/ចង់បាន, លក្ខណនាម នាក់, ទេ ចុងប្រយោគបដិសេធ, សញ្ញា ? ក្នុងសំណួរ, ដកឃ្លាមុន ។ និង ៗ ជាដើម ត្រូវបានគូសពណ៌ខៀវ
            ជាមួយការពន្យល់ និងការកែមួយចុច ·{" "}
            <Link href="/about#grammar" className="text-accent underline underline-offset-4">
              បញ្ជីច្បាប់
            </Link>
          </p>
        </div>
        <div>
          <p className="km-ui font-semibold text-ink">យល់ឃ្លា មិនមែនត្រឹមតែពាក្យ</p>
          <p className="km-ui mt-1">
            ពាក្យដែលមានក្នុងវចនានុក្រម តែមិនត្រូវនឹងពាក្យជុំវិញវា (ដូចជា ការបណ្ដុះបណ្ដា → ការបណ្ដុះបណ្ដាល) ត្រូវបានគូសពណ៌លឿង ដោយប្រៀបធៀបគូពាក្យជាមួយបញ្ជីពាក្យផ្សំ
            {phrases ? ` និងស្ថិតិពីអត្ថបទខ្មែរ ${(phrases.tokens / 1e6).toLocaleString("en", { maximumFractionDigits: 1 })} លានពាក្យ` : ""} ·{" "}
            <Link href="/about#phrases" className="text-accent underline underline-offset-4">
              របៀបដែលវាដឹង
            </Link>
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
