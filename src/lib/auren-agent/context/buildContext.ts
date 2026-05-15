import type {
  AurenAgentInput,
  AurenContext,
  AurenIntentResult,
  AurenMode,
} from '../core/types';
import { buildMemoryContext } from '../memory/memoryEngine';
import { getAvailableTools } from '../tools/toolRegistry';
import { getEnvironmentContext } from './environmentContext';
import { getUserContext } from './userContext';

export const buildAurenContext = async (
  input: AurenAgentInput,
  intent: AurenIntentResult,
  mode: AurenMode,
): Promise<AurenContext> => {
  const [user, memory] = await Promise.all([
    getUserContext(input),
    buildMemoryContext(input),
  ]);

  return {
    input,
    message: input.message,
    intent,
    mode,
    user,
    environment: getEnvironmentContext(),
    conversation: input.conversation ?? [],
    memory,
    availableTools: getAvailableTools(),
    createdAt: new Date().toISOString(),
  };
};
