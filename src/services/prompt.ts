import type { Comment } from "../types/review";

export interface RefinementPromptInput {
  filePath: string;
  lineNumber?: number;
  prId: number;
  prTitle: string;
  sourceBranch: string;
  destinationBranch: string;
  fileDiff: string;
  existingComments: Comment[];
  draft: string;
}

export interface RejectionPromptInput extends RefinementPromptInput {
  previousSuggestion: string;
  rejectionReason: string;
}

export function formatCommentsForPrompt(comments: Comment[]): string {
  if (comments.length === 0) return "None";

  return comments
    .map((c) => {
      if (c.isInline && c.lineNumber != null) {
        return `${c.author.nickname} (line ${c.lineNumber}): ${c.content}`;
      }
      return `${c.author.nickname}: ${c.content}`;
    })
    .join("\n");
}

export function buildRefinementPrompt(input: RefinementPromptInput): string {
  const lineDisplay =
    input.lineNumber != null ? String(input.lineNumber) : "N/A";
  const formattedComments = formatCommentsForPrompt(input.existingComments);

  return `You are helping a code reviewer write a clear, constructive PR comment.

## Context
File: ${input.filePath}
Line: ${lineDisplay}
PR: #${input.prId} — ${input.prTitle}
Branch: ${input.sourceBranch} → ${input.destinationBranch}

## File diff
${input.fileDiff}

## Existing comments on this file
${formattedComments}

## Reviewer's draft comment
${input.draft}

## Instructions
Rewrite the reviewer's draft comment to be:
1. Specific — reference the exact code, variable names, or line numbers
2. Constructive — explain WHY it's a problem and WHAT to do instead
3. Concise — 1-3 sentences, no filler
4. Professional — respectful tone, assume good intent from the author

Return ONLY the refined comment text, nothing else.`;
}

export function buildRejectionPrompt(input: RejectionPromptInput): string {
  const basePrompt = buildRefinementPrompt(input);

  return `${basePrompt}

## Previous suggestion
${input.previousSuggestion}

## Reviewer's feedback on the suggestion
${input.rejectionReason}

## Instructions
The reviewer didn't accept your previous suggestion. Take their feedback into account
and try again. Return ONLY the refined comment text, nothing else.`;
}
