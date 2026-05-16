import type {
  AurenContext,
  AurenMode,
  AurenPlan,
  AurenResponseMetadata,
  AurenToolResult,
} from '../core/types';

export type AurenSearchTrigger = 'none' | 'manual' | 'auto' | 'forced';

export type AurenSearchDepth = 'none' | 'quick' | 'deep';

export type AurenSearchProvider = 'groq_browser_search' | 'custom_web_search' | 'none';

export type AurenSearchModel = 'openai/gpt-oss-20b' | 'openai/gpt-oss-120b';

export type AurenSearchFreshness =
  | 'realtime'
  | 'today'
  | 'week'
  | 'month'
  | 'year'
  | 'timeless'
  | 'unknown';

export type AurenSearchSourceType =
  | 'official'
  | 'documentation'
  | 'news'
  | 'academic'
  | 'company'
  | 'commerce'
  | 'profile'
  | 'social'
  | 'forum'
  | 'blog'
  | 'database'
  | 'unknown';

export type AurenSearchConfidenceLevel = 'high' | 'medium' | 'low' | 'none';

export type AurenSearchQueryPurpose =
  | 'primary'
  | 'verification'
  | 'countercheck'
  | 'source_discovery'
  | 'freshness_check';

export type AurenSearchRiskLevel = 'low' | 'medium' | 'high';

export type AurenSearchLatencyClass = 'fast' | 'standard' | 'slow';

export type AurenSearchMetadata = {
  browserSearch?: boolean;
  searchTrigger?: AurenSearchTrigger;
  searchDepth?: AurenSearchDepth;
  forceSearch?: boolean;
  disableAutoSearch?: boolean;
  userSelectedSearch?: boolean;
  previousSearchReportId?: string;
};

export type AurenSearchSafetyPolicy = {
  allowPersonalInfoSearch: boolean;
  allowSensitivePersonalInfo: boolean;
  allowMedicalAdviceSearch: boolean;
  allowLegalAdviceSearch: boolean;
  allowFinancialAdviceSearch: boolean;
  requireCautionForPeopleSearch: boolean;
  requireSourceBackedClaims: boolean;
  riskLevel: AurenSearchRiskLevel;
};

export type AurenSearchSourcePolicy = {
  preferOfficialSources: boolean;
  preferRecentSources: boolean;
  requireMultipleSources: boolean;
  minSourceCount: number;
  maxSourceCount: number;
  allowedSourceTypes: AurenSearchSourceType[];
  blockedSourceTypes: AurenSearchSourceType[];
  preferredDomains: string[];
  blockedDomains: string[];
};

export type AurenSearchDecision = {
  shouldSearch: boolean;
  trigger: AurenSearchTrigger;
  depth: AurenSearchDepth;
  provider: AurenSearchProvider;
  preferredModel: AurenSearchModel;
  confidence: number;
  reason: string;
  needsCurrentInfo: boolean;
  needsSources: boolean;
  needsFreshnessCheck: boolean;
  freshness: AurenSearchFreshness;
  safety: AurenSearchSafetyPolicy;
  sourcePolicy: AurenSearchSourcePolicy;
  userFacingHint?: string;
};

export type AurenSearchQuery = {
  id: string;
  query: string;
  purpose: AurenSearchQueryPurpose;
  priority: number;
  language?: string;
  freshness: AurenSearchFreshness;
  preferredDomains: string[];
  blockedDomains: string[];
  notes?: string;
};

export type AurenSearchPlan = {
  id: string;
  depth: AurenSearchDepth;
  provider: AurenSearchProvider;
  model: AurenSearchModel;
  queries: AurenSearchQuery[];
  sourcePolicy: AurenSearchSourcePolicy;
  safety: AurenSearchSafetyPolicy;
  maxSearchCalls: number;
  expectedLatency: AurenSearchLatencyClass;
  createdAt: string;
};

export type AurenSearchSource = {
  id: string;
  title?: string;
  url?: string;
  domain?: string;
  sourceType: AurenSearchSourceType;
  snippet?: string;
  author?: string;
  publishedAt?: string;
  accessedAt: string;
  isPrimarySource: boolean;
  trustScore: number;
  relevanceScore: number;
  freshnessScore: number;
  notes?: string;
};

