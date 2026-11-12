import "server-only";
import { normalizeKey } from "@/lib/khmer/normalize";
import { Context, cpLength } from "./context";

/**
 * Grammar rules. Each rule reads the atoms of a `Context` and reports what it
 * finds; `catalog.ts` describes the rules and `context.ts` resolves overlaps.
 *
 * Khmer is written without spaces between words, so rules match on the
 * checker's word segmentation rather than on raw text, except for the
 * spacing/punctuation rules at the bottom, which are plain regexes.
 */
export type Rule = (ctx: Context) => void;

const keys = (words: readonly string[]) => new Set(words.map(normalizeKey));

// --------------------------------------------------------------------------
// និង / នឹង
// --------------------------------------------------------------------------

const hoeyNing: Rule = (ctx) => {
  for (const [from, to] of ctx.findLiteral("ហើយនឹង")) {
    // ហើយនឹងថ្កល់ ("and steady") is the one place ហើយនឹង is right.
    if (ctx.keyAt(ctx.next(to)) === "ថ្កល់") continue;
    ctx.report("hoey-ning", from, to, ["ហើយនិង"], {
      message: "ឈ្នាប់ «ហើយនិង» សរសេរដោយ និង (ស្រៈ ិ) ជានិច្ច។",
      messageEn: "The conjunction is ហើយនិង, never ហើយនឹង.",
    });
  }
};

const cheamuoyNung: Rule = (ctx) => {
  for (const [from, to] of ctx.findLiteral("ជាមួយនិង")) {
    ctx.report("cheamuoy-nung", from, to, ["ជាមួយនឹង"], {
      message: "ក្រោយ «ជាមួយ» ប្រើ នឹង (ស្រៈ ឹ) មិនមែនឈ្នាប់ និង ទេ។",
      messageEn: "After ជាមួយ the particle is នឹង, not the conjunction និង.",
    });
  }
};

/** Verbs and adjectives whose complement is introduced by នឹង ("with, to, against"). */
const TAKES_NUNG = [
  "ប្រឈមមុខ",
  "ប្រឈម",
  "ទាក់ទង",
  "ទាក់ទិន",
  "ពាក់ព័ន្ធ",
  "ស្រដៀង",
  "ស្មើ",
  "ផ្ទុយ",
  "ប្រឆាំង",
  "ទប់ទល់",
  "តទល់",
  "ទល់",
  "ស៊ាំ",
  "ប្រៀបធៀប",
  "ធៀប",
  "សមស្រប",
  "ឆ្លើយតប",
] as const;

const verbNung: Rule = (ctx) => {
  for (let i = 0; i < ctx.atoms.length; i++) {
    const hit = ctx.anyLiteralAt(i, TAKES_NUNG);
    if (!hit) continue;
    const [last, word] = hit;
    const n = ctx.next(last);
    if (ctx.keyAt(n) !== "និង") continue;
    ctx.report("verb-nung", n, n, ["នឹង"], {
      message: `ក្រោយ «${word}» ប្រើ នឹង (ស្រៈ ឹ) មិនមែនឈ្នាប់ និង ទេ។`,
      messageEn: `${word} is followed by the particle នឹង, not the conjunction និង.`,
    });
    i = last;
  }
};

const roviengNing: Rule = (ctx) => {
  for (let i = 0; i < ctx.atoms.length; i++) {
    if (ctx.keyAt(i) !== "រវាង") continue;
    let j = ctx.next(i, true);
    for (let steps = 0; j >= 0 && steps < 10; steps++, j = ctx.next(j, true)) {
      const k = ctx.keyAt(j);
      if (k === "និង" || k === "ឬ") break;
      if (k === "នឹង") {
        ctx.report("rovieng-ning", j, j, ["និង"], {
          message: "«រវាង … និង …» ប្រើឈ្នាប់ និង (ស្រៈ ិ)។",
          messageEn: "“Between A and B” pairs រវាង with និង.",
        });
        break;
      }
    }
  }
};

/** Common verbs the dictionary labels as nouns; never treat them as the second noun of "noun នឹង noun". */
const NOT_A_NOUN = keys(["និយាយ", "លុយ", "ការងារ", "ធ្វើការ", "ដំណើរ", "ចំណាយ", "សិក្សា", "រៀន", "ចេញ", "ចូល"]);

/** True when one of `literals` ends exactly at word atom `end`. */
function literalEndsAt(ctx: Context, end: number, literals: readonly string[]): boolean {
  let start = end;
  for (let back = 0; back < 3 && start >= 0; back++, start = ctx.prev(start)) {
    if (literals.some((lit) => ctx.literalAt(start, lit) === end)) return true;
  }
  return false;
}

const nounNungNoun: Rule = (ctx) => {
  for (let i = 0; i < ctx.atoms.length; i++) {
    if (ctx.keyAt(i) !== "នឹង") continue;
    const p = ctx.prev(i, true);
    const n = ctx.next(i, true);
    if (p < 0 || n < 0) continue;
    if (!ctx.isNounOnly(p) || !ctx.isNounOnly(n)) continue;
    // ប្រឈមមុខនឹងបញ្ហា: មុខ is a noun, but the phrase takes នឹង.
    if (literalEndsAt(ctx, p, [...TAKES_NUNG, "ជាមួយ"])) continue;
    if (NOT_A_NOUN.has(ctx.keyAt(n)) || NOT_A_NOUN.has(ctx.keyAt(p))) continue;
    ctx.report("noun-nung-noun", i, i, ["និង"], {
      message: `«${ctx.atoms[p].text}» និង «${ctx.atoms[n].text}» ជានាមទាំងពីរ ៖ ភ្ជាប់ដោយឈ្នាប់ និង (ស្រៈ ិ)។`,
      messageEn: `Two nouns are joined by និង; នឹង marks the future or “with”.`,
    });
  }
};

// --------------------------------------------------------------------------
// Confusable words
// --------------------------------------------------------------------------

const kalPi: Rule = (ctx) => {
  for (const [from, to] of ctx.findLiteral("កាល់ពី")) {
    // Usually two atoms (កាល់ + ពី): flag only កាល់. One atom: replace the whole.
    const single = from === to;
    ctx.report("kal-pi", from, single ? to : from, [single ? "កាលពី" : "កាល"], {
      message: "«កាល» (ពេល) គ្មានសញ្ញា ់ ទេ ៖ កាលពីមុន។ «កាល់» ជាកិរិយា (សត្វជល់គ្នា)។",
      messageEn: "កាល (time) has no ់; កាល់ is a different verb.",
    });
  }
};

const AFTER_LOENG = keys(["ទៅ", "មក", "លើ", "វិញ", "ដល់"]);

const loengTov: Rule = (ctx) => {
  for (let i = 0; i < ctx.atoms.length; i++) {
    if (ctx.keyAt(i) !== "លើង") continue;
    if (!AFTER_LOENG.has(ctx.keyAt(ctx.next(i)))) continue;
    ctx.report("loeng-tov", i, i, ["ឡើង"], {
      message: "«ឡើង» (ទៅខាងលើ) សរសេរដោយ ឡ។ «លើង» មានន័យថាគាស់ឡើង។",
      messageEn: "“Go up” is ឡើង; លើង means to pry something up.",
    });
  }
};

const AFTER_PIR = keys(["នាក់", "ដុល្លារ", "រៀល", "រយ", "ពាន់", "ម៉ឺន", "លាន"]);
const AFTER_PI = keys(["ណា", "អ្វី", "អី"]);

const piPir: Rule = (ctx) => {
  for (let i = 0; i < ctx.atoms.length; i++) {
    const k = ctx.keyAt(i);
    if (k === "ពី" && AFTER_PIR.has(ctx.keyAt(ctx.next(i)))) {
      ctx.report("pi-pir", i, i, ["ពីរ"], {
        message: `មុនលក្ខណនាម «${ctx.atoms[ctx.next(i)].text}» ត្រូវការលេខ ពីរ (២) មិនមែនធ្នាក់ ពី ទេ។`,
        messageEn: "Before a classifier the word is the number ពីរ (two), not the preposition ពី (from).",
      });
    } else if (k === "ពីរ" && AFTER_PI.has(ctx.keyAt(ctx.next(i)))) {
      ctx.report("pi-pir", i, i, ["ពី"], {
        message: `មុន «${ctx.atoms[ctx.next(i)].text}» ប្រើធ្នាក់ ពី (អំពី) មិនមែនលេខ ពីរ ទេ។`,
        messageEn: "Before ណា / អ្វី the word is the preposition ពី (from), not the number ពីរ (two).",
      });
    }
  }
};

