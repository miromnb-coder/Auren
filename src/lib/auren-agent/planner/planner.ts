import type {
  AurenContext,
  AurenPlan,
  AurenPlanStep,
  AurenToolCall,
  AurenToolName,
} from '../core/types';
import type { PlannerOptions } from './planTypes';

const DEFAULT_MAX_STEPS = 4;
const HARD_MAX_STEPS = 6;

const cleanText = (value: string | null | undefined) => {
  return value?.replace(/\s+/g, ' ').trim() ?? '';
};

const clampStepCount = (value: number) => {
  if (!Number.isFinite(value)) return DEFAULT_MAX_STEPS;

  return Math.max(1, Math.min(Math.floor(value), HARD_MAX_STEPS));
};

const createStep = (
  id: string,
  title: string,
  description: string,
  status: AurenPlanStep['status'] = 'ready',
): AurenPlanStep => {
  return {
    id,
    title,
    description,
    status,
  };
};

const getRequest = (context: AurenContext) => {
  return cleanText(context.message);
};

const getGoalFromContext = (context: AurenContext) => {
  const request = getRequest(context);

  if (!request) {
    return 'Help the user clarify what they want to do next.';
  }

  if (context.mode === 'study') {
    return `Help the user learn or study: ${request}`;
  }

  if (context.mode === 'today') {
    return `Help the user turn today into a clear plan: ${request}`;
  }

  if (context.mode === 'memory') {
    return `Handle useful personal context carefully: ${request}`;
  }

  if (context.mode === 'focus') {
    return `Help the user choose one focused next action: ${request}`;
  }

  if (context.mode === 'money') {
    return `Help the user reason about a money-related decision or question: ${request}`;
  }

  return `Help the user move forward: ${request}`;
};

const hasMemory = (context: AurenContext) => {
  return context.memory.items.length > 0;
};

const createMemoryStep = (context: AurenContext): AurenPlanStep | null => {
  if (hasMemory(context)) {
    return createStep(
      'use-relevant-memory',
      'Use relevant memory',
      'Apply useful saved context only if it improves the answer.',
    );
  }

  if (context.intent.intent === 'save_memory') {
    return createStep(
      'prepare-memory-candidate',
      'Prepare memory candidate',
      'Identify the exact useful fact that should be saved later when persistent memory is connected.',
    );
  }

  return null;
};

const createToolCalls = (context: AurenContext): AurenToolCall[] => {
  const uniqueToolNames = new Set<AurenToolName>();

  for (const toolName of context.intent.toolHints) {
    uniqueToolNames.add(toolName);
  }

  return Array.from(uniqueToolNames).map((name) => ({
    name,
    input: {
      mode: context.mode,
      intent: context.intent.intent,
      message: context.message,
    },
  }));
};

const createStudySteps = (context: AurenContext): AurenPlanStep[] => {
  const memoryStep = createMemoryStep(context);

  return [
    createStep(
      'identify-learning-target',
      'Identify the learning target',
      'Find the subject, topic, test, assignment, or skill the user wants to improve.',
    ),
    ...(memoryStep ? [memoryStep] : []),
    createStep(
      'choose-study-method',
      'Choose the best study method',
      'Decide whether the user needs an explanation, a study plan, quiz questions, examples, or a quick summary.',
    ),
    createStep(
      'create-first-study-action',
      'Create the first study action',
      'Turn the request into a small concrete action the user can start immediately.',
    ),
    createStep(
      'check-understanding',
      'Check understanding',
      'End with a simple follow-up action, such as a quiz, recap, or next topic.',
    ),
  ];
};

const createTodaySteps = (context: AurenContext): AurenPlanStep[] => {
  const memoryStep = createMemoryStep(context);

  return [
    createStep(
      'read-current-situation',
      'Read the current situation',
      'Use the message, conversation, and available context to understand what matters today.',
    ),
    ...(memoryStep ? [memoryStep] : []),
    createStep(
      'choose-top-priority',
      'Choose the top priority',
      'Reduce the day into the most important next outcome instead of listing everything.',
    ),
    createStep(
      'create-simple-day-plan',
      'Create a simple day plan',
      'Suggest a lightweight order, time block, or next move that feels doable.',
    ),
    createStep(
      'start-with-next-action',
      'Start with the next action',
      'Give the user one action they can do now or very soon.',
    ),
  ];
};

const createMemorySteps = (context: AurenContext): AurenPlanStep[] => {
  if (context.intent.intent === 'recall_memory') {
    return [
      createStep(
        'search-relevant-memory',
        'Search relevant memory',
        'Look for useful stored context related to the user request.',
      ),
      createStep(
        'summarize-memory-safely',
        'Summarize memory safely',
        'Show only helpful context and avoid pretending that missing memory exists.',
      ),
      createStep(
        'suggest-memory-update',
        'Suggest memory update',
        'Offer a clear next action if the user wants to add, edit, or remove memory later.',
      ),
    ];
  }

  return [
    createStep(
      'identify-memory-value',
      'Identify memory value',
      'Decide whether the message contains context that would be useful in future conversations.',
    ),
    createStep(
      'extract-clean-memory',
      'Extract clean memory',
      'Turn the message into a short, specific memory candidate without saving unnecessary details.',
    ),
    createStep(
      'confirm-memory-intent',
      'Confirm memory intent',
      'Make it clear what would be remembered once persistent memory is connected.',
    ),
  ];
};

