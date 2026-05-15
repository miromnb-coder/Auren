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

type PlanShape =
  | 'empty'
  | 'direct_answer'
  | 'explanation'
  | 'planning_only'
  | 'implementation'
  | 'debug'
  | 'decision'
  | 'review'
  | 'tool_action'
  | 'study'
  | 'today'
  | 'focus'
  | 'money'
  | 'memory';

type PlanConstraint =
  | 'planning_first'
  | 'no_external_action'
  | 'scope_limited'
  | 'requires_confirmation'
  | 'safe_manual_fallback';

const INTENT_TO_PLAN_SHAPE: Record<string, PlanShape> = {
  general_chat: 'direct_answer',
  direct_answer: 'direct_answer',
  answer_question: 'direct_answer',

  explain: 'explanation',
  explanation: 'explanation',
  explain_concept: 'explanation',
  define_term: 'explanation',

  create_plan: 'planning_only',
  planning: 'planning_only',
  planning_only: 'planning_only',
  strategy: 'planning_only',

  implement: 'implementation',
  implementation: 'implementation',
  create_content: 'implementation',
  create_code: 'implementation',
  edit_code: 'implementation',
  apply_change: 'implementation',

  debug: 'debug',
  troubleshoot: 'debug',
  fix_error: 'debug',
  diagnose_issue: 'debug',

  decide: 'decision',
  decision: 'decision',
  compare_options: 'decision',
  recommendation: 'decision',

  review: 'review',
  analyze: 'review',
  audit: 'review',
  feedback: 'review',

  use_tool: 'tool_action',
  tool_action: 'tool_action',
  integration_action: 'tool_action',

  study_help: 'study',
  daily_planning: 'today',
  focus_help: 'focus',
  money_help: 'money',

  save_memory: 'memory',
  recall_memory: 'memory',
  delete_memory: 'memory',
  update_memory: 'memory',
};

const INTENT_TO_CONSTRAINTS: Record<string, PlanConstraint[]> = {
  planning_only: ['planning_first', 'no_external_action'],
  create_plan: ['planning_first'],
  strategy: ['planning_first'],

  read_only: ['no_external_action'],
  no_external_action: ['no_external_action'],
  ask_before_action: ['requires_confirmation'],
  confirmation_required: ['requires_confirmation'],

  small_change: ['scope_limited'],
  limited_scope: ['scope_limited'],

  money_help: ['safe_manual_fallback'],
};

const cleanText = (value: string | null | undefined) => {
  return value?.replace(/\s+/g, ' ').trim() ?? '';
};

