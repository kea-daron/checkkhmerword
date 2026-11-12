import "server-only";
import type { CheckToken, GrammarIssue } from "@/lib/dict/types";
import { Context } from "./context";
import { GRAMMAR_RULES } from "./rules";
import { checkPhraseContext } from "@/lib/context/check";

export { RULES, ruleInfo, SOURCE_LABEL } from "./catalog";
export type { RuleInfo, RuleSource } from "./catalog";

/**
 * Run every grammar rule over `text`, already segmented into `tokens` by the
 * dictionary checker, then the phrase-context pass (a valid word that does not
 * fit its neighbours). Offsets in the result index into `text`. Overlaps are
 * resolved together, so a grammar rule and the phrase check never mark the
 * same letters twice.
 */
export function checkGrammar(text: string, tokens: CheckToken[]): GrammarIssue[] {
  const ctx = new Context(text, tokens);
  for (const rule of GRAMMAR_RULES) rule(ctx);
  checkPhraseContext(ctx);
  return ctx.finalize();
}
