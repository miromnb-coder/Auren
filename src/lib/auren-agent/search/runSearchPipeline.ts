import {
  executeAurenBrowserSearchPlan,
  getBestBrowserSearchAnswer,
  serializeBrowserSearchExecutorDebug,
  summarizeBrowserSearchExecution,
} from './browserSearchExecutor';
import {
  createNoConfidenceResult,
  evaluateAurenSearchConfidence,
  serializeConfidenceDebug,
  summarizeConfidenceEvaluation,
} from './confidenceEngine';
import {
  extractAurenSearchEvidence,
  serializeEvidenceDebug,
  summarizeEvidenceExtraction,
} from './evidenceExtractor';
import { routeAurenSearch, routeAurenSearchSyncFallback } from './searchRouter';
import {
  createAurenSearchPlan,
  createAurenSearchPlanSyncFallback,
  summarizeSearchPlan,
} from './searchPlanner';
import {
  createEmptySearchReport,
  AUREN_NO_SEARCH_DECISION,
  type AurenSearchAnswerDraft,
  type AurenSearchDecision,
  type AurenSearchPipelineInput,
  type AurenSearchPipelineResult,
  type AurenSearchReport,
} from './types';
import {
  evaluateAurenSearchSources,
  serializeSourceEvaluationDebug,
  summarizeSourceEvaluation,
} from './sourceEvaluator';

const MAX_ANSWER_LENGTH = 9000;

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

function limitAnswer(value: string, maxLength = MAX_ANSWER_LENGTH) {
  const cleaned = cleanAnswerText(value);

  if (cleaned.length <= maxLength) return cleaned;

  return `${cleaned.slice(0, maxLength - 1).trim()}…`;
}

