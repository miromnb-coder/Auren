import type { AurenAgentInput, AurenStreamEvent } from '../core/types';
import { runAurenAgent } from '../core/runAurenAgent';

export type AurenStreamHandler = (event: AurenStreamEvent) => void;

export const streamAgentEvents = async (
  input: AurenAgentInput,
  onEvent: AurenStreamHandler,
): Promise<void> => {
  onEvent({
    type: 'step',
    message: 'Starting Auren Agent v0.1.',
  });

  try {
    const result = await runAurenAgent(input);

    onEvent({
      type: 'result',
      result,
    });
  } catch (error) {
    onEvent({
      type: 'error',
      error: error instanceof Error ? error.message : 'Unknown Auren agent error.',
    });
  }
};
