import { supabase } from '../../supabase';
import { routeAurenSearch } from './searchRouter';
import {
  AUREN_NO_SEARCH_DECISION,
  AUREN_SEARCH_MODELS,
  createEmptySearchReport,
  type AurenBrowserSearchFunctionRequest,
  type AurenBrowserSearchFunctionResponse,
  type AurenSearchAnswerDraft,
  type AurenSearchConfidence,
  type AurenSearchDecision,
  type AurenSearchDepth,
  type AurenSearchEvidence,
  type AurenSearchFreshness,
  type AurenSearchPipelineInput,
  type AurenSearchPipelineResult,
  type AurenSearchPlan,
  type AurenSearchQuery,
  type AurenSearchQueryPurpose,
  type AurenSearchRawResult,
  type AurenSearchReport,
  type AurenSearchSource,
  type AurenSearchSourcePolicy,
  type AurenSearchSourceType,
} from './types';

const AUREN_BROWSER_SEARCH_FUNCTION = 'auren-browser-search';
const SEARCH_PIPELINE_TIMEOUT_MS = 50_000;
const MAX_CONVERSATION_MESSAGES = 8;
const MAX_CONTEXT_MESSAGE_LENGTH = 1600;
const MAX_QUERY_LENGTH = 480;
const MAX_ANSWER_LENGTH = 9000;

type PipelineClock = {
  startedAt: string;
  completedAt?: string;
  latencyMs?: number;
};

type BrowserSearchCallResult = {
  response: AurenBrowserSearchFunctionResponse | null;
  error?: string;
  clock: PipelineClock;
};

function createId(prefix: string) {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

function nowIso() {
  return new Date().toISOString();
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

function limitAnswer(value: string, maxLength = MAX_ANSWER_LENGTH) {
  const cleaned = cleanAnswerText(value);

  if (cleaned.length <= maxLength) return cleaned;

  return `${cleaned.slice(0, maxLength - 1).trim()}…`;
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;

  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => {
      reject(new Error('Auren search pipeline timed out.'));
    }, timeoutMs);
  });

  return Promise.race([promise, timeoutPromise]).finally(() => {
    if (timeoutId) clearTimeout(timeoutId);
  });
}

function getLatencyMs(startedAt: string, completedAt: string) {
  return Math.max(0, new Date(completedAt).getTime() - new Date(startedAt).getTime());
}

function getConversationForSearch(input: AurenSearchPipelineInput) {
  return input.context.conversation.slice(-MAX_CONVERSATION_MESSAGES).map((message) => ({
    role: message.role,
    content: limitText(message.content, MAX_CONTEXT_MESSAGE_LENGTH),
  }));
}

function getPrimaryMessage(input: AurenSearchPipelineInput) {
  return cleanText(input.context.message || input.context.input.message);
}

