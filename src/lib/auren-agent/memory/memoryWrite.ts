import { supabase } from '../../supabase';
import type { AurenMemoryItem, AurenMemoryType } from '../core/types';

export type MemoryWriteInput = {
  userId?: string;
  item: Omit<AurenMemoryItem, 'id' | 'createdAt'>;
};

type MemorySource = NonNullable<AurenMemoryItem['source']>;

type MemoryRow = {
  id: string;
  type: string | null;
  text: string;
  confidence: number | null;
  source: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
  updated_at?: string | null;
  last_used_at?: string | null;
  pinned?: boolean | null;
};

type MemoryEventType = 'created' | 'updated' | 'merged';

type ExistingMemoryMatch = {
  row: MemoryRow;
  score: number;
  reason: 'target_id' | 'exact_text' | 'similar_text';
};

const MAX_MEMORY_TEXT_LENGTH = 900;
const MAX_EXISTING_ROWS_TO_CHECK = 120;
const MIN_MEMORY_TEXT_LENGTH = 4;
const SIMILARITY_UPDATE_THRESHOLD = 0.82;

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

const clampConfidence = (value: number | undefined | null) => {
  if (typeof value !== 'number' || Number.isNaN(value)) {
    return 0.72;
  }

  return Math.max(0.05, Math.min(value, 0.98));
};

const cleanMemoryText = (value: string) => {
  return value.replace(/\s+/g, ' ').trim();
};

const limitMemoryText = (value: string) => {
  const cleaned = cleanMemoryText(value);

  if (cleaned.length <= MAX_MEMORY_TEXT_LENGTH) {
    return cleaned;
  }

  return `${cleaned.slice(0, MAX_MEMORY_TEXT_LENGTH - 1).trim()}…`;
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

const normalizeMetadata = (value: unknown): Record<string, unknown> => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {};
  }

  return value as Record<string, unknown>;
};

const getMetadataString = (
  metadata: Record<string, unknown> | null | undefined,
  key: string,
) => {
  const value = metadata?.[key];

  return typeof value === 'string' && value.trim() ? value.trim() : null;
};

const getMetadataNumber = (
  metadata: Record<string, unknown> | null | undefined,
  key: string,
) => {
  const value = metadata?.[key];

  return typeof value === 'number' && Number.isFinite(value) ? value : null;
};

const getTargetMemoryId = (metadata: Record<string, unknown>) => {
  const targetMemoryId = getMetadataString(metadata, 'targetMemoryId');

  return targetMemoryId && targetMemoryId.length > 0 ? targetMemoryId : null;
};

const shouldSkipMemory = (text: string, metadata: Record<string, unknown>) => {
  if (text.length < MIN_MEMORY_TEXT_LENGTH) {
    return true;
  }

  if (getMetadataString(metadata, 'sensitivity') === 'high') {
    return true;
  }

  return false;
};

const getTextSimilarity = (leftText: string, rightText: string) => {
  const left = normalizeText(leftText);
  const right = normalizeText(rightText);

  if (!left || !right) {
    return 0;
  }

  if (left === right) {
    return 1;
  }

  if (left.includes(right) || right.includes(left)) {
    return 0.92;
  }

  const leftTokens = tokenize(left);
  const rightTokens = tokenize(right);

  if (leftTokens.length === 0 || rightTokens.length === 0) {
    return 0;
  }

  const leftSet = new Set(leftTokens);
  const rightSet = new Set(rightTokens);
  const overlap = leftTokens.filter((token) => rightSet.has(token)).length;
  const union = new Set([...leftSet, ...rightSet]).size;

  return overlap / Math.max(union, 1);
};

const mergeConfidence = (
  existingConfidence: number | null,
  nextConfidence: number | undefined,
) => {
  return Math.max(
    clampConfidence(existingConfidence),
    clampConfidence(nextConfidence),
  );
};

const mergeMetadata = (
  existingMetadata: Record<string, unknown> | null,
  nextMetadata: Record<string, unknown>,
  extra: Record<string, unknown>,
) => {
  return {
    ...(existingMetadata ?? {}),
    ...nextMetadata,
    ...extra,
    engine: 'memory-write-v2',
    updatedBy: 'memory-write-v2',
    updatedAt: new Date().toISOString(),
  };
};

const toMemoryItem = (row: MemoryRow): AurenMemoryItem => {
  return {
    id: row.id,
    type: normalizeMemoryType(row.type),
    text: row.text,
    confidence: clampConfidence(row.confidence),
    createdAt: row.created_at,
    source: normalizeMemorySource(row.source),
    metadata: row.metadata ?? {},
  };
};

const insertMemoryEvent = async (
  input: {
    userId: string;
    memoryId: string;
    eventType: MemoryEventType;
    reason: string;
    metadata?: Record<string, unknown>;
  },
) => {
  try {
    await supabase.from('auren_memory_events').insert({
      user_id: input.userId,
      memory_id: input.memoryId,
      event_type: input.eventType,
      reason: input.reason,
      metadata: {
        engine: 'memory-write-v2',
        ...(input.metadata ?? {}),
      },
    });
  } catch {
    // Memory saving should not fail just because event tracking failed.
  }
};

const fetchExistingRows = async (userId: string): Promise<MemoryRow[]> => {
  const result = await supabase
    .from('auren_memory_items')
    .select(
      'id, type, text, confidence, source, metadata, created_at, updated_at, last_used_at, pinned',
    )
    .eq('user_id', userId)
    .is('archived_at', null)
    .order('pinned', { ascending: false })
    .order('updated_at', { ascending: false })
    .limit(MAX_EXISTING_ROWS_TO_CHECK);

  if (result.error || !result.data) {
    return [];
  }

  return (result.data as MemoryRow[]).filter((row) => row.text?.trim());
};

