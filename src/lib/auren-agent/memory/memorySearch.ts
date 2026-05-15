import { supabase } from '../../supabase';
import type { AurenMemoryItem, AurenMemoryType } from '../core/types';

export type MemorySearchInput = {
  userId?: string;
  query: string;
};

type MemorySource = NonNullable<AurenMemoryItem['source']>;

type MemoryRow = {
  id: string;
  type: string;
  text: string;
  confidence: number | null;
  source: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
  updated_at?: string;
  last_used_at?: string | null;
};

const MAX_SEARCH_RESULTS = 16;

const VALID_MEMORY_TYPES: AurenMemoryType[] = [
  'user_preference',
  'study_goal',
  'active_project',
  'important_fact',
  'habit',
  'unknown',
];

const VALID_MEMORY_SOURCES: MemorySource[] = ['chat', 'system', 'tool'];

const normalizeMemoryType = (value: string | null | undefined): AurenMemoryType => {
  if (VALID_MEMORY_TYPES.includes(value as AurenMemoryType)) {
    return value as AurenMemoryType;
  }

  return 'important_fact';
};

const normalizeMemorySource = (value: string | null | undefined): MemorySource => {
  if (VALID_MEMORY_SOURCES.includes(value as MemorySource)) {
    return value as MemorySource;
  }

  return 'chat';
};

const normalizeText = (value: string) => {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
};

const tokenize = (value: string) => {
  return normalizeText(value)
    .split(' ')
    .map((token) => token.trim())
    .filter((token) => token.length >= 3);
};

const toMemoryItem = (row: MemoryRow, boostedConfidence?: number): AurenMemoryItem => {
  return {
    id: row.id,
    type: normalizeMemoryType(row.type),
    text: row.text,
    confidence:
      typeof boostedConfidence === 'number'
        ? Math.max(0, Math.min(boostedConfidence, 0.98))
        : typeof row.confidence === 'number'
          ? row.confidence
          : 0.72,
    createdAt: row.created_at,
    source: normalizeMemorySource(row.source),
    metadata: row.metadata ?? {},
  };
};

const scoreMemoryRow = (row: MemoryRow, query: string) => {
  const normalizedQuery = normalizeText(query);
  const normalizedMemory = normalizeText(row.text);
  const baseConfidence = typeof row.confidence === 'number' ? row.confidence : 0.72;

  if (!normalizedQuery || !normalizedMemory) {
    return baseConfidence;
  }

  if (normalizedMemory.includes(normalizedQuery) || normalizedQuery.includes(normalizedMemory)) {
    return baseConfidence + 3;
  }

  const queryTokens = new Set(tokenize(normalizedQuery));
  const memoryTokens = tokenize(normalizedMemory);

  if (queryTokens.size === 0 || memoryTokens.length === 0) {
    return baseConfidence;
  }

  const overlap = memoryTokens.filter((token) => queryTokens.has(token)).length;
  const overlapScore = overlap / Math.max(queryTokens.size, 1);

  return baseConfidence + overlapScore * 2;
};

const markMemoryItemsUsed = async (userId: string, memoryIds: string[]) => {
  if (memoryIds.length === 0) return;

  const now = new Date().toISOString();

  await supabase
    .from('auren_memory_items')
    .update({ last_used_at: now })
    .eq('user_id', userId)
    .in('id', memoryIds);

  await supabase.from('auren_memory_events').insert(
    memoryIds.map((memoryId) => ({
      user_id: userId,
      memory_id: memoryId,
      event_type: 'used',
      reason: 'Used by Auren Memory Engine search.',
      metadata: {
        engine: 'memory-lite',
      },
    })),
  );
};

export const findRelevantMemoryItems = async (
  input: MemorySearchInput,
): Promise<AurenMemoryItem[]> => {
  const userId = input.userId?.trim();

  if (!userId) {
    return [];
  }

  const result = await supabase
    .from('auren_memory_items')
    .select('id, type, text, confidence, source, metadata, created_at, updated_at, last_used_at')
    .eq('user_id', userId)
    .is('archived_at', null)
    .order('pinned', { ascending: false })
    .order('updated_at', { ascending: false })
    .limit(80);

  if (result.error || !result.data) {
    return [];
  }

  const query = input.query.trim();
  const scoredRows = (result.data as MemoryRow[])
    .map((row) => ({
      row,
      score: scoreMemoryRow(row, query),
    }))
    .filter(({ score }) => score >= 0.72)
    .sort((left, right) => right.score - left.score)
    .slice(0, MAX_SEARCH_RESULTS);

  const memoryItems = scoredRows.map(({ row, score }) => toMemoryItem(row, score));

  await markMemoryItemsUsed(
    userId,
    memoryItems.map((item) => item.id),
  );

  return memoryItems;
};