const delFinal: Rule = (ctx) => {
  for (let i = 0; i < ctx.atoms.length; i++) {
    if (ctx.keyAt(i) !== "ដែល") continue;
    const s = ctx.sentenceOf(i);
    if (!s || s.terminal === undefined) continue;
    // Nothing but spaces between ដែល and the sentence mark.
    if (ctx.wordsIn(i + 1, s.terminal).length) continue;
    ctx.report("del-final", i, i, ["ដែរ"], {
      message: "«ដែល» នាំឃ្លាខាងក្រោយ មិនអាចនៅចុងប្រយោគទេ ៖ ពាក្យ «ដែរ» (ផងដែរ) ទើបត្រូវ។",
      messageEn: "ដែល introduces a clause; the sentence-final particle “too / also” is ដែរ.",
    });
  }
};

const PLACE_AFTER_NOV = keys([
  "ក្នុង", "លើ", "ក្រោម", "ក្រៅ", "ក្បែរ", "ជិត", "ឆ្ងាយ", "ខាង", "មុខ", "ក្រោយ", "ចន្លោះ", "កណ្ដាល", "ចុង", "ជាយ",
  "ទីនេះ", "ទីនោះ", "ទី", "ឯ", "ឯណា", "ទីណា", "កន្លែង", "ផ្ទះ", "សាលា", "ផ្សារ", "ទីក្រុង", "ខេត្ត", "ស្រុក", "ភូមិ",
  "ប្រទេស", "បរទេស", "ភ្នំពេញ", "កម្ពុជា", "តំបន់", "ទូទាំង", "ជុំវិញ",
]);
const TIME_OR_PLACE = new Set([
  ...PLACE_AFTER_NOV,
  ...keys(["ពេល", "ថ្ងៃ", "ឆ្នាំ", "ខែ", "ម៉ោង", "យប់", "ព្រឹក", "ល្ងាច", "រសៀល", "ថ្ងៃនេះ", "ដើម", "ពាក់កណ្ដាល", "ចំ", "ចំណុច", "តាម", "គ្រប់", "ភាគ", "ទិស", "លើក", "ដំណាក់កាល", "ជំហាន", "កម្រិត", "អាយុ", "វ័យ", "ក្រោមការ", "សម័យ", "រជ្ជកាល", "ជាន់"]),
]);
const TAKES_NUV = ["ទទួលបាន", "ទទួលយក", "ផ្ដល់ជូន", "ផ្ដល់", "ប្រកាន់យក", "ប្រកាន់", "នាំមក", "លើកកម្ពស់", "ពង្រឹង", "អនុវត្ត"] as const;

const novNuv: Rule = (ctx) => {
  for (let i = 0; i < ctx.atoms.length; i++) {
    if (ctx.keyAt(i) === "នូវ") {
      const n = ctx.next(i, true);
      if (n < 0 || !PLACE_AFTER_NOV.has(ctx.keyAt(n))) continue;
      ctx.report("nov-nuv", i, i, ["នៅ"], {
        message: `មុនទីកន្លែង «${ctx.atoms[n].text}» ប្រើ នៅ (ស្ថិតនៅ) មិនមែន នូវ ទេ។`,
        messageEn: "Before a place word the preposition is នៅ (at); នូវ marks an object.",
      });
      continue;
    }
    const hit = ctx.anyLiteralAt(i, TAKES_NUV);
    if (!hit) continue;
    const [last, verb] = hit;
    const nov = ctx.next(last, true);
    if (ctx.keyAt(nov) !== "នៅ") continue;
    const obj = ctx.next(nov, true);
    if (!ctx.isWord(obj) || TIME_OR_PLACE.has(ctx.keyAt(obj))) continue;
    if (!ctx.isNounOnly(obj)) continue;
    ctx.report("nov-nuv", nov, nov, ["នូវ"], {
      severity: "hint",
      message: `កម្មបទរបស់ «${verb}» នាំដោយ នូវ ៖ ${verb}នូវ${ctx.atoms[obj].text}។`,
      messageEn: `The object of ${verb} is introduced by នូវ, not by the locative នៅ.`,
    });
    i = last;
  }
};

/**
 * Spellings SBBIC lists as alternatives, mapped to the Chuon Nath headword.
 * Pairs whose target is not a headword, or whose variant is one, are dropped
 * at startup so the rule never argues with the dictionary.
 */
const VARIANTS: [string, string][] = [
  ["អោយ", "ឱ្យ"],
  ["កំពស់", "កម្ពស់"],
  ["តំលៃ", "តម្លៃ"],
  ["សំលេង", "សំឡេង"],
  ["សម្លេង", "សំឡេង"],
  ["ចំលើយ", "ចម្លើយ"],
  ["ទំលាប់", "ទម្លាប់"],
  ["កម្នាញ់", "កំណាញ់"],
  ["សំលាប់", "សម្លាប់"],
  ["តំរង់", "តម្រង់"],
  ["កំលាំង", "កម្លាំង"],
  ["ចៃដន្យ", "ចៃដន់"],
  ["ម្កុដ", "មកុដ"],
  ["មង្កុដ", "មកុដ"],
  ["ពុទ្ធសាស្នា", "ពុទ្ធសាសនា"],
  // The same ំ + រ/ល pattern beyond SBBIC's list.
  ["សំរាប់", "សម្រាប់"],
  ["សំរេច", "សម្រេច"],
  ["សំរួល", "សម្រួល"],
  ["សំរាក", "សម្រាក"],
  ["សំរាល", "សម្រាល"],
  ["សំអាត", "សម្អាត"],
  ["សំលៀកបំពាក់", "សម្លៀកបំពាក់"],
  ["ចំរើន", "ចម្រើន"],
  ["ចំរុះ", "ចម្រុះ"],
  ["ចំរៀង", "ចម្រៀង"],
  ["ចំលង", "ចម្លង"],
  ["ជំរើស", "ជម្រើស"],
  ["ជំរុញ", "ជម្រុញ"],
  ["ជំរាប", "ជម្រាប"],
  ["តំរូវ", "តម្រូវ"],
  ["តំរង", "តម្រង"],
  ["បំរើ", "បម្រើ"],
  ["បំរុង", "បម្រុង"],
  ["កំរិត", "កម្រិត"],
  ["កំរង", "កម្រង"],
  ["អំរែក", "អម្រែក"],
  ["ដំរី", "ដំរី"],
];

let variantMap: Map<string, string> | null = null;
function variants(ctx: Context): Map<string, string> {
  if (variantMap) return variantMap;
  variantMap = new Map();
  for (const [from, to] of VARIANTS) {
    const f = normalizeKey(from);
    const t = normalizeKey(to);
    if (f === t || ctx.isHeadword(f) || !ctx.isHeadword(t)) continue;
    variantMap.set(f, to);
  }
  return variantMap;
}

const variantSpelling: Rule = (ctx) => {
  const map = variants(ctx);
  const report = (start: number, end: number, to: string) =>
    ctx.reportRange("variant-spelling", start, end, [to], {
      message: `វចនានុក្រម ជួន ណាត សរសេរ «${to}»។`,
      messageEn: `The Chuon Nath dictionary spells this ${to}.`,
    });
  // Whole tokens, not atoms: the checker may have split សំរាប់ into សំ + រាប់ inside one token.
  const done = new Set<number>();
  for (const w of ctx.words) {
    const to = map.get(w.key);
    if (!to) continue;
    done.add(w.start);
    report(w.start, w.end, to);
  }
  // A variant the checker cut into separate known tokens (ទំលាប់ -> ទំ + លាប់) or kept
  // inside a longer compound (សំរេចចិត្ត, និងសំលេង): match the atoms in a row, for a
  // span that begins or ends on a token boundary.
  const starts = new Set(ctx.words.map((w) => w.start));
  const ends = new Set(ctx.words.map((w) => w.end));
  for (const [from, to] of map) {
    for (const [a, b] of ctx.findLiteral(from)) {
      if (a === b) continue; // a single atom is a whole token: handled above or not a variant here
      const start = ctx.atoms[a].start;
      const end = ctx.atoms[b].end;
      if (done.has(start) || (!starts.has(start) && !ends.has(end))) continue;
      done.add(start);
      report(start, end, to);
    }
  }
};

// --------------------------------------------------------------------------
// Verbs and complements
// --------------------------------------------------------------------------

