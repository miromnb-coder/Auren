import type { AurenMemoryItem, AurenMemoryType } from '../core/types';

const TYPE_WEIGHTS: Record<AurenMemoryType, number> = {
  active_project: 0.2,
  user_preference: 0.18,
  study_goal: 0.14,
  habit: 0.1,
  important_fact: 0.08,
  unknown: -0.08,
};

const SOURCE_WEIGHTS: Record<NonNullable<AurenMemoryItem['source']>, number> = {
  chat: 0.04,
  system: 0.03,
  tool: 0.02,
};

const STABILITY_WEIGHTS: Record<string, number> = {
  long_term: 0.16,
  session: 0.04,
  temporary: -0.08,
};

const MAX_SCORE = 1.5;
const MIN_TEXT_LENGTH = 8;
const IDEAL_TEXT_LENGTH = 160;
const LONG_TEXT_LENGTH = 700;
const RECENCY_HALF_LIFE_DAYS = 45;

const clamp = (value: number, min = 0, max = MAX_SCORE) => {
  return Math.min(Math.max(value, min), max);
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

const getMetadataNumber = (
  metadata: AurenMemoryItem['metadata'],
  key: string,
): number | null => {
  const value = metadata?.[key];

  return typeof value === 'number' && Number.isFinite(value) ? value : null;
};

const getMetadataString = (
  metadata: AurenMemoryItem['metadata'],
  key: string,
): string | null => {
  const value = metadata?.[key];

  return typeof value === 'string' && value.trim() ? value.trim() : null;
};

const getMetadataBoolean = (
  metadata: AurenMemoryItem['metadata'],
  key: string,
): boolean | null => {
  const value = metadata?.[key];

  return typeof value === 'boolean' ? value : null;
};

const getAgeInDays = (createdAt: string) => {
  const timestamp = new Date(createdAt).getTime();

  if (!Number.isFinite(timestamp)) {
    return null;
  }

  const ageMs = Date.now() - timestamp;

  if (ageMs < 0) {
    return 0;
  }

  return ageMs / (1000 * 60 * 60 * 24);
};

const getRecencyScore = (item: AurenMemoryItem) => {
  const ageInDays = getAgeInDays(item.createdAt);

  if (ageInDays === null) {
    return 0;
  }

  return 0.12 * Math.exp(-ageInDays / RECENCY_HALF_LIFE_DAYS);
};

const getTextQualityScore = (item: AurenMemoryItem) => {
  const text = item.text.trim();

  if (text.length < MIN_TEXT_LENGTH) {
    return -0.22;
  }

  if (text.length <= IDEAL_TEXT_LENGTH) {
    return 0.08;
  }

  if (text.length <= LONG_TEXT_LENGTH) {
    return 0.03;
  }

  return -0.12;
};

const getMetadataScore = (item: AurenMemoryItem) => {
  const importance = getMetadataNumber(item.metadata, 'importance');
  const stability = getMetadataString(item.metadata, 'stability');
  const sensitivity = getMetadataString(item.metadata, 'sensitivity');
  const temporary = getMetadataBoolean(item.metadata, 'temporary');

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

const getTypeScore = (item: AurenMemoryItem) => {
  return TYPE_WEIGHTS[item.type] ?? TYPE_WEIGHTS.unknown;
};

const getSourceScore = (item: AurenMemoryItem) => {
  if (!item.source) {
    return 0;
  }

  return SOURCE_WEIGHTS[item.source] ?? 0;
};

const getMemoryScore = (item: AurenMemoryItem) => {
  const baseConfidence = clamp(item.confidence, 0, 1);

  return clamp(
    baseConfidence +
      getTypeScore(item) +
      getSourceScore(item) +
      getMetadataScore(item) +
      getTextQualityScore(item) +
      getRecencyScore(item),
  );
};

const dedupeRankedItems = (items: AurenMemoryItem[]) => {
  const seen = new Set<string>();
  const uniqueItems: AurenMemoryItem[] = [];

  for (const item of items) {
    const key = normalizeText(item.text);

    if (!key || seen.has(key)) {
      continue;
    }

    seen.add(key);
    uniqueItems.push(item);
  }

  return uniqueItems;
};

export const rankMemoryItems = (items: AurenMemoryItem[]): AurenMemoryItem[] => {
  return dedupeRankedItems(items)
    .map((item, index) => ({
      item,
      index,
      score: getMemoryScore(item),
    }))
    .sort((left, right) => {
      if (right.score !== left.score) {
        return right.score - left.score;
      }

      if (right.item.confidence !== left.item.confidence) {
        return right.item.confidence - left.item.confidence;
      }

      return left.index - right.index;
    })
    .map(({ item }) => item);
};
