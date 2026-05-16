import { supabase } from '../../supabase';
import type { AurenContext } from '../core/types';
import {
  type AurenSearchDecision,
  type AurenSearchFreshness,
  type AurenSearchQuery,
  type AurenSearchQueryPurpose,
  type AurenSearchSourcePolicy,
} from './types';

const AUREN_QUERY_REWRITER_FUNCTION = 'auren-query-rewriter';
const QUERY_REWRITER_TIMEOUT_MS = 10_000;
const MAX_CONVERSATION_MESSAGES = 8;
const MAX_CONTEXT_MESSAGE_LENGTH = 1400;
const MAX_QUERY_LENGTH = 520;
const MAX_REASON_LENGTH = 800;
const DEFAULT_QUICK_QUERY_COUNT = 1;
const DEFAULT_DEEP_QUERY_COUNT = 3;

type QueryRewriterInput = {
  context: AurenContext;
  decision: AurenSearchDecision;
  maxQueries?: number;
};

type LlmRewrittenQuery = {
  query?: unknown;
  purpose?: unknown;
  priority?: unknown;
  notes?: unknown;
};

type LlmQueryRewriterResponse = {
  language?: unknown;
  mainQuery?: unknown;
  queries?: unknown;
  reasoning?: unknown;
  warnings?: unknown;
};

export type AurenQueryRewriteResult = {
  language?: string;
  mainQuery: string;
  queries: AurenSearchQuery[];
  reasoning: string;
  warnings: string[];
  usedFallback: boolean;
};

function createId(prefix: string) {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
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
      reject(new Error('Auren query rewriter timed out.'));
    }, timeoutMs);
  });

  return Promise.race([promise, timeoutPromise]).finally(() => {
    if (timeoutId) clearTimeout(timeoutId);
  });
}

function safeJsonStringify(value: unknown) {
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return '{}';
  }
}

function inferLanguage(text: string) {
  const normalized = text.toLowerCase();

  const finnishSignals = [
    'mikä',
    'mitä',
    'kuka',
    'miksi',
    'miten',
    'milloin',
    'haluan',
    'kerro',
    'etsi',
    'hae',
    'tarkista',
    'vertaa',
    'paras',
    'hinta',
    'saatavilla',
  ];

  return finnishSignals.some((signal) => normalized.includes(signal)) ? 'fi' : 'auto';
}

function isValidPurpose(value: unknown): value is AurenSearchQueryPurpose {
  return (
    value === 'primary' ||
    value === 'verification' ||
    value === 'countercheck' ||
    value === 'source_discovery' ||
    value === 'freshness_check'
  );
}

function getPriority(value: unknown, fallback: number) {
  if (typeof value !== 'number' || !Number.isFinite(value)) return fallback;

  return Math.max(1, Math.floor(value));
}

function getStringArray(value: unknown) {
  if (!Array.isArray(value)) return [];

  return value
    .filter((item): item is string => typeof item === 'string')
    .map((item) => cleanText(item))
    .filter(Boolean);
}

function parseJsonObject(value: unknown): Record<string, unknown> | null {
  if (!value) return null;

  if (typeof value === 'object' && !Array.isArray(value)) {
    const objectValue = value as Record<string, unknown>;

    if (typeof objectValue.output === 'string') {
      return parseJsonObject(objectValue.output);
    }

    if (typeof objectValue.text === 'string') {
      return parseJsonObject(objectValue.text);
    }

    if (typeof objectValue.answer === 'string') {
      return parseJsonObject(objectValue.answer);
    }

    return objectValue;
  }

  if (typeof value !== 'string') return null;

  const trimmed = value.trim();

  if (!trimmed) return null;

  try {
    const parsed = JSON.parse(trimmed);

    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
  } catch {
    const firstBrace = trimmed.indexOf('{');
    const lastBrace = trimmed.lastIndexOf('}');

    if (firstBrace >= 0 && lastBrace > firstBrace) {
      try {
        const parsed = JSON.parse(trimmed.slice(firstBrace, lastBrace + 1));

        if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
          return parsed as Record<string, unknown>;
        }
      } catch {
        return null;
      }
    }
  }

  return null;
}

function getPrimaryMessage(context: AurenContext) {
  return cleanText(context.message || context.input.message);
}

function getConversationForRewrite(context: AurenContext) {
  return context.conversation.slice(-MAX_CONVERSATION_MESSAGES).map((message) => ({
    role: message.role,
    content: limitText(message.content, MAX_CONTEXT_MESSAGE_LENGTH),
  }));
}

