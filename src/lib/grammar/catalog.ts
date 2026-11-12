import type { IssueSeverity, IssueType } from "@/lib/dict/types";

/**
 * The grammar rules the checker knows about, as data the UI and docs can show.
 * The matching logic lives in `./rules.ts`, keyed by `id`.
 *
 * Sources
 *  - "sbbic-rules":   SBBIC, "Khmer Grammar Checker Rules" (community rule list)
 *                     https://sbbic.org/current-projects/khmer-grammar-checker-rules
 *  - "sbbic-grammar": Nathan Wells, "A Student's Guide to Khmer Grammar" (SBBIC)
 *                     https://sbbic.org/current-projects/khmer-grammar
 *  - "grammar-guide": "ច្បាប់វេយ្យាករណ៍និងការសរសេរប្រយោគភាសាខ្មែរ", the owner's guide to Khmer
 *                     sentence structure (word order, tense markers, questions, conjunctions,
 *                     ellipsis, register)
 *  - "khmerword":     general checks added here (spacing, punctuation, repeats)
 *  - "corpus":        word-pair statistics from Khmer texts (see src/lib/context)
 */
export type RuleSource = "sbbic-rules" | "sbbic-grammar" | "grammar-guide" | "khmerword" | "corpus";

export type RuleInfo = {
  id: string;
  /** Short name in Khmer. */
  name: string;
  nameEn: string;
  /** What the rule checks, in English (shown on the About page). */
  about: string;
  source: RuleSource;
  severity: IssueSeverity;
  type: IssueType;
  /** A wrong / right pair the rule catches. */
  example?: { wrong: string; right: string };
};

export const SOURCE_LABEL: Record<RuleSource, { label: string; url?: string }> = {
  "sbbic-rules": { label: "SBBIC grammar checker rules", url: "https://sbbic.org/current-projects/khmer-grammar-checker-rules" },
  "sbbic-grammar": { label: "SBBIC Student's Guide to Khmer Grammar", url: "https://sbbic.org/current-projects/khmer-grammar" },
  "grammar-guide": { label: "ច្បាប់វេយ្យាករណ៍និងការសរសេរប្រយោគភាសាខ្មែរ" },
  khmerword: { label: "KhmerWord" },
  corpus: { label: "Phrase statistics from Khmer texts" },
};

