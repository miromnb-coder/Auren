import type { AurenAgentInput, AurenMemoryResult } from '../core/types';
import { rankMemoryItems } from './memoryRanker';
import { findRelevantMemoryItems } from './memorySearch';

export const buildMemoryContext = async (
  input: AurenAgentInput,
): Promise<AurenMemoryResult> => {
  const candidates = await findRelevantMemoryItems({
    userId: input.userId,
    query: input.message,
  });

  const items = rankMemoryItems(candidates).slice(0, 6);

  return {
    used: items.length > 0,
    saved: false,
    items,
    candidates,
    note: 'Memory Lite is scaffolded. Persistent memory can be connected later.',
  };
};