function getFreshnessInstruction(freshness: AurenSearchFreshness) {
  if (freshness === 'realtime') return 'Prioritize real-time or very recent sources.';
  if (freshness === 'today') return 'Prioritize sources from today or the most recent available updates.';
  if (freshness === 'week') return 'Prioritize sources from the last week when possible.';
  if (freshness === 'month') return 'Prioritize sources from the last month when possible.';
  if (freshness === 'year') return 'Prioritize sources from the current year when possible.';
  if (freshness === 'timeless') return 'Freshness is less important than reliable source quality.';

  return 'Use current sources if the topic may have changed.';
}

function getSourcePolicyInstruction(policy: AurenSearchSourcePolicy) {
  const lines = [
    policy.preferOfficialSources ? 'Prefer official, primary, or authoritative sources.' : '',
    policy.preferRecentSources ? 'Prefer recent sources when possible.' : '',
    policy.requireMultipleSources ? `Use multiple sources when possible. Minimum target: ${policy.minSourceCount}.` : '',
    policy.preferredDomains.length > 0 ? `Prefer these domains: ${policy.preferredDomains.join(', ')}.` : '',
    policy.blockedDomains.length > 0 ? `Avoid these domains: ${policy.blockedDomains.join(', ')}.` : '',
    policy.allowedSourceTypes.length > 0 ? `Useful source types: ${policy.allowedSourceTypes.join(', ')}.` : '',
    policy.blockedSourceTypes.length > 0 ? `Avoid source types: ${policy.blockedSourceTypes.join(', ')}.` : '',
  ].filter(Boolean);

  return lines.length > 0 ? lines.join('\n') : 'Use reliable sources.';
}

function getSafetyInstruction(decision: AurenSearchDecision) {
  const lines = [
    decision.safety.requireSourceBackedClaims
      ? 'Important claims must be source-backed. Do not invent facts.'
      : '',
    decision.safety.requireCautionForPeopleSearch
      ? 'For public-person queries, use only public reliable sources and avoid guessing identity.'
      : '',
    !decision.safety.allowSensitivePersonalInfo
      ? 'Do not search for or expose sensitive personal information.'
      : '',
    decision.safety.riskLevel === 'high'
      ? 'Use cautious wording because this may be sensitive or high-impact.'
      : '',
  ].filter(Boolean);

  return lines.length > 0 ? lines.join('\n') : 'Use careful, source-grounded wording.';
}

function getMaxQueries(input: QueryRewriterInput) {
  if (typeof input.maxQueries === 'number' && Number.isFinite(input.maxQueries)) {
    return Math.max(1, Math.min(Math.floor(input.maxQueries), 5));
  }

  return input.decision.depth === 'deep' ? DEFAULT_DEEP_QUERY_COUNT : DEFAULT_QUICK_QUERY_COUNT;
}

function buildInstructions(input: QueryRewriterInput) {
  const maxQueries = getMaxQueries(input);

  return [
    'You are the Query Rewriter for Auren Search.',
    '',
    'Your job is to rewrite the user request into better browser-search queries.',
    '',
    'Return strict JSON only. Do not include Markdown. Do not include explanations outside JSON.',
    '',
    'Rules:',
    '- Do not answer the user.',
    '- Do not invent names, facts, dates, places, or assumptions.',
    '- Preserve the user’s actual intent.',
    '- Use the conversation context only to clarify ambiguous references.',
    '- Rewrite the query so a browser-search model can find reliable information.',
    '- Prefer source-backed, public, and verifiable information.',
    '- Do not include private or sensitive personal data unless the user explicitly provided it and the search policy allows it.',
    '- For public-person queries, phrase the query cautiously and require public reliable sources.',
    '- For product, price, documentation, news, or current-info queries, make the search task current and specific.',
    '- For deep search, create multiple queries: primary, verification, and countercheck.',
    `- Return at most ${maxQueries} queries.`,
    '',
    'Freshness policy:',
    getFreshnessInstruction(input.decision.freshness),
    '',
    'Source policy:',
    getSourcePolicyInstruction(input.decision.sourcePolicy),
    '',
    'Safety policy:',
    getSafetyInstruction(input.decision),
    '',
    'Required JSON shape:',
    '{',
    '  "language": "auto" | "fi" | "en" | string,',
    '  "mainQuery": "best single browser-search query",',
    '  "queries": [',
    '    {',
    '      "query": "browser-search query",',
    '      "purpose": "primary" | "verification" | "countercheck" | "source_discovery" | "freshness_check",',
    '      "priority": number,',
    '      "notes": "short internal note"',
    '    }',
    '  ],',
    '  "reasoning": "short internal explanation of rewrite strategy",',
    '  "warnings": ["short internal warning"]',
    '}',
  ].join('\n');
}

