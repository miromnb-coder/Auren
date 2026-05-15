import type { AurenContext, AurenPlan, AurenPlanStep } from '../core/types';
import type { PlannerOptions } from './planTypes';

const createBaseSteps = (mode: AurenContext['mode']): AurenPlanStep[] => {
  if (mode === 'study') {
    return [
      {
        id: 'clarify-study-goal',
        title: 'Clarify the study goal',
        description: 'Identify the topic, target, and next useful learning action.',
        status: 'ready',
      },
      {
        id: 'create-study-action',
        title: 'Create the next study action',
        description: 'Turn the request into a small plan, explanation, or practice step.',
        status: 'ready',
      },
    ];
  }

  if (mode === 'today') {
    return [
      {
        id: 'review-current-situation',
        title: 'Review the current situation',
        description: 'Use the message and available context to understand what matters now.',
        status: 'ready',
      },
      {
        id: 'pick-next-action',
        title: 'Pick the next action',
        description: 'Suggest one clear next step for the user.',
        status: 'ready',
      },
    ];
  }

  return [
    {
      id: 'understand-request',
      title: 'Understand the request',
      description: 'Read the message and route it through Auren Agent v0.1.',
      status: 'ready',
    },
    {
      id: 'prepare-helpful-answer',
      title: 'Prepare a helpful answer',
      description: 'Create a clear answer with lightweight next actions.',
      status: 'ready',
    },
  ];
};

export const createPlan = (
  context: AurenContext,
  options: PlannerOptions = {},
): AurenPlan => {
  const maxSteps = options.maxSteps ?? 4;
  const steps = createBaseSteps(context.mode).slice(0, maxSteps);

  return {
    goal: context.message || 'Help the user move forward.',
    summary: `Auren v0.1 created a lightweight ${context.mode} plan.`,
    steps,
    suggestedToolCalls: [],
  };
};