const COMMON_VERBS = keys([
  "ទៅ", "មក", "ធ្វើ", "រៀន", "អាន", "សរសេរ", "ញ៉ាំ", "ហូប", "ផឹក", "ដេក", "ដើរ", "រត់", "និយាយ", "មើល", "ស្ដាប់", "លេង",
  "ទិញ", "លក់", "ដឹង", "យល់", "ឃើញ", "ជួប", "ជួយ", "សួរ", "ឆ្លើយ", "បង្រៀន", "ធ្វើការ", "ផ្ញើ", "ចេញ", "ចូល", "ឈប់",
  "ចាប់ផ្ដើម", "បន្ត", "ត្រឡប់", "រស់នៅ", "ស្នាក់នៅ", "ប្រើ", "ក្លាយ", "សាកល្បង", "ព្យាយាម", "ចែករំលែក", "ប្រាប់",
  "ពិនិត្យ", "សម្រាក", "ងូតទឹក", "ចម្អិន", "បើក", "បិទ", "បើកបរ", "ហែល", "ហោះ", "ចូលរួម", "ដាក់", "យក", "រៀបការ",
  "សិក្សា", "បម្រើ", "ជិះ", "ទស្សនា", "ទាក់ទង", "ចាកចេញ", "ស្គាល់", "ចេះ", "ហៅ", "រង់ចាំ", "បង្កើត", "សាងសង់", "ទទួល",
]);
const CONCRETE_NOUNS = keys([
  "ឡាន", "ផ្ទះ", "លុយ", "ប្រាក់", "សៀវភៅ", "ទូរស័ព្ទ", "កុំព្យូទ័រ", "ម៉ូតូ", "កង់", "ដី", "អំណោយ", "រង្វាន់", "កូន", "ការងារ",
  "អាហារ", "ទឹក", "បាយ", "កាហ្វេ", "នំ", "ផ្លែឈើ", "ខោអាវ", "អាវ", "ខោ", "ស្បែកជើង", "សន្តិភាព", "សេរីភាព", "យុត្តិធម៌",
  "ចម្លើយ", "ព័ត៌មាន", "ជំនួយ", "ឱកាស", "ពេលវេលា", "សុភមង្គល", "ជោគជ័យ", "សុខភាព", "ចំណេះដឹង", "បទពិសោធន៍", "មិត្ត",
]);

const chongBanVerb: Rule = (ctx) => {
  for (const [from, to] of ctx.findLiteral("ចង់បាន")) {
    const n = ctx.next(to);
    if (!COMMON_VERBS.has(ctx.keyAt(n))) continue;
    ctx.report("chong-ban-verb", from, to, ["ចង់"], {
      message: `មុនកិរិយា «${ctx.atoms[n].text}» ប្រើ ចង់ តែម្នាក់ឯង ៖ ចង់${ctx.atoms[n].text}។ «ចង់បាន» ត្រូវការនាម។`,
      messageEn: `Before the verb ${ctx.atoms[n].text} use ចង់ alone; ចង់បាន takes a noun.`,
    });
  }
};

const chongNoun: Rule = (ctx) => {
  for (let i = 0; i < ctx.atoms.length; i++) {
    if (ctx.keyAt(i) !== "ចង់") continue;
    const n = ctx.next(i);
    if (!CONCRETE_NOUNS.has(ctx.keyAt(n))) continue;
    ctx.report("chong-noun", i, i, ["ចង់បាន"], {
      message: `មុននាម «${ctx.atoms[n].text}» ប្រើ ចង់បាន ៖ ចង់បាន${ctx.atoms[n].text}។`,
      messageEn: `Before the noun ${ctx.atoms[n].text} the verb is ចង់បាន.`,
    });
  }
};

const SPEECH_VERBS = [
  "និយាយ", "គិត", "ប្រាប់", "ដឹង", "ជឿ", "យល់ឃើញ", "យល់", "សង្ឃឹម", "បញ្ជាក់", "សន្យា", "ឮ", "ឃើញ", "សួរ", "ឆ្លើយ",
  "ថ្លែង", "ប្រកាស", "អះអាង", "ពន្យល់", "ចាត់ទុក", "សន្និដ្ឋាន", "សង្ស័យ", "ទទួលស្គាល់", "បដិសេធ", "រកឃើញ", "ទាយ",
  "ស្មាន", "រំពឹង", "បារម្ភ", "បង្ហាញ", "យល់ព្រម",
] as const;
const NOMINALIZERS = keys(["អ្នក", "ការ", "ភាព", "សេចក្ដី", "ពាក្យ", "របៀប", "ដំណើរ", "អ្វី", "ដែល"]);

const verbThaa: Rule = (ctx) => {
  for (let i = 0; i < ctx.atoms.length; i++) {
    const hit = ctx.anyLiteralAt(i, SPEECH_VERBS);
    if (!hit) continue;
    const [last, verb] = hit;
    const del = ctx.next(last);
    if (ctx.keyAt(del) !== "ដែល") continue;
    if (NOMINALIZERS.has(ctx.keyAt(ctx.prev(i)))) continue;
    // ដែល followed by the sentence mark is the ដែរ slip, reported elsewhere.
    const after = ctx.after(del);
    if (!after || after.kind === "punct") continue;
    ctx.report("verb-thaa", del, del, ["ថា"], {
      message: `«${verb}» នាំសេចក្ដីដោយ ថា ៖ ${verb}ថា…។ «ដែល» នាំឃ្លាបរិវារនាម។`,
      messageEn: `${verb} introduces what is said or thought with ថា; ដែល introduces a relative clause.`,
    });
    i = last;
  }
};

const PRONOUNS = keys(["ខ្ញុំ", "គាត់", "នាង", "គេ", "យើង", "ពួកគេ", "ពួកយើង", "លោក", "អ្នក", "វា", "ពួកគាត់", "ឪពុក", "ម្ដាយ", "បង", "ប្អូន", "ខ្ញុំបាទ", "នាងខ្ញុំ"]);
const ROLES = keys([
  "គ្រូ", "គ្រូបង្រៀន", "ពេទ្យ", "គ្រូពេទ្យ", "វេជ្ជបណ្ឌិត", "សិស្ស", "និស្សិត", "កសិករ", "កម្មករ", "មេធាវី", "វិស្វករ", "ស្ថាបត្យករ",
  "មនុស្ស", "កូន", "មិត្ត", "មិត្តភក្តិ", "បងប្អូន", "ប្រធាន", "នាយក", "បុគ្គលិក", "ទាហាន", "ប៉ូលិស", "នគរបាល", "អ្នកជំនួញ", "ឈ្មួញ",
  "ជាង", "អ្នកនិពន្ធ", "កវី", "អ្នកកាសែត", "តារា", "កីឡាករ", "អ្នកបើកបរ", "ចុងភៅ", "បុព្វជិត", "ព្រះសង្ឃ", "សាស្ត្រាចារ្យ", "បណ្ឌិត",
  "ជនជាតិ", "ប្រជាជន", "ពលរដ្ឋ", "អ្នកស្រុក", "អ្នកភូមិ", "បេក្ខជន", "សមាជិក", "អ្នកដឹកនាំ", "មេដឹកនាំ", "ម្ចាស់", "ភ្ញៀវ",
]);

const kueChea: Rule = (ctx) => {
  for (let i = 0; i < ctx.atoms.length; i++) {
    if (ctx.keyAt(i) !== "គឺ") continue;
    if (!PRONOUNS.has(ctx.keyAt(ctx.prev(i, true)))) continue;
    const n = ctx.next(i, true);
    if (!ROLES.has(ctx.keyAt(n))) continue;
    ctx.report("kue-chea", i, i, ["គឺជា", "ជា"], {
      message: `ប្រាប់ពីតួនាទីឬអាជីព ប្រើ គឺជា ៖ …គឺជា${ctx.atoms[n].text}។`,
      messageEn: "To say what someone is, the copula is គឺជា (or ជា), not គឺ alone.",
    });
  }
};

// --------------------------------------------------------------------------
// Classifiers
// --------------------------------------------------------------------------

