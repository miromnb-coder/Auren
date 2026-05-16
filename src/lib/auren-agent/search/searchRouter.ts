import { supabase } from '../../supabase';
import {
  AUREN_DEFAULT_SEARCH_SAFETY_POLICY,
  AUREN_DEFAULT_SOURCE_POLICY,
  AUREN_NO_SEARCH_DECISION,
  AUREN_SEARCH_MODELS,
  getAurenSearchMetadata,
  isSearchEnabledByMetadata,
  type AurenSearchDecision,
  type AurenSearchDepth,
  type AurenSearchFreshness,
  type AurenSearchProvider,
  type AurenSearchRiskLevel,
  type AurenSearchRouterInput,
  type AurenSearchSafetyPolicy,
  type AurenSearchSourcePolicy,
  type AurenSearchSourceType,
  type AurenSearchTrigger,
} from './types';

const AUREN_SEARCH_ROUTER_FUNCTION = 'auren-search-router';
const ROUTER_TIMEOUT_MS = 9000;
const MAX_CONVERSATION_MESSAGES = 8;
const MAX_MESSAGE_LENGTH = 1800;

type LlmRouterResponse = {
  shouldSearch?: unknown;
  trigger?: unknown;
  depth?: unknown;
  provider?: unknown;
  preferredModel?: unknown;
  confidence?: unknown;
  reason?: unknown;
  needsCurrentInfo?: unknown;
  needsSources?: unknown;
  needsFreshnessCheck?: unknown;
  freshness?: unknown;
  safety?: unknown;
  sourcePolicy?: unknown;
  userFacingHint?: unknown;
};

type CompactRouterContext = {
  userMessage: string;
  mode: string;
  intent: {
    intent: string;
    confidence: number;
    reason: string;
  };
  metadata: Record<string, unknown>;
  conversation: {
    role: string;
    content: string;
  }[];
  memory: {
    used: boolean;
    saved: boolean;
    items: {
      type: string;
      text: string;
      confidence: number;
    }[];
  };
  environment: {
    now: string;
    timezone?: string;
    platform: string;
  };
};

function clampScore(value: unknown, fallback = 0.5) {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return fallback;
  }

  return Math.min(Math.max(value, 0), 1);
}

function cleanText(value: unknown, fallback = '') {
  if (typeof value !== 'string') return fallback;

  return value.replace(/\s+/g, ' ').trim() || fallback;
}

function limitText(value: string, maxLength: number) {
  const cleaned = cleanText(value);

  if (cleaned.length <= maxLength) return cleaned;

  return `${cleaned.slice(0, maxLength - 1).trim()}…`;
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;

  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => {
      reject(new Error('Auren search router timed out.'));
    }, timeoutMs);
  });

  return Promise.race([promise, timeoutPromise]).finally(() => {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
  });
}

function cloneSourcePolicy(policy: AurenSearchSourcePolicy): AurenSearchSourcePolicy {
  return {
    ...policy,
    allowedSourceTypes: [...policy.allowedSourceTypes],
    blockedSourceTypes: [...policy.blockedSourceTypes],
    preferredDomains: [...policy.preferredDomains],
    blockedDomains: [...policy.blockedDomains],
  };
}

function cloneSafetyPolicy(policy: AurenSearchSafetyPolicy): AurenSearchSafetyPolicy {
  return {
    ...policy,
  };
}

function createNoSearchDecision(reason = AUREN_NO_SEARCH_DECISION.reason): AurenSearchDecision {
  return {
    ...AUREN_NO_SEARCH_DECISION,
    reason,
    safety: cloneSafetyPolicy(AUREN_NO_SEARCH_DECISION.safety),
    sourcePolicy: cloneSourcePolicy(AUREN_NO_SEARCH_DECISION.sourcePolicy),
  };
}

function isValidDepth(value: unknown): value is AurenSearchDepth {
  return value === 'none' || value === 'quick' || value === 'deep';
}

function isValidTrigger(value: unknown): value is AurenSearchTrigger {
  return value === 'none' || value === 'manual' || value === 'auto' || value === 'forced';
}

function isValidProvider(value: unknown): value is AurenSearchProvider {
  return value === 'none' || value === 'groq_browser_search' || value === 'custom_web_search';
}

function isValidFreshness(value: unknown): value is AurenSearchFreshness {
  return (
    value === 'realtime' ||
    value === 'today' ||
    value === 'week' ||
    value === 'month' ||
    value === 'year' ||
    value === 'timeless' ||
    value === 'unknown'
  );
}

