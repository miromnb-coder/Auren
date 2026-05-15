import { supabase } from '../../supabase';
import type { AurenMemoryItem, AurenMemoryType } from '../core/types';

export type MemoryWriteInput = {
  userId?: string;
  item: Omit<AurenMemoryItem, 'id' | 'createdAt'>;
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
};

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

const toMemoryItem = (row: MemoryRow): AurenMemoryItem => {
  return {
    id: row.id,
    type: normalizeMemoryType(row.type),
    text: row.text,
    confidence: typeof row.confidence === 'number' ? row.confidence : 0.72,
    createdAt: row.created_at,
    source: normalizeMemorySource(row.source),
    metadata: row.metadata ?? {},
  };
};

const clampConfidence = (value: number | undefined) => {
  if (typeof value !== 'number' || Number.isNaN(value)) return 0.72;

  return Math.max(0, Math.min(value, 1));
};

const insertMemoryEvent = async (
  userId: string,
  memoryId: string,
  eventType: 'created' | 'updated',
) => {
  await supabase.from('auren_memory_events').insert({
    user_id: userId,
    memory_id: memoryId,
    event_type: eventType,
    reason: 'Saved through Auren Memory Engine.',
    metadata: {
      engine: 'memory-lite',
    },
  });
};

export const writeMemoryItem = async (
  input: MemoryWriteInput,
): Promise<AurenMemoryItem | null> => {
  const userId = input.userId?.trim();
  const text = input.item.text.trim();

  if (!userId || !text) {
    return null;
  }

  const existingResult = await supabase
    .from('auren_memory_items')
    .select('id, type, text, confidence, source, metadata, created_at')
    .eq('user_id', userId)
    .eq('text', text)
    .is('archived_at', null)
    .maybeSingle();

  if (existingResult.error) {
    return null;
  }

  if (existingResult.data) {
    const updatedResult = await supabase
      .from('auren_memory_items')
      .update({
        type: input.item.type,
        confidence: clampConfidence(input.item.confidence),
        source: normalizeMemorySource(input.item.source),
        metadata: {
          ...(input.item.metadata ?? {}),
          updated_by: 'memory-lite',
        },
        last_used_at: new Date().toISOString(),
      })
      .eq('id', existingResult.data.id)
      .select('id, type, text, confidence, source, metadata, created_at')
      .single();

    if (updatedResult.error || !updatedResult.data) {
      return toMemoryItem(existingResult.data as MemoryRow);
    }

    await insertMemoryEvent(userId, updatedResult.data.id, 'updated');
    return toMemoryItem(updatedResult.data as MemoryRow);
  }

  const insertResult = await supabase
    .from('auren_memory_items')
    .insert({
      user_id: userId,
      type: input.item.type,
      text,
      confidence: clampConfidence(input.item.confidence),
      source: normalizeMemorySource(input.item.source),
      metadata: {
        ...(input.item.metadata ?? {}),
        created_by: 'memory-lite',
      },
    })
    .select('id, type, text, confidence, source, metadata, created_at')
    .single();

  if (insertResult.error || !insertResult.data) {
    return null;
  }

  await insertMemoryEvent(userId, insertResult.data.id, 'created');
  return toMemoryItem(insertResult.data as MemoryRow);
};
