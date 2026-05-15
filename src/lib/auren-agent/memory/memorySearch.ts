import type { AurenMemoryItem } from '../core/types';

export type MemorySearchInput = {
  userId?: string;
  query: string;
};

export const findRelevantMemoryItems = async (
  _input: MemorySearchInput,
): Promise<AurenMemoryItem[]> => {
  return [];
};