function isValidRiskLevel(value: unknown): value is AurenSearchRiskLevel {
  return value === 'low' || value === 'medium' || value === 'high';
}

function isValidSourceType(value: unknown): value is AurenSearchSourceType {
  return (
    value === 'official' ||
    value === 'documentation' ||
    value === 'news' ||
    value === 'academic' ||
    value === 'company' ||
    value === 'commerce' ||
    value === 'profile' ||
    value === 'social' ||
    value === 'forum' ||
    value === 'blog' ||
    value === 'database' ||
    value === 'unknown'
  );
}

function getBoolean(value: unknown, fallback = false) {
  return typeof value === 'boolean' ? value : fallback;
}

function getStringArray(value: unknown) {
  if (!Array.isArray(value)) return [];

  return value.filter((item): item is string => typeof item === 'string' && item.trim().length > 0);
}

function getSourceTypeArray(value: unknown, fallback: AurenSearchSourceType[]) {
  if (!Array.isArray(value)) return fallback;

  const validTypes = value.filter(isValidSourceType);

  return validTypes.length > 0 ? validTypes : fallback;
}

function getSafetyPolicy(value: unknown): AurenSearchSafetyPolicy {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return cloneSafetyPolicy(AUREN_DEFAULT_SEARCH_SAFETY_POLICY);
  }

  const objectValue = value as Record<string, unknown>;

  return {
    allowPersonalInfoSearch: getBoolean(
      objectValue.allowPersonalInfoSearch,
      AUREN_DEFAULT_SEARCH_SAFETY_POLICY.allowPersonalInfoSearch,
    ),
    allowSensitivePersonalInfo: getBoolean(
      objectValue.allowSensitivePersonalInfo,
      AUREN_DEFAULT_SEARCH_SAFETY_POLICY.allowSensitivePersonalInfo,
    ),
    allowMedicalAdviceSearch: getBoolean(
      objectValue.allowMedicalAdviceSearch,
      AUREN_DEFAULT_SEARCH_SAFETY_POLICY.allowMedicalAdviceSearch,
    ),
    allowLegalAdviceSearch: getBoolean(
      objectValue.allowLegalAdviceSearch,
      AUREN_DEFAULT_SEARCH_SAFETY_POLICY.allowLegalAdviceSearch,
    ),
    allowFinancialAdviceSearch: getBoolean(
      objectValue.allowFinancialAdviceSearch,
      AUREN_DEFAULT_SEARCH_SAFETY_POLICY.allowFinancialAdviceSearch,
    ),
    requireCautionForPeopleSearch: getBoolean(
      objectValue.requireCautionForPeopleSearch,
      AUREN_DEFAULT_SEARCH_SAFETY_POLICY.requireCautionForPeopleSearch,
    ),
    requireSourceBackedClaims: getBoolean(
      objectValue.requireSourceBackedClaims,
      AUREN_DEFAULT_SEARCH_SAFETY_POLICY.requireSourceBackedClaims,
    ),
    riskLevel: isValidRiskLevel(objectValue.riskLevel)
      ? objectValue.riskLevel
      : AUREN_DEFAULT_SEARCH_SAFETY_POLICY.riskLevel,
  };
}

function getSourcePolicy(value: unknown): AurenSearchSourcePolicy {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return cloneSourcePolicy(AUREN_DEFAULT_SOURCE_POLICY);
  }

  const objectValue = value as Record<string, unknown>;
  const minSourceCount =
    typeof objectValue.minSourceCount === 'number' && Number.isFinite(objectValue.minSourceCount)
      ? Math.max(0, Math.floor(objectValue.minSourceCount))
      : AUREN_DEFAULT_SOURCE_POLICY.minSourceCount;
  const maxSourceCount =
    typeof objectValue.maxSourceCount === 'number' && Number.isFinite(objectValue.maxSourceCount)
      ? Math.max(minSourceCount, Math.floor(objectValue.maxSourceCount))
      : AUREN_DEFAULT_SOURCE_POLICY.maxSourceCount;

  return {
    preferOfficialSources: getBoolean(
      objectValue.preferOfficialSources,
      AUREN_DEFAULT_SOURCE_POLICY.preferOfficialSources,
    ),
    preferRecentSources: getBoolean(
      objectValue.preferRecentSources,
      AUREN_DEFAULT_SOURCE_POLICY.preferRecentSources,
    ),
    requireMultipleSources: getBoolean(
      objectValue.requireMultipleSources,
      AUREN_DEFAULT_SOURCE_POLICY.requireMultipleSources,
    ),
    minSourceCount,
    maxSourceCount,
    allowedSourceTypes: getSourceTypeArray(
      objectValue.allowedSourceTypes,
      AUREN_DEFAULT_SOURCE_POLICY.allowedSourceTypes,
    ),
    blockedSourceTypes: getSourceTypeArray(
      objectValue.blockedSourceTypes,
      AUREN_DEFAULT_SOURCE_POLICY.blockedSourceTypes,
    ),
    preferredDomains: getStringArray(objectValue.preferredDomains),
    blockedDomains: getStringArray(objectValue.blockedDomains),
  };
}