const PEOPLE = keys([
  "មនុស្ស", "សិស្ស", "គ្រូ", "កូន", "ក្មេង", "កុមារ", "កុមារា", "កុមារី", "បុរស", "ស្ត្រី", "នារី", "និស្សិត", "បុគ្គលិក", "កម្មករ",
  "កសិករ", "ពលរដ្ឋ", "ប្រជាជន", "ប្រជាពលរដ្ឋ", "ភ្ញៀវ", "យុវជន", "កីឡាករ", "ទាហាន", "មិត្ត", "មិត្តភក្តិ", "សមាជិក", "អ្នក",
  "ចោរ", "ជនរងគ្រោះ", "អតិថិជន", "អ្នកដំណើរ", "ជនជាតិ", "ពេទ្យ", "គ្រូពេទ្យ", "វេជ្ជបណ្ឌិត", "ប៉ូលិស", "នគរបាល", "មន្ត្រី",
  "បេក្ខជន", "អ្នកជំងឺ", "ក្មួយ", "បងប្អូន", "ជនបរទេស", "ទេសចរ", "អ្នកទេសចរ", "បុគ្គល", "ជន", "ស្រី", "ប្រុស", "ចៅ", "ភរិយា", "ស្វាមី",
]);
const CARDINALS = keys([
  "មួយ", "ពីរ", "បី", "បួន", "ប្រាំ", "ប្រាំមួយ", "ប្រាំពីរ", "ប្រាំបី", "ប្រាំបួន", "ដប់", "ម្ភៃ", "សាមសិប", "សែសិប", "ហាសិប",
  "ហុកសិប", "ចិតសិប", "ប៉ែតសិប", "កៅសិប", "រយ", "ពាន់", "ម៉ឺន", "សែន", "លាន", "ប៉ុន្មាន",
]);
const NUMBER_WORDS = new Set([...CARDINALS, ...keys(["ច្រើន", "ជាច្រើន", "តិច", "រាប់"])]);
/** Classifiers and measure words that may follow a number after a people noun (SBBIC list plus time, money and group words). */
const AFTER_NUMBER_OK = keys([
  "នាក់", "រូប", "អង្គ", "ក្រុម", "ពួក", "គូ", "គ្រួសារ", "ជួរ", "ក្បាល", "ខ្នង", "ដង", "លើក", "ភាគរយ", "ឆ្នាំ", "ខែ", "ថ្ងៃ", "ម៉ោង",
  "នាទី", "វិនាទី", "សប្ដាហ៍", "អាទិត្យ", "ជំនាន់", "ជាន់", "ដុល្លារ", "រៀល", "បាត", "គីឡូ", "គីឡូក្រាម", "គីឡូម៉ែត្រ", "ម៉ែត្រ", "លីត្រ",
  "ភាគ", "ចំណែក", "ចំនួន", "ប្រភេទ", "យ៉ាង", "បែប", "ភាគី", "ពូជ", "ភេទ", "វ័យ", "ទី", "ផ្នែក", "វគ្គ", "ថ្នាក់", "ជំពូក", "ទំព័រ",
  "លេខ", "សន្លឹក", "ចំណុច", "ដុំ", "ដើម", "កន្លែង", "កន្លះ", "ម៉ាត់", "ដៃ", "ជើង", "ភ្នែក", "កញ្ចប់", "កែវ", "ចាន", "ដប", "ពែង",
  "ច្បាប់", "គ្រឿង", "គ្រាប់", "តួ", "ផែន", "ប្រអប់", "ឈុត", "ហ្វូង", "ក្បួន", "ជំពូក", "ភូមិ", "ឃុំ", "ស្រុក", "ខេត្ត", "ក្រុង", "ប្រទេស",
  "ដំណាក់", "ជំហាន", "ទសវត្សរ៍", "សតវត្ស", "សតវត្សរ៍", "អាយុ", "ជាង", "ដល់", "ទៅ", "ឬ",
]);
const BEFORE_NUMBER_SKIP = keys(["ទាំង", "ទី", "លេខ", "ទាំងអស់", "ចំនួន", "អាយុ", "ថ្នាក់", "ឆ្នាំ", "ជំនាន់"]);
/** What may directly follow a wrong “number + អ្នក” and still leave it a classifier slot. */
const AFTER_NEAK_OK = keys(["នេះ", "នោះ", "ទៀត", "ដែល", "ក៏", "និង", "ហើយ", "ទេ", "ឬ", "ផង", "ដែរ", "ប៉ុណ្ណោះ", "កំពុង", "បាន", "ទៅ", "មក", "ក្នុង", "ដែរ"]);

const isNumber = (ctx: Context, i: number) => i >= 0 && (ctx.atoms[i].kind === "num" || NUMBER_WORDS.has(ctx.keyAt(i)));

const classifierPeople: Rule = (ctx) => {
  for (let i = 0; i < ctx.atoms.length; i++) {
    const a = ctx.atoms[i];
    // number + អ្នក used as a classifier: ពីរអ្នក -> ពីរនាក់
    if (a.kind === "word" && CARDINALS.has(a.key) && ctx.keyAt(ctx.next(i)) === "អ្នក") {
      const neak = ctx.next(i);
      const after = ctx.after(neak);
      if (after && after.kind === "word" && !AFTER_NEAK_OK.has(after.key)) continue;
      const before = ctx.keyAt(ctx.prev(i, true));
      if (before === "និង" || before === "រស់") continue;
      const sugg = [`${a.text}នាក់`];
      // មកពីរអ្នក is usually មកពីអ្នក ("from you") with a stray រ.
      if (a.key === "ពីរ" && ["មក", "ចេញ", "បាន", "ទទួល"].includes(before)) sugg.unshift("ពីអ្នក");
      ctx.report("classifier-people", i, neak, sugg, {
        message: "លក្ខណនាមសម្រាប់រាប់មនុស្សគឺ «នាក់» ៖ ពីរនាក់ មិនមែន ពីរអ្នក ទេ។",
        messageEn: "People are counted with the classifier នាក់, not អ្នក.",
      });
      i = neak;
      continue;
    }
    // people noun + number run + (no classifier)
    if (a.kind !== "word" || !PEOPLE.has(a.key)) continue;
    const first = ctx.next(i);
    if (!isNumber(ctx, first)) continue;
    if (BEFORE_NUMBER_SKIP.has(ctx.keyAt(ctx.prev(i, true)))) continue;
    let last = first;
    for (let n = ctx.next(last); isNumber(ctx, n); n = ctx.next(n)) last = n;
    // What follows the number, skipping spaces: a classifier, something else, or nothing yet.
    let k = last + 1;
    while (k < ctx.atoms.length && (ctx.atoms[k].kind === "zw" || ctx.atoms[k].kind === "space")) k++;
    if (k >= ctx.atoms.length) continue; // still being typed
    const follow = ctx.atoms[k];
    if (follow.kind === "word" && (AFTER_NUMBER_OK.has(follow.key) || isNumber(ctx, k))) continue;
    if (follow.kind === "other") continue;
    const run = ctx.text.slice(ctx.atoms[first].start, ctx.atoms[last].end);
    ctx.report("classifier-people", first, last, [`${run}នាក់`], {
      message: `រាប់ «${a.text}» ត្រូវបន្ថែមលក្ខណនាម នាក់ ក្រោយលេខ ៖ ${a.text}${run}នាក់។`,
      messageEn: `A number after ${a.text} needs the classifier នាក់: ${a.text}${run}នាក់.`,
    });
    i = last;
  }
};

// --------------------------------------------------------------------------
// Sentence endings
// --------------------------------------------------------------------------

const NEGATORS = keys(["មិន", "អត់", "ពុំ", "គ្មាន", "ឥត"]);
const CLOSERS = keys(["ទេ", "ឡើយ", "សោះ", "ដែរ", "ណា", "អី", "ទាំងអស់", "ប៉ុន្មាន", "បន្តិច", "ឡើយ"]);
/** A negator right after one of these is inside a condition or clause, where ទេ is not needed. */
const SUBORDINATORS = keys([
  "បើ", "ប្រសិនបើ", "បើសិន", "បើសិនជា", "ទោះ", "ទោះបី", "ទោះបីជា", "ទោះជា", "កាលណា", "ពេល", "ពេលដែល", "នៅពេល", "ដោយ", "ដែល",
  "ថា", "ថាតើ", "តែ", "លុះត្រា", "លុះត្រាតែ", "មុន", "មុននឹង", "ក្រោយពី", "បន្ទាប់ពី", "ព្រោះ", "ពីព្រោះ", "ដោយសារ", "ដោយសារតែ",
  "ដើម្បី", "កុំ", "អ្វី", "អ្វីដែល", "អ្នកណា", "នរណា", "ណា", "ខ្លាច", "ដរាប", "ដរាបណា", "លើកលែងតែ", "វៀរលែងតែ", "ទាល់តែ",
  "សូម្បី", "សូម្បីតែ", "ស្ទើរ", "ស្ទើរតែ", "ហាក់", "ហាក់ដូចជា", "ដូចជា", "មើលទៅ", "ទើប", "ទើបតែ", "ចំពោះ", "ក្រៅពី", "នៅឡើយ", "បើមិន", "បើអត់",
]);
/** Fixed expressions that start with a negator and do not close with ទេ. */
const NEGATOR_IDIOMS: Record<string, string[]> = {
  មិន: ["ថា", "ត្រឹមតែ", "មែនតែ", "ខាន", "យូរ", "ដឹងជា", "គួរឲ្យ", "គួរឱ្យ", "ធម្មតា", "ប្រក្រតី", "ទៀងទាត់", "អស់", "ចេះចប់", "គិតថ្លៃ", "ច្រើន", "តិច", "សូវ"],
  អត់: ["ទ្រាំ", "ធ្មត់", "ឃ្លាន", "ទោស", "ឱន", "អោន", "ការ", "ឲ្យ", "ឱ្យ"],
  គ្មាន: ["អ្វី", "នរណា", "អ្នកណា"],
};

