import { supabase } from '../../supabase';
import { buildAurenContext } from '../context/buildContext';
import { evaluateResponse } from '../critic/evaluateResponse';
import { generateFinalResponse } from '../generator/finalResponse';
import { createPlan } from '../planner/planner';
import { routeIntent, routeIntentHybrid } from '../router/intentRouter';
import { createThinkingStatus } from '../streaming/thinkingStatusWriter';
import { selectMode } from '../router/modeSelector';
import { executeTools } from '../tools/executeTool';
import type {
  AurenAgentInput,
  AurenAgentResult,
  AurenAgentRunOptions,
  AurenAgentStep,
  AurenPlan,
  AurenPlanStep,
  AurenResponseDraft,
  AurenResponseEvaluation,
  AurenResponseMetadata,
  AurenSuggestion,
  AurenThinkingStage,
  AurenToolResult,
} from './types';

type AurenBuiltContext = Awaited<ReturnType<typeof buildAurenContext>>;

type ResponseGenerationState = {
  draft: AurenResponseDraft;
  usedFallback: boolean;
  errorMessage?: string;
  metadata?: AurenResponseMetadata;
};

type ToolExecutionState = {
  results: AurenToolResult[];
  errorMessage?: string;
};

type PlanGenerationState = {
  plan: AurenPlan;
  usedFallback: boolean;
  errorMessage?: string;
};

type RouteState = {
  intent: ReturnType<typeof routeIntent>;
  usedFallback: boolean;
  errorMessage?: string;
};

type RunTimings = Record<string, number>;

type ThinkingEmitter = (input: {
  stage: AurenThinkingStage;
  mode?: AurenBuiltContext['mode'];
  intent?: ReturnType<typeof routeIntent>['intent'];
  message: string;
  planGoal?: string;
  toolNames?: string[];
  metadata?: Record<string, unknown>;
}) => Promise<void>;