function getLatencyMs(startedAt: string, completedAt: string) {
  return Math.max(0, new Date(completedAt).getTime() - new Date(startedAt).getTime());
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

function getFallbackSearchAnswer(params: {
  rawResults: { error?: string; answer?: string; rawText?: string }[];
  language?: string;
}) {
  const bestExistingText = params.rawResults
    .map((result) => cleanAnswerText(result.answer || result.rawText))
    .find(Boolean);

  if (bestExistingText) {
    return limitAnswer(bestExistingText);
  }

  const error = params.rawResults.find((result) => result.error)?.error;

  if (params.language === 'fi') {
    if (error) {
      return `En saanut web-hakua valmiiksi juuri nyt. ${error}`;
    }

    return 'En saanut web-hakua valmiiksi juuri nyt. Kokeile hetken päästä uudelleen.';
  }

  if (error) {
    return `I could not complete web search right now. ${error}`;
  }

  return 'I could not complete web search right now, but you can try again in a moment.';
}

function createAnswerDraft(params: {
  answer: string;
  language?: string;
  shouldMentionUncertainty: boolean;
  shouldMentionSources: boolean;
  suggestedStatusLine: string;
}): AurenSearchAnswerDraft {
  return {
    text: limitAnswer(params.answer),
    language: params.language,
    shouldMentionUncertainty: params.shouldMentionUncertainty,
    shouldMentionSources: params.shouldMentionSources,
    suggestedStatusLine: params.suggestedStatusLine,
  };
}

function mergeWarnings(...warningGroups: Array<string[] | undefined>) {
  return Array.from(
    new Set(
      warningGroups
        .flatMap((warnings) => warnings ?? [])
        .map((warning) => cleanText(warning))
        .filter(Boolean),
    ),
  );
}

async function getSearchDecision(input: AurenSearchPipelineInput): Promise<AurenSearchDecision> {
  try {
    return await routeAurenSearch({
      context: input.context,
      metadata: input.metadata,
    });
  } catch {
    return routeAurenSearchSyncFallback({
      context: input.context,
      metadata: input.metadata,
    });
  }
}

async function getPlannerResult(params: {
  input: AurenSearchPipelineInput;
  decision: AurenSearchDecision;
}) {
  try {
    return await createAurenSearchPlan({
      context: params.input.context,
      decision: params.decision,
    });
  } catch {
    return createAurenSearchPlanSyncFallback({
      context: params.input.context,
      decision: params.decision,
    });
  }
}

function createNoSearchReport(params: {
  decision: AurenSearchDecision;
  createdAt: string;
  reason?: string;
}): AurenSearchPipelineResult {
  return {
    report: createEmptySearchReport({
      id: createId('search_report_empty'),
      decision: {
        ...params.decision,
        reason: params.reason || params.decision.reason,
      },
      createdAt: params.createdAt,
    }),
    shouldUseSearchAnswer: false,
  };
}

function createUsedSearchReport(params: {
  input: AurenSearchPipelineInput;
  decision: AurenSearchDecision;
  plannerResult: Awaited<ReturnType<typeof getPlannerResult>>;
  browserResult: Awaited<ReturnType<typeof executeAurenBrowserSearchPlan>>;
  createdAt: string;
}): AurenSearchReport {
  const sourceEvaluation = evaluateAurenSearchSources({
    plan: params.plannerResult.plan,
    rawResults: params.browserResult.rawResults,
  });

  const evidenceExtraction = extractAurenSearchEvidence({
    plan: params.plannerResult.plan,
    rawResults: params.browserResult.rawResults,
    sources: sourceEvaluation.sources,
  });

  const combinedPreConfidenceWarnings = mergeWarnings(
    params.plannerResult.warnings,
    params.browserResult.warnings,
    sourceEvaluation.warnings,
    evidenceExtraction.warnings,
  );

  const confidenceEvaluation = evaluateAurenSearchConfidence({
    decision: params.decision,
    plan: params.plannerResult.plan,
    rawResults: params.browserResult.rawResults,
    sources: sourceEvaluation.sources,
    evidence: evidenceExtraction.evidence,
    conflicts: evidenceExtraction.conflicts,
    warnings: combinedPreConfidenceWarnings,
  });

  const warnings = mergeWarnings(combinedPreConfidenceWarnings, confidenceEvaluation.warnings);
  const bestAnswer = getBestBrowserSearchAnswer(params.browserResult.rawResults);
  const language = inferLanguage(params.input.context.message || params.input.context.input.message);
  const answerText =
    bestAnswer ||
    getFallbackSearchAnswer({
      rawResults: params.browserResult.rawResults,
      language,
    });

  const answerDraft = createAnswerDraft({
    answer: answerText,
    language,
    shouldMentionUncertainty: confidenceEvaluation.shouldMentionUncertainty,
    shouldMentionSources: confidenceEvaluation.shouldMentionSources,
    suggestedStatusLine: confidenceEvaluation.suggestedStatusLine,
  });

  const completedAt = nowIso();

  return {
    id: createId('search_report'),
    used: true,
    trigger: params.decision.trigger,
    depth: params.plannerResult.plan.depth,
    provider: params.plannerResult.plan.provider,
    model: params.plannerResult.plan.model,
    decision: params.decision,
    plan: params.plannerResult.plan,
    rawResults: params.browserResult.rawResults,
    sources: sourceEvaluation.sources,
    evidence: evidenceExtraction.evidence,
    conflicts: evidenceExtraction.conflicts,
    confidence: confidenceEvaluation.confidence,
    answerDraft,
    sourcesChecked: sourceEvaluation.sources.length,
    warnings,
    createdAt: params.createdAt,
    completedAt,
    debug: {
      latencyMs: getLatencyMs(params.createdAt, completedAt),
      decision: {
        shouldSearch: params.decision.shouldSearch,
        trigger: params.decision.trigger,
        depth: params.decision.depth,
        confidence: params.decision.confidence,
        reason: params.decision.reason,
      },
      plan: summarizeSearchPlan(params.plannerResult.plan),
      planner: {
        rewrite: {
          language: params.plannerResult.rewrite.language,
          mainQuery: params.plannerResult.rewrite.mainQuery,
          reasoning: params.plannerResult.rewrite.reasoning,
          usedFallback: params.plannerResult.rewrite.usedFallback,
          warnings: params.plannerResult.rewrite.warnings,
        },
        warnings: params.plannerResult.warnings,
      },
      browserSearch: summarizeBrowserSearchExecution(params.browserResult),
      sources: summarizeSourceEvaluation(sourceEvaluation),
      evidence: summarizeEvidenceExtraction(evidenceExtraction),
      confidence: summarizeConfidenceEvaluation(confidenceEvaluation),
      detailedDebug: {
        browserSearch: serializeBrowserSearchExecutorDebug(params.browserResult),
        sources: serializeSourceEvaluationDebug(sourceEvaluation),
        evidence: serializeEvidenceDebug(evidenceExtraction),
        confidence: serializeConfidenceDebug(confidenceEvaluation),
      },
    },
  };
}

export async function runSearchPipeline(input: AurenSearchPipelineInput): Promise<AurenSearchPipelineResult> {
  const createdAt = nowIso();
  const decision = await getSearchDecision(input);

  if (!decision.shouldSearch || decision.depth === 'none') {
    return createNoSearchReport({
      decision,
      createdAt,
    });
  }

  const plannerResult = await getPlannerResult({
    input,
    decision,
  });

  if (
    plannerResult.plan.depth === 'none' ||
    plannerResult.plan.provider === 'none' ||
    plannerResult.plan.queries.length === 0 ||
    plannerResult.plan.maxSearchCalls <= 0
  ) {
    return createNoSearchReport({
      decision,
      createdAt,
      reason: 'Search was requested, but no executable search plan was created.',
    });
  }

  const browserResult = await executeAurenBrowserSearchPlan({
    context: input.context,
    plan: plannerResult.plan,
  });

  const report = createUsedSearchReport({
    input,
    decision,
    plannerResult,
    browserResult,
    createdAt,
  });

  return {
    report,
    shouldUseSearchAnswer:
      report.used &&
      cleanAnswerText(report.answerDraft.text).length > 0 &&
      report.confidence.level !== 'none',
  };
}

export function createNoSearchPipelineResult(reason?: string): AurenSearchPipelineResult {
  const createdAt = nowIso();

  const decision: AurenSearchDecision = {
    ...AUREN_NO_SEARCH_DECISION,
    reason: reason || AUREN_NO_SEARCH_DECISION.reason,
    safety: {
      ...AUREN_NO_SEARCH_DECISION.safety,
    },
    sourcePolicy: {
      ...AUREN_NO_SEARCH_DECISION.sourcePolicy,
      allowedSourceTypes: [...AUREN_NO_SEARCH_DECISION.sourcePolicy.allowedSourceTypes],
      blockedSourceTypes: [...AUREN_NO_SEARCH_DECISION.sourcePolicy.blockedSourceTypes],
      preferredDomains: [...AUREN_NO_SEARCH_DECISION.sourcePolicy.preferredDomains],
      blockedDomains: [...AUREN_NO_SEARCH_DECISION.sourcePolicy.blockedDomains],
    },
  };

  return {
    report: createEmptySearchReport({
      id: createId('search_report_empty'),
      decision,
      createdAt,
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

export function summarizeSearchPipelineResult(result: AurenSearchPipelineResult) {
  return {
    shouldUseSearchAnswer: result.shouldUseSearchAnswer,
    used: result.report.used,
    trigger: result.report.trigger,
    depth: result.report.depth,
    provider: result.report.provider,
    model: result.report.model,
    confidence: result.report.confidence.level,
    confidenceScore: result.report.confidence.score,
    sourcesChecked: result.report.sourcesChecked,
    evidenceCount: result.report.evidence.length,
    conflictCount: result.report.conflicts.length,
    warningCount: result.report.warnings.length,
    statusLine: result.report.answerDraft.suggestedStatusLine,
  };
}