export type AurenSearchEvidence = {
  id: string;
  claim: string;
  sourceId?: string;
  sourceTitle?: string;
  sourceUrl?: string;
  sourceType: AurenSearchSourceType;
  supportLevel: 'strong' | 'partial' | 'weak' | 'contradicts' | 'unknown';
  confidence: number;
  relevance: number;
  extractedAt: string;
  notes?: string;
};

export type AurenSearchConflict = {
  id: string;
  summary: string;
  claims: string[];
  sourceIds: string[];
  severity: 'minor' | 'moderate' | 'major';
};

export type AurenSearchConfidence = {
  level: AurenSearchConfidenceLevel;
  score: number;
  reason: string;
  supportingEvidenceCount: number;
  conflictingEvidenceCount: number;
  sourceQualityAverage: number;
};

export type AurenSearchRawResult = {
  id: string;
  provider: AurenSearchProvider;
  model: AurenSearchModel;
  queryIds: string[];
  success: boolean;
  answer?: string;
  rawText?: string;
  error?: string;
  startedAt: string;
  completedAt?: string;
  latencyMs?: number;
  usage?: Record<string, unknown>;
};

export type AurenSearchAnswerDraft = {
  text: string;
  language?: string;
  shouldMentionUncertainty: boolean;
  shouldMentionSources: boolean;
  suggestedStatusLine?: string;
};

export type AurenSearchReport = {
  id: string;
  used: boolean;
  trigger: AurenSearchTrigger;
  depth: AurenSearchDepth;
  provider: AurenSearchProvider;
  model: AurenSearchModel;
  decision: AurenSearchDecision;
  plan: AurenSearchPlan;
  rawResults: AurenSearchRawResult[];
  sources: AurenSearchSource[];
  evidence: AurenSearchEvidence[];
  conflicts: AurenSearchConflict[];
  confidence: AurenSearchConfidence;
  answerDraft: AurenSearchAnswerDraft;
  sourcesChecked: number;
  warnings: string[];
  createdAt: string;
  completedAt?: string;
  debug?: Record<string, unknown>;
};

export type AurenSearchRouterInput = {
  context: AurenContext;
  metadata?: AurenSearchMetadata;
};

export type AurenSearchPlannerInput = {
  context: AurenContext;
  decision: AurenSearchDecision;
};

export type AurenSearchExecutorInput = {
  context: AurenContext;
  plan: AurenSearchPlan;
};

export type AurenSearchEvaluatorInput = {
  context: AurenContext;
  plan: AurenSearchPlan;
  rawResults: AurenSearchRawResult[];
  sources: AurenSearchSource[];
  evidence: AurenSearchEvidence[];
};

export type AurenSearchPipelineInput = {
  context: AurenContext;
  plan?: AurenPlan;
  toolResults?: AurenToolResult[];
  metadata?: AurenSearchMetadata;
};

export type AurenSearchPipelineResult = {
  report: AurenSearchReport;
  shouldUseSearchAnswer: boolean;
};

export type AurenBrowserSearchFunctionRequest = {
  message: string;
  instructions: string;
  context: {
    userMessage: string;
    mode: AurenMode;
    conversation: {
      role: string;
      content: string;
    }[];
    searchPlan?: AurenSearchPlan;
    searchDecision?: AurenSearchDecision;
    memory?: unknown;
    user?: unknown;
    environment?: unknown;
  };
};

export type AurenBrowserSearchFunctionResponse = {
  answer?: string;
  suggestions?: unknown[];
  model?: string;
  browserSearchUsed?: boolean;
  fallback?: boolean;
  fallbackReason?: string;
  groqStatus?: number;
  groqError?: string;
  groqErrorType?: string;
  debug?: Record<string, unknown>;
};

export type AurenSearchResponseMetadata = AurenResponseMetadata & {
  search?: {
    used: boolean;
    trigger: AurenSearchTrigger;
    depth: AurenSearchDepth;
    provider: AurenSearchProvider;
    model: AurenSearchModel;
    confidence: AurenSearchConfidenceLevel;
    confidenceScore: number;
    sourcesChecked: number;
    warnings: string[];
  };
};