/** A negator anywhere after one of these sits in a subordinate clause (ដែលរកមិនឃើញ…). */
const CLAUSE_MARKERS = keys(["ដែល", "បើ", "ប្រសិនបើ", "បើសិន", "ទោះ", "ទោះបី", "ពេល", "ពេលដែល", "កាលណា", "ថា", "ដោយ", "ដើម្បី", "ព្រោះ", "ពីព្រោះ", "ដោយសារ", "លុះត្រា", "ទាល់តែ", "កុំ", "ឬ", "តើ", "សូម"]);

/** Conjunctions that start a new clause after a negated one. */
const TRAILING_CLAUSE = ["ដោយសារ", "ព្រោះ", "ពីព្រោះ", "ប៉ុន្តែ", "ដូច្នេះ", "ហេតុនេះ", "ទោះ", "បើ", "ប្រសិនបើ", "លុះត្រា", "ទាល់តែ", "ដរាប", "ដើម្បី"] as const;

const negationTe: Rule = (ctx) => {
  for (const s of ctx.sentences) {
    if (s.terminal === undefined || ctx.atoms[s.terminal].text !== "។") continue;
    const words = ctx.wordsIn(s.from, s.terminal);
    const at = words.findIndex((w) => NEGATORS.has(ctx.keyAt(w)));
    if (at < 0) continue;
    const neg = words[at];
    const rest = words.slice(at + 1);
    if (rest.length > 15) continue;
    if (words.slice(0, at).some((w) => CLAUSE_MARKERS.has(ctx.keyAt(w)))) continue;
    if (rest.some((w) => CLOSERS.has(ctx.keyAt(w)))) continue;
    const before = ctx.keyAt(ctx.prev(neg, true));
    if (SUBORDINATORS.has(before) || NEGATORS.has(before)) continue;
    const idioms = NEGATOR_IDIOMS[ctx.keyAt(neg)] ?? [];
    if (idioms.some((lit) => ctx.literalAt(ctx.next(neg), lit) >= 0)) continue;
    // A second negator in the sentence means two clauses (មិន…ក៏មិន…); leave it.
    if (rest.some((w) => NEGATORS.has(ctx.keyAt(w)))) continue;
    // A question inside (តើ, ឬ) is not a plain negative statement.
    if (rest.some((w) => ["តើ", "ឬ"].includes(ctx.keyAt(w)))) continue;
    // A second clause after the negated one (…មិនបានមក ដោយសារ…): ទេ would close the
    // first clause, not the sentence, so there is no single place to add it.
    if (rest.some((w) => ctx.anyLiteralAt(w, TRAILING_CLAUSE))) continue;
    ctx.report("negation-te", s.terminal, s.terminal, ["ទេ។"], {
      message: `ប្រយោគបដិសេធដោយ «${ctx.atoms[neg].text}» ជាធម្មតាបញ្ចប់ដោយ ទេ ៖ …${ctx.atoms[neg].text}…ទេ។`,
      messageEn: `A statement negated with ${ctx.atoms[neg].text} normally closes with ទេ before ។.`,
    });
  }
};

const REPORTED = keys(["ថា", "ថាតើ", "សួរ", "ដឹង", "ពន្យល់", "មូលហេតុ", "ហេតុផល", "ឆ្ងល់", "យល់", "បង្ហាញ", "គិត", "ទោះ", "ទោះបី", "ក៏ដោយ", "ក៏បាន", "មិនថា", "ប្រាប់", "អាស្រ័យ", "ស្វែងរក", "រក", "ពិនិត្យ", "សិក្សា", "ពិភាក្សា"]);
const QUESTION_WORDS = ["ហេតុអ្វីបានជា", "ហេតុអ្វី", "យ៉ាងម៉េច", "ម៉េចក៏", "ម៉េចបានជា", "ពីអង្កាល", "អង្កាល់", "ដូចម្ដេច", "ហេតុដូចម្ដេច"] as const;
/** Question words by where the grammar guide puts them: at the end of the sentence, or at its start. */
const FINAL_WH = ["អ្វី", "ស្អី", "នៅឯណា", "ឯណា", "ទីណា", "ពេលណា", "អ្នកណា", "នរណា", "ម៉េច", "ប៉ុន្មាន"] as const;
const INITIAL_WH = ["នរណា", "អ្នកណា"] as const;
/** Words that turn a question word into an indefinite ("anything", "whoever"). */
const INDEFINITE = keys(["ក៏", "ដែល", "គ្រប់", "រាល់", "បើ", "ប្រសិនបើ"]);
const OR_TAIL = keys(["ទេ", "នៅ", "អត់", "យ៉ាងណា", "យ៉ាងម៉េច", "ម៉េច"]);

const questionMark: Rule = (ctx) => {
  for (const s of ctx.sentences) {
    if (s.terminal === undefined || ctx.atoms[s.terminal].text !== "។") continue;
    const words = ctx.wordsIn(s.from, s.terminal);
    if (!words.length) continue;
    let why: string | null = null;
    // A sentence that opens with តើ is a direct question whatever follows.
    if (ctx.keyAt(words[0]) === "តើ") why = "តើ";
    // Otherwise reported speech (…សួរថា…ឬទេ។) is a statement.
    else if (words.some((w) => REPORTED.has(ctx.keyAt(w)))) continue;
    if (!why) {
      // Ends in ឬ, or in ឬ(ក៏) + ទេ/នៅ/អត់/យ៉ាងណា.
      const tail = words.slice(-3);
      const or = tail.map((w) => ctx.keyAt(w)).lastIndexOf("ឬ");
      if (or >= 0 && tail.slice(or + 1).every((w) => OR_TAIL.has(ctx.keyAt(w)) || ctx.keyAt(w) === "ក៏")) {
        why = tail
          .slice(or)
          .map((w) => ctx.atoms[w].text)
          .join("");
      }
    }
    if (!why) {
      for (const w of words) {
        const hit = ctx.anyLiteralAt(w, QUESTION_WORDS);
        if (hit) {
          why = hit[1];
          break;
        }
      }
    }
    const lastWord = words[words.length - 1];
    const plain = !words.some((w) => NEGATORS.has(ctx.keyAt(w)) || INDEFINITE.has(ctx.keyAt(w)));
    // Colloquial yes/no tail with ឬ dropped: ហូបបាយហើយនៅ
    if (!why && literalEndsAt(ctx, lastWord, ["ហើយនៅ"])) why = "ហើយនៅ";
    // A question word closing the sentence (អ្នកកំពុងធ្វើអ្វី) or opening it (នរណាមកផ្ទះយើង).
    // With a negation or ក៏ the same words are indefinites (គ្មានអ្វី, នរណាក៏ដឹង).
    if (!why && plain) {
      const final = FINAL_WH.find((lit) => literalEndsAt(ctx, lastWord, [lit]));
      if (final) why = final;
      else {
        const first = ctx.anyLiteralAt(words[0], INITIAL_WH);
        if (first) why = first[1];
      }
    }
    if (!why) continue;
    ctx.report("question-mark", s.terminal, s.terminal, ["?"], {
      message: `ប្រយោគសំណួរ (មាន «${why}») បញ្ចប់ដោយសញ្ញា ? មិនមែន ។ ទេ។`,
      messageEn: `A question (${why}) ends with ? rather than ។.`,
    });
  }
};

// --------------------------------------------------------------------------
// Sentence structure (grammar guide: word order, tense markers, register)
// --------------------------------------------------------------------------

