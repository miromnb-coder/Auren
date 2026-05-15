import { orchestrateAurenAgent } from './orchestrator';
import type { AurenAgentInput, AurenAgentResult, AurenAgentRunOptions } from './types';

export const runAurenAgent = async (
  input: AurenAgentInput,
  options: AurenAgentRunOptions = {},
): Promise<AurenAgentResult> => {
  return orchestrateAurenAgent(input, options);
};
