import { buildAurenContext } from '../context/buildContext';
import { evaluateResponse } from '../critic/evaluateResponse';
import { generateFinalResponse } from '../generator/finalResponse';
import { createPlan } from '../planner/planner';
import { routeIntent } from '../router/intentRouter';
import { selectMode } from '../router/modeSelector';
import { executeTools } from '../tools/executeTool';
import type { AurenAgentInput, AurenAgentResult, AurenAgentStep } from './types';

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

export const orchestrateAurenAgent = async (
  input: AurenAgentInput,
): Promise<AurenAgentResult> => {
  const createdAt = new Date().toISOString();
  const intent = routeIntent(input.message);
  const selectedMode = selectMode(input.mode, intent);
  const context = await buildAurenContext(input, intent, selectedMode.mode);
  const plan = createPlan(context);
  const toolResults = await executeTools(plan.suggestedToolCalls);
  const draft = generateFinalResponse(context, plan, toolResults);
  const evaluation = evaluateResponse(context, plan, draft);

  return {
    id: createAgentId(),
    answer: draft.answer,
    mode: context.mode,
    intent: intent.intent,
    confidence: Math.min(intent.confidence, evaluation.score),
    steps: createCompletedSteps(),
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