/** Personal pronouns that can only be a subject here (kin terms are left out: បងនិងប្អូន is a real pair). */
const SUBJECTS = keys(["ខ្ញុំ", "គាត់", "នាង", "គេ", "យើង", "វា", "អ្នក", "ខ្ញុំបាទ", "នាងខ្ញុំ", "អញ"]);
/** Words a new clause can follow directly, so the pronoun after them is its subject. */
const CLAUSE_OPENERS = keys([
  "ថា", "ហើយ", "ប៉ុន្តែ", "តែ", "ដូច្នេះ", "បើ", "ប្រសិនបើ", "ព្រោះ", "ពីព្រោះ", "ដោយសារ", "តើ", "ពេល", "ស្អែក", "ថ្ងៃស្អែក", "ថ្ងៃនេះ",
  "ឥឡូវ", "ឥឡូវនេះ", "ក្រោយ", "មុន", "ពេលនោះ", "បន្ទាប់មក",
]);

/** The atom index where the subject ending at `p` begins (ពួក + គេ is one subject). */
const subjectStart = (ctx: Context, p: number) => (ctx.keyAt(ctx.prev(p)) === "ពួក" ? ctx.prev(p) : p);

/** Nothing, a space, a mark or a clause opener comes right before atom `i`. */
function startsClause(ctx: Context, i: number): boolean {
  let j = i - 1;
  while (j >= 0 && ctx.atoms[j].kind === "zw") j--;
  if (j < 0) return true;
  const a = ctx.atoms[j];
  return a.kind === "space" || a.kind === "punct" || (a.kind === "word" && CLAUSE_OPENERS.has(a.key));
}

/**
 * Subject + នឹង + verb is the future. និង ("and") in that slot, glued between a
 * subject pronoun that opens the clause and a verb, is the future marker
 * misspelt: ខ្ញុំនិងទៅផ្សារ.
 */
const ningFuture: Rule = (ctx) => {
  for (let i = 0; i < ctx.atoms.length; i++) {
    if (ctx.keyAt(i) !== "និង") continue;
    const p = ctx.prev(i);
    const n = ctx.next(i);
    if (!SUBJECTS.has(ctx.keyAt(p)) || !COMMON_VERBS.has(ctx.keyAt(n))) continue;
    if (!startsClause(ctx, subjectStart(ctx, p))) continue;
    const subj = ctx.text.slice(ctx.atoms[subjectStart(ctx, p)].start, ctx.atoms[p].end);
    const verb = ctx.atoms[n].text;
    ctx.report("ning-future", i, i, ["នឹង"], {
      message: `អនាគតកាល ៖ ប្រធាន + នឹង + កិរិយាសព្ទ។ រវាង «${subj}» និងកិរិយា «${verb}» ត្រូវប្រើ នឹង (ស្រៈ ឹ) ៖ ${subj}នឹង${verb}…។`,
      messageEn: `The future is subject + នឹង + verb: ${subj}នឹង${verb}. និង means “and”.`,
    });
  }
};

const PAST_TIMES = ["ម្សិលមិញ", "ម្សិលម៉ិញ", "ខែមុន", "ឆ្នាំមុន", "សប្ដាហ៍មុន", "អាទិត្យមុន", "ឆ្នាំទៅ"] as const;
const FUTURE_TIMES = ["ថ្ងៃស្អែក", "ស្អែក", "ខានស្អែក", "សប្ដាហ៍ក្រោយ", "អាទិត្យក្រោយ", "ខែក្រោយ", "ឆ្នាំក្រោយ"] as const;
/** After one of these the time word is a topic or a limit, not when the action happens (សម្រាប់ថ្ងៃស្អែក). */
const NOT_WHEN = keys(["សម្រាប់", "អំពី", "ដល់", "មុន", "ក្រោយ", "រហូត", "របស់", "នៃ", "ដូច", "ជាង", "ទុក", "ចាំ"]);
/** A second clause or a modal: the time word may belong to something else than the marked verb. */
const TENSE_UNSURE = keys([
  "ថា", "ដែល", "ហើយ", "ប៉ុន្តែ", "តែ", "បើ", "ប្រសិនបើ", "ពេល", "ព្រោះ", "ពីព្រោះ", "ដោយសារ", "ដើម្បី", "ទោះ", "ឬ", "តើ", "អាច", "ទើប",
  "ចង់", "ត្រូវ", "គួរ", "សូម", "កុំ", "មិន", "អត់", "ពុំ", "គ្មាន", "ក៏",
]);

/**
 * បាន marks the past and នឹង the future. When the sentence is a single clause
 * and also names the time, the two must agree: នឹង with ម្សិលមិញ, or បាន with
 * ថ្ងៃស្អែក, contradicts itself.
 */
const tenseTime: Rule = (ctx) => {
  for (const s of ctx.sentences) {
    const words = ctx.wordsIn(s.from, s.terminal ?? s.to);
    if (words.length < 3 || words.length > 14) continue;
    if (words.some((w) => TENSE_UNSURE.has(ctx.keyAt(w)))) continue;
    const timeOf = (list: readonly string[]) => {
      let skipTo = -1;
      for (const w of words) {
        if (w <= skipTo) continue; // inside a longer time word already judged (ថ្ងៃ + ស្អែក)
        const hit = ctx.anyLiteralAt(w, list);
        if (!hit) continue;
        if (!NOT_WHEN.has(ctx.keyAt(ctx.prev(w, true)))) return hit[1];
        skipTo = hit[0];
      }
      return null;
    };
    const markers = words.filter((w) => (ctx.keyAt(w) === "នឹង" || ctx.keyAt(w) === "បាន") && COMMON_VERBS.has(ctx.keyAt(ctx.next(w))));
    if (markers.length !== 1) continue;
    const m = markers[0];
    // The marker must follow the subject: ទៅបាន ("can go") and ទាក់ទងនឹង ("related to") are something else.
    if (!SUBJECTS.has(ctx.keyAt(ctx.prev(m)))) continue;
    const verb = ctx.atoms[ctx.next(m)].text;
    if (ctx.keyAt(m) === "នឹង") {
      const past = timeOf(PAST_TIMES);
      if (!past) continue;
      ctx.report("tense-time", m, m, ["បាន"], {
        message: `«នឹង» បញ្ជាក់អនាគតកាល ប៉ុន្តែប្រយោគមានពាក្យពេលអតីតកាល «${past}» ៖ អតីតកាលប្រើ បាន ៖ បាន${verb}…។`,
        messageEn: `នឹង marks the future, but the sentence says “${past}”. The past is បាន + verb.`,
      });
    } else {
      const future = timeOf(FUTURE_TIMES);
      if (!future) continue;
      ctx.report("tense-time", m, m, ["នឹង"], {
        message: `«បាន» បញ្ជាក់អតីតកាល ប៉ុន្តែប្រយោគមានពាក្យពេលអនាគត «${future}» ៖ អនាគតកាលប្រើ នឹង ៖ នឹង${verb}…។`,
        messageEn: `បាន marks the past, but the sentence says “${future}”. The future is នឹង + verb.`,
      });
    }
  }
};

/** Plain describing words that are not also common nouns or adverbs (ថ្លៃ "price" and ល្អ are left out). */
const ADJECTIVES = keys(["ធំ", "តូច", "ថ្មី", "ចាស់", "ស្អាត", "វែង", "ខ្លី", "ខ្ពស់", "ទាប", "ក្រាស់", "ស្ដើង", "ក្រហម", "ខៀវ", "បៃតង", "លឿង"]);
const THINGS = keys([
  "ផ្ទះ", "ឡាន", "រថយន្ត", "សៀវភៅ", "ម៉ូតូ", "កង់", "ទូរស័ព្ទ", "កុំព្យូទ័រ", "អាវ", "ខោ", "ខោអាវ", "ស្បែកជើង", "ឆ្កែ", "ឆ្មា", "តុ", "កៅអី",
  "បន្ទប់", "សាលា", "អគារ", "ផ្លូវ", "ស្ពាន", "ទូក", "កាបូប", "នាឡិកា", "មួក", "ប៊ិច", "ខ្មៅដៃ",
]);
/** Verbs whose object is a thing; the adjective right after them has no noun of its own yet. */
const THING_VERBS = keys(["មាន", "ទិញ", "លក់", "ឃើញ", "ជួល", "ជិះ", "ពាក់", "ស្លៀក", "យក", "អាន", "សង់", "ត្រូវការ", "បាន", "ចង់បាន", "ជួសជុល", "រក"]);