const MAX_DB_TEXT_LENGTH = 12000;
const MAX_VISIBLE_ANSWER_LENGTH = 10000;
const MAX_SUGGESTIONS = 4;
const DEFAULT_PLAN_MAX_STEPS = 4;
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const createAgentId = () => {
  return `auren_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
};

const nowMs = () => Date.now();

const cleanText = (value: string | null | undefined) => {
  return value?.replace(/\s+/g, ' ').trim() ?? '';
};

const cleanAnswerText = (value: string | null | undefined) => {
  return (
    value
      ?.replace(/\r\n/g, '\n')
      .replace(/\r/g, '\n')
      .replace(/[ \t]+/g, ' ')
      .replace(/ *\n */g, '\n')
      .replace(/\n{3,}/g, '\n\n')
      .trim() ?? ''
  );
};

const limitText = (value: string, maxLength = MAX_DB_TEXT_LENGTH) => {
  const cleaned = cleanText(value);

  if (cleaned.length <= maxLength) {
    return cleaned;
  }

  return `${cleaned.slice(0, maxLength - 1).trim()}…`;
};

const limitAnswer = (value: string, maxLength = MAX_VISIBLE_ANSWER_LENGTH) => {
  const cleaned = cleanAnswerText(value);

  if (cleaned.length <= maxLength) {
    return cleaned;
  }

  return `${cleaned.slice(0, maxLength - 1).trim()}…`;
};

const clampConfidence = (value: number) => {
  if (!Number.isFinite(value)) {
    return 0.42;
  }

  return Math.max(0.05, Math.min(value, 0.98));
};

const measureAsync = async <T>(
  timings: RunTimings,
  key: string,
  task: () => Promise<T>,
): Promise<T> => {
  const startedAt = nowMs();

  try {
    return await task();
  } finally {
    timings[key] = nowMs() - startedAt;
  }
};

const measureSync = <T>(
  timings: RunTimings,
  key: string,
  task: () => T,
): T => {
  const startedAt = nowMs();

  try {
    return task();
  } finally {
    timings[key] = nowMs() - startedAt;
  }
};

const createAgentStep = (
  id: string,
  label: string,
  status: AurenAgentStep['status'],
  detail?: string,
): AurenAgentStep => {
  return {
    id,
    label,
    status,
    ...(detail ? { detail } : {}),
  };
};

const createPlanStep = (
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

const createCompletedSteps = (input?: {
  routeError?: string;
  planUsedFallback?: boolean;
  planError?: string;
  toolError?: string;
  responseUsedFallback?: boolean;
  responseError?: string;
}): AurenAgentStep[] => {
  return [
    createAgentStep(
      'route-intent',
      'Routing intent',
      input?.routeError ? 'error' : 'complete',
      input?.routeError,
    ),
    createAgentStep('select-mode', 'Selecting mode', 'complete'),
    createAgentStep('build-context', 'Building context', 'complete'),
    createAgentStep(
      'create-plan',
      'Creating plan',
      input?.planUsedFallback ? 'error' : 'complete',
      input?.planError,
    ),
    createAgentStep(
      'execute-tools',
      'Checking tools',
      input?.toolError ? 'error' : 'complete',
      input?.toolError,
    ),
    createAgentStep(
      'generate-response',
      'Generating response',
      input?.responseUsedFallback ? 'error' : 'complete',
      input?.responseError,
    ),
  ];
};

const getStringMetadataValue = (input: AurenAgentInput, key: string) => {
  const value = input.metadata?.[key];

  return typeof value === 'string' && value.trim() ? value.trim() : null;
};

const getNumberMetadataValue = (input: AurenAgentInput, key: string) => {
  const value = input.metadata?.[key];

  return typeof value === 'number' && Number.isFinite(value) ? value : null;
};

const getBooleanMetadataValue = (input: AurenAgentInput, key: string) => {
  const value = input.metadata?.[key];

  return typeof value === 'boolean' ? value : null;
};

const getUuidMetadataValue = (input: AurenAgentInput, key: string) => {
  const value = getStringMetadataValue(input, key);

  if (!value || !UUID_PATTERN.test(value)) {
    return null;
  }

  return value;
};

const getPlanMaxSteps = (input: AurenAgentInput) => {
  const value = getNumberMetadataValue(input, 'maxSteps');

  if (!value) {
    return DEFAULT_PLAN_MAX_STEPS;
  }

  return Math.max(1, Math.min(Math.floor(value), 6));
};

const createFallbackSuggestion = (
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
    const id = cleanText(suggestion.id);
    const label = cleanText(suggestion.label);
    const action = cleanText(suggestion.action);

    if (!id || !label || !action) {
      continue;
    }

    const key = action || id;

    if (!uniqueSuggestions.has(key)) {
      uniqueSuggestions.set(key, {
        ...suggestion,
        id,
        label: limitText(label, 42),
        action,
      });
    }
  }

  return Array.from(uniqueSuggestions.values()).slice(0, MAX_SUGGESTIONS);
};

const createFallbackSuggestions = (
  input: AurenAgentInput,
  plan: AurenPlan,
): AurenSuggestion[] => {
  const basePayload = {
    mode: input.mode,
    planGoal: plan.goal,
  };

  const planSuggestions = plan.steps
    .filter((step) => cleanText(step.title))
    .slice(0, MAX_SUGGESTIONS)
    .map((step, index) =>
      createFallbackSuggestion(
        `plan_step_${index + 1}`,
        limitText(step.title, 32),
        `plan_step_${index + 1}`,
        basePayload,
      ),
    );

  if (planSuggestions.length > 0) {
    return planSuggestions;
  }

  return [
    createFallbackSuggestion('continue', 'Continue', 'continue', basePayload),
    createFallbackSuggestion('make_plan', 'Make a plan', 'make_plan', basePayload),
  ];
};

const normalizeDraft = (
  input: AurenAgentInput,
  plan: AurenPlan,
  draft: AurenResponseDraft,
): AurenResponseDraft => {
  const answer = limitAnswer(draft.answer);
  const suggestions = dedupeSuggestions(draft.suggestions ?? []);

  return {
    answer,
    suggestions:
      suggestions.length > 0
        ? suggestions
        : createFallbackSuggestions(input, plan),
    ...(draft.metadata ? { metadata: draft.metadata } : {}),
  };
};

const createSafeFallbackPlan = (
  input: AurenAgentInput,
  context: AurenBuiltContext,
): AurenPlan => {
  const message = cleanText(input.message);

  return {
    goal: message
      ? `Help the user move forward safely: ${message}`
      : 'Help the user clarify what they want to do next.',
    summary: 'Auren created a safe fallback plan because the normal planner failed.',
    steps: [
      createPlanStep(
        'understand-request',
        'Understand request',
        'Identify what the user is asking for and avoid making assumptions.',
      ),
      ...(context.memory.items.length > 0
        ? [
            createPlanStep(
              'use-relevant-memory',
              'Use relevant memory',
              'Apply saved context only if it improves the answer.',
            ),
          ]
        : []),
      createPlanStep(
        'respond-safely',
        'Respond safely',
        'Give a helpful answer without relying on failed planning logic.',
      ),
    ],
    suggestedToolCalls: [],
  };
};

const createInternalFallbackMetadata = (fallbackReason: string): AurenResponseMetadata => {
  return {
    fallback: true,
    fallbackReason,
    debug: {
      fallback: true,
      fallbackReason,
      source: 'orchestrator.createFallbackDraft',
    },
  };
};

const createFallbackDraft = (
  input: AurenAgentInput,
  plan: AurenPlan,
  toolResults: AurenToolResult[],
  fallbackReason = 'orchestrator_fallback',
): AurenResponseDraft => {
  const unavailableTools = toolResults.filter((result) => !result.success);
  const firstReadyStep = plan.steps.find((step) => step.status === 'ready') ?? plan.steps[0];
  const metadata = createInternalFallbackMetadata(fallbackReason);

  if (unavailableTools.length > 0) {
    const toolNames = unavailableTools.map((result) => result.name).join(', ');

    return {
      answer: `I cannot use ${toolNames} yet, but I can still help with the next step.`,
      suggestions: createFallbackSuggestions(input, plan),
      metadata,
    };
  }

  if (firstReadyStep) {
    const title = cleanText(firstReadyStep.title);
    const description = cleanText(firstReadyStep.description);
    const answer = [title, description].filter(Boolean).join(': ');

    return {
      answer:
        answer ||
        'I had trouble generating the full response, but I can still help continue from your last message.',
      suggestions: createFallbackSuggestions(input, plan),
      metadata,
    };
  }

  return {
    answer: input.message.trim()
      ? 'I had trouble generating the full response, but I can still help continue from your last message.'
      : 'Send me a message and I’ll help with the next step.',
    suggestions: createFallbackSuggestions(input, plan),
    metadata,
  };
};

const getResponseFallbackReason = (draft: AurenResponseDraft) => {
  return (
    draft.metadata?.fallbackReason ??
    (typeof draft.metadata?.debug?.fallbackReason === 'string'
      ? draft.metadata.debug.fallbackReason
      : undefined)
  );
};

const isResponseFallback = (draft: AurenResponseDraft) => {
  return draft.metadata?.fallback === true || draft.metadata?.debug?.fallback === true;
};

const createFallbackEvaluation = (errorMessage?: string): AurenResponseEvaluation => {
  return {
    passed: false,
    score: 0.42,
    issues: [errorMessage ?? 'Response evaluation failed.'],
    recommendations: ['Use the safe fallback response and continue without crashing the agent.'],
  };
};

const createThinkingEmitter = (
  input: AurenAgentInput,
  options?: AurenAgentRunOptions,
): ThinkingEmitter => {
  let sequence = 0;

  return async (thinkingInput) => {
    if (!options?.onEvent) return;

    const copy = await createThinkingStatus({
      stage: thinkingInput.stage,
      mode: thinkingInput.mode,
      intent: thinkingInput.intent,
      message: thinkingInput.message,
      planGoal: thinkingInput.planGoal,
      toolNames: thinkingInput.toolNames,
    });

    sequence += 1;

    options.onEvent({
      type: 'thinking_state',
      thinking: {
        type: 'thinking_state',
        stage: thinkingInput.stage,
        title: copy.title,
        detail: copy.detail,
        sequence,
        timestamp: new Date().toISOString(),
        metadata: {
          source: 'orchestrateAurenAgent',
          userId: input.userId,
          ...(thinkingInput.metadata ?? {}),
        },
      },
    });
  };
};

const safeRouteIntent = async (
  input: AurenAgentInput,
): Promise<RouteState> => {
  const enableLLMRouter = getBooleanMetadataValue(input, 'enableLLMRouter');

  try {
    const intent = await routeIntentHybrid(input.message, {
      userId: input.userId,
      mode: input.mode,
      conversation: input.conversation,
      enableLLM: enableLLMRouter ?? true,
    });

    return {
      intent,
      usedFallback: false,
    };
  } catch (error) {
    const fallbackIntent = routeIntent(input.message);
    const errorMessage =
      error instanceof Error ? error.message : 'Hybrid intent routing failed.';

    return {
      intent: {
        ...fallbackIntent,
        reason: `${fallbackIntent.reason} Hybrid router failed, so Auren used the fast route.`,
      },
      usedFallback: true,
      errorMessage,
    };
  }
};

const safeCreatePlan = (
  input: AurenAgentInput,
  context: AurenBuiltContext,
): PlanGenerationState => {
  try {
    const plan = createPlan(context, {
      maxSteps: getPlanMaxSteps(input),
    });

    return {
      plan,
      usedFallback: false,
    };
  } catch (error) {
    return {
      plan: createSafeFallbackPlan(input, context),
      usedFallback: true,
      errorMessage: error instanceof Error ? error.message : 'Plan creation failed.',
    };
  }
};

const safeExecuteTools = async (plan: AurenPlan): Promise<ToolExecutionState> => {
  if (plan.suggestedToolCalls.length === 0) {
    return {
      results: [],
    };
  }

  try {
    return {
      results: await executeTools(plan.suggestedToolCalls),
    };
  } catch (error) {
    return {
      results: [],
      errorMessage: error instanceof Error ? error.message : 'Tool execution failed.',
    };
  }
};

const safeGenerateFinalResponse = async (
  input: AurenAgentInput,
  plan: AurenPlan,
  context: AurenBuiltContext,
  toolResults: AurenToolResult[],
): Promise<ResponseGenerationState> => {
  try {
    const rawDraft = await generateFinalResponse(context, plan, toolResults);
    const draft = normalizeDraft(input, plan, rawDraft);

    if (!cleanAnswerText(draft.answer)) {
      const fallbackDraft = createFallbackDraft(
        input,
        plan,
        toolResults,
        'empty_response_from_generator',
      );

      return {
        draft: fallbackDraft,
        usedFallback: true,
        errorMessage: 'The response generator returned an empty answer.',
        metadata: fallbackDraft.metadata,
      };
    }

    const responseUsedFallback = isResponseFallback(draft);
    const fallbackReason = getResponseFallbackReason(draft);

    return {
      draft,
      usedFallback: responseUsedFallback,
      errorMessage: responseUsedFallback ? fallbackReason ?? 'Response generator used fallback.' : undefined,
      metadata: draft.metadata,
    };
  } catch (error) {
    const fallbackDraft = createFallbackDraft(
      input,
      plan,
      toolResults,
      error instanceof Error ? error.message : 'response_generation_exception',
    );

    return {
      draft: fallbackDraft,
      usedFallback: true,
      errorMessage: error instanceof Error ? error.message : 'Response generation failed.',
      metadata: fallbackDraft.metadata,
    };
  }
};

const safeEvaluateResponse = (
  context: AurenBuiltContext,
  plan: AurenPlan,
  draft: AurenResponseDraft,
): AurenResponseEvaluation => {
  try {
    return evaluateResponse(context, plan, draft);
  } catch (error) {
    return createFallbackEvaluation(error instanceof Error ? error.message : undefined);
  }
};

const safeDbTask = async (task: PromiseLike<unknown>) => {
  try {
    const result = await task;
    const maybeResult = result as { error?: unknown };

    if (maybeResult?.error) {
      console.warn('Auren persistence subtask failed', maybeResult.error);
    }
  } catch (error) {
    console.warn('Auren persistence subtask threw', error);
  }
};

const persistAgentRun = async (input: {
  agentInput: AurenAgentInput;
  resultId: string;
  answer: string;
  plan: AurenPlan;
  steps: AurenAgentStep[];
  suggestions: AurenSuggestion[];
  toolResults: AurenToolResult[];
  evaluation: AurenResponseEvaluation;
  createdAt: string;
  mode: AurenAgentResult['mode'];
  intent: AurenAgentResult['intent'];
  confidence: number;
  memoryUsed: boolean;
  routeUsedFallback: boolean;
  routeError?: string;
  planUsedFallback: boolean;
  planError?: string;
  responseUsedFallback: boolean;
  responseError?: string;
  responseMetadata?: AurenResponseMetadata;
  toolError?: string;
  timings: RunTimings;
}) => {
  const userId = input.agentInput.userId?.trim();

  if (!userId) {
    return input.resultId;
  }

  try {
    const chatId = getUuidMetadataValue(input.agentInput, 'chatId');
    const messageId = getUuidMetadataValue(input.agentInput, 'messageId');
    const completedAt = new Date().toISOString();

    const runResult = await supabase
      .from('auren_agent_runs')
      .insert({
        user_id: userId,
        chat_id: chatId,
        message_id: messageId,
        mode: input.mode,
        intent: input.intent,
        input: limitText(input.agentInput.message),
        answer: limitText(input.answer),
        confidence: input.confidence,
        status: 'completed',
        plan: input.plan,
        memory_used: input.memoryUsed,
        tools_used: input.toolResults.length > 0,
        error_message:
          input.routeError ??
          input.planError ??
          input.responseError ??
          input.toolError ??
          null,
        metadata: {
          source: 'orchestrateAurenAgent',
          router: {
            hybrid: true,
            usedFallback: input.routeUsedFallback,
            error: input.routeError,
          },
          planner: {
            usedFallback: input.planUsedFallback,
            error: input.planError,
          },
          response: {
            usedFallback: input.responseUsedFallback,
            error: input.responseError,
            metadata: input.responseMetadata,
            fallbackReason: input.responseMetadata?.fallbackReason,
            groqStatus: input.responseMetadata?.groqStatus,
            groqError: input.responseMetadata?.groqError,
            groqErrorType: input.responseMetadata?.groqErrorType,
            model: input.responseMetadata?.model,
          },
          tools: {
            error: input.toolError,
            resultCount: input.toolResults.length,
            suggestedCount: input.plan.suggestedToolCalls.length,
          },
          evaluation: input.evaluation,
          timings: input.timings,
          originalResultId: input.resultId,
        },
        started_at: input.createdAt,
        completed_at: completedAt,
      })
      .select('id')
      .single();

    if (runResult.error || !runResult.data?.id) {
      console.warn('Auren run persistence failed', runResult.error);
      return input.resultId;
    }

    const runId = String(runResult.data.id);

    await Promise.all([
      input.steps.length > 0
        ? safeDbTask(
            supabase.from('auren_agent_steps').insert(
              input.steps.map((step, index) => ({
                user_id: userId,
                run_id: runId,
                step_key: step.id,
                label: step.label,
                detail: step.detail ?? null,
                status: step.status,
                position: index,
                metadata: {
                  source: 'orchestrateAurenAgent',
                },
                started_at: input.createdAt,
                completed_at: completedAt,
              })),
            ),
          )
        : Promise.resolve(),

      input.suggestions.length > 0
        ? safeDbTask(
            supabase.from('auren_agent_suggestions').insert(
              input.suggestions.map((suggestion, index) => ({
                user_id: userId,
                run_id: runId,
                suggestion_key: suggestion.id,
                label: suggestion.label,
                action: suggestion.action,
                payload: suggestion.payload ?? {},
                position: index,
              })),
            ),
          )
        : Promise.resolve(),

      input.toolResults.length > 0
        ? safeDbTask(
            supabase.from('auren_agent_tool_calls').insert(
              input.toolResults.map((toolResult) => ({
                user_id: userId,
                run_id: runId,
                tool_name: toolResult.name,
                input: {},
                output: toolResult.data ?? {},
                success: toolResult.success,
                status: toolResult.status,
                error_message: toolResult.success ? null : toolResult.message,
                started_at: input.createdAt,
                completed_at: completedAt,
              })),
            ),
          )
        : Promise.resolve(),
    ]);

    return runId;
  } catch (error) {
    console.warn('Auren run persistence threw', error);
    return input.resultId;
  }
};

export const orchestrateAurenAgent = async (
  input: AurenAgentInput,
  options: AurenAgentRunOptions = {},
): Promise<AurenAgentResult> => {
  const createdAt = new Date().toISOString();
  const fallbackId = createAgentId();
  const timings: RunTimings = {};
  const totalStartedAt = nowMs();
  const emitThinking = createThinkingEmitter(input, options);

  await emitThinking({
    stage: 'understanding',
    message: input.message,
  });

  const routeState = await measureAsync(timings, 'routeIntentMs', async () => {
    await emitThinking({
      stage: 'routing',
      message: input.message,
    });

    return safeRouteIntent(input);
  });
  const intent = routeState.intent;

  const selectedMode = measureSync(timings, 'selectModeMs', () => selectMode(input.mode, intent));

  const context = await measureAsync(timings, 'buildContextMs', async () => {
    await emitThinking({
      stage: 'context',
      mode: selectedMode.mode,
      intent: intent.intent,
      message: input.message,
    });

    await emitThinking({
      stage: 'memory',
      mode: selectedMode.mode,
      intent: intent.intent,
      message: input.message,
    });

    return buildAurenContext(input, intent, selectedMode.mode);
  });

  const planState = measureSync(timings, 'createPlanMs', () => safeCreatePlan(input, context));
  const plan = planState.plan;

  await emitThinking({
    stage: 'planning',
    mode: context.mode,
    intent: intent.intent,
    message: input.message,
    planGoal: plan.goal,
  });

  const toolState = await measureAsync(timings, 'executeToolsMs', async () => {
    if (plan.suggestedToolCalls.length > 0) {
      await emitThinking({
        stage: 'tools',
        mode: context.mode,
        intent: intent.intent,
        message: input.message,
        planGoal: plan.goal,
        toolNames: plan.suggestedToolCalls.map((call) => call.name),
      });
    }

    return safeExecuteTools(plan);
  });

  await emitThinking({
    stage: 'writing',
    mode: context.mode,
    intent: intent.intent,
    message: input.message,
    planGoal: plan.goal,
  });

  const responseState = await measureAsync(timings, 'generateResponseMs', () =>
    safeGenerateFinalResponse(input, plan, context, toolState.results),
  );

  await emitThinking({
    stage: 'finalizing',
    mode: context.mode,
    intent: intent.intent,
    message: input.message,
    planGoal: plan.goal,
  });

  const evaluation = measureSync(timings, 'evaluateResponseMs', () =>
    safeEvaluateResponse(context, plan, responseState.draft),
  );

  timings.totalBeforePersistenceMs = nowMs() - totalStartedAt;

  const steps = createCompletedSteps({
    routeError: routeState.errorMessage,
    planUsedFallback: planState.usedFallback,
    planError: planState.errorMessage,
    toolError: toolState.errorMessage,
    responseUsedFallback: responseState.usedFallback,
    responseError: responseState.errorMessage,
  });

  const confidence = clampConfidence(
    Math.min(
      intent.confidence,
      evaluation.score,
      routeState.usedFallback ? 0.72 : 0.98,
      planState.usedFallback ? 0.68 : 0.98,
      responseState.usedFallback ? 0.55 : 0.98,
    ),
  );

  const persistedId = await measureAsync(timings, 'persistRunMs', () =>
    persistAgentRun({
      agentInput: input,
      resultId: fallbackId,
      answer: responseState.draft.answer,
      plan,
      steps,
      suggestions: responseState.draft.suggestions,
      toolResults: toolState.results,
      evaluation,
      createdAt,
      mode: context.mode,
      intent: intent.intent,
      confidence,
      memoryUsed: context.memory.used,
      routeUsedFallback: routeState.usedFallback,
      routeError: routeState.errorMessage,
      planUsedFallback: planState.usedFallback,
      planError: planState.errorMessage,
      responseUsedFallback: responseState.usedFallback,
      responseError: responseState.errorMessage,
      responseMetadata: responseState.metadata,
      toolError: toolState.errorMessage,
      timings,
    }),
  );

  timings.totalMs = nowMs() - totalStartedAt;

  return {
    id: persistedId,
    answer: responseState.draft.answer,
    mode: context.mode,
    intent: intent.intent,
    confidence,
    steps,
    suggestions: responseState.draft.suggestions,
    memory: context.memory,
    tools: {
      used: toolState.results.length > 0,
      results: toolState.results,
    },
    plan,
    evaluation,
    context,
    createdAt,
  };
};
