import type {
  AurenAgentInput,
  AurenMemoryItem,
  AurenMemoryResult,
  AurenMemoryType,
} from '../core/types';
import { rankMemoryItems } from './memoryRanker';
import { findRelevantMemoryItems } from './memorySearch';
import { writeMemoryItem } from './memoryWrite';

type LocalMemoryStore = Map<string, AurenMemoryItem[]>;

const LOCAL_MEMORY_STORE: LocalMemoryStore = new Map();

const MAX_MEMORY_ITEMS_PER_USER = 80;
const MAX_RETURNED_MEMORY_ITEMS = 6;
const MAX_CANDIDATE_ITEMS = 16;

const MEMORY_CUE_PATTERNS = [
  /^remember\s+(that\s+)?/i,
  /^save\s+(this|that)\s*:?/i,
  /^keep\s+in\s+mind\s+(that\s+)?/i,
  /^muista\s+(että|etta)?\s*/i,
  /^tallenna\s+(tämä|tama|tää|taa|se)?\s*:?/i,
  /^laita\s+muistiin\s*:?/i,
  /^pidä\s+mielessä\s+(että)?\s*/i,
  /^pida\s+mielessa\s+(etta)?\s*/i,
];

const normalizeText = (value: string) => {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
};

const cleanMemoryText = (value: string) => {
  return value.replace(/\s+/g, ' ').trim();
};

const getStoreKey = (userId?: string) => {
  return userId?.trim() || 'anonymous-user';
};

