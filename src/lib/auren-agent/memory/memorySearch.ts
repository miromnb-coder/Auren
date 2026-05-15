import { supabase } from '../../supabase';
import type { AurenMemoryItem, AurenMemoryType } from '../core/types';

export type MemorySearchInput = {
  userId?: string;
  query: string;
};

type MemorySource = NonNullable<AurenMemoryItem['source']>;

type MemoryRow = {
  id: string;
  type: string | null;
  text: string;
  confidence: number | null;
  source: string | null;
  metadata: Record<string, unknown> | null;
  pinned?: boolean | null;
  created_at: string;
  updated_at?: string | null;
  last_used_at?: string | null;
};

type ScoredMemoryRow = {
  row: MemoryRow;
  score: number;
};

const MAX_FETCHED_MEMORY_ROWS = 120;
const MAX_SEARCH_RESULTS = 16;
const MIN_RELEVANCE_SCORE = 0.56;
const LOW_SIGNAL_MIN_RELEVANCE_SCORE = 0.9;
const RECENCY_HALF_LIFE_DAYS = 60;

const VALID_MEMORY_TYPES: AurenMemoryType[] = [
  'user_preference',
  'study_goal',
  'active_project',
  'important_fact',
  'habit',
  'unknown',
];

const VALID_MEMORY_SOURCES: MemorySource[] = ['chat', 'system', 'tool'];

const TYPE_WEIGHTS: Record<AurenMemoryType, number> = {
  active_project: 0.18,
  user_preference: 0.16,
  study_goal: 0.13,
  habit: 0.1,
  important_fact: 0.07,
  unknown: -0.06,
};

const SOURCE_WEIGHTS: Record<MemorySource, number> = {
  chat: 0.04,
  system: 0.03,
  tool: 0.02,
};

const STABILITY_WEIGHTS: Record<string, number> = {
  long_term: 0.14,
  session: 0.04,
  temporary: -0.1,
};

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

const normalizeMetadata = (value: unknown): Record<string, unknown> => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {};
  }

  return value as Record<string, unknown>;
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

const clamp = (value: number, min = 0, max = 1) => {
  return Math.min(Math.max(value, min), max);
};

const getMetadataNumber = (
  metadata: Record<string, unknown> | null | undefined,
  key: string,
): number | null => {
  const value = metadata?.[key];

  return typeof value === 'number' && Number.isFinite(value) ? value : null;
};

const getMetadataString = (
  metadata: Record<string, unknown> | null | undefined,
  key: string,
): string | null => {
  const value = metadata?.[key];

  return typeof value === 'string' && value.trim() ? value.trim() : null;
};

const getMetadataBoolean = (
  metadata: Record<string, unknown> | null | undefined,
  key: string,
): boolean | null => {
  const value = metadata?.[key];

  return typeof value === 'boolean' ? value : null;
};

const getDateAgeInDays = (value: string | null | undefined) => {
  if (!value) {
    return null;
  }

  const timestamp = new Date(value).getTime();

  if (!Number.isFinite(timestamp)) {
    return null;
  }

  const ageMs = Date.now() - timestamp;

  if (ageMs < 0) {
    return 0;
  }

  return ageMs / (1000 * 60 * 60 * 24);
};

const getRecencyScore = (row: MemoryRow) => {
  const ageInDays = getDateAgeInDays(row.updated_at ?? row.created_at);

  if (ageInDays === null) {
    return 0;
  }

  return 0.08 * Math.exp(-ageInDays / RECENCY_HALF_LIFE_DAYS);
};

const getLastUsedScore = (row: MemoryRow) => {
  const ageInDays = getDateAgeInDays(row.last_used_at);

  if (ageInDays === null) {
    return 0;
  }

  return 0.025 * Math.exp(-ageInDays / 14);
};

const getTextQualityScore = (text: string) => {
  const cleaned = text.trim();

  if (cleaned.length < 8) {
    return -0.18;
  }

  if (cleaned.length <= 220) {
    return 0.06;
  }

  if (cleaned.length <= 800) {
    return 0.02;
  }

  return -0.1;
};

const getMetadataScore = (row: MemoryRow) => {
  const metadata = normalizeMetadata(row.metadata);
  const importance = getMetadataNumber(metadata, 'importance');
  const stability = getMetadataString(metadata, 'stability');
  const sensitivity = getMetadataString(metadata, 'sensitivity');
  const temporary = getMetadataBoolean(metadata, 'temporary');

  let score = 0;

  if (importance !== null) {
    score += clamp(importance, 0, 1) * 0.18;
  }

  if (stability) {
    score += STABILITY_WEIGHTS[stability] ?? 0;
  }

  if (sensitivity === 'high') {
    score -= 0.35;
  }

  if (sensitivity === 'medium') {
    score -= 0.08;
  }

  if (temporary === true) {
    score -= 0.12;
  }

  return score;
};

