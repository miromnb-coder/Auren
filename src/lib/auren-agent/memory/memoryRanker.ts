import type { AurenMemoryItem } from '../core/types';

export const rankMemoryItems = (items: AurenMemoryItem[]): AurenMemoryItem[] => {
  return [...items].sort((left, right) => right.confidence - left.confidence);
};
