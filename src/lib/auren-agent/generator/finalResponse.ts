import type {
  AurenContext,
  AurenPlan,
  AurenResponseDraft,
  AurenSuggestion,
  AurenToolResult,
} from '../core/types';

const getModeSuggestions = (mode: AurenContext['mode']): AurenSuggestion[] => {
  if (mode === 'study') {
    return [
      {
        id: 'explain-topic',
        label: 'Explain topic',
        action: 'explain_topic',
      },
      {
        id: 'make-study-plan',
        label: 'Make study plan',
        action: 'make_study_plan',
      },
      {
        id: 'quiz-me',
        label: 'Quiz me',
        action: 'quiz_me',
      },
    ];
  }

  if (mode === 'today') {
    return [
      {
        id: 'plan-day',
        label: 'Plan my day',
        action: 'plan_day',
      },
      {
        id: 'pick-priority',
        label: 'Pick top priority',
        action: 'pick_top_priority',
      },
      {
        id: 'start-focus',
        label: 'Start focus session',
        action: 'start_focus_session',
      },
    ];
  }

  if (mode === 'memory') {
    return [
      {
        id: 'save-memory',
        label: 'Save this',
        action: 'save_memory',
      },
      {
        id: 'show-memory',
        label: 'Show memory',
        action: 'show_memory',
      },
    ];
  }

  return [
    {
      id: 'make-plan',
      label: 'Make a plan',
      action: 'make_plan',
    },
    {
      id: 'save-context',
      label: 'Save context',
      action: 'save_context',
    },
    {
      id: 'next-step',
      label: 'Next step',
      action: 'next_step',
    },
  ];
};

export const generateFinalResponse = (
  context: AurenContext,
  plan: AurenPlan,
  toolResults: AurenToolResult[],
): AurenResponseDraft => {
  const hasTools = toolResults.length > 0;
  const firstStep = plan.steps[0];
  const nextAction = firstStep?.title ?? 'Choose the next useful action';

  const answer = [
    `Auren Agent v0.1 is ready in ${context.mode} mode.`,
    `I understood the request and created a lightweight plan with ${plan.steps.length} step${plan.steps.length === 1 ? '' : 's'}.`,
    hasTools
      ? 'Some tool calls were requested, but external tools are only scaffolded right now.'
      : 'No external tools were needed for this first scaffolded pass.',
    `Next: ${nextAction}.`,
  ].join('\n\n');

  return {
    answer,
    suggestions: getModeSuggestions(context.mode),
  };
};