const getLexicalScore = (memoryText: string, query: string) => {
  const normalizedQuery = normalizeText(query);
  const normalizedMemory = normalizeText(memoryText);

  if (!normalizedQuery || !normalizedMemory) {
    return 0;
  }

  if (normalizedMemory.includes(normalizedQuery) || normalizedQuery.includes(normalizedMemory)) {
    return 1;
  }

  const queryTokens = tokenize(normalizedQuery);
  const memoryTokens = tokenize(normalizedMemory);

  if (queryTokens.length === 0 || memoryTokens.length === 0) {
    return 0;
  }

  const queryTokenSet = new Set(queryTokens);
  const memoryTokenSet = new Set(memoryTokens);

  const exactOverlap = memoryTokens.filter((token) => queryTokenSet.has(token)).length;
  const partialOverlap = memoryTokens.filter((memoryToken) =>
    queryTokens.some(
      (queryToken) =>
        memoryToken.includes(queryToken) ||
        queryToken.includes(memoryToken),
    ),
  ).length;

  const recall = exactOverlap / Math.max(queryTokens.length, 1);
  const precision = exactOverlap / Math.max(memoryTokens.length, 1);
  const partial = partialOverlap / Math.max(memoryTokenSet.size, 1);
  const jaccard =
    exactOverlap /
    Math.max(new Set([...queryTokenSet, ...memoryTokenSet]).size, 1);

  return clamp(recall * 0.52 + precision * 0.18 + partial * 0.18 + jaccard * 0.12);
};

const isLowSignalQuery = (query: string) => {
  const normalized = normalizeText(query);
  const tokens = tokenize(query);

  return normalized.length < 16 && tokens.length <= 1;
};

const toSearchConfidence = (score: number, rowConfidence: number | null) => {
  const baseConfidence = typeof rowConfidence === 'number' ? rowConfidence : 0.72;

  return clamp(Math.max(baseConfidence, 0.35 + score * 0.52), 0.2, 0.98);
};

const toMemoryItem = (row: MemoryRow, score: number): AurenMemoryItem => {
  const metadata = normalizeMetadata(row.metadata);

  return {
    id: row.id,
    type: normalizeMemoryType(row.type),
    text: row.text,
    confidence: toSearchConfidence(score, row.confidence),
    createdAt: row.created_at,
    source: normalizeMemorySource(row.source),
    metadata: {
      ...metadata,
      searchScore: score,
      pinned: row.pinned === true,
      updatedAt: row.updated_at ?? null,
      lastUsedAt: row.last_used_at ?? null,
      engine: 'memory-search-v2',
    },
  };
};

const scoreMemoryRow = (row: MemoryRow, query: string) => {
  const type = normalizeMemoryType(row.type);
  const source = normalizeMemorySource(row.source);
  const baseConfidence = clamp(typeof row.confidence === 'number' ? row.confidence : 0.72);
  const lexicalScore = getLexicalScore(row.text, query);
  const pinnedScore = row.pinned === true ? 0.18 : 0;

  return (
    baseConfidence * 0.42 +
    lexicalScore * 0.56 +
    TYPE_WEIGHTS[type] +
    SOURCE_WEIGHTS[source] +
    getMetadataScore(row) +
    getTextQualityScore(row.text) +
    getRecencyScore(row) +
    getLastUsedScore(row) +
    pinnedScore
  );
};

const dedupeScoredRows = (rows: ScoredMemoryRow[]) => {
  const rowMap = new Map<string, ScoredMemoryRow>();

  for (const row of rows) {
    const key = normalizeText(row.row.text);

    if (!key) {
      continue;
    }

    const currentRow = rowMap.get(key);

    if (!currentRow || row.score > currentRow.score) {
      rowMap.set(key, row);
    }
  }

  return Array.from(rowMap.values());
};

const markMemoryItemsUsed = async (userId: string, memoryIds: string[]) => {
  if (memoryIds.length === 0) return;

  const now = new Date().toISOString();

  try {
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
          engine: 'memory-search-v2',
        },
      })),
    );
  } catch {
    // Search should never fail just because usage tracking failed.
  }
};

const fetchMemoryRows = async (userId: string): Promise<MemoryRow[]> => {
  const result = await supabase
    .from('auren_memory_items')
    .select(
      'id, type, text, confidence, source, metadata, pinned, created_at, updated_at, last_used_at',
    )
    .eq('user_id', userId)
    .is('archived_at', null)
    .order('pinned', { ascending: false })
    .order('updated_at', { ascending: false })
    .limit(MAX_FETCHED_MEMORY_ROWS);

  if (result.error || !result.data) {
    return [];
  }

  return (result.data as MemoryRow[]).filter((row) => row.text?.trim());
};

export const findRelevantMemoryItems = async (
  input: MemorySearchInput,
): Promise<AurenMemoryItem[]> => {
  const userId = input.userId?.trim();

  if (!userId) {
    return [];
  }

  const query = input.query.trim();
  const rows = await fetchMemoryRows(userId);

  if (rows.length === 0) {
    return [];
  }

  if (isLowSignalQuery(query)) {
    return [];
  }

  const minScore = query
    ? MIN_RELEVANCE_SCORE
    : LOW_SIGNAL_MIN_RELEVANCE_SCORE;

  const scoredRows = dedupeScoredRows(
    rows.map((row) => ({
      row,
      score: scoreMemoryRow(row, query),
    })),
  )
    .filter(({ score }) => score >= minScore)
    .sort((left, right) => {
      if (right.score !== left.score) {
        return right.score - left.score;
      }

      const leftPinned = left.row.pinned === true ? 1 : 0;
      const rightPinned = right.row.pinned === true ? 1 : 0;

      if (rightPinned !== leftPinned) {
        return rightPinned - leftPinned;
      }

      return (
        new Date(right.row.updated_at ?? right.row.created_at).getTime() -
        new Date(left.row.updated_at ?? left.row.created_at).getTime()
      );
    })
    .slice(0, MAX_SEARCH_RESULTS);

  const memoryItems = scoredRows.map(({ row, score }) => toMemoryItem(row, score));

  await markMemoryItemsUsed(
    userId,
    memoryItems.map((item) => item.id),
  );

  return memoryItems;
};
