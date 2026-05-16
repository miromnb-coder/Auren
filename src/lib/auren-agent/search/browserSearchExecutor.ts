import { supabase } from '../../supabase';
import {
  AUREN_SEARCH_MODELS,
  type AurenBrowserSearchFunctionRequest,
  type AurenBrowserSearchFunctionResponse,
  type AurenSearchExecutorInput,
  type AurenSearchFreshness,
  type AurenSearchModel,
  type AurenSearchPlan,
  type AurenSearchProvider,
  type AurenSearchQuery,
  type AurenSearchRawResult,
  type AurenSearchSafetyPolicy,
  type AurenSearchSourcePolicy,
} from './types';

const AUREN_BROWSER_SEARCH_FUNCTION = 'auren-browser-search';

const BROWSER_SEARCH_CALL_TIMEOUT_MS = 50_000;
const MAX_CONVERSATION_MESSAGES = 8;
const MAX_CONTEXT_MESSAGE_LENGTH = 1600;
const MAX_QUERY_LENGTH = 1200;
const MAX_INSTRUCTION_LENGTH = 5000;
const MAX_RAW_TEXT_LENGTH = 12_000;

export type AurenBrowserSearchCallResult = {
  query: AurenSearchQuery;
  rawResult: AurenSearchRawResult;
};

export type AurenBrowserSearchExecutorResult = {
  rawResults: AurenSearchRawResult[];
  calls: AurenBrowserSearchCallResult[];
  warnings: string[];
  startedAt: string;
  completedAt: string;
  latencyMs: number;
  executedQueryCount: number;
  successCount: number;
  failedCount: number;
};

type BrowserSearchClock = {
  startedAt: string;
  completedAt: string;
  latencyMs: number;
};

type SupabaseBrowserSearchCallResult = {
  response: AurenBrowserSearchFunctionResponse | null;
  error?: string;
  clock: BrowserSearchClock;
};

function createId(prefix: string) {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

function nowIso() {
  return new Date().toISOString();
}

function getLatencyMs(startedAt: string, completedAt: string) {
  return Math.max(0, new Date(completedAt).getTime() - new Date(startedAt).getTime());
}

function cleanText(value: unknown, fallback = '') {
  if (typeof value !== 'string') return fallback;

  return value.replace(/\s+/g, ' ').trim() || fallback;
}

function cleanAnswerText(value: unknown, fallback = '') {
  if (typeof value !== 'string') return fallback;

  return (
    value
      .replace(/\r\n/g, '\n')
      .replace(/\r/g, '\n')
      .replace(/[ \t]+/g, ' ')
      .replace(/ *\n */g, '\n')
      .replace(/\n{3,}/g, '\n\n')
      .trim() || fallback
  );
}

function limitText(value: string, maxLength: number) {
  const cleaned = cleanText(value);

  if (cleaned.length <= maxLength) return cleaned;

  return `${cleaned.slice(0, maxLength - 1).trim()}…`;
}

function limitRawText(value: string) {
  const cleaned = cleanAnswerText(value);

  if (cleaned.length <= MAX_RAW_TEXT_LENGTH) return cleaned;

  return `${cleaned.slice(0, MAX_RAW_TEXT_LENGTH - 1).trim()}…`;
}

function safeJsonStringify(value: unknown) {
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return '{}';
  }
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;

  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => {
      reject(new Error('Auren browser search timed out.'));
    }, timeoutMs);
  });

  return Promise.race([promise, timeoutPromise]).finally(() => {
    if (timeoutId) clearTimeout(timeoutId);
  });
}

function getConversationForSearch(input: AurenSearchExecutorInput) {
  return input.context.conversation.slice(-MAX_CONVERSATION_MESSAGES).map((message) => ({
    role: message.role,
    content: limitText(message.content, MAX_CONTEXT_MESSAGE_LENGTH),
  }));
}

