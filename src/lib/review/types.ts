import type { IssueType } from "@/lib/dict/types";

export type ReviewIssueType = IssueType;

export type ReviewIssue = {
  /** The exact text in the input that has the problem. */
  text: string;
  /** What it should be. */
  suggestion: string;
  /** Short explanation in Khmer. */
  reason: string;
  type: ReviewIssueType;
};

export type ReviewResponse = {
  model: string;
  /** One-line verdict in Khmer. */
  summary: string;
  issues: ReviewIssue[];
  /** The whole text rewritten with every issue fixed. */
  corrected: string;
};
