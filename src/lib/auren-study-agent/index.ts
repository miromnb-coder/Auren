import { buildStudyAgentContext } from './context';
import { createStudyAgentResponse } from './response';
import { routeStudyIntent } from './router';
import type { StudyAgentInput, StudyAgentResult, StudyAgentRunOptions } from './types';

function createId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function nowIso() {
  return new Date().toISOString();
}

function emitThinking(options: StudyAgentRunOptions | undefined, params: {
  stage: 'understanding' | 'routing' | 'context' | 'planning' | 'writing' | 'finalizing';
  title: string;
  detail: string;
  sequence: number;
}) {
  options?.onEvent?.({
    type: 'thinking_state',
    thinking: {
      type: 'thinking_state',
      stage: params.stage,
      title: params.title,
      detail: params.detail,
      sequence: params.sequence,
      timestamp: nowIso(),
      metadata: {
        engine: 'auren-study-agent-v1',
      },
    },
  });
}

export async function runAurenStudyAgent(
  input: StudyAgentInput,
  options: StudyAgentRunOptions = {},
): Promise<StudyAgentResult> {
  const message = input.message.trim();

  emitThinking(options, {
    stage: 'understanding',
    title: 'Understanding your study request',
    detail: 'Finding the best way to help you learn or make progress...',
    sequence: 1,
  });

  const route = routeStudyIntent(message);

  emitThinking(options, {
    stage: 'routing',
    title: 'Choosing a study mode',
    detail: 'Matching your request to explanation, quiz, planning, focus, or review help...',
    sequence: 2,
  });

  const context = await buildStudyAgentContext(
    {
      ...input,
      message,
    },
    route,
  );

  emitThinking(options, {
    stage: 'context',
    title: 'Checking your study context',
    detail: context.study.available
      ? 'Looking at today’s focus, active tasks, and study progress...'
      : 'Preparing a clean study answer without connected study data...',
    sequence: 3,
  });

  emitThinking(options, {
    stage: 'planning',
    title: 'Creating the next study step',
    detail: 'Reducing this into one useful action you can take now...',
    sequence: 4,
  });

  emitThinking(options, {
    stage: 'writing',
    title: 'Writing your study response',
    detail: 'Keeping it clear, practical, and mobile-friendly...',
    sequence: 5,
  });

  const draft = await createStudyAgentResponse(context);
  const createdAt = nowIso();

  emitThinking(options, {
    stage: 'finalizing',
    title: 'Finishing response',
    detail: 'Preparing suggestions and next actions...',
    sequence: 6,
  });

  return {
    id: createId('study-agent-run'),
    answer: draft.answer,
    suggestions: draft.suggestions,
    actions: draft.actions,
    metadata: draft.metadata,
    intent: route.intent,
    confidence: route.confidence,
    context,
    createdAt,
  };
}

export type {
  StudyAgentAction,
  StudyAgentContext,
  StudyAgentIntent,
  StudyAgentResult,
  StudyAgentSuggestion,
} from './types';
