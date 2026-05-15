import { supabase } from '../../supabase';
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

type MemoryDecisionAction = 'save' | 'update' | 'delete' | 'ignore';
type MemoryDecisionStability = 'temporary' | 'session' | 'long_term';
type MemoryDecisionSensitivity = 'low' | 'medium' | 'high';

type MemoryDecision = {
  action: MemoryDecisionAction;
  type: AurenMemoryType;
  text: string;
  importance: number;
  confidence: number;
  stability: MemoryDecisionStability;
  sensitivity: MemoryDecisionSensitivity;
  targetMemoryId: string | null;
  reason: string;
};

type MemoryDecisionResponse = {
  decision?: MemoryDecision;
  model?: string | null;
};

const LOCAL_MEMORY_STORE: LocalMemoryStore = new Map();

const MEMORY_DECISION_FUNCTION = 'auren-memory-decide';

const MAX_MEMORY_ITEMS_PER_USER = 80;
const MAX_RETURNED_MEMORY_ITEMS = 6;
const MAX_CANDIDATE_ITEMS = 16;
const MAX_EXISTING_MEMORIES_FOR_DECISION = 12;
const MAX_CONVERSATION_MESSAGES_FOR_DECISION = 8;

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

const FORGET_CUE_PATTERNS = [
  /^forget\s+(this|that)?\s*:?/i,
  /^delete\s+(this|that)?\s+memory\s*:?/i,
  /^remove\s+(this|that)?\s+memory\s*:?/i,
  /^do\s+not\s+remember\s+(this|that)?\s*:?/i,
  /^uno(hda|hda tämä|hda tama)\s*:?/i,
  /^poista\s+(tämä|tama|tää|taa|se)?\s*(muistista)?\s*:?/i,
  /^älä\s+muista\s+(tätä|tata|tää|taa|se)?\s*:?/i,
  /^ala\s+muista\s+(tata|taa|se)?\s*:?/i,
];

const MEMORY_TYPES: AurenMemoryType[] = [
  'user_preference',
  'study_goal',
  'active_project',
  'important_fact',
  'habit',
  'unknown',
];

const MEMORY_ACTIONS: MemoryDecisionAction[] = ['save', 'update', 'delete', 'ignore'];
const MEMORY_STABILITIES: MemoryDecisionStability[] = ['temporary', 'session', 'long_term'];
const MEMORY_SENSITIVITIES: MemoryDecisionSensitivity[] = ['low', 'medium', 'high'];

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

const limitText = (value: string, maxLength: number) => {
  const cleaned = cleanMemoryText(value);

  if (cleaned.length <= maxLength) {
    return cleaned;
  }

  return `${cleaned.slice(0, maxLength - 1).trim()}…`;
};

const getStoreKey = (userId?: string) => {
  return userId?.trim() || 'anonymous-user';
};

