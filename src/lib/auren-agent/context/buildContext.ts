import type {
  AurenAgentInput,
  AurenContext,
  AurenIntentResult,
  AurenMode,
} from '../core/types';
import { buildMemoryContext } from '../memory/memoryEngine';
import { getAvailableTools } from '../tools/toolRegistry';
import { getEnvironmentContext } from './environmentContext';
import { getStudyContext } from './studyContext';
import { getUserContext } from './userContext';

export const buildAurenContext = async (
  input: AurenAgentInput,
  intent: AurenIntentResult,
  mode: AurenMode,
): Promise<AurenContext> => {
  const [user, memory, study] = await Promise.all([
    getUserContext(input),
    buildMemoryContext(input),
    getStudyContext(input),
  ]);
  const userWithStudy = {
    ...user,
    preferences: {
      ...user.preferences,
      study,
    },
  };

  return {
    input,
    message: input.message,
    intent,
    mode,
    user: userWithStudy,
    environment: getEnvironmentContext(),
    conversation: input.conversation ?? [],
    memory,
    study,
    availableTools: getAvailableTools(),
    createdAt: new Date().toISOString(),
  };
};