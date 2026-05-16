import {
  getPrimaryRewrittenQuery,
  rewriteAurenSearchQuery,
  rewriteAurenSearchQuerySyncFallback,
  type AurenQueryRewriteResult,
} from './queryRewriter';
import {
  AUREN_DEFAULT_SEARCH_SAFETY_POLICY,
  AUREN_DEFAULT_SOURCE_POLICY,
  AUREN_SEARCH_MODELS,
  type AurenSearchDecision,
  type AurenSearchDepth,
  type AurenSearchLatencyClass,
  type AurenSearchModel,
  type AurenSearchPlan,
  type AurenSearchPlannerInput,
  type AurenSearchProvider,
  type AurenSearchQuery,
  type AurenSearchQueryPurpose,
  type AurenSearchSafetyPolicy,
  type AurenSearchSourcePolicy,
} from './types';

const QUICK_MAX_SEARCH_CALLS = 1;
const DEEP_MAX_SEARCH_CALLS = 3;
const HARD_MAX_SEARCH_CALLS = 5;
const MAX_QUERY_LENGTH = 520;
const MAX_PLAN_QUERY_COUNT = 5;

export type AurenSearchPlannerResult = {
  plan: AurenSearchPlan;
  rewrite: AurenQueryRewriteResult;
  warnings: string[];
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

function limitText(value: string, maxLength: number) {
  const cleaned = cleanText(value);

  if (cleaned.length <= maxLength) return cleaned;

  return `${cleaned.slice(0, maxLength - 1).trim()}…`;
}

function clampNumber(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
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

function getDepth(decision: AurenSearchDecision): AurenSearchDepth {
  if (!decision.shouldSearch) return 'none';

  if (decision.depth === 'deep') return 'deep';
  if (decision.depth === 'quick') return 'quick';

  return 'quick';
}

function getProvider(decision: AurenSearchDecision, depth: AurenSearchDepth): AurenSearchProvider {
  if (depth === 'none') return 'none';

  return decision.provider === 'groq_browser_search' || decision.provider === 'custom_web_search'
    ? decision.provider
    : 'groq_browser_search';
}

function getModel(decision: AurenSearchDecision, depth: AurenSearchDepth): AurenSearchModel {
  if (decision.preferredModel === AUREN_SEARCH_MODELS.deep || decision.preferredModel === AUREN_SEARCH_MODELS.quick) {
    return decision.preferredModel;
  }

  return depth === 'deep' ? AUREN_SEARCH_MODELS.deep : AUREN_SEARCH_MODELS.quick;
}

function getExpectedLatency(depth: AurenSearchDepth): AurenSearchLatencyClass {
  if (depth === 'none') return 'fast';
  if (depth === 'deep') return 'slow';

  return 'standard';
}

function getMaxSearchCalls(depth: AurenSearchDepth, queryCount: number, policy: AurenSearchSourcePolicy) {
  if (depth === 'none') return 0;

  if (depth === 'quick') {
    return Math.min(QUICK_MAX_SEARCH_CALLS, Math.max(queryCount, 1));
  }

  const minimumForPolicy = policy.requireMultipleSources ? Math.max(policy.minSourceCount, 2) : 1;
  const desired = Math.max(DEEP_MAX_SEARCH_CALLS, minimumForPolicy);

  return clampNumber(Math.min(desired, queryCount), 1, HARD_MAX_SEARCH_CALLS);
}

function normalizeSourcePolicy(decision: AurenSearchDecision, depth: AurenSearchDepth): AurenSearchSourcePolicy {
  const basePolicy = decision.sourcePolicy
    ? cloneSourcePolicy(decision.sourcePolicy)
    : cloneSourcePolicy(AUREN_DEFAULT_SOURCE_POLICY);

  const requireMultipleSources =
    basePolicy.requireMultipleSources ||
    depth === 'deep' ||
    decision.safety.riskLevel === 'high' ||
    decision.needsSources;

  const minSourceCount =
    depth === 'deep'
      ? Math.max(basePolicy.minSourceCount, requireMultipleSources ? 2 : 1)
      : Math.max(basePolicy.minSourceCount, 1);

  const maxSourceCount =
    depth === 'deep'
      ? Math.max(basePolicy.maxSourceCount, minSourceCount, 6)
      : Math.max(basePolicy.maxSourceCount, minSourceCount, 3);

  return {
    ...basePolicy,
    preferOfficialSources: basePolicy.preferOfficialSources || decision.safety.requireSourceBackedClaims,
    preferRecentSources: basePolicy.preferRecentSources || decision.needsCurrentInfo || decision.needsFreshnessCheck,
    requireMultipleSources,
    minSourceCount,
    maxSourceCount: Math.min(maxSourceCount, 10),
    allowedSourceTypes:
      basePolicy.allowedSourceTypes.length > 0
        ? [...basePolicy.allowedSourceTypes]
        : [...AUREN_DEFAULT_SOURCE_POLICY.allowedSourceTypes],
    blockedSourceTypes: [...basePolicy.blockedSourceTypes],
    preferredDomains: [...basePolicy.preferredDomains],
    blockedDomains: [...basePolicy.blockedDomains],
  };
}

function normalizeSafetyPolicy(decision: AurenSearchDecision): AurenSearchSafetyPolicy {
  const policy = decision.safety
    ? cloneSafetyPolicy(decision.safety)
    : cloneSafetyPolicy(AUREN_DEFAULT_SEARCH_SAFETY_POLICY);

  return {
    ...policy,
    allowSensitivePersonalInfo: false,
    requireSourceBackedClaims: policy.requireSourceBackedClaims || decision.needsSources,
    requireCautionForPeopleSearch:
      policy.requireCautionForPeopleSearch || policy.riskLevel === 'high' || decision.safety.riskLevel === 'high',
  };
}

function getPriorityForPurpose(purpose: AurenSearchQueryPurpose) {
  if (purpose === 'primary') return 1;
  if (purpose === 'source_discovery') return 2;
  if (purpose === 'verification') return 3;
  if (purpose === 'freshness_check') return 4;
  if (purpose === 'countercheck') return 5;

  return 9;
}

function normalizeQuery(query: AurenSearchQuery, decision: AurenSearchDecision, index: number): AurenSearchQuery | null {
  const cleanedQuery = limitText(query.query, MAX_QUERY_LENGTH);

  if (!cleanedQuery) return null;

  return {
    ...query,
    id: query.id || createId(`search_query_${query.purpose || 'primary'}`),
    query: cleanedQuery,
    purpose: query.purpose || (index === 0 ? 'primary' : 'verification'),
    priority:
      typeof query.priority === 'number' && Number.isFinite(query.priority)
        ? Math.max(1, Math.floor(query.priority))
        : getPriorityForPurpose(query.purpose),
    freshness: query.freshness || decision.freshness,
    preferredDomains: Array.isArray(query.preferredDomains)
      ? [...query.preferredDomains]
      : [...decision.sourcePolicy.preferredDomains],
    blockedDomains: Array.isArray(query.blockedDomains)
      ? [...query.blockedDomains]
      : [...decision.sourcePolicy.blockedDomains],
    notes: query.notes ? limitText(query.notes, 260) : undefined,
  };
}

function dedupeQueries(queries: AurenSearchQuery[]) {
  const seen = new Set<string>();
  const deduped: AurenSearchQuery[] = [];

  for (const query of queries) {
    const key = query.query.toLowerCase().replace(/\s+/g, ' ').trim();

    if (seen.has(key)) continue;

    seen.add(key);
    deduped.push(query);
  }

  return deduped;
}

function ensurePrimaryQuery(queries: AurenSearchQuery[]) {
  if (queries.some((query) => query.purpose === 'primary')) {
    return queries;
  }

  const firstQuery = queries[0];

  if (!firstQuery) return queries;

  return [
    {
      ...firstQuery,
      purpose: 'primary',
      priority: 1,
      notes: firstQuery.notes ?? 'Promoted to primary query by the search planner.',
    },
    ...queries.slice(1),
  ];
}

function sortQueries(queries: AurenSearchQuery[]) {
  return [...queries].sort((a, b) => {
    const priorityDiff = a.priority - b.priority;

    if (priorityDiff !== 0) return priorityDiff;

    return getPriorityForPurpose(a.purpose) - getPriorityForPurpose(b.purpose);
  });
}

function normalizeQueries(
  rawQueries: AurenSearchQuery[],
  decision: AurenSearchDecision,
  depth: AurenSearchDepth,
): AurenSearchQuery[] {
  const normalized = rawQueries
    .map((query, index) => normalizeQuery(query, decision, index))
    .filter((query): query is AurenSearchQuery => Boolean(query));

  const withPrimary = ensurePrimaryQuery(dedupeQueries(normalized));
  const sorted = sortQueries(withPrimary);

  if (depth === 'none') return [];

  if (depth === 'quick') {
    return sorted.slice(0, 1);
  }

  return sorted.slice(0, MAX_PLAN_QUERY_COUNT);
}

function createEmergencyQuery(input: AurenSearchPlannerInput, decision: AurenSearchDecision): AurenSearchQuery {
  const message = cleanText(input.context.message || input.context.input.message);

  return {
    id: createId('search_query_emergency_primary'),
    query: limitText(
      [
        message,
        '',
        'Search task: answer using current, public, reliable, source-backed information.',
        'Do not guess. If reliable sources are unclear, say that clearly.',
      ].join('\n'),
      MAX_QUERY_LENGTH,
    ),
    purpose: 'primary',
    priority: 1,
    freshness: decision.freshness,
    preferredDomains: [...decision.sourcePolicy.preferredDomains],
    blockedDomains: [...decision.sourcePolicy.blockedDomains],
    notes: 'Emergency fallback query created by searchPlanner.',
  };
}

function createDisabledRewrite(input: AurenSearchPlannerInput): AurenQueryRewriteResult {
  return {
    language: undefined,
    mainQuery: '',
    queries: [],
    reasoning: 'Search is disabled, so the planner did not rewrite any queries.',
    warnings: [],
    usedFallback: false,
  };
}

function buildPlan(params: {
  input: AurenSearchPlannerInput;
  decision: AurenSearchDecision;
  rewrite: AurenQueryRewriteResult;
  warnings: string[];
}): AurenSearchPlan {
  const depth = getDepth(params.decision);
  const sourcePolicy = normalizeSourcePolicy(params.decision, depth);
  const safety = normalizeSafetyPolicy(params.decision);
  const provider = getProvider(params.decision, depth);
  const model = getModel(params.decision, depth);

  const normalizedDecision: AurenSearchDecision = {
    ...params.decision,
    depth,
    provider,
    preferredModel: model,
    sourcePolicy,
    safety,
  };

  const queries = normalizeQueries(params.rewrite.queries, normalizedDecision, depth);
  const finalQueries =
    depth !== 'none' && queries.length === 0
      ? [createEmergencyQuery(params.input, normalizedDecision)]
      : queries;

  return {
    id: createId('search_plan'),
    depth,
    provider,
    model,
    queries: finalQueries,
    sourcePolicy,
    safety,
    maxSearchCalls: getMaxSearchCalls(depth, finalQueries.length, sourcePolicy),
    expectedLatency: getExpectedLatency(depth),
    createdAt: nowIso(),
  };
}

function getPlannerWarnings(rewrite: AurenQueryRewriteResult, plan: AurenSearchPlan) {
  const warnings = [...rewrite.warnings];

  if (rewrite.usedFallback) {
    warnings.push('Search planner used fallback query rewrite.');
  }

  if (plan.depth !== 'none' && plan.queries.length === 0) {
    warnings.push('Search planner created no executable queries.');
  }

  if (plan.depth === 'deep' && plan.queries.length < 2) {
    warnings.push('Deep search has fewer than two queries.');
  }

  if (plan.sourcePolicy.requireMultipleSources && plan.maxSearchCalls < 2) {
    warnings.push('Source policy requests multiple sources, but maxSearchCalls is below 2.');
  }

  return Array.from(new Set(warnings));
}

export async function createAurenSearchPlan(input: AurenSearchPlannerInput): Promise<AurenSearchPlannerResult> {
  const decision = input.decision;

  if (!decision.shouldSearch || decision.depth === 'none') {
    const rewrite = createDisabledRewrite(input);
    const plan = buildPlan({
      input,
      decision,
      rewrite,
      warnings: [],
    });

    return {
      plan,
      rewrite,
      warnings: [],
    };
  }

  let rewrite: AurenQueryRewriteResult;

  try {
    rewrite = await rewriteAurenSearchQuery({
      context: input.context,
      decision,
    });
  } catch {
    rewrite = rewriteAurenSearchQuerySyncFallback({
      context: input.context,
      decision,
    });
  }

  const plan = buildPlan({
    input,
    decision,
    rewrite,
    warnings: rewrite.warnings,
  });

  return {
    plan,
    rewrite,
    warnings: getPlannerWarnings(rewrite, plan),
  };
}

export function createAurenSearchPlanSyncFallback(input: AurenSearchPlannerInput): AurenSearchPlannerResult {
  const decision = input.decision;

  const rewrite =
    !decision.shouldSearch || decision.depth === 'none'
      ? createDisabledRewrite(input)
      : rewriteAurenSearchQuerySyncFallback({
          context: input.context,
          decision,
        });

  const plan = buildPlan({
    input,
    decision,
    rewrite,
    warnings: rewrite.warnings,
  });

  return {
    plan,
    rewrite,
    warnings: getPlannerWarnings(rewrite, plan),
  };
}

export function getPrimaryQueryFromPlan(plan: AurenSearchPlan) {
  return plan.queries.find((query) => query.purpose === 'primary') ?? plan.queries[0];
}

export function getExecutableQueriesFromPlan(plan: AurenSearchPlan) {
  return plan.queries
    .slice()
    .sort((a, b) => a.priority - b.priority)
    .slice(0, plan.maxSearchCalls);
}

export function isExecutableSearchPlan(plan: AurenSearchPlan) {
  return plan.depth !== 'none' && plan.provider !== 'none' && plan.maxSearchCalls > 0 && plan.queries.length > 0;
}

export function summarizeSearchPlan(plan: AurenSearchPlan) {
  const primaryQuery = getPrimaryQueryFromPlan(plan);

  return {
    id: plan.id,
    depth: plan.depth,
    provider: plan.provider,
    model: plan.model,
    queryCount: plan.queries.length,
    maxSearchCalls: plan.maxSearchCalls,
    expectedLatency: plan.expectedLatency,
    primaryQuery: primaryQuery?.query,
    requireMultipleSources: plan.sourcePolicy.requireMultipleSources,
    minSourceCount: plan.sourcePolicy.minSourceCount,
    maxSourceCount: plan.sourcePolicy.maxSourceCount,
  };
}

export function getPrimaryRewrittenQueryFromPlannerResult(result: AurenSearchPlannerResult) {
  return getPrimaryRewrittenQuery(result.rewrite);
}