export const AUREN_SEARCH_MODELS = {
  quick: 'openai/gpt-oss-20b',
  deep: 'openai/gpt-oss-120b',
} as const satisfies Record<'quick' | 'deep', AurenSearchModel>;

export const AUREN_DEFAULT_SEARCH_SAFETY_POLICY: AurenSearchSafetyPolicy = {
  allowPersonalInfoSearch: true,
  allowSensitivePersonalInfo: false,
  allowMedicalAdviceSearch: true,
  allowLegalAdviceSearch: true,
  allowFinancialAdviceSearch: true,
  requireCautionForPeopleSearch: true,
  requireSourceBackedClaims: true,
  riskLevel: 'medium',
};

export const AUREN_DEFAULT_SOURCE_POLICY: AurenSearchSourcePolicy = {
  preferOfficialSources: true,
  preferRecentSources: true,
  requireMultipleSources: false,
  minSourceCount: 1,
  maxSourceCount: 5,
  allowedSourceTypes: [
    'official',
    'documentation',
    'news',
    'academic',
    'company',
    'commerce',
    'profile',
    'database',
    'blog',
    'unknown',
  ],
  blockedSourceTypes: [],
  preferredDomains: [],
  blockedDomains: [],
};

export const AUREN_NO_SEARCH_DECISION: AurenSearchDecision = {
  shouldSearch: false,
  trigger: 'none',
  depth: 'none',
  provider: 'none',
  preferredModel: 'openai/gpt-oss-20b',
  confidence: 1,
  reason: 'No current or source-backed information required.',
  needsCurrentInfo: false,
  needsSources: false,
  needsFreshnessCheck: false,
  freshness: 'unknown',
  safety: AUREN_DEFAULT_SEARCH_SAFETY_POLICY,
  sourcePolicy: AUREN_DEFAULT_SOURCE_POLICY,
};

export function isAurenSearchMetadata(value: unknown): value is AurenSearchMetadata {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return false;
  }

  const metadata = value as Record<string, unknown>;

  return (
    typeof metadata.browserSearch === 'boolean' ||
    typeof metadata.forceSearch === 'boolean' ||
    typeof metadata.disableAutoSearch === 'boolean' ||
    typeof metadata.userSelectedSearch === 'boolean' ||
    typeof metadata.searchDepth === 'string' ||
    typeof metadata.searchTrigger === 'string'
  );
}

export function getAurenSearchMetadata(value: unknown): AurenSearchMetadata {
  return isAurenSearchMetadata(value) ? value : {};
}

export function isSearchEnabledByMetadata(metadata: AurenSearchMetadata | undefined) {
  return metadata?.browserSearch === true || metadata?.forceSearch === true || metadata?.userSelectedSearch === true;
}

export function createEmptySearchReport(overrides: {
  id: string;
  decision?: AurenSearchDecision;
  createdAt?: string;
}): AurenSearchReport {
  const createdAt = overrides.createdAt ?? new Date().toISOString();
  const decision = overrides.decision ?? AUREN_NO_SEARCH_DECISION;

  return {
    id: overrides.id,
    used: false,
    trigger: decision.trigger,
    depth: decision.depth,
    provider: decision.provider,
    model: decision.preferredModel,
    decision,
    plan: {
      id: `${overrides.id}_plan`,
      depth: 'none',
      provider: 'none',
      model: decision.preferredModel,
      queries: [],
      sourcePolicy: decision.sourcePolicy,
      safety: decision.safety,
      maxSearchCalls: 0,
      expectedLatency: 'fast',
      createdAt,
    },
    rawResults: [],
    sources: [],
    evidence: [],
    conflicts: [],
    confidence: {
      level: 'none',
      score: 0,
      reason: 'Search was not used.',
      supportingEvidenceCount: 0,
      conflictingEvidenceCount: 0,
      sourceQualityAverage: 0,
    },
    answerDraft: {
      text: '',
      shouldMentionUncertainty: false,
      shouldMentionSources: false,
    },
    sourcesChecked: 0,
    warnings: [],
    createdAt,
  };
}