const findExistingMemoryMatch = async (
  input: {
    userId: string;
    text: string;
    metadata: Record<string, unknown>;
  },
): Promise<ExistingMemoryMatch | null> => {
  const rows = await fetchExistingRows(input.userId);
  const targetMemoryId = getTargetMemoryId(input.metadata);

  if (targetMemoryId) {
    const targetRow = rows.find((row) => row.id === targetMemoryId);

    if (targetRow) {
      return {
        row: targetRow,
        score: 1,
        reason: 'target_id',
      };
    }
  }

  const normalizedText = normalizeText(input.text);
  const exactRow = rows.find((row) => normalizeText(row.text) === normalizedText);

  if (exactRow) {
    return {
      row: exactRow,
      score: 1,
      reason: 'exact_text',
    };
  }

  const similarRows = rows
    .map((row) => ({
      row,
      score: getTextSimilarity(row.text, input.text),
    }))
    .filter(({ score }) => score >= SIMILARITY_UPDATE_THRESHOLD)
    .sort((left, right) => right.score - left.score);

  const bestSimilarRow = similarRows[0];

  if (!bestSimilarRow) {
    return null;
  }

  return {
    row: bestSimilarRow.row,
    score: bestSimilarRow.score,
    reason: 'similar_text',
  };
};

const updateExistingMemoryItem = async (
  input: {
    userId: string;
    match: ExistingMemoryMatch;
    item: Omit<AurenMemoryItem, 'id' | 'createdAt'>;
    text: string;
    metadata: Record<string, unknown>;
  },
): Promise<AurenMemoryItem | null> => {
  const now = new Date().toISOString();
  const action = getMetadataString(input.metadata, 'memoryAction');
  const importance = getMetadataNumber(input.metadata, 'importance');
  const shouldReplaceText =
    input.match.reason === 'target_id' ||
    action === 'update' ||
    input.text.length > input.match.row.text.length;

  const updatedText = shouldReplaceText ? input.text : input.match.row.text;
  const updatedType = normalizeMemoryType(input.item.type);
  const updatedSource = normalizeMemorySource(input.item.source);
  const updatedConfidence = mergeConfidence(input.match.row.confidence, input.item.confidence);
  const updatedMetadata = mergeMetadata(input.match.row.metadata, input.metadata, {
    writeAction: action ?? 'merge',
    mergeReason: input.match.reason,
    mergeScore: input.match.score,
    importance: importance ?? input.metadata.importance,
  });

  const result = await supabase
    .from('auren_memory_items')
    .update({
      type: updatedType,
      text: updatedText,
      confidence: updatedConfidence,
      source: updatedSource,
      metadata: updatedMetadata,
      last_used_at: now,
    })
    .eq('user_id', input.userId)
    .eq('id', input.match.row.id)
    .select('id, type, text, confidence, source, metadata, created_at')
    .single();

  if (result.error || !result.data) {
    return toMemoryItem(input.match.row);
  }

  await insertMemoryEvent({
    userId: input.userId,
    memoryId: result.data.id,
    eventType: input.match.reason === 'exact_text' ? 'updated' : 'merged',
    reason:
      input.match.reason === 'target_id'
        ? 'Updated through Auren Memory Engine target memory id.'
        : input.match.reason === 'exact_text'
          ? 'Updated matching Auren memory item.'
          : 'Merged similar Auren memory item.',
    metadata: {
      matchReason: input.match.reason,
      matchScore: input.match.score,
    },
  });

  return toMemoryItem(result.data as MemoryRow);
};

const insertNewMemoryItem = async (
  input: {
    userId: string;
    item: Omit<AurenMemoryItem, 'id' | 'createdAt'>;
    text: string;
    metadata: Record<string, unknown>;
  },
): Promise<AurenMemoryItem | null> => {
  const metadata = {
    ...input.metadata,
    engine: 'memory-write-v2',
    createdBy: 'memory-write-v2',
    createdAt: new Date().toISOString(),
  };

  const result = await supabase
    .from('auren_memory_items')
    .insert({
      user_id: input.userId,
      type: normalizeMemoryType(input.item.type),
      text: input.text,
      confidence: clampConfidence(input.item.confidence),
      source: normalizeMemorySource(input.item.source),
      metadata,
    })
    .select('id, type, text, confidence, source, metadata, created_at')
    .single();

  if (result.error || !result.data) {
    return null;
  }

  await insertMemoryEvent({
    userId: input.userId,
    memoryId: result.data.id,
    eventType: 'created',
    reason: 'Created through Auren Memory Engine.',
    metadata: {
      memoryType: normalizeMemoryType(input.item.type),
    },
  });

  return toMemoryItem(result.data as MemoryRow);
};

export const writeMemoryItem = async (
  input: MemoryWriteInput,
): Promise<AurenMemoryItem | null> => {
  const userId = input.userId?.trim();
  const text = limitMemoryText(input.item.text);
  const metadata = normalizeMetadata(input.item.metadata);

  if (!userId || shouldSkipMemory(text, metadata)) {
    return null;
  }

  const existingMatch = await findExistingMemoryMatch({
    userId,
    text,
    metadata,
  });

  if (existingMatch) {
    return updateExistingMemoryItem({
      userId,
      match: existingMatch,
      item: input.item,
      text,
      metadata,
    });
  }

  return insertNewMemoryItem({
    userId,
    item: input.item,
    text,
    metadata,
  });
};
