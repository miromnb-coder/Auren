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
  AurenResponseEvaluation,
  AurenSuggestion,
  AurenToolResult,
} from './types';

const createAgentId = () => {
  return `auren_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
};

const createCompletedSteps = (): AurenAgentStep[] => {
  return [
    {
      id: 'understand-request',
      label: 'Understanding request',
      status: 'complete',
    },
    {
      id: 'select-mode',
      label: 'Selecting mode',
      status: 'complete',
    },
    {
      id: 'build-context',
      label: 'Building context',
      status: 'complete',
    },
    {
      id: 'create-plan',
      label: 'Creating plan',
      status: 'complete',
    },
    {
      id: 'generate-response',
      label: 'Generating response',
      status: 'complete',
    },
  ];
};

const getStringMetadataValue = (input: AurenAgentInput, key: string) => {
  const value = input.metadata?.[key];

  return typeof value === 'string' && value.trim() ? value.trim() : null;
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
}) => {
  const userId = input.agentInput.userId?.trim();

  if (!userId) {
    return input.resultId;
  }

  const chatId = getStringMetadataValue(input.agentInput, 'chatId');
  const messageId = getStringMetadataValue(input.agentInput, 'messageId');
  const completedAt = new Date().toISOString();

  const runResult = await supabase
    .from('auren_agent_runs')
    .insert({
      user_id: userId,
      chat_id: chatId,
      message_id: messageId,
      mode: input.mode,
      intent: input.intent,
      input: input.agentInput.message,
      answer: input.answer,
      confidence: input.confidence,
      status: 'completed',
      plan: input.plan,
      memory_used: input.memoryUsed,
      tools_used: input.toolResults.length > 0,
      metadata: {
        source: 'runAurenAgent',
        evaluation: input.evaluation,
        originalResultId: input.resultId,
      },
      started_at: input.createdAt,
      completed_at: completedAt,
    })
    .select('id')
    .single();

  if (runResult.error || !runResult.data?.id) {
    return input.resultId;
  }

  const runId = String(runResult.data.id);

  await Promise.all([
    input.steps.length > 0
      ? supabase.from('auren_agent_steps').insert(
          input.steps.map((step, index) => ({
            user_id: userId,
            run_id: runId,
            step_key: step.id,
            label: step.label,
            detail: step.detail ?? null,
            status: step.status,
            position: index,
            metadata: {},
            started_at: input.createdAt,
            completed_at: completedAt,
          })),
        )
      : Promise.resolve(),
    input.suggestions.length > 0
      ? supabase.from('auren_agent_suggestions').insert(
          input.suggestions.map((suggestion, index) => ({
            user_id: userId,
            run_id: runId,
            suggestion_key: suggestion.id,
            label: suggestion.label,
            action: suggestion.action,
            payload: suggestion.payload ?? {},
            position: index,
          })),
        )
      : Promise.resolve(),
    input.toolResults.length > 0
      ? supabase.from('auren_agent_tool_calls').insert(
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
        )
      : Promise.resolve(),
  ]);

  return runId;
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
  const toolResults = await executeTools(plan.suggestedToolCalls);
  const draft = generateFinalResponse(context, plan, toolResults);
  const evaluation = evaluateResponse(context, plan, draft);
  const steps = createCompletedSteps();
  const confidence = Math.min(intent.confidence, evaluation.score);
  const persistedId = await persistAgentRun({
    agentInput: input,
    resultId: fallbackId,
    answer: draft.answer,
    plan,
    steps,
    suggestions: draft.suggestions,
    toolResults,
    evaluation,
    createdAt,
    mode: context.mode,
    intent: intent.intent,
    confidence,
    memoryUsed: context.memory.used,
  });

  return {
    id: persistedId,
    answer: draft.answer,
    mode: context.mode,
    intent: intent.intent,
    confidence,
    steps,
    suggestions: draft.suggestions,
    memory: context.memory,
    tools: {
      used: toolResults.length > 0,
      results: toolResults,
    },
    plan,
    evaluation,
    context,
    createdAt,
  };
};
