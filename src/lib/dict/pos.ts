/**
 * Abbreviations used in the Chuon Nath dictionary.
 * Only the well-established ones are expanded; anything else is shown as printed.
 */
export type PosInfo = { km: string; en: string };

export const POS_LEGEND: Record<string, PosInfo> = {
  "ន.": { km: "នាម", en: "noun" },
  "កិ.": { km: "កិរិយាសព្ទ", en: "verb" },
  "គុ.": { km: "គុណនាម", en: "adjective" },
  "កិ. វិ.": { km: "កិរិយាវិសេសន៍", en: "adverb" },
  "ឧ.": { km: "ឧទានសព្ទ", en: "interjection" },
  "និ.": { km: "និបាតសព្ទ", en: "particle" },
  "សព្វ.": { km: "សព្វនាម", en: "pronoun" },
  "អា. និ.": { km: "អាយតនិបាត", en: "preposition" },
  "បា.": { km: "បាលី", en: "Pali origin" },
  "សំ.": { km: "សំស្ក្រឹត", en: "Sanskrit origin" },
  "សំ. បា.": { km: "សំស្ក្រឹត-បាលី", en: "Sanskrit / Pali origin" },
  "ព. កា.": { km: "ពាក្យកាព្យ", en: "poetic usage" },
  "ព. ប្រ.": { km: "ពាក្យប្រៀប", en: "figurative" },
  "ព. សា.": { km: "ពាក្យសាមញ្ញ", en: "colloquial" },
  "រ. ស.": { km: "រាជសព្ទ", en: "royal vocabulary" },
  "ព. ទ្រ.": { km: "ពាក្យទ្រុឌទ្រោម", en: "corrupted form" },
  "ព. ផ្ទ.": { km: "ពាក្យផ្ទុយ", en: "antonym" },
};

export function describePos(abbr: string): PosInfo | undefined {
  return POS_LEGEND[abbr.replace(/\s+/g, " ").trim()];
}
