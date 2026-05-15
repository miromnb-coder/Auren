import type {
  AurenAgentInput,
  AurenAgentRunOptions,
  AurenStreamEvent,
  AurenThinkingEvent,
  AurenThinkingStage,
} from '../core/types';
import { runAurenAgent } from '../core/runAurenAgent';

export type AurenStreamHandler = (event: AurenStreamEvent) => void;

export type CreateThinkingEventInput = {
  stage: AurenThinkingStage;
  title: string;
  detail: string;
  sequence: number;
  metadata?: Record<string, unknown>;
};

export const createThinkingEvent = (input: CreateThinkingEventInput): AurenThinkingEvent => {
  return {
    type: 'thinking_state',
    stage: input.stage,
    title: input.title,
    detail: input.detail,
    sequence: input.sequence,
    timestamp: new Date().toISOString(),
    ...(input.metadata ? { metadata: input.metadata } : {}),
  };
};

export const emitThinkingState = (
  onEvent: AurenStreamHandler | undefined,
  input: CreateThinkingEventInput,
) => {
  if (!onEvent) return createThinkingEvent(input);

  const thinking = createThinkingEvent(input);

  onEvent({
    type: 'thinking_state',
    thinking,
  });

  return thinking;
};

export const emitStep = (
  onEvent: AurenStreamHandler | undefined,
  message: string,
) => {
  onEvent?.({
    type: 'step',
    message,
  });
};

export const emitToken = (
  onEvent: AurenStreamHandler | undefined,
  message: string,
) => {
  if (!message) return;

  onEvent?.({
    type: 'token',
    message,
  });
};

export const emitError = (
  onEvent: AurenStreamHandler | undefined,
  error: unknown,
) => {
  onEvent?.({
    type: 'error',
    error: error instanceof Error ? error.message : 'Unknown Auren agent error.',
  });
};

export const streamAgentEvents = async (
  input: AurenAgentInput,
  onEvent: AurenStreamHandler,
  options: Omit<AurenAgentRunOptions, 'onEvent'> = {},
): Promise<void> => {
  emitStep(onEvent, 'Starting Auren.');

  try {
    const result = await runAurenAgent(input, {
      ...options,
      onEvent,
    });

    onEvent({
      type: 'result',
      result,
    });
  } catch (error) {
    emitError(onEvent, error);
  }
};