const createMemoryId = () => {
  return `memory_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
};

const clampNumber = (value: unknown, fallback: number, min = 0, max = 1) => {
  const numberValue = typeof value === 'number' && Number.isFinite(value) ? value : fallback;

  return Math.min(Math.max(numberValue, min), max);
};

const isMemoryType = (value: unknown): value is AurenMemoryType => {
  return typeof value === 'string' && MEMORY_TYPES.includes(value as AurenMemoryType);
};

const isMemoryAction = (value: unknown): value is MemoryDecisionAction => {
  return typeof value === 'string' && MEMORY_ACTIONS.includes(value as MemoryDecisionAction);
};

const isMemoryStability = (value: unknown): value is MemoryDecisionStability => {
  return typeof value === 'string' && MEMORY_STABILITIES.includes(value as MemoryDecisionStability);
};

const isMemorySensitivity = (value: unknown): value is MemoryDecisionSensitivity => {
  return typeof value === 'string' && MEMORY_SENSITIVITIES.includes(value as MemoryDecisionSensitivity);
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

const extractForgetMemoryText = (message: string) => {
  const cleanedMessage = cleanMemoryText(message);

  for (const pattern of FORGET_CUE_PATTERNS) {
    const candidate = cleanedMessage.replace(pattern, '').trim();

    if (candidate !== cleanedMessage) {
      return candidate.length >= 3 ? candidate : cleanedMessage;
    }
  }

  return null;
};

const createIgnoreDecision = (reason: string): MemoryDecision => {
  return {
    action: 'ignore',
    type: 'unknown',
    text: '',
    importance: 0,
    confidence: 0.65,
    stability: 'temporary',
    sensitivity: 'low',
    targetMemoryId: null,
    reason,
  };
};

const createFallbackMemoryDecision = (input: AurenAgentInput): MemoryDecision => {
  const forgetText = extractForgetMemoryText(input.message);

  if (forgetText) {
    return {
      action: 'delete',
      type: 'unknown',
      text: limitText(forgetText, 800),
      importance: 0.75,
      confidence: 0.82,
      stability: 'long_term',
      sensitivity: 'low',
      targetMemoryId: null,
      reason: 'The user explicitly asked to forget or remove memory.',
    };
  }

  const explicitMemoryText = extractExplicitMemoryText(input.message);

  if (!explicitMemoryText) {
    return createIgnoreDecision('No explicit memory cue was found and LLM memory decision was unavailable.');
  }

  const text = limitText(explicitMemoryText, 800);

  if (text.length < 3) {
    return createIgnoreDecision('The explicit memory text was too short.');
  }

  return {
    action: 'save',
    type: inferMemoryType(text),
    text,
    importance: 0.72,
    confidence: 0.86,
    stability: 'long_term',
    sensitivity: 'low',
    targetMemoryId: null,
    reason: 'The user explicitly asked Auren to remember this.',
  };
};

const normalizeMemoryDecision = (value: unknown): MemoryDecision | null => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }

  const record = value as Record<string, unknown>;
  const action = isMemoryAction(record.action) ? record.action : 'ignore';
  const type = isMemoryType(record.type) ? record.type : 'unknown';
  const stability = isMemoryStability(record.stability) ? record.stability : 'temporary';
  const sensitivity = isMemorySensitivity(record.sensitivity) ? record.sensitivity : 'low';
  const text = action === 'ignore' ? '' : limitText(typeof record.text === 'string' ? record.text : '', 800);
  const targetMemoryId =
    typeof record.targetMemoryId === 'string' && record.targetMemoryId.trim()
      ? record.targetMemoryId.trim()
      : null;

  if (action !== 'ignore' && text.length < 4) {
    return createIgnoreDecision('The LLM memory decision did not include useful memory text.');
  }

  if (sensitivity === 'high') {
    return createIgnoreDecision('The LLM marked this memory as highly sensitive, so it was not stored.');
  }

  return {
    action,
    type,
    text,
    importance: clampNumber(record.importance, action === 'ignore' ? 0 : 0.6),
    confidence: clampNumber(record.confidence, 0.7),
    stability,
    sensitivity,
    targetMemoryId,
    reason:
      typeof record.reason === 'string' && record.reason.trim()
        ? limitText(record.reason, 360)
        : 'No memory decision reason was provided.',
  };
};

const getLocalMemoryItems = (userId?: string) => {
  return LOCAL_MEMORY_STORE.get(getStoreKey(userId)) ?? [];
};

const saveLocalMemoryItem = (
  userId: string | undefined,
  item: AurenMemoryItem,
  targetMemoryId?: string | null,
) => {
  const storeKey = getStoreKey(userId);
  const currentItems = LOCAL_MEMORY_STORE.get(storeKey) ?? [];
  const normalizedNewText = normalizeText(item.text);

  const filteredItems = currentItems.filter((currentItem) => {
    if (targetMemoryId && currentItem.id === targetMemoryId) {
      return false;
    }

    return normalizeText(currentItem.text) !== normalizedNewText;
  });

  const nextItems = dedupeMemoryItems([item, ...filteredItems]).slice(0, MAX_MEMORY_ITEMS_PER_USER);

  LOCAL_MEMORY_STORE.set(storeKey, nextItems);

  return item;
};

const removeLocalMemoryItems = (userId: string | undefined, decision: MemoryDecision) => {
  const storeKey = getStoreKey(userId);
  const currentItems = LOCAL_MEMORY_STORE.get(storeKey) ?? [];

  if (currentItems.length === 0) {
    return 0;
  }

  const normalizedDeleteText = normalizeText(decision.text);
  const deleteTokens = new Set(tokenize(normalizedDeleteText));

  const nextItems = currentItems.filter((item) => {
    if (decision.targetMemoryId && item.id === decision.targetMemoryId) {
      return false;
    }

    const normalizedMemory = normalizeText(item.text);

    if (normalizedDeleteText && normalizedMemory.includes(normalizedDeleteText)) {
      return false;
    }

    if (normalizedDeleteText && normalizedDeleteText.includes(normalizedMemory)) {
      return false;
    }

    const memoryTokens = tokenize(normalizedMemory);
    const overlap = memoryTokens.filter((token) => deleteTokens.has(token)).length;
    const overlapScore = overlap / Math.max(deleteTokens.size, 1);

    return overlapScore < 0.6;
  });

  LOCAL_MEMORY_STORE.set(storeKey, nextItems);

  return currentItems.length - nextItems.length;
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

const createMemoryItemFromDecision = (
  input: AurenAgentInput,
  decision: MemoryDecision,
): AurenMemoryItem => {
  return {
    id: createMemoryId(),
    type: decision.type,
    text: decision.text,
    confidence: Math.max(0.2, Math.min(decision.confidence, 0.98)),
    createdAt: new Date().toISOString(),
    source: 'chat',
    metadata: {
      userId: input.userId,
      engine: 'llm-memory-decision',
      memoryAction: decision.action,
      importance: decision.importance,
      stability: decision.stability,
      sensitivity: decision.sensitivity,
      targetMemoryId: decision.targetMemoryId,
      reason: decision.reason,
    },
  };
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

const getDecisionExistingMemories = (items: AurenMemoryItem[]) => {
  return dedupeMemoryItems(items)
    .slice(0, MAX_EXISTING_MEMORIES_FOR_DECISION)
    .map((item) => ({
      id: item.id,
      type: item.type,
      text: item.text,
      confidence: item.confidence,
      createdAt: item.createdAt,
      metadata: item.metadata,
    }));
};

const getDecisionConversation = (input: AurenAgentInput) => {
  return (input.conversation ?? [])
    .slice(-MAX_CONVERSATION_MESSAGES_FOR_DECISION)
    .map((message) => ({
      role: message.role,
      content: limitText(message.content, 1200),
    }));
};

const tryLLMMemoryDecision = async (
  input: AurenAgentInput,
  existingMemories: AurenMemoryItem[],
): Promise<MemoryDecision | null> => {
  try {
    const { data, error } = await supabase.functions.invoke<MemoryDecisionResponse>(
      MEMORY_DECISION_FUNCTION,
      {
        body: {
          userId: input.userId,
          message: input.message,
          mode: input.mode,
          intent:
            typeof input.metadata?.intent === 'string'
              ? input.metadata.intent
              : undefined,
          existingMemories: getDecisionExistingMemories(existingMemories),
          conversation: getDecisionConversation(input),
        },
      },
    );

    if (error) {
      return null;
    }

    return normalizeMemoryDecision(data?.decision);
  } catch {
    return null;
  }
};

const shouldApplyDecision = (decision: MemoryDecision) => {
  if (decision.action === 'ignore') {
    return false;
  }

  if (decision.sensitivity === 'high') {
    return false;
  }

  if (decision.confidence < 0.55) {
    return false;
  }

  if (decision.action !== 'delete' && decision.importance < 0.42) {
    return false;
  }

  if (decision.action !== 'delete' && cleanMemoryText(decision.text).length < 4) {
    return false;
  }

  return true;
};

const applyMemoryDecision = async (
  input: AurenAgentInput,
  decision: MemoryDecision,
) => {
  if (!shouldApplyDecision(decision)) {
    return {
      saved: false,
      savedItem: null as AurenMemoryItem | null,
      deletedCount: 0,
    };
  }

  if (decision.action === 'delete') {
    const deletedCount = removeLocalMemoryItems(input.userId, decision);

    return {
      saved: false,
      savedItem: null as AurenMemoryItem | null,
      deletedCount,
    };
  }

  const memoryItem = createMemoryItemFromDecision(input, decision);
  const persistentItem = await tryPersistentWrite(input, memoryItem);
  const savedItem = saveLocalMemoryItem(
    input.userId,
    persistentItem ?? memoryItem,
    decision.targetMemoryId,
  );

  return {
    saved: true,
    savedItem,
    deletedCount: 0,
  };
};

const getMemoryNote = (input: {
  saved: boolean;
  used: boolean;
  decision: MemoryDecision;
  deletedCount: number;
  savedItem: AurenMemoryItem | null;
}) => {
  if (input.saved && input.savedItem) {
    if (input.decision.action === 'update') {
      return `LLM Memory updated useful context: ${input.savedItem.text}`;
    }

    return `LLM Memory saved useful context: ${input.savedItem.text}`;
  }

  if (input.decision.action === 'delete') {
    return input.deletedCount > 0
      ? 'LLM Memory removed matching local session memory. Persistent memory deletion can be connected later.'
      : 'LLM Memory detected a forget request, but no matching local session memory was found. Persistent memory deletion can be connected later.';
  }

  if (input.used) {
    return 'LLM Memory found relevant context for this response.';
  }

  if (input.decision.action === 'ignore') {
    return `LLM Memory ignored this message: ${input.decision.reason}`;
  }

  return 'LLM Memory is active, but no relevant saved context was found for this message.';
};

export const buildMemoryContext = async (
  input: AurenAgentInput,
): Promise<AurenMemoryResult> => {
  const persistentCandidates = await tryPersistentSearch(input);
  const initialLocalCandidates = searchLocalMemoryItems(input);
  const existingCandidates = dedupeMemoryItems([
    ...initialLocalCandidates,
    ...persistentCandidates,
  ]).slice(0, MAX_CANDIDATE_ITEMS);

  const llmDecision = await tryLLMMemoryDecision(input, existingCandidates);
  const decision = llmDecision ?? createFallbackMemoryDecision(input);
  const decisionResult = await applyMemoryDecision(input, decision);

  const localCandidates = searchLocalMemoryItems(input);
  const candidates = dedupeMemoryItems([
    ...(decisionResult.savedItem ? [decisionResult.savedItem] : []),
    ...localCandidates,
    ...persistentCandidates,
  ]).slice(0, MAX_CANDIDATE_ITEMS);

  const items = rankMemoryItems(candidates).slice(0, MAX_RETURNED_MEMORY_ITEMS);
  const used = items.length > 0;

  return {
    used,
    saved: decisionResult.saved,
    items,
    candidates,
    note: getMemoryNote({
      saved: decisionResult.saved,
      used,
      decision,
      deletedCount: decisionResult.deletedCount,
      savedItem: decisionResult.savedItem,
    }),
  };
};