export const RULES: RuleInfo[] = [
  // ---- phrase context (statistics, not a grammar rule) --------------------
  {
    id: "phrase-context",
    name: "ពាក្យមិនត្រូវនឹងឃ្លា",
    nameEn: "A real word that does not fit the phrase",
    about:
      "Every word exists, but one of them is a letter away from the word the phrase needs. The checker compares each word with its neighbours against word-pair counts from Khmer texts and the dictionary's list of compounds (បណ្ដុះ + បណ្ដាល is the compound បណ្ដុះបណ្ដាល; បណ្ដុះ + បណ្ដា is nothing). A warning when the fix forms a known compound; otherwise a hint.",
    source: "corpus",
    severity: "warning",
    type: "word-choice",
    example: { wrong: "ការបណ្ដុះបណ្ដាបុគ្គលិក", right: "ការបណ្ដុះបណ្ដាលបុគ្គលិក" },
  },
  // ---- និង / នឹង ---------------------------------------------------------
  {
    id: "hoey-ning",
    name: "ហើយនឹង → ហើយនិង",
    nameEn: "ហើយនឹង is always ហើយនិង",
    about: "The conjunction “and” is ហើយនិង; ហើយនឹង only occurs before ថ្កល់ (“steady”).",
    source: "sbbic-rules",
    severity: "error",
    type: "spelling",
    example: { wrong: "ខ្ញុំទៅសាលាហើយនឹងទៅផ្សារ។", right: "ខ្ញុំទៅសាលាហើយនិងទៅផ្សារ។" },
  },
  {
    id: "cheamuoy-nung",
    name: "ជាមួយនិង → ជាមួយនឹង",
    nameEn: "ជាមួយ takes នឹង",
    about: "After ជាមួយ (“together with”) the particle is នឹង, not the conjunction និង.",
    source: "sbbic-grammar",
    severity: "error",
    type: "spelling",
    example: { wrong: "ទៅជាមួយនិងមិត្ត", right: "ទៅជាមួយនឹងមិត្ត" },
  },
  {
    id: "verb-nung",
    name: "ពាក្យដែលត្រូវការ «នឹង»",
    nameEn: "Words that take នឹង, not និង",
    about:
      "ប្រឈមមុខ, ទាក់ទង, ពាក់ព័ន្ធ, ស្រដៀង, ស្មើ, ផ្ទុយ, ប្រឆាំង, ទល់, ស៊ាំ, ជាប់, ដូច, ប្រៀបធៀប, សមស្រប … are followed by the particle នឹង (“with / to”), not by និង (“and”).",
    source: "sbbic-grammar",
    severity: "warning",
    type: "word-choice",
    example: { wrong: "ប្រឈមមុខនិងបញ្ហា", right: "ប្រឈមមុខនឹងបញ្ហា" },
  },
  {
    id: "rovieng-ning",
    name: "រវាង … នឹង → និង",
    nameEn: "រវាង … pairs with និង",
    about: "“Between A and B” is រវាង A និង B. A នឹង after រវាង is the future/with particle by mistake.",
    source: "sbbic-grammar",
    severity: "warning",
    type: "word-choice",
    example: { wrong: "រវាងខ្ញុំនឹងអ្នក", right: "រវាងខ្ញុំនិងអ្នក" },
  },
  {
    id: "noun-nung-noun",
    name: "នាម នឹង នាម → និង",
    nameEn: "Nouns are joined by និង",
    about: "នឹង between two nouns (“book នឹង pen”) should be the conjunction និង. The dictionary's part-of-speech labels decide what counts as a noun.",
    source: "sbbic-rules",
    severity: "hint",
    type: "word-choice",
    example: { wrong: "សៀវភៅ នឹង ខ្មៅដៃ", right: "សៀវភៅ និង ខ្មៅដៃ" },
  },

  // ---- confusable words -------------------------------------------------
  {
    id: "kal-pi",
    name: "កាល់ពី → កាលពី",
    nameEn: "កាល់ពី is កាលពី",
    about: "កាល (“time, when”) has no ់; កាល់ is a different verb (animals butting).",
    source: "sbbic-grammar",
    severity: "error",
    type: "spelling",
    example: { wrong: "កាល់ពីមុន", right: "កាលពីមុន" },
  },
  {
    id: "loeng-tov",
    name: "លើងទៅ → ឡើងទៅ",
    nameEn: "លើង / ឡើង",
    about: "“Go up, rise” is ឡើង. លើង means to pry or dig something up, so លើងទៅ, លើងមក, លើងលើ are almost always a slip.",
    source: "sbbic-grammar",
    severity: "warning",
    type: "word-choice",
    example: { wrong: "លើងទៅលើភ្នំ", right: "ឡើងទៅលើភ្នំ" },
  },
  {
    id: "pi-pir",
    name: "ពី / ពីរ",
    nameEn: "ពី (from) vs ពីរ (two)",
    about: "ពី is the preposition “from”, ពីរ is the number two. ពី before a classifier (ពីនាក់) must be ពីរ; ពីរ before ណា / អ្វី / អី must be ពី.",
    source: "sbbic-rules",
    severity: "warning",
    type: "word-choice",
    example: { wrong: "មនុស្សពីនាក់", right: "មនុស្សពីរនាក់" },
  },
  {
    id: "del-final",
    name: "ដែល ចុងប្រយោគ → ដែរ",
    nameEn: "ដែល cannot end a sentence",
    about: "ដែល (“which, that”) introduces a clause; the particle at the end of a sentence meaning “too, also” is ដែរ.",
    source: "khmerword",
    severity: "warning",
    type: "word-choice",
    example: { wrong: "ខ្ញុំក៏ទៅដែល។", right: "ខ្ញុំក៏ទៅដែរ។" },
  },
  {
    id: "dae-rel",
    name: "ដែរ មុនឃ្លា → ដែល",
    nameEn: "ដែរ before a clause should be ដែល",
    about: "ដែរ (“too, also”) belongs at the end of a clause (…ដែរ។, …ដែរទេ, …ដែរឬទេ); the word that links a noun to the clause describing it (“which, that, who”) is ដែល. The two sound alike. ដែរ right after a noun-like head and right before a verb, pronoun, negation or auxiliary is a warning; any other word glued on after ដែរ (not ទេ, ឬ, ហើយ, ផង, a conjunction or a preposition) is a hint.",
    source: "khmerword",
    severity: "warning",
    type: "word-choice",
    example: { wrong: "បញ្ហាដែរកើតឡើង", right: "បញ្ហាដែលកើតឡើង" },
  },
  {
    id: "nov-nuv",
    name: "នៅ / នូវ",
    nameEn: "នៅ (at) vs នូវ (object marker)",
    about: "នៅ marks a place (នៅក្នុង, នៅផ្ទះ); នូវ marks the object of verbs like ទទួលបាន, ផ្ដល់, ប្រកាន់. Each is flagged in the other's position.",
    source: "khmerword",
    severity: "warning",
    type: "word-choice",
    example: { wrong: "នូវក្នុងផ្ទះ", right: "នៅក្នុងផ្ទះ" },
  },
  {
    id: "variant-spelling",
    name: "អក្ខរាវិរុទ្ធតាមវចនានុក្រម",
    nameEn: "Dictionary spelling of variant forms",
    about:
      "Words SBBIC lists with several spellings (កំលាំង/កម្លាំង, សំលេង/សំឡេង, តំលៃ/តម្លៃ, ចំលើយ/ចម្លើយ, អោយ/ឱ្យ …) are pointed to the form in the Chuon Nath dictionary.",
    source: "sbbic-grammar",
    severity: "hint",
    type: "spelling",
    example: { wrong: "កំលាំង", right: "កម្លាំង" },
  },

  // ---- verbs and their complements --------------------------------------
  {
    id: "chong-ban-verb",
    name: "ចង់បាន + កិរិយា → ចង់",
    nameEn: "ចង់បាន takes a noun",
    about: "Before a verb use ចង់ alone (ចង់ទៅ); ចង់បាន is followed by a noun (ចង់បានឡាន).",
    source: "sbbic-rules",
    severity: "warning",
    type: "grammar",
    example: { wrong: "ខ្ញុំចង់បានទៅផ្សារ", right: "ខ្ញុំចង់ទៅផ្សារ" },
  },
  {
    id: "chong-noun",
    name: "ចង់ + នាម → ចង់បាន",
    nameEn: "ចង់ + noun needs បាន",
    about: "Before a thing you want, ចង់ needs បាន: ចង់បានឡាន, not ចង់ឡាន.",
    source: "sbbic-rules",
    severity: "warning",
    type: "grammar",
    example: { wrong: "ខ្ញុំចង់ឡានថ្មី", right: "ខ្ញុំចង់បានឡានថ្មី" },
  },
  {
    id: "verb-thaa",
    name: "កិរិយា + ដែល → ថា",
    nameEn: "Speech and thought verbs take ថា",
    about: "និយាយ, គិត, ប្រាប់, ដឹង, ជឿ, យល់, សង្ឃឹម, បញ្ជាក់ … introduce what is said or thought with ថា, not with the relative ដែល.",
    source: "sbbic-rules",
    severity: "warning",
    type: "grammar",
    example: { wrong: "គាត់និយាយដែលគាត់ឈឺ", right: "គាត់និយាយថាគាត់ឈឺ" },
  },
  {
    id: "kue-chea",
    name: "គឺ + នាម → គឺជា",
    nameEn: "គឺ alone before a noun",
    about: "To say what someone is (occupation, role) the copula is គឺជា or ជា; a bare គឺ after a pronoun is incomplete.",
    source: "sbbic-grammar",
    severity: "hint",
    type: "grammar",
    example: { wrong: "គាត់គឺគ្រូ។", right: "គាត់គឺជាគ្រូ។" },
  },

  // ---- classifiers -------------------------------------------------------
  {
    id: "classifier-people",
    name: "លក្ខណនាម នាក់",
    nameEn: "People are counted with នាក់",
    about: "A number after a noun for people needs a classifier: មនុស្សពីរនាក់, not មនុស្សពីរ. Also catches number + អ្នក used as a classifier (ពីរអ្នក → ពីរនាក់).",
    source: "sbbic-grammar",
    severity: "warning",
    type: "grammar",
    example: { wrong: "សិស្សបីមកសាលា", right: "សិស្សបីនាក់មកសាលា" },
  },

  // ---- sentence structure (grammar guide) -------------------------------
  {
    id: "ning-future",
    name: "ប្រធាន + និង + កិរិយា → នឹង",
    nameEn: "The future marker is នឹង",
    about:
      "The future is subject + នឹង + verb (ខ្ញុំនឹងទៅ). និង (“and”) glued between a subject pronoun that opens the clause and a verb is the future marker misspelt.",
    source: "grammar-guide",
    severity: "warning",
    type: "word-choice",
    example: { wrong: "ខ្ញុំនិងទៅផ្សារ។", right: "ខ្ញុំនឹងទៅផ្សារ។" },
  },
  {
    id: "tense-time",
    name: "បាន / នឹង មិនត្រូវនឹងពេលវេលា",
    nameEn: "Tense marker contradicts the time word",
    about:
      "Verbs do not change form; បាន marks the past and នឹង the future. In a single-clause sentence, នឹង with a past time word (ម្សិលមិញ, ខែមុន) or បាន with a future one (ថ្ងៃស្អែក, សប្ដាហ៍ក្រោយ) contradicts itself.",
    source: "grammar-guide",
    severity: "hint",
    type: "grammar",
    example: { wrong: "ខ្ញុំនឹងជួបគាត់កាលពីម្សិលមិញ។", right: "ខ្ញុំបានជួបគាត់កាលពីម្សិលមិញ។" },
  },
  {
    id: "adjective-order",
    name: "គុណនាមនៅក្រោយនាម",
    nameEn: "Adjectives follow the noun",
    about:
      "An adjective comes after the noun it describes (ផ្ទះធំ, ឡានថ្មីស្អាត), the reverse of English. Flagged only in the clear case: verb + adjective + thing (មានធំផ្ទះ).",
    source: "grammar-guide",
    severity: "hint",
    type: "grammar",
    example: { wrong: "ខ្ញុំទិញថ្មីឡាន។", right: "ខ្ញុំទិញឡានថ្មី។" },
  },
  {
    id: "register-verb",
    name: "កម្រិតភាសា ៖ ឆាន់ / សោយ / ពិសា",
    nameEn: "Verb does not fit the register",
    about:
      "Words are chosen by who is spoken of. “Eat” is ឆាន់ for a monk, សោយ for the king, ពិសា or ទទួលទាន in polite address, ញ៉ាំ / ហូប among equals and ស៊ី only between intimates; a monk is invited with និមន្ត, not អញ្ជើញ. Flags ញ៉ាំ / ហូប / ស៊ី after ព្រះសង្ឃ or ព្រះមហាក្សត្រ (warning), and after a polite invitation or title (hint).",
    source: "grammar-guide",
    severity: "warning",
    type: "word-choice",
    example: { wrong: "ព្រះសង្ឃកំពុងញ៉ាំបាយ។", right: "ព្រះសង្ឃកំពុងឆាន់ចង្ហាន់។" },
  },

  // ---- sentence endings -------------------------------------------------
  {
    id: "negation-te",
    name: "មិន/អត់ … ទេ",
    nameEn: "Negative sentences end in ទេ",
    about: "A statement with មិន, អត់, ពុំ or គ្មាន normally closes with ទេ (or ឡើយ, សោះ). Conditional and relative clauses are left alone.",
    source: "sbbic-rules",
    severity: "hint",
    type: "grammar",
    example: { wrong: "ខ្ញុំមិនទៅ។", right: "ខ្ញុំមិនទៅទេ។" },
  },
  {
    id: "question-mark",
    name: "សំណួរបញ្ចប់ដោយ ?",
    nameEn: "Questions end with ?",
    about:
      "A sentence that opens with តើ, or ends in ឬទេ / ឬនៅ / ហើយនៅ / ឬអត់ / ឬ, or asks ហេតុអ្វី, យ៉ាងម៉េច, ម៉េចក៏, ពីអង្កាល, or closes on a question word (អ្វី, ស្អី, ឯណា, ពេលណា, នរណា, ប៉ុន្មាន) or opens with នរណា / អ្នកណា, should end with ? rather than ។. Reported speech (ថា, សួរ, ដឹង) and indefinites (គ្មានអ្វី, នរណាក៏…) are skipped.",
    source: "sbbic-rules",
    severity: "hint",
    type: "punctuation",
    example: { wrong: "តើអ្នកទៅណា។", right: "តើអ្នកទៅណា?" },
  },

  // ---- spacing and punctuation ------------------------------------------
  {
    id: "space-before-khan",
    name: "ដកឃ្លាមុន ។",
    nameEn: "No space before ។ ៕ ? !",
    about: "Khmer sentence marks attach to the last word; the space goes after them.",
    source: "khmerword",
    severity: "error",
    type: "spacing",
    example: { wrong: "ខ្ញុំទៅផ្សារ ។", right: "ខ្ញុំទៅផ្សារ។" },
  },
  {
    id: "space-after-khan",
    name: "គ្មានដកឃ្លាក្រោយ ។",
    nameEn: "Space after ។",
    about: "A new sentence starts after a space: ។ followed directly by a letter runs two sentences together.",
    source: "khmerword",
    severity: "warning",
    type: "spacing",
    example: { wrong: "ខ្ញុំទៅផ្សារ។គាត់នៅផ្ទះ។", right: "ខ្ញុំទៅផ្សារ។ គាត់នៅផ្ទះ។" },
  },
  {
    id: "space-before-repeat",
    name: "ដកឃ្លាមុន ៗ",
    nameEn: "ៗ attaches to its word",
    about: "The repetition sign ៗ is written directly after the word it doubles.",
    source: "khmerword",
    severity: "error",
    type: "spacing",
    example: { wrong: "ផ្សេង ៗ", right: "ផ្សេងៗ" },
  },
  {
    id: "double-khan",
    name: "។។",
    nameEn: "Doubled ។",
    about: "Two sentence marks in a row; one is enough.",
    source: "khmerword",
    severity: "error",
    type: "punctuation",
    example: { wrong: "ចប់។។", right: "ចប់។" },
  },
  {
    id: "latin-etc",
    name: ".ល. → ។ល។",
    nameEn: "“Etc.” uses ។ល។",
    about: "The abbreviation for ជាដើម is written with Khmer marks: ។ល។",
    source: "khmerword",
    severity: "error",
    type: "punctuation",
    example: { wrong: "ផ្លែឈើ បន្លែ .ល.", right: "ផ្លែឈើ បន្លែ ។ល។" },
  },
  {
    id: "latin-period",
    name: "សញ្ញា . ជំនួស ។",
    nameEn: "Latin full stop after Khmer",
    about: "A Khmer sentence ends with ។, not with a Latin full stop. Short abbreviations (ន., កិ.) are ignored.",
    source: "khmerword",
    severity: "hint",
    type: "punctuation",
    example: { wrong: "ខ្ញុំទៅផ្សារ.", right: "ខ្ញុំទៅផ្សារ។" },
  },
  {
    id: "repeated-word",
    name: "ពាក្យដដែលជាប់គ្នា → ៗ",
    nameEn: "Repeated word",
    about: "The same word twice in a row is written once with ៗ (ផ្សេងៗ), unless it was a typing slip.",
    source: "khmerword",
    severity: "warning",
    type: "grammar",
    example: { wrong: "ផ្សេងផ្សេង", right: "ផ្សេងៗ" },
  },
];

const BY_ID = new Map(RULES.map((r) => [r.id, r]));

export function ruleInfo(id: string): RuleInfo | undefined {
  return BY_ID.get(id);
}
