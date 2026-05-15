import type {
  AurenContext,
  AurenPlan,
  AurenResponseDraft,
  AurenSuggestion,
  AurenToolResult,
} from '../core/types';

const MAX_VISIBLE_PLAN_STEPS = 4;
const MAX_VISIBLE_MEMORY_ITEMS = 3;
const MAX_SUGGESTIONS = 4;

const cleanText = (value: string | null | undefined) => {
  return value?.replace(/\s+/g, ' ').trim() ?? '';
};

const createSuggestion = (
  id: string,
  label: string,
  action: string,
  payload?: AurenSuggestion['payload'],
): AurenSuggestion => {
  return {
    id,
    label,
    action,
    ...(payload ? { payload } : {}),
  };
};

const dedupeSuggestions = (suggestions: AurenSuggestion[]) => {
  const uniqueSuggestions = new Map<string, AurenSuggestion>();

  for (const suggestion of suggestions) {
    const key = suggestion.action || suggestion.id;

    if (!uniqueSuggestions.has(key)) {
      uniqueSuggestions.set(key, suggestion);
    }
  }

  return Array.from(uniqueSuggestions.values()).slice(0, MAX_SUGGESTIONS);
};

const getModeSuggestions = (context: AurenContext, plan: AurenPlan): AurenSuggestion[] => {
  const basePayload = {
    mode: context.mode,
    intent: context.intent.intent,
    planGoal: plan.goal,
  };

  if (context.mode === 'study') {
    return dedupeSuggestions([
      createSuggestion('explain-topic', 'Explain topic', 'explain_topic', basePayload),
      createSuggestion('make-study-plan', 'Make study plan', 'make_study_plan', basePayload),
      createSuggestion('quiz-me', 'Quiz me', 'quiz_me', basePayload),
      createSuggestion('summarize-notes', 'Summarize notes', 'summarize_notes', basePayload),
    ]);
  }

  if (context.mode === 'today') {
    return dedupeSuggestions([
      createSuggestion('plan-day', 'Plan my day', 'plan_day', basePayload),
      createSuggestion('pick-priority', 'Pick top priority', 'pick_top_priority', basePayload),
      createSuggestion('start-focus', 'Start focus session', 'start_focus_session', basePayload),
      createSuggestion('add-task', 'Add task', 'add_task', basePayload),
    ]);
  }

  if (context.mode === 'memory') {
    return dedupeSuggestions([
      createSuggestion('save-memory', 'Save this', 'save_memory', basePayload),
      createSuggestion('show-memory', 'Show memory', 'show_memory', basePayload),
      createSuggestion('edit-memory', 'Edit memory', 'edit_memory', basePayload),
      createSuggestion('forget-memory', 'Forget this', 'forget_memory', basePayload),
    ]);
  }

  if (context.mode === 'focus') {
    return dedupeSuggestions([
      createSuggestion('start-focus', 'Start focus session', 'start_focus_session', basePayload),
      createSuggestion('pick-one-task', 'Pick one task', 'pick_one_task', basePayload),
      createSuggestion('remove-distractions', 'Remove distractions', 'remove_distractions', basePayload),
      createSuggestion('make-timer-plan', 'Make timer plan', 'make_timer_plan', basePayload),
    ]);
  }

  if (context.mode === 'money') {
    return dedupeSuggestions([
      createSuggestion('analyze-spending', 'Analyze spending', 'analyze_spending', basePayload),
      createSuggestion('find-subscriptions', 'Find subscriptions', 'find_subscriptions', basePayload),
      createSuggestion('make-budget', 'Make budget', 'make_budget', basePayload),
      createSuggestion('find-savings', 'Find savings', 'find_savings', basePayload),
    ]);
  }

  return dedupeSuggestions([
    createSuggestion('make-plan', 'Make a plan', 'make_plan', basePayload),
    createSuggestion('next-step', 'Next step', 'next_step', basePayload),
    createSuggestion('save-context', 'Save context', 'save_context', basePayload),
    createSuggestion('break-down', 'Break it down', 'break_down', basePayload),
  ]);
};

const getModeOpening = (context: AurenContext) => {
  if (context.mode === 'study') {
    return 'I can help turn this into a clear study action.';
  }

  if (context.mode === 'today') {
    return 'I can help organize this into a practical next step for today.';
  }

  if (context.mode === 'memory') {
    return 'I can treat this as personal context and use it carefully.';
  }

  if (context.mode === 'focus') {
    return 'I can help reduce this to one focused action.';
  }

  if (context.mode === 'money') {
    return 'I can help look at this from a money and decision-making angle.';
  }

  return 'I can help move this forward.';
};