function buildPayload(input: QueryRewriterInput) {
  const context = input.context;
  const userMessage = getPrimaryMessage(context);

  return {
    instructions: buildInstructions(input),
    context: {
      userMessage: limitText(userMessage, MAX_CONTEXT_MESSAGE_LENGTH),
      language: inferLanguage(userMessage),
      mode: context.mode,
      intent: {
        intent: context.intent.intent,
        confidence: context.intent.confidence,
        reason: limitText(context.intent.reason, 600),
      },
      searchDecision: {
        shouldSearch: input.decision.shouldSearch,
        trigger: input.decision.trigger,
        depth: input.decision.depth,
        provider: input.decision.provider,
        preferredModel: input.decision.preferredModel,
        reason: input.decision.reason,
        freshness: input.decision.freshness,
        needsCurrentInfo: input.decision.needsCurrentInfo,
        needsSources: input.decision.needsSources,
        needsFreshnessCheck: input.decision.needsFreshnessCheck,
        safety: input.decision.safety,
        sourcePolicy: input.decision.sourcePolicy,
      },
      conversation: getConversationForRewrite(context),
      memory: {
        used: context.memory.used,
        saved: context.memory.saved,
        note: context.memory.note,
        items: context.memory.items.slice(0, 6).map((item) => ({
          type: item.type,
          text: limitText(item.text, 900),
          confidence: item.confidence,
        })),
      },
      user: {
        userId: context.user.userId,
        displayName: context.user.displayName,
        preferences: context.user.preferences,
      },
      environment: context.environment,
    },
    responseFormat: {
      type: 'json',
      name: 'auren_query_rewrite_result',
    },
  };
}

function createSearchQuery(params: {
  query: string;
  purpose: AurenSearchQueryPurpose;
  priority: number;
  decision: AurenSearchDecision;
  language?: string;
  notes?: string;
}): AurenSearchQuery {
  return {
    id: createId(`search_query_${params.purpose}`),
    query: limitText(params.query, MAX_QUERY_LENGTH),
    purpose: params.purpose,
    priority: params.priority,
    language: params.language,
    freshness: params.decision.freshness,
    preferredDomains: [...params.decision.sourcePolicy.preferredDomains],
    blockedDomains: [...params.decision.sourcePolicy.blockedDomains],
    notes: params.notes ? limitText(params.notes, 240) : undefined,
  };
}

function createFallbackPrimaryQuery(input: QueryRewriterInput) {
  const message = getPrimaryMessage(input.context);
  const language = inferLanguage(message);

  return limitText(
    [
      message,
      '',
      'Search task: answer the user using current, public, reliable, source-backed information.',
      getFreshnessInstruction(input.decision.freshness),
      getSourcePolicyInstruction(input.decision.sourcePolicy),
      getSafetyInstruction(input.decision),
      language === 'fi' ? 'Respond in Finnish if the user used Finnish.' : 'Respond in the user’s language.',
    ].join('\n'),
    MAX_QUERY_LENGTH,
  );
}

function createFallbackVerificationQuery(input: QueryRewriterInput) {
  const message = getPrimaryMessage(input.context);

  return limitText(
    [
      message,
      '',
      'Verification task: check whether the main facts are supported by reliable public sources.',
      getSourcePolicyInstruction(input.decision.sourcePolicy),
    ].join('\n'),
    MAX_QUERY_LENGTH,
  );
}

function createFallbackCountercheckQuery(input: QueryRewriterInput) {
  const message = getPrimaryMessage(input.context);

  return limitText(
    [
      message,
      '',
      'Countercheck task: look for conflicting, outdated, weak, or missing evidence.',
      getFreshnessInstruction(input.decision.freshness),
    ].join('\n'),
    MAX_QUERY_LENGTH,
  );
}

export function createFallbackQueryRewrite(input: QueryRewriterInput): AurenQueryRewriteResult {
  const language = inferLanguage(getPrimaryMessage(input.context));
  const queries: AurenSearchQuery[] = [
    createSearchQuery({
      query: createFallbackPrimaryQuery(input),
      purpose: 'primary',
      priority: 1,
      decision: input.decision,
      language,
      notes: 'Fallback primary query created without the LLM query rewriter.',
    }),
  ];

  if (input.decision.depth === 'deep' || input.decision.sourcePolicy.requireMultipleSources) {
    queries.push(
      createSearchQuery({
        query: createFallbackVerificationQuery(input),
        purpose: 'verification',
        priority: 2,
        decision: input.decision,
        language,
        notes: 'Fallback verification query for stronger source grounding.',
      }),
    );
  }

  if (input.decision.depth === 'deep') {
    queries.push(
      createSearchQuery({
        query: createFallbackCountercheckQuery(input),
        purpose: 'countercheck',
        priority: 3,
        decision: input.decision,
        language,
        notes: 'Fallback countercheck query for contradictions and uncertainty.',
      }),
    );
  }

  const limitedQueries = queries.slice(0, getMaxQueries(input));

  return {
    language,
    mainQuery: limitedQueries[0]?.query ?? createFallbackPrimaryQuery(input),
    queries: limitedQueries,
    reasoning: 'Fallback query rewrite used because the LLM query rewriter was unavailable or returned invalid output.',
    warnings: ['Query rewrite fallback was used.'],
    usedFallback: true,
  };
}