function getPrimaryUserMessage(input: AurenSearchExecutorInput) {
  return cleanText(input.context.message || input.context.input.message);
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

function getFreshnessPhrase(freshness: AurenSearchFreshness) {
  if (freshness === 'realtime') return 'Prioritize real-time or very recent sources.';
  if (freshness === 'today') return 'Prioritize sources from today or the newest available updates.';
  if (freshness === 'week') return 'Prioritize sources from the last week when possible.';
  if (freshness === 'month') return 'Prioritize sources from the last month when possible.';
  if (freshness === 'year') return 'Prioritize sources from the current year when possible.';
  if (freshness === 'timeless') return 'Freshness is less important than reliable source quality.';

  return 'Use current sources if the topic may have changed.';
}

function getSourcePolicyPhrase(policy: AurenSearchSourcePolicy) {
  const lines = [
    policy.preferOfficialSources ? '- Prefer official, primary, or authoritative sources.' : '',
    policy.preferRecentSources ? '- Prefer recent sources when possible.' : '',
    policy.requireMultipleSources ? `- Check at least ${policy.minSourceCount} reliable sources when possible.` : '',
    policy.allowedSourceTypes.length > 0 ? `- Useful source types: ${policy.allowedSourceTypes.join(', ')}.` : '',
    policy.blockedSourceTypes.length > 0 ? `- Avoid source types: ${policy.blockedSourceTypes.join(', ')}.` : '',
    policy.preferredDomains.length > 0 ? `- Prefer these domains: ${policy.preferredDomains.join(', ')}.` : '',
    policy.blockedDomains.length > 0 ? `- Avoid these domains: ${policy.blockedDomains.join(', ')}.` : '',
  ].filter(Boolean);

  return lines.length > 0 ? lines.join('\n') : '- Use reliable sources.';
}

function getSafetyPolicyPhrase(policy: AurenSearchSafetyPolicy) {
  const lines = [
    policy.requireSourceBackedClaims ? '- Do not make important claims unless search results support them.' : '',
    policy.requireCautionForPeopleSearch
      ? '- For public-person queries, use only public reliable sources and avoid guessing identity.'
      : '',
    !policy.allowSensitivePersonalInfo ? '- Do not search for or expose sensitive personal information.' : '',
    policy.riskLevel === 'high'
      ? '- Use careful wording because this may be high-risk or personally sensitive.'
      : '',
  ].filter(Boolean);

  return lines.length > 0 ? lines.join('\n') : '- Use careful, source-grounded wording.';
}

function isSearchExecutable(plan: AurenSearchPlan) {
  return plan.depth !== 'none' && plan.provider !== 'none' && plan.maxSearchCalls > 0 && plan.queries.length > 0;
}

function getExecutableQueries(plan: AurenSearchPlan) {
  if (!isSearchExecutable(plan)) return [];

  return plan.queries
    .slice()
    .sort((a, b) => a.priority - b.priority)
    .slice(0, Math.max(0, plan.maxSearchCalls));
}

function getExpectedModel(plan: AurenSearchPlan): AurenSearchModel {
  if (plan.model === AUREN_SEARCH_MODELS.deep || plan.model === AUREN_SEARCH_MODELS.quick) {
    return plan.model;
  }

  return plan.depth === 'deep' ? AUREN_SEARCH_MODELS.deep : AUREN_SEARCH_MODELS.quick;
}

function getExpectedProvider(plan: AurenSearchPlan): AurenSearchProvider {
  if (plan.provider === 'groq_browser_search' || plan.provider === 'custom_web_search') {
    return plan.provider;
  }

  return plan.depth === 'none' ? 'none' : 'groq_browser_search';
}

function buildBrowserSearchInstructions(input: AurenSearchExecutorInput, query: AurenSearchQuery) {
  const plan = input.plan;
  const userMessage = getPrimaryUserMessage(input);
  const language = inferLanguage(userMessage);

  const instructions = [
    'You are Auren Search, the web-search execution layer for a premium personal AI agent.',
    '',
    'Use browser search to answer the user with current, source-backed information.',
    '',
    'Response rules:',
    '- Answer in the same language the user used.',
    '- Keep the answer clear, natural, and mobile-friendly.',
    '- Do not expose internal JSON, raw plans, or tool implementation details.',
    '- Do not invent sources, facts, dates, prices, availability, or identities.',
    '- If search results are weak, unclear, outdated, or conflicting, say that clearly.',
    '- Avoid overconfident claims about people, health, law, finance, or safety.',
    '- Give the direct answer first, then add useful context.',
    '',
    'Original user message:',
    userMessage,
    '',
    'Query purpose:',
    query.purpose,
    '',
    'Search depth:',
    plan.depth === 'deep'
      ? 'Deep search: verify facts, check more than one angle, and surface uncertainty when needed.'
      : 'Quick search: answer directly, but stay source-grounded.',
    '',
    'Freshness:',
    getFreshnessPhrase(query.freshness),
    '',
    'Source policy:',
    getSourcePolicyPhrase(plan.sourcePolicy),
    '',
    'Safety policy:',
    getSafetyPolicyPhrase(plan.safety),
    '',
    language === 'fi'
      ? 'The user appears to use Finnish. Reply in Finnish unless the user clearly requested another language.'
      : 'Reply in the user’s language.',
  ].join('\n');

  return limitText(instructions, MAX_INSTRUCTION_LENGTH);
}

function buildBrowserSearchRequest(
  input: AurenSearchExecutorInput,
  query: AurenSearchQuery,
): AurenBrowserSearchFunctionRequest {
  const plan = input.plan;
  const userMessage = getPrimaryUserMessage(input);

  return {
    message: limitText(query.query, MAX_QUERY_LENGTH),
    instructions: buildBrowserSearchInstructions(input, query),
    context: {
      userMessage,
      mode: input.context.mode,
      conversation: getConversationForSearch(input),
      searchPlan: plan,
      memory: {
        used: input.context.memory.used,
        saved: input.context.memory.saved,
        note: input.context.memory.note,
        items: input.context.memory.items.slice(0, 6).map((item) => ({
          type: item.type,
          text: limitText(item.text, 900),
          confidence: item.confidence,
        })),
      },
      user: {
        userId: input.context.user.userId,
        displayName: input.context.user.displayName,
        preferences: input.context.user.preferences,
      },
      environment: input.context.environment,
    },
  };
}

function isUsableBrowserSearchResponse(value: unknown): value is AurenBrowserSearchFunctionResponse {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

async function callBrowserSearchFunction(
  input: AurenSearchExecutorInput,
  query: AurenSearchQuery,
): Promise<SupabaseBrowserSearchCallResult> {
  const startedAt = nowIso();

  try {
    const response = await withTimeout(
      supabase.functions.invoke(AUREN_BROWSER_SEARCH_FUNCTION, {
        body: buildBrowserSearchRequest(input, query),
      }),
      BROWSER_SEARCH_CALL_TIMEOUT_MS,
    );

    const completedAt = nowIso();

    if (response.error) {
      return {
        response: null,
        error: response.error.message || 'browser_search_function_error',
        clock: {
          startedAt,
          completedAt,
          latencyMs: getLatencyMs(startedAt, completedAt),
        },
      };
    }

    return {
      response: isUsableBrowserSearchResponse(response.data) ? response.data : null,
      error: isUsableBrowserSearchResponse(response.data) ? undefined : 'invalid_browser_search_response',
      clock: {
        startedAt,
        completedAt,
        latencyMs: getLatencyMs(startedAt, completedAt),
      },
    };
  } catch (error) {
    const completedAt = nowIso();

    return {
      response: null,
      error: error instanceof Error ? error.message : 'unknown_browser_search_error',
      clock: {
        startedAt,
        completedAt,
        latencyMs: getLatencyMs(startedAt, completedAt),
      },
    };
  }
}

function getResponseModel(plan: AurenSearchPlan, response: AurenBrowserSearchFunctionResponse | null): AurenSearchModel {
  if (response?.model === AUREN_SEARCH_MODELS.deep || response?.model === AUREN_SEARCH_MODELS.quick) {
    return response.model;
  }

  return getExpectedModel(plan);
}

function getUsageFromResponse(response: AurenBrowserSearchFunctionResponse | null) {
  const debug = response?.debug;

  if (!debug || typeof debug !== 'object' || Array.isArray(debug)) {
    return undefined;
  }

  const usage = (debug as Record<string, unknown>).usage;

  if (!usage || typeof usage !== 'object' || Array.isArray(usage)) {
    return undefined;
  }

  return usage as Record<string, unknown>;
}

function getErrorFromResponse(response: AurenBrowserSearchFunctionResponse | null, explicitError?: string) {
  if (explicitError) return explicitError;

  const fallbackReason = cleanText(response?.fallbackReason);
  if (fallbackReason) return fallbackReason;

  const groqError = cleanText(response?.groqError);
  if (groqError) return groqError;

  return undefined;
}

function createRawResult(
  plan: AurenSearchPlan,
  query: AurenSearchQuery,
  callResult: SupabaseBrowserSearchCallResult,
): AurenSearchRawResult {
  const answer = limitRawText(cleanAnswerText(callResult.response?.answer));
  const error = getErrorFromResponse(callResult.response, callResult.error);
  const success = Boolean(callResult.response && !callResult.response.fallback && answer);

  return {
    id: createId('search_raw_result'),
    provider: getExpectedProvider(plan),
    model: getResponseModel(plan, callResult.response),
    queryIds: [query.id],
    success,
    answer: answer || undefined,
    rawText: answer || undefined,
    error,
    startedAt: callResult.clock.startedAt,
    completedAt: callResult.clock.completedAt,
    latencyMs: callResult.clock.latencyMs,
    usage: getUsageFromResponse(callResult.response),
  };
}

function createSkippedRawResult(plan: AurenSearchPlan, query: AurenSearchQuery, reason: string): AurenSearchRawResult {
  const timestamp = nowIso();

  return {
    id: createId('search_raw_result_skipped'),
    provider: getExpectedProvider(plan),
    model: getExpectedModel(plan),
    queryIds: [query.id],
    success: false,
    error: reason,
    startedAt: timestamp,
    completedAt: timestamp,
    latencyMs: 0,
  };
}

function createNoExecutablePlanResult(input: AurenSearchExecutorInput, reason: string): AurenBrowserSearchExecutorResult {
  const startedAt = nowIso();
  const completedAt = nowIso();

  const skippedResults = input.plan.queries.map((query) => createSkippedRawResult(input.plan, query, reason));

  return {
    rawResults: skippedResults,
    calls: skippedResults.map((rawResult, index) => ({
      query: input.plan.queries[index],
      rawResult,
    })).filter((call): call is AurenBrowserSearchCallResult => Boolean(call.query)),
    warnings: [reason],
    startedAt,
    completedAt,
    latencyMs: getLatencyMs(startedAt, completedAt),
    executedQueryCount: 0,
    successCount: 0,
    failedCount: skippedResults.length,
  };
}

function getExecutionWarnings(params: {
  plan: AurenSearchPlan;
  rawResults: AurenSearchRawResult[];
  executedQueryCount: number;
}) {
  const warnings: string[] = [];

  if (params.executedQueryCount === 0) {
    warnings.push('No browser search queries were executed.');
  }

  if (params.plan.depth === 'deep' && params.executedQueryCount < 2) {
    warnings.push('Deep search executed fewer than two queries.');
  }

  if (params.rawResults.some((result) => !result.success)) {
    warnings.push('At least one browser search call failed or returned fallback output.');
  }

  if (params.plan.sourcePolicy.requireMultipleSources && params.executedQueryCount < params.plan.sourcePolicy.minSourceCount) {
    warnings.push('Source policy requested multiple sources, but fewer search calls were executed.');
  }

  return Array.from(new Set(warnings));
}

function shouldStopAfterResult(plan: AurenSearchPlan, rawResult: AurenSearchRawResult, executedCount: number) {
  if (!rawResult.success) return false;

  if (plan.depth === 'quick') return true;

  if (!plan.sourcePolicy.requireMultipleSources && executedCount >= 1) return true;

  return false;
}

export async function executeAurenBrowserSearchPlan(
  input: AurenSearchExecutorInput,
): Promise<AurenBrowserSearchExecutorResult> {
  const startedAt = nowIso();

  if (!isSearchExecutable(input.plan)) {
    return createNoExecutablePlanResult(input, 'Search plan is not executable.');
  }

  const executableQueries = getExecutableQueries(input.plan);
  const calls: AurenBrowserSearchCallResult[] = [];

  for (const query of executableQueries) {
    const callResult = await callBrowserSearchFunction(input, query);
    const rawResult = createRawResult(input.plan, query, callResult);

    calls.push({
      query,
      rawResult,
    });

    if (shouldStopAfterResult(input.plan, rawResult, calls.length)) {
      break;
    }
  }

  const completedAt = nowIso();
  const rawResults = calls.map((call) => call.rawResult);
  const successCount = rawResults.filter((result) => result.success).length;
  const failedCount = rawResults.length - successCount;
  const warnings = getExecutionWarnings({
    plan: input.plan,
    rawResults,
    executedQueryCount: calls.length,
  });

  return {
    rawResults,
    calls,
    warnings,
    startedAt,
    completedAt,
    latencyMs: getLatencyMs(startedAt, completedAt),
    executedQueryCount: calls.length,
    successCount,
    failedCount,
  };
}

export async function executeAurenBrowserSearchQuery(params: {
  input: AurenSearchExecutorInput;
  query: AurenSearchQuery;
}): Promise<AurenBrowserSearchCallResult> {
  const callResult = await callBrowserSearchFunction(params.input, params.query);
  const rawResult = createRawResult(params.input.plan, params.query, callResult);

  return {
    query: params.query,
    rawResult,
  };
}

export function getBestBrowserSearchRawResult(rawResults: AurenSearchRawResult[]) {
  const successfulResults = rawResults.filter((result) => result.success && cleanAnswerText(result.answer));

  if (successfulResults.length === 0) return undefined;

  return [...successfulResults].sort((a, b) => {
    const aLength = cleanAnswerText(a.answer).length;
    const bLength = cleanAnswerText(b.answer).length;

    return bLength - aLength;
  })[0];
}

export function getBestBrowserSearchAnswer(rawResults: AurenSearchRawResult[]) {
  return cleanAnswerText(getBestBrowserSearchRawResult(rawResults)?.answer);
}

export function hasSuccessfulBrowserSearchResult(rawResults: AurenSearchRawResult[]) {
  return rawResults.some((result) => result.success && cleanAnswerText(result.answer).length > 0);
}

export function summarizeBrowserSearchExecution(result: AurenBrowserSearchExecutorResult) {
  const bestResult = getBestBrowserSearchRawResult(result.rawResults);

  return {
    executedQueryCount: result.executedQueryCount,
    successCount: result.successCount,
    failedCount: result.failedCount,
    latencyMs: result.latencyMs,
    warnings: result.warnings,
    bestResultId: bestResult?.id,
    bestAnswerPreview: bestResult?.answer ? limitText(bestResult.answer, 280) : undefined,
  };
}

export function serializeBrowserSearchExecutorDebug(result: AurenBrowserSearchExecutorResult) {
  return {
    startedAt: result.startedAt,
    completedAt: result.completedAt,
    latencyMs: result.latencyMs,
    executedQueryCount: result.executedQueryCount,
    successCount: result.successCount,
    failedCount: result.failedCount,
    warnings: result.warnings,
    calls: result.calls.map((call) => ({
      queryId: call.query.id,
      purpose: call.query.purpose,
      priority: call.query.priority,
      queryPreview: limitText(call.query.query, 240),
      rawResultId: call.rawResult.id,
      success: call.rawResult.success,
      error: call.rawResult.error,
      latencyMs: call.rawResult.latencyMs,
      usage: call.rawResult.usage ? safeJsonStringify(call.rawResult.usage) : undefined,
    })),
  };
}