function getPreferredModel(depth: AurenSearchDepth, value?: unknown) {
  if (value === AUREN_SEARCH_MODELS.quick || value === AUREN_SEARCH_MODELS.deep) {
    return value;
  }

  return depth === 'deep' ? AUREN_SEARCH_MODELS.deep : AUREN_SEARCH_MODELS.quick;
}

function getProvider(depth: AurenSearchDepth, value?: unknown): AurenSearchProvider {
  if (depth === 'none') return 'none';

  return isValidProvider(value) && value !== 'none' ? value : 'groq_browser_search';
}

function createManualSearchDecision(input: AurenSearchRouterInput): AurenSearchDecision {
  const metadata = getAurenSearchMetadata(input.metadata ?? input.context.input.metadata);
  const depth: AurenSearchDepth = metadata.searchDepth === 'deep' ? 'deep' : 'quick';
  const trigger: AurenSearchTrigger = metadata.forceSearch === true ? 'forced' : 'manual';

  return {
    shouldSearch: true,
    trigger,
    depth,
    provider: 'groq_browser_search',
    preferredModel: getPreferredModel(depth),
    confidence: 1,
    reason: 'The user enabled Search for this message.',
    needsCurrentInfo: true,
    needsSources: true,
    needsFreshnessCheck: true,
    freshness: 'unknown',
    safety: cloneSafetyPolicy(AUREN_DEFAULT_SEARCH_SAFETY_POLICY),
    sourcePolicy: {
      ...cloneSourcePolicy(AUREN_DEFAULT_SOURCE_POLICY),
      preferOfficialSources: true,
      preferRecentSources: true,
      requireMultipleSources: depth === 'deep',
      minSourceCount: depth === 'deep' ? 2 : 1,
      maxSourceCount: depth === 'deep' ? 8 : 5,
    },
    userFacingHint: 'Auren will use current web information for the next answer.',
  };
}

function createRouterContext(input: AurenSearchRouterInput): CompactRouterContext {
  const context = input.context;
  const metadata = getAurenSearchMetadata(input.metadata ?? context.input.metadata);

  return {
    userMessage: limitText(context.message || context.input.message || '', MAX_MESSAGE_LENGTH),
    mode: context.mode,
    intent: {
      intent: context.intent.intent,
      confidence: context.intent.confidence,
      reason: limitText(context.intent.reason, 600),
    },
    metadata: metadata as Record<string, unknown>,
    conversation: context.conversation.slice(-MAX_CONVERSATION_MESSAGES).map((message) => ({
      role: message.role,
      content: limitText(message.content, MAX_MESSAGE_LENGTH),
    })),
    memory: {
      used: context.memory.used,
      saved: context.memory.saved,
      items: context.memory.items.slice(0, 6).map((item) => ({
        type: item.type,
        text: limitText(item.text, 900),
        confidence: item.confidence,
      })),
    },
    environment: {
      now: context.environment.now,
      timezone: context.environment.timezone,
      platform: context.environment.platform,
    },
  };
}