function normalizeLlmQueries(value: unknown, input: QueryRewriterInput, language?: string): AurenSearchQuery[] {
  if (!Array.isArray(value)) return [];

  const queries: AurenSearchQuery[] = [];

  value.forEach((item, index) => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) return;

    const objectValue = item as LlmRewrittenQuery;
    const query = cleanText(objectValue.query);
    const purpose: AurenSearchQueryPurpose = isValidPurpose(objectValue.purpose)
      ? objectValue.purpose
      : index === 0
        ? 'primary'
        : index === 1
          ? 'verification'
          : 'countercheck';

    if (!query) return;

    queries.push(
      createSearchQuery({
        query,
        purpose,
        priority: getPriority(objectValue.priority, index + 1),
        decision: input.decision,
        language,
        notes: cleanText(objectValue.notes, undefined),
      }),
    );
  });

  return queries
    .sort((a, b) => a.priority - b.priority)
    .slice(0, getMaxQueries(input));
}

function normalizeLlmResult(value: unknown, input: QueryRewriterInput): AurenQueryRewriteResult | null {
  const objectValue = parseJsonObject(value);

  if (!objectValue) return null;

  const language = cleanText(objectValue.language, inferLanguage(getPrimaryMessage(input.context)));
  const mainQuery = cleanText(objectValue.mainQuery);
  const warnings = getStringArray(objectValue.warnings).map((warning) => limitText(warning, 240));
  const reasoning = limitText(cleanText(objectValue.reasoning, 'LLM query rewrite completed.'), MAX_REASON_LENGTH);
  const queries = normalizeLlmQueries(objectValue.queries, input, language);

  if (queries.length === 0 && !mainQuery) return null;

  const finalQueries =
    queries.length > 0
      ? queries
      : [
          createSearchQuery({
            query: mainQuery,
            purpose: 'primary',
            priority: 1,
            decision: input.decision,
            language,
            notes: 'Primary query created from mainQuery because the query list was empty.',
          }),
        ];

  const finalMainQuery = mainQuery || finalQueries[0]?.query || '';

  if (!finalMainQuery) return null;

  return {
    language,
    mainQuery: limitText(finalMainQuery, MAX_QUERY_LENGTH),
    queries: finalQueries.slice(0, getMaxQueries(input)),
    reasoning,
    warnings,
    usedFallback: false,
  };
}

async function callLlmQueryRewriter(input: QueryRewriterInput): Promise<AurenQueryRewriteResult | null> {
  const response = await withTimeout(
    supabase.functions.invoke(AUREN_QUERY_REWRITER_FUNCTION, {
      body: buildPayload(input),
    }),
    QUERY_REWRITER_TIMEOUT_MS,
  );

  if (response.error) {
    return null;
  }

  return normalizeLlmResult(response.data, input);
}

export async function rewriteAurenSearchQuery(input: QueryRewriterInput): Promise<AurenQueryRewriteResult> {
  if (!input.decision.shouldSearch || input.decision.depth === 'none') {
    return {
      language: inferLanguage(getPrimaryMessage(input.context)),
      mainQuery: '',
      queries: [],
      reasoning: 'Search is not enabled for this request, so no query rewrite was created.',
      warnings: [],
      usedFallback: false,
    };
  }

  try {
    const llmResult = await callLlmQueryRewriter(input);

    if (llmResult && llmResult.queries.length > 0) {
      return llmResult;
    }
  } catch {
    // Fallback keeps Auren responsive if the query rewriter function is unavailable.
  }

  return createFallbackQueryRewrite(input);
}

export async function rewriteAurenSearchQueries(input: QueryRewriterInput): Promise<AurenSearchQuery[]> {
  const result = await rewriteAurenSearchQuery(input);

  return result.queries;
}

export function rewriteAurenSearchQuerySyncFallback(input: QueryRewriterInput): AurenQueryRewriteResult {
  if (!input.decision.shouldSearch || input.decision.depth === 'none') {
    return {
      language: inferLanguage(getPrimaryMessage(input.context)),
      mainQuery: '',
      queries: [],
      reasoning: 'Search is not enabled for this request, so no query rewrite was created.',
      warnings: [],
      usedFallback: false,
    };
  }

  return createFallbackQueryRewrite(input);
}

export function getPrimaryRewrittenQuery(result: AurenQueryRewriteResult) {
  return result.queries.find((query) => query.purpose === 'primary') ?? result.queries[0];
}