const normalizeKey = (value: string | null | undefined) => {
  return cleanText(value)
    .toLowerCase()
    .replace(/[^a-z0-9_:-]+/g, '_')
    .replace(/^_+|_+$/g, '');
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

const getIntentKey = (context: AurenContext) => {
  return normalizeKey(context.intent.intent);
};

const hasMemory = (context: AurenContext) => {
  return context.memory.items.length > 0;
};

const hasToolNeed = (context: AurenContext) => {
  return Boolean(context.intent.needsTools) || context.intent.toolHints.length > 0;
};

const getConstraints = (context: AurenContext): PlanConstraint[] => {
  const intent = getIntentKey(context);
  const constraints = new Set<PlanConstraint>();

  for (const constraint of INTENT_TO_CONSTRAINTS[intent] ?? []) {
    constraints.add(constraint);
  }

  if (context.mode === 'money') {
    constraints.add('safe_manual_fallback');
  }

  if (hasToolNeed(context)) {
    constraints.add('requires_confirmation');
  }

  return Array.from(constraints);
};

const selectPlanShape = (context: AurenContext): PlanShape => {
  const request = getRequest(context);
  const intent = getIntentKey(context);
  const constraints = getConstraints(context);

  if (!request) {
    return 'empty';
  }

  if (context.mode === 'memory') return 'memory';
  if (context.mode === 'study') return 'study';
  if (context.mode === 'today') return 'today';
  if (context.mode === 'focus') return 'focus';
  if (context.mode === 'money') return 'money';

  if (INTENT_TO_PLAN_SHAPE[intent]) {
    return INTENT_TO_PLAN_SHAPE[intent];
  }

  if (constraints.includes('planning_first') || constraints.includes('no_external_action')) {
    return 'planning_only';
  }

  if (hasToolNeed(context)) {
    return 'tool_action';
  }

  return 'direct_answer';
};

const getConstraintText = (constraints: PlanConstraint[]) => {
  if (constraints.length === 0) {
    return 'No special constraints detected.';
  }

  const labels: Record<PlanConstraint, string> = {
    planning_first: 'plan before acting',
    no_external_action: 'do not take external actions',
    scope_limited: 'keep the scope focused',
    requires_confirmation: 'ask before actions with real-world effects',
    safe_manual_fallback: 'use a safe manual fallback if tools are unavailable',
  };

  return constraints.map((constraint) => labels[constraint]).join(', ');
};

const createMemoryStep = (context: AurenContext): AurenPlanStep | null => {
  if (context.memory.saved) {
    return createStep(
      'respect-new-memory',
      'Respect new memory',
      'Use newly saved context only if it improves the current answer.',
    );
  }

  if (hasMemory(context)) {
    return createStep(
      'use-relevant-memory',
      'Use relevant memory',
      'Apply useful saved context only when it improves the answer.',
    );
  }

  if (context.intent.intent === 'save_memory') {
    return createStep(
      'prepare-memory-candidate',
      'Prepare memory candidate',
      'Identify the exact useful fact that should be saved and avoid unnecessary details.',
    );
  }

  return null;
};

const createConstraintStep = (constraints: PlanConstraint[]): AurenPlanStep | null => {
  if (constraints.length === 0) {
    return null;
  }

  return createStep(
    'respect-agent-boundaries',
    'Respect agent boundaries',
    `Follow these boundaries: ${getConstraintText(constraints)}.`,
  );
};

const compactSteps = (steps: Array<AurenPlanStep | null>) => {
  return steps.filter((step): step is AurenPlanStep => Boolean(step));
};

const createPlanningOnlySteps = (
  context: AurenContext,
  constraints: PlanConstraint[],
): AurenPlanStep[] => {
  return compactSteps([
    createStep(
      'understand-goal',
      'Understand the goal',
      'Identify what the user wants to decide, design, organize, or improve.',
    ),
    createMemoryStep(context),
    createConstraintStep(constraints),
    createStep(
      'map-options',
      'Map options',
      'Compare the most useful approaches before taking action.',
    ),
    createStep(
      'recommend-next-step',
      'Recommend next step',
      'Choose the highest-impact next move and keep it practical.',
    ),
  ]);
};

const createImplementationSteps = (
  context: AurenContext,
  constraints: PlanConstraint[],
): AurenPlanStep[] => {
  return compactSteps([
    createStep(
      'define-output',
      'Define output',
      'Identify what concrete result the user expects.',
    ),
    createMemoryStep(context),
    createConstraintStep(constraints),
    createStep(
      'prepare-result',
      'Prepare result',
      'Create the requested content, structure, or implementation in a complete usable form.',
    ),
    createStep(
      'protect-scope',
      'Protect scope',
      'Avoid unrelated changes and keep the result focused.',
    ),
  ]);
};

const createDebugSteps = (
  context: AurenContext,
  constraints: PlanConstraint[],
): AurenPlanStep[] => {
  return compactSteps([
    createStep(
      'identify-symptom',
      'Identify symptom',
      'Understand what is failing, unclear, or not behaving as expected.',
    ),
    createMemoryStep(context),
    createStep(
      'isolate-cause',
      'Isolate cause',
      'Connect the symptom to the most likely cause using available context.',
    ),
    createConstraintStep(constraints),
    createStep(
      'suggest-fix',
      'Suggest fix',
      'Give the smallest safe fix first.',
    ),
    createStep(
      'verify-result',
      'Verify result',
      'Explain how to confirm the issue is resolved.',
    ),
  ]);
};

const createDecisionSteps = (
  context: AurenContext,
  constraints: PlanConstraint[],
): AurenPlanStep[] => {
  return compactSteps([
    createStep(
      'identify-options',
      'Identify options',
      'Clarify the realistic choices the user is deciding between.',
    ),
    createMemoryStep(context),
    createStep(
      'compare-tradeoffs',
      'Compare tradeoffs',
      'Compare upside, downside, effort, risk, timing, and fit with the user’s goal.',
    ),
    createConstraintStep(constraints),
    createStep(
      'recommend-choice',
      'Recommend choice',
      'Choose the best option and explain why.',
    ),
  ]);
};

const createExplanationSteps = (
  context: AurenContext,
  constraints: PlanConstraint[],
): AurenPlanStep[] => {
  return compactSteps([
    createStep(
      'identify-concept',
      'Identify concept',
      'Find the exact thing the user wants explained.',
    ),
    createMemoryStep(context),
    createConstraintStep(constraints),
    createStep(
      'explain-clearly',
      'Explain clearly',
      'Give a simple answer in the user’s language without unnecessary complexity.',
    ),
    createStep(
      'add-example-if-useful',
      'Add example if useful',
      'Use a short example only when it makes the answer clearer.',
    ),
  ]);
};

const createReviewSteps = (
  context: AurenContext,
  constraints: PlanConstraint[],
): AurenPlanStep[] => {
  return compactSteps([
    createStep(
      'review-current-state',
      'Review current state',
      'Identify what is working and what the user wants evaluated.',
    ),
    createMemoryStep(context),
    createStep(
      'find-main-improvement',
      'Find main improvement',
      'Choose the highest-impact improvement instead of listing too many changes.',
    ),
    createConstraintStep(constraints),
    createStep(
      'prioritize-next-step',
      'Prioritize next step',
      'Recommend what to improve first and what can wait.',
    ),
  ]);
};

const createToolActionSteps = (
  context: AurenContext,
  constraints: PlanConstraint[],
): AurenPlanStep[] => {
  return compactSteps([
    createStep(
      'identify-tool-need',
      'Identify tool need',
      'Decide which tool or integration would be required to answer accurately.',
    ),
    createMemoryStep(context),
    createConstraintStep(constraints),
    createStep(
      'check-tool-readiness',
      'Check tool readiness',
      'Use connected tools when available and avoid pretending unavailable tools were used.',
    ),
    createStep(
      'provide-fallback',
      'Provide fallback',
      'If tools are unavailable, give a safe manual next step.',
    ),
  ]);
};

const createStudySteps = (
  context: AurenContext,
  constraints: PlanConstraint[],
): AurenPlanStep[] => {
  return compactSteps([
    createStep(
      'identify-learning-target',
      'Identify learning target',
      'Find the subject, topic, test, assignment, or skill the user wants to improve.',
    ),
    createMemoryStep(context),
    createStep(
      'choose-study-method',
      'Choose study method',
      'Decide whether the user needs an explanation, plan, quiz, example, or summary.',
    ),
    createConstraintStep(constraints),
    createStep(
      'create-first-study-action',
      'Create first study action',
      'Turn the request into one concrete study action the user can start immediately.',
    ),
  ]);
};

const createTodaySteps = (
  context: AurenContext,
  constraints: PlanConstraint[],
): AurenPlanStep[] => {
  return compactSteps([
    createStep(
      'read-current-situation',
      'Read current situation',
      'Use the message, conversation, and available context to understand what matters today.',
    ),
    createMemoryStep(context),
    createStep(
      'choose-priority',
      'Choose priority',
      'Reduce the day into the most important next outcome.',
    ),
    createConstraintStep(constraints),
    createStep(
      'create-simple-plan',
      'Create simple plan',
      'Suggest a lightweight order, time block, or next move that feels doable.',
    ),
  ]);
};

const createMemorySteps = (
  context: AurenContext,
  constraints: PlanConstraint[],
): AurenPlanStep[] => {
  if (context.intent.intent === 'recall_memory') {
    return compactSteps([
      createStep(
        'search-relevant-memory',
        'Search relevant memory',
        'Look for useful stored context related to the user request.',
      ),
      createStep(
        'summarize-safely',
        'Summarize safely',
        'Show only helpful context and avoid pretending missing memory exists.',
      ),
      createConstraintStep(constraints),
      createStep(
        'offer-memory-control',
        'Offer memory control',
        'Make it easy for the user to add, edit, or remove memory later.',
      ),
    ]);
  }

  return compactSteps([
    createStep(
      'identify-memory-value',
      'Identify memory value',
      'Decide whether the message contains context useful for future conversations.',
    ),
    createStep(
      'extract-clean-memory',
      'Extract clean memory',
      'Turn the message into a short, specific memory without unnecessary details.',
    ),
    createConstraintStep(constraints),
    createStep(
      'confirm-once',
      'Confirm once',
      'Confirm memory action clearly without repeating the same confirmation.',
    ),
  ]);
};

const createFocusSteps = (
  context: AurenContext,
  constraints: PlanConstraint[],
): AurenPlanStep[] => {
  return compactSteps([
    createStep(
      'reduce-to-one-task',
      'Reduce to one task',
      'Find the smallest useful action instead of creating an overwhelming plan.',
    ),
    createMemoryStep(context),
    createStep(
      'remove-friction',
      'Remove friction',
      'Identify what makes starting difficult and make the first step easier.',
    ),
    createConstraintStep(constraints),
    createStep(
      'define-done-state',
      'Define done state',
      'Make it obvious when the focused action is complete.',
    ),
  ]);
};

const createMoneySteps = (
  context: AurenContext,
  constraints: PlanConstraint[],
): AurenPlanStep[] => {
  return compactSteps([
    createStep(
      'clarify-money-question',
      'Clarify money question',
      'Understand whether the user wants budgeting, spending review, subscription review, or a decision.',
    ),
    createMemoryStep(context),
    createStep(
      'separate-known-from-unknown',
      'Separate known from unknown',
      'Use only available information and avoid pretending finance integrations are connected.',
    ),
    createConstraintStep(constraints),
    createStep(
      'create-safe-next-step',
      'Create safe next step',
      'Suggest a practical manual step if real finance tools are unavailable.',
    ),
  ]);
};

const createDirectAnswerSteps = (
  context: AurenContext,
  constraints: PlanConstraint[],
): AurenPlanStep[] => {
  return compactSteps([
    createStep(
      'understand-request',
      'Understand request',
      'Identify the smallest useful answer.',
    ),
    createMemoryStep(context),
    createConstraintStep(constraints),
    createStep(
      'answer-directly',
      'Answer directly',
      'Give a concise useful answer without turning a small request into a large plan.',
    ),
  ]);
};

const createEmptySteps = (): AurenPlanStep[] => {
  return [
    createStep(
      'ask-for-request',
      'Ask for request',
      'The user has not provided enough information, so ask what they want help with.',
    ),
  ];
};

const createBaseSteps = (
  context: AurenContext,
  shape: PlanShape,
  constraints: PlanConstraint[],
): AurenPlanStep[] => {
  if (shape === 'empty') return createEmptySteps();
  if (shape === 'planning_only') return createPlanningOnlySteps(context, constraints);
  if (shape === 'implementation') return createImplementationSteps(context, constraints);
  if (shape === 'debug') return createDebugSteps(context, constraints);
  if (shape === 'decision') return createDecisionSteps(context, constraints);
  if (shape === 'explanation') return createExplanationSteps(context, constraints);
  if (shape === 'review') return createReviewSteps(context, constraints);
  if (shape === 'tool_action') return createToolActionSteps(context, constraints);
  if (shape === 'study') return createStudySteps(context, constraints);
  if (shape === 'today') return createTodaySteps(context, constraints);
  if (shape === 'memory') return createMemorySteps(context, constraints);
  if (shape === 'focus') return createFocusSteps(context, constraints);
  if (shape === 'money') return createMoneySteps(context, constraints);

  return createDirectAnswerSteps(context, constraints);
};

const getGoalFromContext = (
  context: AurenContext,
  shape: PlanShape,
  constraints: PlanConstraint[],
) => {
  const request = getRequest(context);
  const constraintText = constraints.length > 0 ? ` Boundaries: ${getConstraintText(constraints)}.` : '';

  if (!request) {
    return 'Help the user clarify what they want to do next.';
  }

  if (shape === 'planning_only') {
    return `Plan the best approach before acting: ${request}.${constraintText}`;
  }

  if (shape === 'implementation') {
    return `Create the requested result while keeping the scope focused: ${request}.${constraintText}`;
  }

  if (shape === 'debug') {
    return `Find the likely cause and safest fix for the issue: ${request}.${constraintText}`;
  }

  if (shape === 'decision') {
    return `Help the user choose the best option and next action: ${request}.${constraintText}`;
  }

  if (shape === 'explanation') {
    return `Explain the topic clearly and simply: ${request}.${constraintText}`;
  }

  if (shape === 'review') {
    return `Review the shared idea or result and identify the highest-impact improvement: ${request}.${constraintText}`;
  }

  if (shape === 'tool_action') {
    return `Determine whether tools are needed and provide a safe answer or fallback: ${request}.${constraintText}`;
  }

  if (context.mode === 'study') {
    return `Help the user learn or study: ${request}.${constraintText}`;
  }

  if (context.mode === 'today') {
    return `Help the user turn today into a clear plan: ${request}.${constraintText}`;
  }

  if (context.mode === 'memory') {
    return `Handle useful personal context carefully: ${request}.${constraintText}`;
  }

  if (context.mode === 'focus') {
    return `Help the user choose one focused next action: ${request}.${constraintText}`;
  }

  if (context.mode === 'money') {
    return `Help the user reason about a money-related decision or question: ${request}.${constraintText}`;
  }

  return `Help the user move forward: ${request}.${constraintText}`;
};

const getShapeStepLimit = (shape: PlanShape, requestedMaxSteps: number) => {
  if (shape === 'empty') return 1;
  if (shape === 'direct_answer') return Math.min(requestedMaxSteps, 3);
  if (shape === 'explanation') return Math.min(requestedMaxSteps, 3);
  if (shape === 'memory') return Math.min(requestedMaxSteps, 4);

  return requestedMaxSteps;
};

const createToolCalls = (
  context: AurenContext,
  shape: PlanShape,
  constraints: PlanConstraint[],
): AurenToolCall[] => {
  if (
    constraints.includes('no_external_action') ||
    constraints.includes('planning_first') ||
    constraints.includes('requires_confirmation')
  ) {
    return [];
  }

  if (shape === 'planning_only' || shape === 'explanation' || shape === 'direct_answer') {
    return [];
  }

  if (!hasToolNeed(context)) {
    return [];
  }

  const uniqueToolNames = new Set<AurenToolName>();

  for (const toolName of context.intent.toolHints) {
    uniqueToolNames.add(toolName);
  }

  return Array.from(uniqueToolNames).map((name) => ({
    name,
    input: {
      mode: context.mode,
      intent: context.intent.intent,
      planShape: shape,
      constraints,
      message: context.message,
    },
  }));
};

const createPlanSummary = (
  context: AurenContext,
  shape: PlanShape,
  constraints: PlanConstraint[],
  steps: AurenPlanStep[],
  suggestedToolCalls: AurenToolCall[],
) => {
  const stepCount = steps.length;
  const memoryText = hasMemory(context) ? 'with relevant memory' : 'without relevant memory';
  const toolText =
    suggestedToolCalls.length > 0
      ? `with ${suggestedToolCalls.length} prepared tool call${
          suggestedToolCalls.length === 1 ? '' : 's'
        }`
      : 'with no tool calls';
  const constraintText =
    constraints.length > 0 ? ` Boundaries: ${getConstraintText(constraints)}.` : '';

  return `Auren created a ${shape} plan in ${context.mode} mode with ${stepCount} step${
    stepCount === 1 ? '' : 's'
  }, ${memoryText}, ${toolText}.${constraintText}`;
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
  const requestedMaxSteps = clampStepCount(options.maxSteps ?? DEFAULT_MAX_STEPS);
  const shape = selectPlanShape(context);
  const constraints = getConstraints(context);
  const maxSteps = getShapeStepLimit(shape, requestedMaxSteps);
  const baseSteps = createBaseSteps(context, shape, constraints);
  const steps = markBlockedIfEmptyRequest(context, baseSteps).slice(0, maxSteps);
  const suggestedToolCalls = createToolCalls(context, shape, constraints);

  return {
    goal: getGoalFromContext(context, shape, constraints),
    summary: createPlanSummary(context, shape, constraints, steps, suggestedToolCalls),
    steps,
    suggestedToolCalls,
  };
};