function createRouterInstructions() {
  return [
    'You are the Search Router for Auren, a personal AI agent.',
    '',
    'Your only job is to decide whether the next answer needs web search.',
    '',
    'Return strict JSON only.',
    '',
    'Decision rules:',
    '- Use search when the answer needs current, recent, source-backed, price, availability, news, product, documentation, legal, medical, financial, public-person, or verification information.',
    '- Use no search for normal reasoning, writing, rewriting, translation, brainstorming, coding from provided context, app planning, or personal advice that does not require current facts.',
    '- If the user manually enabled search in metadata, search should already be handled before you are called, but still return a consistent search decision if present.',
    '- Choose quick for simple current facts.',
    '- Choose deep for comparisons, multi-source research, important decisions, high-stakes topics, uncertain claims, or when multiple sources are needed.',
    '- Be conservative with claims about people. Require public sources and avoid guessing.',
    '',
    'JSON schema:',
    '{',
    '  "shouldSearch": true | false,',
    '  "trigger": "auto",',
    '  "depth": "none" | "quick" | "deep",',
    '  "provider": "none" | "groq_browser_search",',
    '  "preferredModel": "openai/gpt-oss-20b" | "openai/gpt-oss-120b",',
    '  "confidence": number between 0 and 1,',
    '  "reason": "short internal reason",',
    '  "needsCurrentInfo": true | false,',
    '  "needsSources": true | false,',
    '  "needsFreshnessCheck": true | false,',
    '  "freshness": "realtime" | "today" | "week" | "month" | "year" | "timeless" | "unknown",',
    '  "safety": {',
    '    "allowPersonalInfoSearch": boolean,',
    '    "allowSensitivePersonalInfo": false,',
    '    "allowMedicalAdviceSearch": boolean,',
    '    "allowLegalAdviceSearch": boolean,',
    '    "allowFinancialAdviceSearch": boolean,',
    '    "requireCautionForPeopleSearch": boolean,',
    '    "requireSourceBackedClaims": boolean,',
    '    "riskLevel": "low" | "medium" | "high"',
    '  },',
    '  "sourcePolicy": {',
    '    "preferOfficialSources": boolean,',
    '    "preferRecentSources": boolean,',
    '    "requireMultipleSources": boolean,',
    '    "minSourceCount": number,',
    '    "maxSourceCount": number,',
    '    "allowedSourceTypes": ["official" | "documentation" | "news" | "academic" | "company" | "commerce" | "profile" | "social" | "forum" | "blog" | "database" | "unknown"],',
    '    "blockedSourceTypes": ["official" | "documentation" | "news" | "academic" | "company" | "commerce" | "profile" | "social" | "forum" | "blog" | "database" | "unknown"],',
    '    "preferredDomains": string[],',
    '    "blockedDomains": string[]',
    '  },',
    '  "userFacingHint": "short optional hint"',
    '}',
  ].join('\n');
}

function normalizeLlmDecision(value: LlmRouterResponse | null): AurenSearchDecision | null {
  if (!value) return null;

  const shouldSearch = getBoolean(value.shouldSearch, false);
  const depth = shouldSearch
    ? isValidDepth(value.depth) && value.depth !== 'none'
      ? value.depth
      : 'quick'
    : 'none';
  const trigger: AurenSearchTrigger = isValidTrigger(value.trigger) && value.trigger !== 'manual' && value.trigger !== 'forced'
    ? value.trigger
    : 'auto';
  const freshness: AurenSearchFreshness = isValidFreshness(value.freshness) ? value.freshness : 'unknown';
  const safety = getSafetyPolicy(value.safety);
  const sourcePolicy = getSourcePolicy(value.sourcePolicy);
  const provider = getProvider(depth, value.provider);
  const preferredModel = getPreferredModel(depth, value.preferredModel);

  return {
    shouldSearch,
    trigger: shouldSearch ? trigger : 'none',
    depth,
    provider,
    preferredModel,
    confidence: clampScore(value.confidence, shouldSearch ? 0.72 : 0.7),
    reason: cleanText(
      value.reason,
      shouldSearch ? 'The router determined that web search is useful.' : 'The router determined that web search is not needed.',
    ),
    needsCurrentInfo: getBoolean(value.needsCurrentInfo, shouldSearch),
    needsSources: getBoolean(value.needsSources, shouldSearch),
    needsFreshnessCheck: getBoolean(value.needsFreshnessCheck, shouldSearch && freshness !== 'timeless'),
    freshness,
    safety,
    sourcePolicy,
    userFacingHint: cleanText(value.userFacingHint, undefined),
  };
}

function parseRouterResponse(value: unknown): LlmRouterResponse | null {
  if (!value) return null;

  if (typeof value === 'object' && !Array.isArray(value)) {
    const objectValue = value as Record<string, unknown>;

    if (typeof objectValue.output === 'string') {
      return parseRouterResponse(objectValue.output);
    }

    if (typeof objectValue.text === 'string') {
      return parseRouterResponse(objectValue.text);
    }

    if (typeof objectValue.answer === 'string') {
      return parseRouterResponse(objectValue.answer);
    }

    return objectValue as LlmRouterResponse;
  }

  if (typeof value === 'string') {
    try {
      return JSON.parse(value) as LlmRouterResponse;
    } catch {
      return null;
    }
  }

  return null;
}

