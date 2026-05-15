import type { AurenContext, AurenPlan, AurenResponseDraft, AurenResponseEvaluation } from '../core/types';

export const evaluateResponse = (
  context: AurenContext,
  plan: AurenPlan,
  draft: AurenResponseDraft,
): AurenResponseEvaluation => {
  const issues: string[] = [];
  const recommendations: string[] = [];

  if (!draft.answer.trim()) {
    issues.push('The generated answer is empty.');
    recommendations.push('Return a safe fallback answer.');
  }

  if (plan.steps.length === 0) {
    issues.push('The plan has no steps.');
    recommendations.push('Create at least one lightweight plan step.');
  }

  if (!context.message.trim()) {
    issues.push('The user message is empty.');
    recommendations.push('Ask the user for a message before running deeper agent logic.');
  }

  return {
    passed: issues.length === 0,
    score: issues.length === 0 ? 0.82 : 0.45,
    issues,
    recommendations,
  };
};
