export type Entry = {
  id: number;
  word: string;
  /** Part-of-speech abbreviation as printed in the dictionary, e.g. "ន." */
  pos?: string;
};

export type MatchType = "exact" | "prefix" | "contains" | "fuzzy";

export type SearchResult = {
  id: number;
  word: string;
  pos?: string;
  match: MatchType;
  /** Short plain-text preview of the definition. */
  excerpt: string;
};

export type SearchResponse = {
  query: string;
  normalized: string;
  total: number;
  results: SearchResult[];
};

export type Suggestion = { word: string; id?: number; distance: number };

export type TokenKind = "word" | "space" | "punct" | "other";

/**
 * dict      – headword found in the Chuon Nath dictionary
 * sbbic     – not in Chuon Nath but present in the SBBIC spelling word list
 * compound  – not an entry itself, but splits cleanly into known words
 * unknown   – not found anywhere
 */
export type TokenStatus = "dict" | "sbbic" | "compound" | "unknown";

export type CheckPart = { text: string; status: "dict" | "sbbic"; ids?: number[] };

export type CheckToken = {
  text: string;
  kind: TokenKind;
  status?: TokenStatus;
  ids?: number[];
  parts?: CheckPart[];
  suggestions?: Suggestion[];
};

export type CheckSummary = {
  words: number;
  dict: number;
  sbbic: number;
  compound: number;
  unknown: number;
};

export type CheckResponse = {
  tokens: CheckToken[];
  summary: CheckSummary;
};

export type DefinitionSegment =
  | { t: "text"; v: string }
  | { t: "link"; v: string; id: number }
  | { t: "pos"; v: string };

export type ParsedDefinition = {
  lines: DefinitionSegment[][];
};

export type LetterInfo = { letter: string; count: number };