const createFocusSteps = (context: AurenContext): AurenPlanStep[] => {
  const memoryStep = createMemoryStep(context);

  return [
    createStep(
      'reduce-to-one-task',
      'Reduce to one task',
      'Find the smallest useful action instead of creating a large overwhelming plan.',
    ),
    ...(memoryStep ? [memoryStep] : []),
    createStep(
      'remove-friction',
      'Remove friction',
      'Identify what makes starting difficult and make the first step easier.',
    ),
    createStep(
      'create-focus-session',
      'Create a focus session',
      'Suggest a short session structure with a clear start and finish.',
    ),
    createStep(
      'define-done-state',
      'Define done state',
      'Make it obvious when the focused action is complete.',
    ),
  ];
};

const createMoneySteps = (context: AurenContext): AurenPlanStep[] => {
  const memoryStep = createMemoryStep(context);

  return [
    createStep(
      'clarify-money-question',
      'Clarify the money question',
      'Understand whether the user wants budgeting, subscription review, spending analysis, or a decision.',
    ),
    ...(memoryStep ? [memoryStep] : []),
    createStep(
      'separate-facts-from-assumptions',
      'Separate facts from assumptions',
      'Use only what is known and clearly avoid pretending that finance integrations are connected.',
    ),
    createStep(
      'create-safe-next-step',
      'Create a safe next step',
      'Suggest a practical action such as listing subscriptions, estimating costs, or making a budget outline.',
    ),
    createStep(
      'prepare-for-future-tool-use',
      'Prepare for future tool use',
      'Keep the plan compatible with future finance tools without requiring them yet.',
    ),
  ];
};

const createGeneralSteps = (context: AurenContext): AurenPlanStep[] => {
  const memoryStep = createMemoryStep(context);

  if (!getRequest(context)) {
    return [
      createStep(
        'ask-for-request',
        'Ask for a request',
        'The user has not provided enough information, so the next step is to ask what they want help with.',
      ),
    ];
  }

  if (context.intent.intent === 'create_plan') {
    return [
      createStep(
        'define-outcome',
        'Define the outcome',
        'Identify what the user wants to achieve and what a good result would look like.',
      ),
      ...(memoryStep ? [memoryStep] : []),
      createStep(
        'break-into-steps',
        'Break it into steps',
        'Turn the request into a small ordered plan with clear actions.',
      ),
      createStep(
        'choose-first-step',
        'Choose the first step',
        'Make the plan easy to start by picking the first practical action.',
      ),
    ];
  }

  return [
    createStep(
      'understand-request',
      'Understand the request',
      'Identify what the user is really asking for and what kind of help would be useful.',
    ),
    ...(memoryStep ? [memoryStep] : []),
    createStep(
      'decide-response-shape',
      'Decide response shape',
      'Choose whether the answer should be a plan, explanation, recommendation, checklist, or direct answer.',
    ),
    createStep(
      'create-useful-answer',
      'Create a useful answer',
      'Respond with a clear explanation and a practical next move.',
    ),
    createStep(
      'offer-next-action',
      'Offer next action',
      'End with a small action the user can continue with.',
    ),
  ];
};

const createBaseSteps = (context: AurenContext): AurenPlanStep[] => {
  if (context.mode === 'study') {
    return createStudySteps(context);
  }

  if (context.mode === 'today') {
    return createTodaySteps(context);
  }

  if (context.mode === 'memory') {
    return createMemorySteps(context);
  }

  if (context.mode === 'focus') {
    return createFocusSteps(context);
  }

  if (context.mode === 'money') {
    return createMoneySteps(context);
  }

  return createGeneralSteps(context);
};

const createPlanSummary = (context: AurenContext, steps: AurenPlanStep[]) => {
  const stepCount = steps.length;
  const memoryText = hasMemory(context) ? 'with memory context' : 'without saved memory context';
  const toolText =
    context.intent.toolHints.length > 0
      ? 'and prepared placeholder tool calls'
      : 'and no tool calls needed';

  return `Auren created a ${context.mode} plan with ${stepCount} step${
    stepCount === 1 ? '' : 's'
  }, ${memoryText}, ${toolText}.`;
};

const markBlockedIfEmptyRequest = (
  context: AurenContext,
  steps: AurenPlanStep[],
): AurenPlanStep[] => {
  if (getRequest(context)) {
    return steps;
  }

  return steps.map((step, index) => ({
    ...step,
    status: index === 0 ? 'ready' : 'blocked',
  }));
};

export const createPlan = (
  context: AurenContext,
  options: PlannerOptions = {},
): AurenPlan => {
  const maxSteps = clampStepCount(options.maxSteps ?? DEFAULT_MAX_STEPS);
  const baseSteps = createBaseSteps(context);
  const steps = markBlockedIfEmptyRequest(context, baseSteps).slice(0, maxSteps);
  const suggestedToolCalls = createToolCalls(context);

  return {
    goal: getGoalFromContext(context),
    summary: createPlanSummary(context, steps),
    steps,
    suggestedToolCalls,
  };
};