const getModeFocus = (context: AurenContext) => {
  if (context.mode === 'study') {
    return 'The goal is to make learning easier, more structured, and easier to start.';
  }

  if (context.mode === 'today') {
    return 'The goal is to choose what matters now instead of making the whole day feel heavy.';
  }

  if (context.mode === 'memory') {
    return 'The goal is to keep only useful context, not store everything.';
  }

  if (context.mode === 'focus') {
    return 'The goal is to remove noise and create one small action you can actually do.';
  }

  if (context.mode === 'money') {
    return 'The goal is to make the decision clearer before connecting real finance tools.';
  }

  return 'The goal is to give you a useful answer and a clear next move.';
};

const getPlanLines = (plan: AurenPlan) => {
  const visibleSteps = plan.steps.slice(0, MAX_VISIBLE_PLAN_STEPS);

  if (visibleSteps.length === 0) {
    return ['1. Understand what you want to do.', '2. Pick the next useful action.'];
  }

  return visibleSteps.map((step, index) => {
    const title = cleanText(step.title) || 'Next step';
    const description = cleanText(step.description);

    if (!description) {
      return `${index + 1}. ${title}`;
    }

    return `${index + 1}. ${title} — ${description}`;
  });
};

const getNextAction = (plan: AurenPlan) => {
  const readyStep = plan.steps.find((step) => step.status === 'ready') ?? plan.steps[0];

  if (!readyStep) {
    return 'Choose one small next action and start there.';
  }

  const title = cleanText(readyStep.title);
  const description = cleanText(readyStep.description);

  if (title && description) {
    return `${title}: ${description}`;
  }

  return title || description || 'Choose one small next action and start there.';
};

const getMemoryNote = (context: AurenContext) => {
  const memoryItems = context.memory.items
    .map((item) => cleanText(item.text))
    .filter(Boolean)
    .slice(0, MAX_VISIBLE_MEMORY_ITEMS);

  if (memoryItems.length === 0) {
    return 'I did not use saved memory yet. The memory system is ready as a scaffold, but persistent memory can be connected later.';
  }

  return [
    'Relevant memory used:',
    ...memoryItems.map((item, index) => `${index + 1}. ${item}`),
  ].join('\n');
};

const getToolNote = (toolResults: AurenToolResult[]) => {
  if (toolResults.length === 0) {
    return null;
  }

  const connectedTools = toolResults.filter((result) => result.success);
  const unavailableTools = toolResults.filter((result) => !result.success);

  const lines: string[] = [];

  if (connectedTools.length > 0) {
    lines.push(
      `Used ${connectedTools.length} tool${connectedTools.length === 1 ? '' : 's'} successfully.`,
    );
  }

  if (unavailableTools.length > 0) {
    const toolNames = unavailableTools.map((result) => result.name).join(', ');
    lines.push(
      `Some tools are not connected yet: ${toolNames}. I kept the response safe and continued without external tool data.`,
    );
  }

  return lines.join('\n');
};

const getConfidenceLabel = (confidence: number) => {
  if (confidence >= 0.8) return 'high';
  if (confidence >= 0.55) return 'medium';
  return 'early';
};

const getUserRequestLine = (context: AurenContext) => {
  const message = cleanText(context.message);

  if (!message) {
    return 'No clear message was provided yet.';
  }

  if (message.length <= 140) {
    return `Request: “${message}”`;
  }

  return `Request: “${message.slice(0, 137)}...”`;
};

const buildAnswerSections = (
  context: AurenContext,
  plan: AurenPlan,
  toolResults: AurenToolResult[],
) => {
  const confidenceLabel = getConfidenceLabel(context.intent.confidence);
  const toolNote = getToolNote(toolResults);
  const planLines = getPlanLines(plan);
  const nextAction = getNextAction(plan);

  const sections = [
    getModeOpening(context),
    [
      getUserRequestLine(context),
      `Mode: ${context.mode}`,
      `Intent: ${context.intent.intent}`,
      `Confidence: ${confidenceLabel}`,
    ].join('\n'),
    getModeFocus(context),
    ['Plan:', ...planLines].join('\n'),
    `Best next action: ${nextAction}`,
    getMemoryNote(context),
  ];

  if (toolNote) {
    sections.push(toolNote);
  }

  sections.push('I can continue from here with one of the suggested actions.');

  return sections;
};

export const generateFinalResponse = (
  context: AurenContext,
  plan: AurenPlan,
  toolResults: AurenToolResult[],
): AurenResponseDraft => {
  const sections = buildAnswerSections(context, plan, toolResults);
  const answer = sections.filter(Boolean).join('\n\n');

  return {
    answer,
    suggestions: getModeSuggestions(context, plan),
  };
};
