import { supabase } from '../../supabase';
import { buildAurenContext } from '../context/buildContext';
import { evaluateResponse } from '../critic/evaluateResponse';
import { generateFinalResponse } from '../generator/finalResponse';
import { createPlan } from '../planner/planner';
import { routeIntent } from '../router/intentRouter';
import { selectMode } from '../router/modeSelector';
import { executeTools } from '../tools/executeTool';
import type {
  AurenAgentInput,
  AurenAgentResult,
  AurenAgentStep,
  AurenPlan,
  AurenResponseDraft,
  AurenResponseEvaluation,
  AurenSuggestion,
  AurenToolResult,
} from './types';

const MAX_DB_TEXT_LENGTH = 12000;
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type ResponseGenerationState = {
  draft: AurenResponseDraft;
  usedFallback: boolean;
  errorMessage?: string;
};

type ToolExecutionState = {
  results: AurenToolResult[];
  errorMessage?: string;
};

const createAgentId = () => {
  return `auren_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
};

const cleanText = (value: string | null | undefined) => {
  return value?.replace(/\s+/g, ' ').trim() ?? '';
};

const limitText = (value: string, maxLength = MAX_DB_TEXT_LENGTH) => {
  const cleaned = cleanText(value);

  if (cleaned.length <= maxLength) {
    return cleaned;
  }

  return `${cleaned.slice(0, maxLength - 1).trim()}…`;
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

const createCompletedSteps = (input?: {
  toolError?: string;
  responseUsedFallback?: boolean;
  responseError?: string;
}): AurenAgentStep[] => {
  return [
    createAgentStep('understand-request', 'Understanding request', 'complete'),
    createAgentStep('select-mode', 'Selecting mode', 'complete'),
    createAgentStep('build-context', 'Building context', 'complete'),
    createAgentStep(
      'execute-tools',
      'Checking tools',
      input?.toolError ? 'error' : 'complete',
      input?.toolError,
    ),
    createAgentStep('create-plan', 'Creating plan', 'complete'),
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

const getUuidMetadataValue = (input: AurenAgentInput, key: string) => {
  const value = getStringMetadataValue(input, key);

  if (!value || !UUID_PATTERN.test(value)) {
    return null;
  }

  return value;
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
    .slice(0, 4)
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

const createFallbackDraft = (
  input: AurenAgentInput,
  plan: AurenPlan,
  toolResults: AurenToolResult[],
): AurenResponseDraft => {
  const unavailableTools = toolResults.filter((result) => !result.success);
  const firstReadyStep = plan.steps.find((step) => step.status === 'ready') ?? plan.steps[0];

  if (unavailableTools.length > 0) {
    const toolNames = unavailableTools.map((result) => result.name).join(', ');

    return {
      answer: `I cannot use ${toolNames} yet, but I can still help with the next step.`,
      suggestions: createFallbackSuggestions(input, plan),
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
    };
  }

  return {
    answer: input.message.trim()
      ? 'I had trouble generating the full response, but I can still help continue from your last message.'
      : 'Send me a message and I’ll help with the next step.',
    suggestions: createFallbackSuggestions(input, plan),
  };
};

const createFallbackEvaluation = (errorMessage?: string): AurenResponseEvaluation => {
  return {
    passed: false,
    score: 0.42,
    issues: [errorMessage ?? 'Response evaluation failed.'],
    recommendations: ['Use the safe fallback response and continue without crashing the agent.'],
  };
};

const safeExecuteTools = async (plan: AurenPlan): Promise<ToolExecutionState> => {
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
  context: Parameters<typeof generateFinalResponse>[0],
  toolResults: AurenToolResult[],
): Promise<ResponseGenerationState> => {
  try {
    const draft = await generateFinalResponse(context, plan, toolResults);

    if (!cleanText(draft.answer)) {
      return {
        draft: createFallbackDraft(input, plan, toolResults),
        usedFallback: true,
        errorMessage: 'The response generator returned an empty answer.',
      };
    }

    return {
      draft,
      usedFallback: false,
    };
  } catch (error) {
    return {
      draft: createFallbackDraft(input, plan, toolResults),
      usedFallback: true,
      errorMessage: error instanceof Error ? error.message : 'Response generation failed.',
    };
  }
};

const safeEvaluateResponse = (
  context: Parameters<typeof evaluateResponse>[0],
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
  responseUsedFallback: boolean;
  responseError?: string;
  toolError?: string;
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
        error_message: input.responseError ?? input.toolError ?? null,
        metadata: {
          source: 'runAurenAgent',
          evaluation: input.evaluation,
          originalResultId: input.resultId,
          responseUsedFallback: input.responseUsedFallback,
          responseError: input.responseError,
          toolError: input.toolError,
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
                  source: 'runAurenAgent',
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
): Promise<AurenAgentResult> => {
  const createdAt = new Date().toISOString();
  const fallbackId = createAgentId();

  const intent = routeIntent(input.message);
  const selectedMode = selectMode(input.mode, intent);
  const context = await buildAurenContext(input, intent, selectedMode.mode);
  const plan = createPlan(context);

  const toolState = await safeExecuteTools(plan);
  const responseState = await safeGenerateFinalResponse(input, plan, context, toolState.results);
  const evaluation = safeEvaluateResponse(context, plan, responseState.draft);
  const steps = createCompletedSteps({
    toolError: toolState.errorMessage,
    responseUsedFallback: responseState.usedFallback,
    responseError: responseState.errorMessage,
  });

  const confidence = Math.min(
    intent.confidence,
    evaluation.score,
    responseState.usedFallback ? 0.55 : 0.98,
  );

  const persistedId = await persistAgentRun({
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
    responseUsedFallback: responseState.usedFallback,
    responseError: responseState.errorMessage,
    toolError: toolState.errorMessage,
  });

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