const createMemoryId = () => {
  return `memory_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
};

const tokenize = (value: string) => {
  return normalizeText(value)
    .split(' ')
    .map((token) => token.trim())
    .filter((token) => token.length >= 3);
};

const dedupeMemoryItems = (items: AurenMemoryItem[]) => {
  const seen = new Set<string>();
  const uniqueItems: AurenMemoryItem[] = [];

  for (const item of items) {
    const key = normalizeText(item.text);

    if (!key || seen.has(key)) continue;

    seen.add(key);
    uniqueItems.push(item);
  }

  return uniqueItems;
};

const inferMemoryType = (text: string): AurenMemoryType => {
  const normalized = normalizeText(text);

  if (
    normalized.includes('prefer') ||
    normalized.includes('like') ||
    normalized.includes('haluan') ||
    normalized.includes('tykkaan') ||
    normalized.includes('tykkään')
  ) {
    return 'user_preference';
  }

  if (
    normalized.includes('study') ||
    normalized.includes('exam') ||
    normalized.includes('learn') ||
    normalized.includes('opisk') ||
    normalized.includes('koe') ||
    normalized.includes('oppia')
  ) {
    return 'study_goal';
  }

  if (
    normalized.includes('project') ||
    normalized.includes('app') ||
    normalized.includes('building') ||
    normalized.includes('rakennan') ||
    normalized.includes('sovellus') ||
    normalized.includes('projekti')
  ) {
    return 'active_project';
  }

  if (
    normalized.includes('habit') ||
    normalized.includes('routine') ||
    normalized.includes('usually') ||
    normalized.includes('tapa') ||
    normalized.includes('rutiini') ||
    normalized.includes('yleensä') ||
    normalized.includes('yleensa')
  ) {
    return 'habit';
  }

  return 'important_fact';
};

const extractExplicitMemoryText = (message: string) => {
  const cleanedMessage = cleanMemoryText(message);

  for (const pattern of MEMORY_CUE_PATTERNS) {
    const candidate = cleanedMessage.replace(pattern, '').trim();

    if (candidate !== cleanedMessage && candidate.length >= 3) {
      return candidate;
    }
  }

  return null;
};

const createMemoryCandidate = (input: AurenAgentInput): AurenMemoryItem | null => {
  const explicitMemoryText = extractExplicitMemoryText(input.message);

  if (!explicitMemoryText) {
    return null;
  }

  const text = cleanMemoryText(explicitMemoryText);

  if (text.length < 3) {
    return null;
  }

  return {
    id: createMemoryId(),
    type: inferMemoryType(text),
    text,
    confidence: 0.86,
    createdAt: new Date().toISOString(),
    source: 'chat',
    metadata: {
      userId: input.userId,
      temporary: true,
      engine: 'memory-lite',
    },
  };
};

const getLocalMemoryItems = (userId?: string) => {
  return LOCAL_MEMORY_STORE.get(getStoreKey(userId)) ?? [];
};

const saveLocalMemoryItem = (userId: string | undefined, item: AurenMemoryItem) => {
  const storeKey = getStoreKey(userId);
  const currentItems = LOCAL_MEMORY_STORE.get(storeKey) ?? [];
  const nextItems = dedupeMemoryItems([item, ...currentItems]).slice(0, MAX_MEMORY_ITEMS_PER_USER);

  LOCAL_MEMORY_STORE.set(storeKey, nextItems);

  return item;
};

const scoreMemoryItem = (item: AurenMemoryItem, query: string) => {
  const normalizedQuery = normalizeText(query);
  const normalizedMemory = normalizeText(item.text);

  if (!normalizedQuery || !normalizedMemory) {
    return item.confidence;
  }

  if (normalizedMemory.includes(normalizedQuery) || normalizedQuery.includes(normalizedMemory)) {
    return item.confidence + 3;
  }

  const queryTokens = new Set(tokenize(normalizedQuery));
  const memoryTokens = tokenize(normalizedMemory);

  if (queryTokens.size === 0 || memoryTokens.length === 0) {
    return item.confidence;
  }

  const overlap = memoryTokens.filter((token) => queryTokens.has(token)).length;
  const overlapScore = overlap / Math.max(queryTokens.size, 1);

  return item.confidence + overlapScore * 2;
};

const searchLocalMemoryItems = (input: AurenAgentInput) => {
  const query = input.message;
  const items = getLocalMemoryItems(input.userId);

  if (!query.trim()) {
    return items.slice(0, MAX_CANDIDATE_ITEMS);
  }

  return [...items]
    .map((item) => ({
      item,
      score: scoreMemoryItem(item, query),
    }))
    .filter(({ score }) => score >= 0.72)
    .sort((left, right) => right.score - left.score)
    .map(({ item, score }) => ({
      ...item,
      confidence: Math.min(score, 0.98),
    }))
    .slice(0, MAX_CANDIDATE_ITEMS);
};

const tryPersistentWrite = async (
  input: AurenAgentInput,
  item: AurenMemoryItem,
): Promise<AurenMemoryItem | null> => {
  try {
    return await writeMemoryItem({
      userId: input.userId,
      item: {
        type: item.type,
        text: item.text,
        confidence: item.confidence,
        source: item.source,
        metadata: item.metadata,
      },
    });
  } catch {
    return null;
  }
};

const tryPersistentSearch = async (input: AurenAgentInput): Promise<AurenMemoryItem[]> => {
  try {
    return await findRelevantMemoryItems({
      userId: input.userId,
      query: input.message,
    });
  } catch {
    return [];
  }
};

export const buildMemoryContext = async (
  input: AurenAgentInput,
): Promise<AurenMemoryResult> => {
  const localMemoryCandidate = createMemoryCandidate(input);
  let saved = false;
  let savedItem: AurenMemoryItem | null = null;

  if (localMemoryCandidate) {
    const persistentItem = await tryPersistentWrite(input, localMemoryCandidate);

    savedItem = saveLocalMemoryItem(input.userId, persistentItem ?? localMemoryCandidate);
    saved = true;
  }

  const [persistentCandidates] = await Promise.all([tryPersistentSearch(input)]);
  const localCandidates = searchLocalMemoryItems(input);

  const candidates = dedupeMemoryItems([
    ...(savedItem ? [savedItem] : []),
    ...localCandidates,
    ...persistentCandidates,
  ]).slice(0, MAX_CANDIDATE_ITEMS);

  const items = rankMemoryItems(candidates).slice(0, MAX_RETURNED_MEMORY_ITEMS);

  const used = items.length > 0;

  return {
    used,
    saved,
    items,
    candidates,
    note: saved
      ? 'Memory Lite saved this context for the current app session. Connect memoryWrite.ts to persistent storage when you want memory to survive app restarts.'
      : used
        ? 'Memory Lite found relevant context for this response.'
        : 'Memory Lite is active, but no relevant saved context was found for this message.',
  };
};