/**
 * The adjective follows its noun (ផ្ទះធំ, never ធំផ្ទះ). Only the clear case is
 * flagged: verb + adjective + thing, where the adjective has no noun before it.
 */
const adjectiveOrder: Rule = (ctx) => {
  for (let i = 0; i < ctx.atoms.length; i++) {
    if (!ADJECTIVES.has(ctx.keyAt(i))) continue;
    const n = ctx.next(i);
    if (!THINGS.has(ctx.keyAt(n)) || !THING_VERBS.has(ctx.keyAt(ctx.prev(i)))) continue;
    const adj = ctx.atoms[i].text;
    const noun = ctx.atoms[n].text;
    ctx.report("adjective-order", i, n, [`${noun}${adj}`], {
      message: `គុណនាមនៅក្រោយនាមដែលវាបញ្ជាក់ ៖ ${noun}${adj} មិនមែន ${adj}${noun} ទេ។`,
      messageEn: `The adjective follows its noun: ${noun}${adj}, not ${adj}${noun}.`,
    });
    i = n;
  }
};

const MONKS = ["ព្រះសង្ឃ", "លោកសង្ឃ", "ភិក្ខុ", "សាមណេរ", "ព្រះតេជគុណ"] as const;
const ROYALS = ["ព្រះមហាក្សត្រ", "ព្រះរាជា", "ព្រះករុណា", "ព្រះមហាក្សត្រិយានី"] as const;
const HONORIFICS = ["លោកស្រី", "អ្នកស្រី", "លោកជំទាវ", "ឯកឧត្ដម", "លោក"] as const;
const EAT_PLAIN = keys(["ញ៉ាំ", "ហូប", "ស៊ី"]);
const FOOD = keys(["បាយ", "អាហារ", "ម្ហូប", "នំ", "ចង្ហាន់", "ផ្លែឈើ", "បបរ", "ទឹក"]);
const TENSE_MARKERS = keys(["បាន", "កំពុង", "នឹង", "តែ", "ទើប", "ក៏", "ធ្លាប់"]);

/** The plain "eat" verb that follows the subject ending at `last`, past any tense marker. */
function eatVerbAfter(ctx: Context, last: number): number {
  let j = ctx.next(last, true);
  for (let steps = 0; steps < 3 && TENSE_MARKERS.has(ctx.keyAt(j)); steps++) j = ctx.next(j, true);
  return EAT_PLAIN.has(ctx.keyAt(j)) ? j : -1;
}

/**
 * Khmer picks its words by who is spoken of. "Eat" is ឆាន់ for a monk, សោយ for
 * the king, ពិសា / ទទួលទាន for someone addressed politely, ញ៉ាំ / ហូប among
 * equals and ស៊ី only between intimates; a monk is invited with និមន្ត.
 */
const registerVerb: Rule = (ctx) => {
  for (let i = 0; i < ctx.atoms.length; i++) {
    if (!ctx.isWord(i)) continue;
    const monk = ctx.anyLiteralAt(i, MONKS);
    const royal = monk ? null : ctx.anyLiteralAt(i, ROYALS);
    const who = monk ?? royal;
    if (who) {
      const [last, name] = who;
      if (monk && ctx.keyAt(ctx.prev(i, true)) === "អញ្ជើញ") {
        const inv = ctx.prev(i, true);
        ctx.report("register-verb", inv, inv, ["និមន្ត"], {
          severity: "hint",
          message: `សង្ឃស័ព្ទ ៖ ជាមួយ «${name}» ប្រើ និមន្ត មិនមែន អញ្ជើញ ទេ ៖ សូមនិមន្ត${name}…។`,
          messageEn: `A monk is invited with និមន្ត, not អញ្ជើញ.`,
        });
      }
      const v = eatVerbAfter(ctx, last);
      if (v >= 0) {
        const verb = ctx.atoms[v].text;
        ctx.report("register-verb", v, v, monk ? ["ឆាន់"] : ["សោយ"], {
          message: monk
            ? `សង្ឃស័ព្ទ ៖ ជាមួយ «${name}» កិរិយា «${verb}» ត្រូវជា ឆាន់ ៖ ${name}ឆាន់ចង្ហាន់។`
            : `រាជស័ព្ទ ៖ ជាមួយ «${name}» កិរិយា «${verb}» ត្រូវជា សោយ។`,
          messageEn: monk ? `For a monk, “eat” is ឆាន់, not ${verb}.` : `For the king, “eat” is សោយ, not ${verb}.`,
        });
      }
      i = last;
      continue;
    }
    // Polite address: (សូម)អញ្ជើញ + លោក/លោកស្រី… + ញ៉ាំ/ហូប/ស៊ី, or លោក… + ស៊ី + food.
    const hon = ctx.anyLiteralAt(i, HONORIFICS);
    if (!hon) continue;
    const [last, title] = hon;
    const v = eatVerbAfter(ctx, last);
    if (v < 0) continue;
    const verb = ctx.atoms[v].text;
    const invited = ctx.keyAt(ctx.prev(i, true)) === "អញ្ជើញ";
    const crude = ctx.keyAt(v) === "ស៊ី" && FOOD.has(ctx.keyAt(ctx.next(v, true)));
    if (!invited && !crude) continue;
    ctx.report("register-verb", v, v, ["ពិសា", "ទទួលទាន"], {
      severity: crude ? "warning" : "hint",
      message: crude
        ? `«ស៊ី» ជាពាក្យកម្រិតស្និទ្ធស្នាលខ្លាំង មិនសមនឹង «${title}» ទេ ៖ ភាសាគួរសមប្រើ ពិសា ឬ ទទួលទាន។`
        : `ភាសាគួរសម ៖ អញ្ជើញ «${title}» ប្រើ ពិសា ឬ ទទួលទាន ជំនួស «${verb}» ៖ សូមអញ្ជើញ${title}ពិសាអាហារ។`,
      messageEn: crude
        ? `ស៊ី is intimate speech and does not fit ${title}; the polite verb is ពិសា or ទទួលទាន.`
        : `When inviting ${title} politely, “eat” is ពិសា or ទទួលទាន rather than ${verb}.`,
    });
    i = last;
  }
};

// --------------------------------------------------------------------------
// Spacing and punctuation (plain text)
// --------------------------------------------------------------------------

const KH = "\\u1780-\\u17dd";

function regexRule(rule: string, re: RegExp, replace: (m: RegExpExecArray) => string, opts?: { message: string; messageEn: string }): Rule {
  return (ctx) => {
    re.lastIndex = 0;
    for (let m = re.exec(ctx.text); m; m = re.exec(ctx.text)) {
      ctx.reportRange(rule, m.index, m.index + m[0].length, [replace(m)], opts);
      if (!m[0].length) re.lastIndex++;
    }
  };
}

const spaceBeforeKhan = regexRule("space-before-khan", new RegExp(`(?<=[${KH}])[ \\t\\u00a0]+([។៕?!])`, "g"), (m) => m[1], {
  message: "គ្មានដកឃ្លាមុនសញ្ញាចុងប្រយោគទេ ៖ សញ្ញាជាប់នឹងពាក្យចុងក្រោយ។",
  messageEn: "No space before a sentence mark; it attaches to the last word.",
});

const spaceAfterKhan = regexRule("space-after-khan", new RegExp(`[។៕](?!ល។)(?=[${KH}])`, "g"), (m) => `${m[0]} `, {
  message: "ដាក់ដកឃ្លាក្រោយសញ្ញា ។ មុនចាប់ផ្ដើមប្រយោគថ្មី។",
  messageEn: "Put a space after ។ before the next sentence.",
});

const spaceBeforeRepeat = regexRule("space-before-repeat", new RegExp(`(?<=[${KH}])[ \\u00a0]+ៗ`, "g"), () => "ៗ", {
  message: "សញ្ញា ៗ សរសេរជាប់នឹងពាក្យដែលត្រូវថា ៖ ផ្សេងៗ។",
  messageEn: "The repetition sign ៗ is written directly after its word.",
});

const doubleKhan = regexRule("double-khan", /។{2,}/g, () => "។", {
  message: "សញ្ញា ។ ជាន់គ្នា ៖ ទុកតែមួយ។",
  messageEn: "Doubled ។; keep one.",
});

const latinEtc = regexRule("latin-etc", /(?:\.ល[.។]|។ល\.)/g, () => "។ល។", {
  message: "អក្សរកាត់ «ជាដើម» សរសេរ ។ល។ ដោយសញ្ញាខ្មែរ។",
  messageEn: "“Etc.” is written ។ល។ with Khmer marks.",
});

