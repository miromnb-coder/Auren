import { orchestrateAurenAgent } from './orchestrator';
import type { AurenAgentInput, AurenAgentResult } from './types';

export const runAurenAgent = async (
  input: AurenAgentInput,
): Promise<AurenAgentResult> => {
  return orchestrateAurenAgent(input);
};