function inferLanguage(text: string) {
  const normalized = text.toLowerCase();

  const finnishSignals = [
    'mikä',
    'mita',
    'mitä',
    'kuka',
    'milloin',
    'miksi',
    'miten',
    'voinko',
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
  if (freshness === 'today') return 'Prioritize sources from today or the most recent available updates.';
  if (freshness === 'week') return 'Prioritize sources from the last week when possible.';
  if (freshness === 'month') return 'Prioritize sources from the last month when possible.';
  if (freshness === 'year') return 'Prioritize sources from the current year when possible.';
  if (freshness === 'timeless') return 'Current freshness is less important than source quality.';

  return 'Use current sources when the topic may have changed.';
}

function getSourcePolicyPhrase(policy: AurenSearchSourcePolicy) {
  const lines = [
    policy.preferOfficialSources ? '- Prefer official or primary sources.' : '',
    policy.preferRecentSources ? '- Prefer recent sources.' : '',
    policy.requireMultipleSources ? `- Check at least ${policy.minSourceCount} reliable sources when possible.` : '',
    policy.preferredDomains.length > 0 ? `- Prefer these domains: ${policy.preferredDomains.join(', ')}.` : '',
    policy.blockedDomains.length > 0 ? `- Avoid these domains: ${policy.blockedDomains.join(', ')}.` : '',
  ].filter(Boolean);

  return lines.length > 0 ? lines.join('\n') : '- Use reliable sources.';
}

function getSafetyPhrase(decision: AurenSearchDecision) {
  const lines = [
    decision.safety.requireSourceBackedClaims ? '- Do not make important claims unless search results support them.' : '',
    decision.safety.requireCautionForPeopleSearch
      ? '- For public-person queries, use only public reliable sources and avoid guessing identity.'
      : '',
    !decision.safety.allowSensitivePersonalInfo
      ? '- Do not search for or expose sensitive personal information.'
      : '',
    decision.safety.riskLevel === 'high'
      ? '- Use careful wording because this may be high-risk or personally sensitive.'
      : '',
  ].filter(Boolean);

  return lines.length > 0 ? lines.join('\n') : '- Use careful, source-grounded wording.';
}

function createBaseQuery(input: AurenSearchPipelineInput, decision: AurenSearchDecision) {
  const message = getPrimaryMessage(input);
  const language = inferLanguage(message);

  const sourceInstruction = decision.sourcePolicy.preferOfficialSources
    ? 'Prefer official, primary, or well-known reliable sources.'
    : 'Prefer reliable sources.';

  const cautionInstruction =
    decision.safety.requireCautionForPeopleSearch || decision.safety.riskLevel === 'high'
      ? 'Do not guess. If reliable public sources do not verify the answer, say that clearly.'
      : 'If the search results are unclear, say that clearly.';

  return limitText(
    [
      message,
      '',
      `Search task: answer the user using current, source-backed information.`,
      sourceInstruction,
      getFreshnessPhrase(decision.freshness),
      cautionInstruction,
      language === 'fi' ? 'Respond in Finnish if the user used Finnish.' : 'Respond in the user’s language.',
    ].join('\n'),
    MAX_QUERY_LENGTH,
  );
}

function createVerificationQuery(input: AurenSearchPipelineInput, decision: AurenSearchDecision) {
  const message = getPrimaryMessage(input);

  return limitText(
    [
      message,
      '',
      'Verification task: check whether the main facts can be verified by reliable sources.',
      getSourcePolicyPhrase(decision.sourcePolicy),
      getSafetyPhrase(decision),
    ].join('\n'),
    MAX_QUERY_LENGTH,
  );
}

function createCountercheckQuery(input: AurenSearchPipelineInput, decision: AurenSearchDecision) {
  const message = getPrimaryMessage(input);

  return limitText(
    [
      message,
      '',
      'Countercheck task: look for conflicting information, outdated claims, uncertainty, or missing evidence.',
      getFreshnessPhrase(decision.freshness),
    ].join('\n'),
    MAX_QUERY_LENGTH,
  );
}

function createQuery(params: {
  id: string;
  query: string;
  purpose: AurenSearchQueryPurpose;
  priority: number;
  decision: AurenSearchDecision;
  language?: string;
  notes?: string;
}): AurenSearchQuery {
  return {
    id: params.id,
    query: params.query,
    purpose: params.purpose,
    priority: params.priority,
    language: params.language,
    freshness: params.decision.freshness,
    preferredDomains: [...params.decision.sourcePolicy.preferredDomains],
    blockedDomains: [...params.decision.sourcePolicy.blockedDomains],
    notes: params.notes,
  };
}

function createSearchQueries(input: AurenSearchPipelineInput, decision: AurenSearchDecision): AurenSearchQuery[] {
  const message = getPrimaryMessage(input);
  const language = inferLanguage(message);

  const queries: AurenSearchQuery[] = [
    createQuery({
      id: createId('search_query_primary'),
      query: createBaseQuery(input, decision),
      purpose: 'primary',
      priority: 1,
      decision,
      language,
      notes: 'Primary search query generated from the user message and search decision.',
    }),
  ];

  if (decision.depth === 'deep' || decision.sourcePolicy.requireMultipleSources) {
    queries.push(
      createQuery({
        id: createId('search_query_verify'),
        query: createVerificationQuery(input, decision),
        purpose: 'verification',
        priority: 2,
        decision,
        language,
        notes: 'Verification query for stronger source-backed answers.',
      }),
    );
  }

  if (decision.depth === 'deep') {
    queries.push(
      createQuery({
        id: createId('search_query_countercheck'),
        query: createCountercheckQuery(input, decision),
        purpose: 'countercheck',
        priority: 3,
        decision,
        language,
        notes: 'Countercheck query for contradictions and uncertainty.',
      }),
    );
  }

  return queries;
}

function createSearchPlan(input: AurenSearchPipelineInput, decision: AurenSearchDecision): AurenSearchPlan {
  const createdAt = nowIso();
  const depth: AurenSearchDepth = decision.depth;
  const queries = createSearchQueries(input, decision);
  const maxSearchCalls = depth === 'deep' ? Math.min(queries.length, 3) : 1;

  return {
    id: createId('search_plan'),
    depth,
    provider: decision.provider,
    model: decision.preferredModel,
    queries,
    sourcePolicy: decision.sourcePolicy,
    safety: decision.safety,
    maxSearchCalls,
    expectedLatency: depth === 'deep' ? 'slow' : 'standard',
    createdAt,
  };
}

function buildBrowserSearchInstructions(decision: AurenSearchDecision, plan: AurenSearchPlan) {
  return [
    'You are Auren Search, the web-search layer for a premium personal AI agent.',
    '',
    'Use browser search to answer the user with current, source-backed information.',
    '',
    'Response rules:',
    '- Answer in the same language the user used.',
    '- Keep the answer concise, natural, and mobile-friendly.',
    '- Do not expose internal JSON, raw plans, or tool implementation details.',
    '- Do not invent sources or facts.',
    '- If results are weak, unclear, outdated, or conflicting, say that clearly.',
    '- Avoid overconfident claims about people, health, law, finance, or safety.',
    '',
    'Freshness:',
    getFreshnessPhrase(decision.freshness),
    '',
    'Source policy:',
    getSourcePolicyPhrase(plan.sourcePolicy),
    '',
    'Safety policy:',
    getSafetyPhrase(decision),
    '',
    'Search depth:',
    plan.depth === 'deep'
      ? 'Use a deeper approach: verify facts, check more than one angle, and mention uncertainty when needed.'
      : 'Use a quick approach: answer directly, but stay source-grounded.',
  ].join('\n');
}

function buildBrowserSearchRequest(
  input: AurenSearchPipelineInput,
  decision: AurenSearchDecision,
  plan: AurenSearchPlan,
  query: AurenSearchQuery,
): AurenBrowserSearchFunctionRequest {
  return {
    message: query.query,
    instructions: buildBrowserSearchInstructions(decision, plan),
    context: {
      userMessage: getPrimaryMessage(input),
      mode: input.context.mode,
      conversation: getConversationForSearch(input),
      searchPlan: plan,
      searchDecision: decision,
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

async function callBrowserSearch(
  input: AurenSearchPipelineInput,
  decision: AurenSearchDecision,
  plan: AurenSearchPlan,
  query: AurenSearchQuery,
): Promise<BrowserSearchCallResult> {
  const startedAt = nowIso();

  try {
    const response = await withTimeout(
      supabase.functions.invoke(AUREN_BROWSER_SEARCH_FUNCTION, {
        body: buildBrowserSearchRequest(input, decision, plan, query),
      }),
      SEARCH_PIPELINE_TIMEOUT_MS,
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
      response: response.data as AurenBrowserSearchFunctionResponse,
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

function createRawResult(
  plan: AurenSearchPlan,
  query: AurenSearchQuery,
  callResult: BrowserSearchCallResult,
): AurenSearchRawResult {
  const answer = cleanAnswerText(callResult.response?.answer);
  const fallbackReason = cleanText(callResult.response?.fallbackReason);
  const groqError = cleanText(callResult.response?.groqError);
  const error = callResult.error || fallbackReason || groqError || undefined;
  const success = Boolean(callResult.response && !callResult.response.fallback && answer);

  return {
    id: createId('search_raw_result'),
    provider: plan.provider,
    model:
      callResult.response?.model === AUREN_SEARCH_MODELS.deep || callResult.response?.model === AUREN_SEARCH_MODELS.quick
        ? callResult.response.model
        : plan.model,
    queryIds: [query.id],
    success,
    answer: answer || undefined,
    rawText: answer || undefined,
    error,
    startedAt: callResult.clock.startedAt,
    completedAt: callResult.clock.completedAt,
    latencyMs: callResult.clock.latencyMs,
    usage:
      callResult.response?.debug && typeof callResult.response.debug === 'object'
        ? (callResult.response.debug.usage as Record<string, unknown> | undefined)
        : undefined,
  };
}

function getDomainFromUrl(url: string | undefined) {
  if (!url) return undefined;

  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return undefined;
  }
}

function normalizeSourceType(value: unknown): AurenSearchSourceType {
  if (
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
  ) {
    return value;
  }

  return 'unknown';
}

function extractSourcesFromDebug(rawResults: AurenSearchRawResult[]): AurenSearchSource[] {
  const sources: AurenSearchSource[] = [];

  for (const result of rawResults) {
    const debug = result.usage;

    if (!debug || typeof debug !== 'object') continue;

    const maybeSources = (debug as Record<string, unknown>).sources;

    if (!Array.isArray(maybeSources)) continue;

    for (const source of maybeSources) {
      if (!source || typeof source !== 'object') continue;

      const sourceObject = source as Record<string, unknown>;
      const url = typeof sourceObject.url === 'string' ? sourceObject.url : undefined;
      const title = typeof sourceObject.title === 'string' ? sourceObject.title : undefined;
      const snippet = typeof sourceObject.snippet === 'string' ? sourceObject.snippet : undefined;

      sources.push({
        id: createId('search_source'),
        title,
        url,
        domain: getDomainFromUrl(url),
        sourceType: normalizeSourceType(sourceObject.sourceType),
        snippet,
        author: typeof sourceObject.author === 'string' ? sourceObject.author : undefined,
        publishedAt: typeof sourceObject.publishedAt === 'string' ? sourceObject.publishedAt : undefined,
        accessedAt: nowIso(),
        isPrimarySource: sourceObject.isPrimarySource === true,
        trustScore: typeof sourceObject.trustScore === 'number' ? sourceObject.trustScore : 0.45,
        relevanceScore: typeof sourceObject.relevanceScore === 'number' ? sourceObject.relevanceScore : 0.55,
        freshnessScore: typeof sourceObject.freshnessScore === 'number' ? sourceObject.freshnessScore : 0.45,
        notes: typeof sourceObject.notes === 'string' ? sourceObject.notes : undefined,
      });
    }
  }

  return sources;
}

function inferSourceTypeFromPolicy(policy: AurenSearchSourcePolicy): AurenSearchSourceType {
  if (policy.allowedSourceTypes.includes('official')) return 'official';
  if (policy.allowedSourceTypes.includes('documentation')) return 'documentation';
  if (policy.allowedSourceTypes.includes('news')) return 'news';
  if (policy.allowedSourceTypes.includes('company')) return 'company';

  return 'unknown';
}

function createSyntheticSources(plan: AurenSearchPlan, rawResults: AurenSearchRawResult[]): AurenSearchSource[] {
  const successfulResults = rawResults.filter((result) => result.success);

  if (successfulResults.length === 0) return [];

  return successfulResults.map((result) => ({
    id: createId('search_source_synthetic'),
    title: 'Browser search result',
    sourceType: inferSourceTypeFromPolicy(plan.sourcePolicy),
    snippet: result.answer ? limitText(result.answer, 280) : undefined,
    accessedAt: result.completedAt ?? nowIso(),
    isPrimarySource: false,
    trustScore: plan.sourcePolicy.preferOfficialSources ? 0.62 : 0.52,
    relevanceScore: 0.72,
    freshnessScore: plan.sourcePolicy.preferRecentSources ? 0.68 : 0.5,
    notes: 'Synthetic source placeholder created from the browser search response because explicit source metadata was not returned.',
  }));
}

function createEvidenceFromRawResults(
  plan: AurenSearchPlan,
  rawResults: AurenSearchRawResult[],
  sources: AurenSearchSource[],
): AurenSearchEvidence[] {
  const evidence: AurenSearchEvidence[] = [];
  const source = sources[0];

  for (const result of rawResults.filter((item) => item.success && item.answer)) {
    evidence.push({
      id: createId('search_evidence'),
      claim: limitText(result.answer ?? '', 420),
      sourceId: source?.id,
      sourceTitle: source?.title,
      sourceUrl: source?.url,
      sourceType: source?.sourceType ?? inferSourceTypeFromPolicy(plan.sourcePolicy),
      supportLevel: source ? 'partial' : 'unknown',
      confidence: source ? 0.62 : 0.48,
      relevance: source ? source.relevanceScore : 0.55,
      extractedAt: nowIso(),
      notes: 'Evidence generated from the browser search answer. Add a dedicated evidence extractor later for stronger claim-level grounding.',
    });
  }

  return evidence;
}

function average(values: number[]) {
  if (values.length === 0) return 0;

  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function evaluateConfidence(params: {
  decision: AurenSearchDecision;
  plan: AurenSearchPlan;
  rawResults: AurenSearchRawResult[];
  sources: AurenSearchSource[];
  evidence: AurenSearchEvidence[];
  warnings: string[];
}): AurenSearchConfidence {
  const successfulResults = params.rawResults.filter((result) => result.success);
  const failedResults = params.rawResults.filter((result) => !result.success);
  const sourceQualityAverage = average(
    params.sources.map((source) => average([source.trustScore, source.relevanceScore, source.freshnessScore])),
  );
  const evidenceConfidenceAverage = average(params.evidence.map((item) => item.confidence));

  let score = 0;

  if (successfulResults.length > 0) score += 0.42;
  if (params.sources.length > 0) score += 0.18;
  if (params.evidence.length > 0) score += 0.16;
  if (params.plan.sourcePolicy.requireMultipleSources && params.sources.length >= params.plan.sourcePolicy.minSourceCount) {
    score += 0.12;
  }
  if (!params.plan.sourcePolicy.requireMultipleSources) {
    score += 0.08;
  }

  score += sourceQualityAverage * 0.16;
  score += evidenceConfidenceAverage * 0.12;
  score -= failedResults.length * 0.08;

  if (params.decision.safety.riskLevel === 'high') {
    score -= 0.1;
  }

  if (params.warnings.length > 0) {
    score -= Math.min(0.18, params.warnings.length * 0.05);
  }

  const normalizedScore = Math.min(Math.max(score, 0), 1);

  if (successfulResults.length === 0) {
    return {
      level: 'none',
      score: 0,
      reason: 'Search did not return a usable result.',
      supportingEvidenceCount: 0,
      conflictingEvidenceCount: 0,
      sourceQualityAverage,
    };
  }

  if (normalizedScore >= 0.76) {
    return {
      level: 'high',
      score: normalizedScore,
      reason: 'Search returned usable results with enough source or evidence support.',
      supportingEvidenceCount: params.evidence.length,
      conflictingEvidenceCount: 0,
      sourceQualityAverage,
    };
  }

  if (normalizedScore >= 0.52) {
    return {
      level: 'medium',
      score: normalizedScore,
      reason: 'Search returned useful information, but source support should still be treated with some caution.',
      supportingEvidenceCount: params.evidence.length,
      conflictingEvidenceCount: 0,
      sourceQualityAverage,
    };
  }

  return {
    level: 'low',
    score: normalizedScore,
    reason: 'Search returned limited or weakly supported information.',
    supportingEvidenceCount: params.evidence.length,
    conflictingEvidenceCount: 0,
    sourceQualityAverage,
  };
}

function buildWarnings(params: {
  decision: AurenSearchDecision;
  plan: AurenSearchPlan;
  rawResults: AurenSearchRawResult[];
  sources: AurenSearchSource[];
}) {
  const warnings: string[] = [];

  if (params.rawResults.length === 0) {
    warnings.push('No search calls were executed.');
  }

  if (params.rawResults.some((result) => !result.success)) {
    warnings.push('At least one search call failed or returned fallback output.');
  }

  if (params.sources.length === 0) {
    warnings.push('Explicit source metadata was not returned by the browser search function.');
  }

  if (
    params.plan.sourcePolicy.requireMultipleSources &&
    params.sources.length < params.plan.sourcePolicy.minSourceCount
  ) {
    warnings.push('The answer may need more sources for strong confidence.');
  }

  if (params.decision.safety.riskLevel === 'high') {
    warnings.push('This search decision is high risk and should use cautious wording.');
  }

  return warnings;
}

function selectBestAnswer(rawResults: AurenSearchRawResult[]) {
  const successfulResults = rawResults.filter((result) => result.success && result.answer);

  if (successfulResults.length === 0) return '';

  const longestUsefulAnswer = [...successfulResults].sort((a, b) => {
    const aLength = cleanAnswerText(a.answer).length;
    const bLength = cleanAnswerText(b.answer).length;

    return bLength - aLength;
  })[0];

  return limitAnswer(longestUsefulAnswer.answer ?? '');
}

function createAnswerDraft(params: {
  decision: AurenSearchDecision;
  rawResults: AurenSearchRawResult[];
  confidence: AurenSearchConfidence;
  warnings: string[];
}): AurenSearchAnswerDraft {
  const text = selectBestAnswer(params.rawResults);
  const shouldMentionUncertainty =
    params.confidence.level === 'low' ||
    params.confidence.level === 'none' ||
    params.warnings.length > 0 ||
    params.decision.safety.riskLevel === 'high';

  const shouldMentionSources = params.decision.needsSources || params.confidence.level !== 'none';

  const statusLabel =
    params.confidence.level === 'high'
      ? 'High confidence'
      : params.confidence.level === 'medium'
        ? 'Medium confidence'
        : params.confidence.level === 'low'
          ? 'Low confidence'
          : 'No reliable result';

  return {
    text,
    language: text ? inferLanguage(text) : undefined,
    shouldMentionUncertainty,
    shouldMentionSources,
    suggestedStatusLine: `Searched web · ${statusLabel}`,
  };
}

function createFallbackSearchAnswer(rawResults: AurenSearchRawResult[]) {
  const error = rawResults.find((result) => result.error)?.error;

  if (error) {
    return `I could not complete web search right now. ${error}`;
  }

  return 'I could not complete web search right now, but you can try again in a moment.';
}

async function executeSearchPlan(
  input: AurenSearchPipelineInput,
  decision: AurenSearchDecision,
  plan: AurenSearchPlan,
): Promise<AurenSearchRawResult[]> {
  const queriesToRun = plan.queries
    .slice()
    .sort((a, b) => a.priority - b.priority)
    .slice(0, plan.maxSearchCalls);

  const rawResults: AurenSearchRawResult[] = [];

  for (const query of queriesToRun) {
    const callResult = await callBrowserSearch(input, decision, plan, query);
    rawResults.push(createRawResult(plan, query, callResult));

    if (plan.depth !== 'deep') {
      break;
    }
  }

  return rawResults;
}

function createUsedSearchReport(params: {
  input: AurenSearchPipelineInput;
  decision: AurenSearchDecision;
  plan: AurenSearchPlan;
  rawResults: AurenSearchRawResult[];
  createdAt: string;
}): AurenSearchReport {
  const explicitSources = extractSourcesFromDebug(params.rawResults);
  const sources = explicitSources.length > 0 ? explicitSources : createSyntheticSources(params.plan, params.rawResults);
  const initialWarnings = buildWarnings({
    decision: params.decision,
    plan: params.plan,
    rawResults: params.rawResults,
    sources,
  });
  const evidence = createEvidenceFromRawResults(params.plan, params.rawResults, sources);
  const confidence = evaluateConfidence({
    decision: params.decision,
    plan: params.plan,
    rawResults: params.rawResults,
    sources,
    evidence,
    warnings: initialWarnings,
  });
  const answerDraft = createAnswerDraft({
    decision: params.decision,
    rawResults: params.rawResults,
    confidence,
    warnings: initialWarnings,
  });

  const completedAt = nowIso();

  return {
    id: createId('search_report'),
    used: true,
    trigger: params.decision.trigger,
    depth: params.decision.depth,
    provider: params.decision.provider,
    model: params.plan.model,
    decision: params.decision,
    plan: params.plan,
    rawResults: params.rawResults,
    sources,
    evidence,
    conflicts: [],
    confidence,
    answerDraft: {
      ...answerDraft,
      text: answerDraft.text || createFallbackSearchAnswer(params.rawResults),
    },
    sourcesChecked: sources.length,
    warnings: initialWarnings,
    createdAt: params.createdAt,
    completedAt,
    debug: {
      latencyMs: getLatencyMs(params.createdAt, completedAt),
      planId: params.plan.id,
      queryCount: params.plan.queries.length,
      executedQueryCount: params.rawResults.length,
      hasExplicitSources: explicitSources.length > 0,
    },
  };
}

export async function runSearchPipeline(input: AurenSearchPipelineInput): Promise<AurenSearchPipelineResult> {
  const createdAt = nowIso();
  const decision = await routeAurenSearch({
    context: input.context,
    metadata: input.metadata,
  });

  if (!decision.shouldSearch) {
    return {
      report: createEmptySearchReport({
        id: createId('search_report_empty'),
        decision,
        createdAt,
      }),
      shouldUseSearchAnswer: false,
    };
  }

  const plan = createSearchPlan(input, decision);
  const rawResults = await executeSearchPlan(input, decision, plan);
  const report = createUsedSearchReport({
    input,
    decision,
    plan,
    rawResults,
    createdAt,
  });

  return {
    report,
    shouldUseSearchAnswer: report.used && cleanAnswerText(report.answerDraft.text).length > 0,
  };
}

export function createNoSearchPipelineResult(reason?: string): AurenSearchPipelineResult {
  const decision: AurenSearchDecision = {
    ...AUREN_NO_SEARCH_DECISION,
    reason: reason || AUREN_NO_SEARCH_DECISION.reason,
  };

  return {
    report: createEmptySearchReport({
      id: createId('search_report_empty'),
      decision,
      createdAt: nowIso(),
    }),
    shouldUseSearchAnswer: false,
  };
}

export function getSearchAnswerFromPipelineResult(result: AurenSearchPipelineResult) {
  if (!result.shouldUseSearchAnswer) return '';

  return cleanAnswerText(result.report.answerDraft.text);
}

export function getSearchMetadataFromReport(report: AurenSearchReport) {
  return {
    used: report.used,
    trigger: report.trigger,
    depth: report.depth,
    provider: report.provider,
    model: report.model,
    confidence: report.confidence.level,
    confidenceScore: report.confidence.score,
    sourcesChecked: report.sourcesChecked,
    warnings: report.warnings,
  };
}
