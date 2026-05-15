import type { AurenMemoryItem } from '../core/types';

export type MemoryWriteInput = {
  userId?: string;
  item: Omit<AurenMemoryItem, 'id' | 'createdAt'>;
};

export const writeMemoryItem = async (
  _input: MemoryWriteInput,
): Promise<AurenMemoryItem | null> => {
  return null;
};