const latinPeriod = regexRule("latin-period", new RegExp(`(?<=[${KH}]{4,})\\.(?![.0-9ល])(?=\\s|$)`, "g"), () => "។", {
  message: "ប្រយោគខ្មែរបញ្ចប់ដោយសញ្ញា ។ មិនមែនសញ្ញា . ទេ។",
  messageEn: "A Khmer sentence ends with ។, not a Latin full stop.",
});

const repeatedWord: Rule = (ctx) => {
  for (let i = 0; i < ctx.atoms.length; i++) {
    const a = ctx.atoms[i];
    if (a.kind !== "word" || !a.ids || cpLength(a.key) < 2 || NUMBER_WORDS.has(a.key)) continue;
    // Allow one real space between the two copies, nothing else.
    let j = ctx.next(i);
    if (j < 0) {
      const gap = ctx.after(i);
      if (!gap || gap.kind !== "space" || gap.text !== " ") continue;
      j = ctx.next(ctx.atoms.indexOf(gap));
    }
    if (j < 0 || ctx.atoms[j].key !== a.key || !ctx.atoms[j].ids) continue;
    ctx.report("repeated-word", i, j, [`${a.text}ៗ`], {
      message: `ពាក្យ «${a.text}» ជាន់គ្នា ៖ សរសេរ ${a.text}ៗ ឬលុបមួយ។`,
      messageEn: `“${a.text}” is repeated; write ${a.text}ៗ or delete one.`,
    });
    i = j;
  }
};

// --------------------------------------------------------------------------
// ដែរ / ដែល
// --------------------------------------------------------------------------

/** What may directly follow the particle ដែរ ("too, also"): the clause is over. */
const AFTER_DAE_OK = keys([
  "ទេ", "ឬ", "ឬទេ", "ឬអត់", "អត់", "ហើយ", "ផង", "ណា", "ណាស់", "ទៀត", "ក៏", "ដែរ", "ទៅ", "មែន", "ដោយ", "ដោយសារ", "ព្រោះ", "ពីព្រោះ",
  "ប៉ុន្តែ", "តែ", "ថា", "គឺ", "ដូច", "ដូចជា", "បើ", "ប្រសិនបើ", "ទោះ", "ទោះបី", "កាល", "ពេល", "នៅពេល", "រួច", "បន្ទាប់មក", "ដូច្នេះ",
  "ដូច្នោះ", "ហេតុនេះ", "និង", "នឹង", "ចំណែក", "រីឯ", "ឯ", "សម្រាប់", "ដើម្បី", "ចំពោះ", "នូវ", "នៅ", "ពី", "អំពី", "តាម", "ក្នុង", "លើ",
  "ជាមួយ", "ទាំង", "សូម្បី", "សូម្បីតែ", "ឬក៏", "នេះ", "នោះ", "ដែល", "ហ្ន៎", "ណ៎", "ហ៎", "ហ្នឹង", "ហើ", "អី", "ចុះ", "ទើប",
]);
/** Negation and auxiliaries that open a verb phrase. */
const VERB_OPENERS = keys(["មិន", "ពុំ", "គ្មាន", "ឥត", "បាន", "កំពុង", "កំពុងតែ", "ត្រូវ", "អាច", "ទើប", "ទើបតែ", "ធ្លាប់", "គួរ", "មាន", "នៅតែ", "បន្ត"]);
/** Heads a relative clause attaches to, besides words the dictionary labels as nouns. */
const REL_HEADS = keys(["អ្វី", "អី", "អ្វីៗ", "អ្វីមួយ", "នរណា", "អ្នកណា", "នរណាម្នាក់", "ម្នាក់", "មួយ", "កន្លែង", "ពេល", "ពេលវេលា", "ទី", "រឿង", "ការ", "របស់"]);

/** Every sense of the word is a verb (កិ.). */
const isVerbOnly = (ctx: Context, i: number) => {
  const pos = ctx.pos(i);
  return pos.length > 0 && pos.every((p) => p.startsWith("កិ."));
};

/**
 * ដែរ ("too, also") closes a clause: ខ្ញុំក៏ទៅដែរ។ The word that links a noun
 * to the clause describing it is ដែល: បញ្ហាដែលកើតឡើង. The two sound alike, so
 * ដែរ is often written where ដែល is meant. Flag ដែរ that sits right after a
 * noun-like head and right before something that starts a clause (a verb,
 * a pronoun, a negation or auxiliary), with no space in between.
 */
const daeRel: Rule = (ctx) => {
  for (let i = 0; i < ctx.atoms.length; i++) {
    if (ctx.keyAt(i) !== "ដែរ") continue;
    const n = ctx.next(i);
    if (!ctx.isWord(n) || ctx.atoms[n].unknown) continue;
    const nk = ctx.keyAt(n);
    // The checker's whole token after ដែរ too: ពួកគេ is one pronoun even though its atoms are ពួក + គេ.
    const nextSpan = ctx.words.find((w) => w.start === ctx.atoms[n].start)?.key ?? nk;
    if (AFTER_DAE_OK.has(nk) || AFTER_DAE_OK.has(nextSpan)) continue;
    const strongOpener = PRONOUNS.has(nk) || PRONOUNS.has(nextSpan) || VERB_OPENERS.has(nk) || VERB_OPENERS.has(nextSpan);
    const p = ctx.prev(i, true);
    if (!ctx.isWord(p) || ctx.atoms[p].unknown) continue;
    const pk = ctx.keyAt(p);
    // The checker's whole token before ដែរ: a known compound (សាលារៀន) counts as a head when what follows is unmistakable.
    const headSpan = ctx.words.find((w) => w.end === ctx.atoms[i].start || (w.end < ctx.atoms[i].start && ctx.text.slice(w.end, ctx.atoms[i].start).trim() === ""));
    const compoundHead = headSpan?.status === "sbbic" && strongOpener;
    const nounHead = ctx.isNounOnly(p) || ROLES.has(pk) || PEOPLE.has(pk) || REL_HEADS.has(pk) || compoundHead;
    const opensClause = strongOpener || isVerbOnly(ctx, n);
    const head = headSpan && headSpan.end <= ctx.atoms[i].start && headSpan.end >= ctx.atoms[p].start ? headSpan.text : ctx.atoms[p].text;
    const next = ctx.atoms[n].text;
    if (nounHead && opensClause) {
      // Noun + ដែរ + clause: the relative ដែល, with confidence.
      ctx.report("dae-rel", i, i, ["ដែល"], {
        message: `«ដែរ» មានន័យថា ផង/ដូចគ្នា ហើយនៅចុងឃ្លា។ ពាក្យភ្ជាប់ «${head}» ទៅឃ្លា «${next}…» គឺ «ដែល» ៖ ${head}ដែល${next}…។`,
        messageEn: `ដែរ means “too / also” and ends a clause; the word linking “${head}” to the clause “${next}…” is ដែល: ${head}ដែល${next}…`,
      });
    } else {
      // Anything else glued on after ដែរ: the clause did not end where ដែរ says it does.
      ctx.report("dae-rel", i, i, ["ដែល"], {
        severity: "hint",
        message: `«ដែរ» ត្រូវនៅចុងឃ្លា (…ដែរ។ / …ដែរទេ / …ដែរឬទេ)។ នៅទីនេះមានពាក្យ «${next}» បន្តភ្ជាប់ ៖ បើជាឃ្លាបន្ត ត្រូវប្រើ «ដែល» ឬដកឃ្លាក្រោយ «ដែរ»។`,
        messageEn: `ដែរ belongs at the end of a clause (…ដែរ។ / …ដែរទេ). Here “${next}” follows directly: use ដែល if a clause continues, or put a space after ដែរ.`,
      });
    }
  }
};

export const GRAMMAR_RULES: Rule[] = [
  hoeyNing,
  cheamuoyNung,
  verbNung,
  roviengNing,
  nounNungNoun,
  kalPi,
  loengTov,
  piPir,
  delFinal,
  daeRel,
  novNuv,
  variantSpelling,
  chongBanVerb,
  chongNoun,
  verbThaa,
  kueChea,
  classifierPeople,
  ningFuture,
  tenseTime,
  adjectiveOrder,
  registerVerb,
  negationTe,
  questionMark,
  spaceBeforeKhan,
  spaceAfterKhan,
  spaceBeforeRepeat,
  doubleKhan,
  latinEtc,
  latinPeriod,
  repeatedWord,
];