async function callLlmSearchRouter(input: AurenSearchRouterInput): Promise<AurenSearchDecision | null> {
  const payload = {
    instructions: createRouterInstructions(),
    context: createRouterContext(input),
    responseFormat: {
      type: 'json',
      name: 'auren_search_router_decision',
    },
  };

  const response = await withTimeout(
    supabase.functions.invoke(AUREN_SEARCH_ROUTER_FUNCTION, {
      body: payload,
    }),
    ROUTER_TIMEOUT_MS,
  );

  if (response.error) {
    return null;
  }

  return normalizeLlmDecision(parseRouterResponse(response.data));
}

function createFallbackAutoDecision(input: AurenSearchRouterInput): AurenSearchDecision {
  const context = input.context;
  const text = `${context.message || context.input.message || ''}`.toLowerCase();
  const currentSignals = [
    'latest',
    'current',
    'today',
    'now',
    'price',
    'available',
    'released',
    'news',
    'source',
    'verify',
    'docs',
    'api',
    'version',
    'uusin',
    'nykyinen',
    'tänään',
    'nyt',
    'hinta',
    'saatavilla',
    'uutiset',
    'tarkista',
    'varmista',
    'lähde',
    'dokumentaatio',
    'versio',
  ];

  const deepSignals = [
    'compare',
    'review',
    'research',
    'analyze',
    'best',
    'versus',
    'vs',
    'vertaa',
    'arvostelu',
    'tutki',
    'analysoi',
    'paras',
    'parhaat',
  ];

  const shouldSearch = currentSignals.some((signal) => text.includes(signal));

  if (!shouldSearch) {
    return createNoSearchDecision('Fallback router found no strong need for web search.');
  }

  const depth: AurenSearchDepth = deepSignals.some((signal) => text.includes(signal)) ? 'deep' : 'quick';

  return {
    shouldSearch: true,
    trigger: 'auto',
    depth,
    provider: 'groq_browser_search',
    preferredModel: getPreferredModel(depth),
    confidence: depth === 'deep' ? 0.74 : 0.66,
    reason: 'Fallback router detected that current or source-backed information may be needed.',
    needsCurrentInfo: true,
    needsSources: true,
    needsFreshnessCheck: true,
    freshness: 'unknown',
    safety: cloneSafetyPolicy(AUREN_DEFAULT_SEARCH_SAFETY_POLICY),
    sourcePolicy: {
      ...cloneSourcePolicy(AUREN_DEFAULT_SOURCE_POLICY),
      preferOfficialSources: true,
      preferRecentSources: true,
      requireMultipleSources: depth === 'deep',
      minSourceCount: depth === 'deep' ? 2 : 1,
      maxSourceCount: depth === 'deep' ? 8 : 5,
    },
    userFacingHint: 'Auren will use current web information for the next answer.',
  };
}

export async function routeAurenSearch(input: AurenSearchRouterInput): Promise<AurenSearchDecision> {
  const metadata = getAurenSearchMetadata(input.metadata ?? input.context.input.metadata);

  if (isSearchEnabledByMetadata(metadata)) {
    return createManualSearchDecision(input);
  }

  if (metadata.disableAutoSearch === true) {
    return createNoSearchDecision('Auto search is disabled for this message.');
  }

  try {
    const llmDecision = await callLlmSearchRouter(input);

    if (llmDecision) {
      return llmDecision;
    }
  } catch {
    // Keep the app responsive if the router function is unavailable.
  }

  return createFallbackAutoDecision(input);
}

export async function shouldUseAurenSearch(input: AurenSearchRouterInput) {
  const decision = await routeAurenSearch(input);

  return decision.shouldSearch;
}

export async function explainAurenSearchDecision(input: AurenSearchRouterInput) {
  const decision = await routeAurenSearch(input);

  return {
    shouldSearch: decision.shouldSearch,
    trigger: decision.trigger,
    depth: decision.depth,
    confidence: decision.confidence,
    reason: decision.reason,
    freshness: decision.freshness,
    provider: decision.provider,
    model: decision.preferredModel,
  };
}

export function routeAurenSearchSyncFallback(input: AurenSearchRouterInput): AurenSearchDecision {
  const metadata = getAurenSearchMetadata(input.metadata ?? input.context.input.metadata);

  if (isSearchEnabledByMetadata(metadata)) {
    return createManualSearchDecision(input);
  }

  if (metadata.disableAutoSearch === true) {
    return createNoSearchDecision('Auto search is disabled for this message.');
  }

  return createFallbackAutoDecision(input);
}
