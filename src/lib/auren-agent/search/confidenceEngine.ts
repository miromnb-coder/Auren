import type {
  AurenSearchConfidence,
  AurenSearchConfidenceLevel,
  AurenSearchConflict,
  AurenSearchDecision,
  AurenSearchEvidence,
  AurenSearchPlan,
  AurenSearchRawResult,
  AurenSearchSource,
} from './types';

const HIGH_CONFIDENCE_THRESHOLD = 0.76;
const MEDIUM_CONFIDENCE_THRESHOLD = 0.52;
const LOW_CONFIDENCE_THRESHOLD = 0.24;

const MAX_WARNING_PENALTY = 0.18;
const MAX_CONFLICT_PENALTY = 0.24;

export type AurenConfidenceEngineInput = {
  decision: AurenSearchDecision;
  plan: AurenSearchPlan;
  rawResults: AurenSearchRawResult[];
  sources: AurenSearchSource[];
  evidence: AurenSearchEvidence[];
  conflicts: AurenSearchConflict[];
  warnings?: string[];
};

export type AurenConfidenceFactors = {
  rawResultScore: number;
  sourceCoverageScore: number;
  sourceQualityScore: number;
  evidenceScore: number;
  conflictPenalty: number;
  riskPenalty: number;
  warningPenalty: number;
  policyPenalty: number;
};

export type AurenConfidenceEngineResult = {
  confidence: AurenSearchConfidence;
  factors: AurenConfidenceFactors;
  shouldUseSearchAnswer: boolean;
  shouldMentionUncertainty: boolean;
  shouldMentionSources: boolean;
  suggestedStatusLine: string;
  warnings: string[];
  debug: {
    successfulResultCount: number;
    failedResultCount: number;
    sourceCount: number;
    evidenceCount: number;
    strongEvidenceCount: number;
    usableEvidenceCount: number;
    conflictCount: number;
    majorConflictCount: number;
    policySatisfied: boolean;
  };
};

function cleanText(value: unknown, fallback = '') {
  if (typeof value !== 'string') return fallback;

  return value.replace(/\s+/g, ' ').trim() || fallback;
}

function clampScore(value: number) {
  if (!Number.isFinite(value)) return 0;

  return Math.min(Math.max(value, 0), 1);
}

function average(values: number[]) {
  if (values.length === 0) return 0;

  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function getRawResultAnswerLength(result: AurenSearchRawResult) {
  return cleanText(result.answer || result.rawText).length;
}

function getSuccessfulRawResults(rawResults: AurenSearchRawResult[]) {
  return rawResults.filter((result) => result.success && getRawResultAnswerLength(result) > 0);
}

function getFailedRawResults(rawResults: AurenSearchRawResult[]) {
  return rawResults.filter((result) => !result.success || getRawResultAnswerLength(result) === 0);
}

function getSourceQualityScore(source: AurenSearchSource) {
  return clampScore(average([source.trustScore, source.relevanceScore, source.freshnessScore]));
}

function getSourceQualityAverage(sources: AurenSearchSource[]) {
  return average(sources.map(getSourceQualityScore));
}

function isSyntheticSource(source: AurenSearchSource) {
  return source.notes?.toLowerCase().includes('synthetic source placeholder') === true;
}

function getExplicitSourceCount(sources: AurenSearchSource[]) {
  return sources.filter((source) => !isSyntheticSource(source)).length;
}

function getUniqueDomainCount(sources: AurenSearchSource[]) {
  return new Set(sources.map((source) => source.domain).filter(Boolean)).size;
}

function getPrimaryOrOfficialSourceCount(sources: AurenSearchSource[]) {
  return sources.filter(
    (source) =>
      source.isPrimarySource ||
      source.sourceType === 'official' ||
      source.sourceType === 'documentation' ||
      source.sourceType === 'academic' ||
      source.sourceType === 'database',
  ).length;
}

function getStrongEvidence(evidence: AurenSearchEvidence[]) {
  return evidence.filter((item) => item.supportLevel === 'strong' && item.confidence >= 0.7);
}

function getUsableEvidence(evidence: AurenSearchEvidence[]) {
  return evidence.filter(
    (item) =>
      item.supportLevel !== 'contradicts' &&
      item.supportLevel !== 'unknown' &&
      item.confidence >= 0.45 &&
      item.relevance >= 0.42,
  );
}

function getContradictingEvidence(evidence: AurenSearchEvidence[]) {
  return evidence.filter((item) => item.supportLevel === 'contradicts');
}

function getMajorConflicts(conflicts: AurenSearchConflict[]) {
  return conflicts.filter((conflict) => conflict.severity === 'major');
}

function hasEnoughSources(input: AurenConfidenceEngineInput) {
  const minSourceCount = input.plan.sourcePolicy.requireMultipleSources
    ? Math.max(2, input.plan.sourcePolicy.minSourceCount)
    : Math.max(1, input.plan.sourcePolicy.minSourceCount);

  return input.sources.length >= minSourceCount;
}

function hasEnoughExplicitSources(input: AurenConfidenceEngineInput) {
  if (!input.plan.sourcePolicy.requireMultipleSources) {
    return input.sources.length > 0;
  }

  return getExplicitSourceCount(input.sources) >= Math.max(1, input.plan.sourcePolicy.minSourceCount);
}

function calculateRawResultScore(rawResults: AurenSearchRawResult[]) {
  if (rawResults.length === 0) return 0;

  const successfulResults = getSuccessfulRawResults(rawResults);

  if (successfulResults.length === 0) return 0;

  const successRatio = successfulResults.length / rawResults.length;
  const bestAnswerLength = Math.max(...successfulResults.map(getRawResultAnswerLength));
  const answerDepthScore = clampScore(bestAnswerLength / 1200);

  return clampScore(successRatio * 0.72 + answerDepthScore * 0.28);
}

function calculateSourceCoverageScore(input: AurenConfidenceEngineInput) {
  const sourceCount = input.sources.length;

  if (sourceCount === 0) return 0;

  const requiredCount = input.plan.sourcePolicy.requireMultipleSources
    ? Math.max(2, input.plan.sourcePolicy.minSourceCount)
    : Math.max(1, input.plan.sourcePolicy.minSourceCount);

  const countScore = clampScore(sourceCount / requiredCount);
  const uniqueDomainCount = getUniqueDomainCount(input.sources);
  const uniqueDomainScore = clampScore(uniqueDomainCount / Math.max(1, Math.min(requiredCount, 3)));
  const primarySourceScore = clampScore(getPrimaryOrOfficialSourceCount(input.sources) / Math.max(1, requiredCount));
  const explicitSourceScore = clampScore(getExplicitSourceCount(input.sources) / Math.max(1, requiredCount));

  return clampScore(
    countScore * 0.38 +
      uniqueDomainScore * 0.22 +
      primarySourceScore * 0.22 +
      explicitSourceScore * 0.18,
  );
}

function calculateSourceQualityScore(sources: AurenSearchSource[]) {
  if (sources.length === 0) return 0;

  const qualityAverage = getSourceQualityAverage(sources);
  const bestSourceQuality = Math.max(...sources.map(getSourceQualityScore));
  const primarySourceCount = getPrimaryOrOfficialSourceCount(sources);
  const primarySourceBonus = primarySourceCount > 0 ? 0.08 : 0;
  const syntheticPenalty = sources.some(isSyntheticSource) ? 0.08 : 0;

  return clampScore(qualityAverage * 0.72 + bestSourceQuality * 0.28 + primarySourceBonus - syntheticPenalty);
}

function calculateEvidenceScore(evidence: AurenSearchEvidence[]) {
  if (evidence.length === 0) return 0;

  const usableEvidence = getUsableEvidence(evidence);
  const strongEvidence = getStrongEvidence(evidence);
  const contradictingEvidence = getContradictingEvidence(evidence);
  const averageConfidence = average(usableEvidence.map((item) => item.confidence));
  const averageRelevance = average(usableEvidence.map((item) => item.relevance));
  const usableRatio = usableEvidence.length / evidence.length;
  const strongRatio = strongEvidence.length / Math.max(1, evidence.length);
  const contradictionPenalty = Math.min(0.2, contradictingEvidence.length * 0.06);

  return clampScore(
    usableRatio * 0.28 +
      strongRatio * 0.22 +
      averageConfidence * 0.28 +
      averageRelevance * 0.22 -
      contradictionPenalty,
  );
}

function calculateConflictPenalty(conflicts: AurenSearchConflict[], evidence: AurenSearchEvidence[]) {
  if (conflicts.length === 0 && getContradictingEvidence(evidence).length === 0) return 0;

  const minorCount = conflicts.filter((conflict) => conflict.severity === 'minor').length;
  const moderateCount = conflicts.filter((conflict) => conflict.severity === 'moderate').length;
  const majorCount = conflicts.filter((conflict) => conflict.severity === 'major').length;
  const contradictingEvidenceCount = getContradictingEvidence(evidence).length;

  return Math.min(
    MAX_CONFLICT_PENALTY,
    minorCount * 0.035 +
      moderateCount * 0.07 +
      majorCount * 0.13 +
      contradictingEvidenceCount * 0.06,
  );
}

function calculateRiskPenalty(input: AurenConfidenceEngineInput) {
  let penalty = 0;

  if (input.decision.safety.riskLevel === 'medium') {
    penalty += 0.035;
  }

  if (input.decision.safety.riskLevel === 'high') {
    penalty += 0.09;
  }

  if (input.decision.safety.requireCautionForPeopleSearch) {
    penalty += 0.035;
  }

  if (input.decision.safety.requireSourceBackedClaims && input.sources.length === 0) {
    penalty += 0.12;
  }

  if (input.decision.safety.requireSourceBackedClaims && getUsableEvidence(input.evidence).length === 0) {
    penalty += 0.08;
  }

  return Math.min(0.22, penalty);
}

function calculateWarningPenalty(warnings: string[]) {
  if (warnings.length === 0) return 0;

  return Math.min(MAX_WARNING_PENALTY, warnings.length * 0.045);
}

function calculatePolicyPenalty(input: AurenConfidenceEngineInput) {
  let penalty = 0;

  if (input.plan.sourcePolicy.requireMultipleSources && !hasEnoughSources(input)) {
    penalty += 0.12;
  }

  if (input.plan.sourcePolicy.requireMultipleSources && !hasEnoughExplicitSources(input)) {
    penalty += 0.08;
  }

  if (input.plan.sourcePolicy.preferOfficialSources && getPrimaryOrOfficialSourceCount(input.sources) === 0) {
    penalty += 0.05;
  }

  if (input.plan.sourcePolicy.preferRecentSources) {
    const freshnessAverage = average(input.sources.map((source) => source.freshnessScore));

    if (input.sources.length > 0 && freshnessAverage < 0.45) {
      penalty += 0.055;
    }
  }

  return Math.min(0.2, penalty);
}

function calculateFactors(input: AurenConfidenceEngineInput): AurenConfidenceFactors {
  const warnings = input.warnings ?? [];

  return {
    rawResultScore: calculateRawResultScore(input.rawResults),
    sourceCoverageScore: calculateSourceCoverageScore(input),
    sourceQualityScore: calculateSourceQualityScore(input.sources),
    evidenceScore: calculateEvidenceScore(input.evidence),
    conflictPenalty: calculateConflictPenalty(input.conflicts, input.evidence),
    riskPenalty: calculateRiskPenalty(input),
    warningPenalty: calculateWarningPenalty(warnings),
    policyPenalty: calculatePolicyPenalty(input),
  };
}

function calculateFinalScore(factors: AurenConfidenceFactors) {
  const positiveScore =
    factors.rawResultScore * 0.28 +
    factors.sourceCoverageScore * 0.2 +
    factors.sourceQualityScore * 0.22 +
    factors.evidenceScore * 0.3;

  const penalty =
    factors.conflictPenalty +
    factors.riskPenalty +
    factors.warningPenalty +
    factors.policyPenalty;

  return clampScore(positiveScore - penalty);
}

function getConfidenceLevel(params: {
  score: number;
  successfulResultCount: number;
  sourceCount: number;
  majorConflictCount: number;
  usableEvidenceCount: number;
}): AurenSearchConfidenceLevel {
  if (params.successfulResultCount === 0) return 'none';
  if (params.score < LOW_CONFIDENCE_THRESHOLD) return 'none';

  if (params.majorConflictCount > 0 && params.score < HIGH_CONFIDENCE_THRESHOLD + 0.08) {
    return params.score >= MEDIUM_CONFIDENCE_THRESHOLD ? 'medium' : 'low';
  }

  if (params.score >= HIGH_CONFIDENCE_THRESHOLD && params.sourceCount > 0 && params.usableEvidenceCount > 0) {
    return 'high';
  }

  if (params.score >= MEDIUM_CONFIDENCE_THRESHOLD) {
    return 'medium';
  }

  return 'low';
}

function createReason(params: {
  level: AurenSearchConfidenceLevel;
  factors: AurenConfidenceFactors;
  successfulResultCount: number;
  sourceCount: number;
  usableEvidenceCount: number;
  strongEvidenceCount: number;
  conflictCount: number;
  majorConflictCount: number;
  policySatisfied: boolean;
}) {
  if (params.level === 'none') {
    if (params.successfulResultCount === 0) {
      return 'Search did not return a usable result.';
    }

    return 'Search returned information, but support was too weak to use confidently.';
  }

  if (params.level === 'high') {
    return 'Search returned usable results with strong enough source and evidence support.';
  }

  if (params.level === 'medium') {
    const reasons = [
      'Search returned useful information.',
      params.sourceCount > 0 ? 'Some source support is available.' : '',
      params.usableEvidenceCount > 0 ? 'Some usable evidence was extracted.' : '',
      params.conflictCount > 0 ? 'There may be some conflicting or uncertain evidence.' : '',
      !params.policySatisfied ? 'The source policy was not fully satisfied.' : '',
    ].filter(Boolean);

    return reasons.join(' ');
  }

  const reasons = [
    'Search returned limited or weakly supported information.',
    params.sourceCount === 0 ? 'No accepted source metadata was available.' : '',
    params.usableEvidenceCount === 0 ? 'No strong evidence was extracted.' : '',
    params.majorConflictCount > 0 ? 'Major conflicting evidence was detected.' : '',
    !params.policySatisfied ? 'The source policy was not fully satisfied.' : '',
  ].filter(Boolean);

  return reasons.join(' ');
}

function shouldUseSearchAnswer(params: {
  level: AurenSearchConfidenceLevel;
  successfulResultCount: number;
  rawResults: AurenSearchRawResult[];
}) {
  if (params.successfulResultCount === 0) return false;

  const hasAnswer = params.rawResults.some((result) => result.success && getRawResultAnswerLength(result) > 0);

  if (!hasAnswer) return false;

  return params.level !== 'none';
}

function shouldMentionUncertainty(params: {
  level: AurenSearchConfidenceLevel;
  decision: AurenSearchDecision;
  warnings: string[];
  conflicts: AurenSearchConflict[];
  factors: AurenConfidenceFactors;
}) {
  if (params.level === 'low' || params.level === 'none') return true;
  if (params.decision.safety.riskLevel === 'high') return true;
  if (params.warnings.length > 0) return true;
  if (params.conflicts.length > 0) return true;
  if (params.factors.policyPenalty > 0.08) return true;
  if (params.factors.sourceCoverageScore < 0.45) return true;

  return false;
}

function shouldMentionSources(params: {
  decision: AurenSearchDecision;
  sourceCount: number;
  evidenceCount: number;
  level: AurenSearchConfidenceLevel;
}) {
  if (params.decision.needsSources) return true;
  if (params.sourceCount > 0 && params.evidenceCount > 0) return true;
  if (params.level === 'medium' || params.level === 'high') return true;

  return false;
}

function getStatusLabel(level: AurenSearchConfidenceLevel) {
  if (level === 'high') return 'High confidence';
  if (level === 'medium') return 'Medium confidence';
  if (level === 'low') return 'Low confidence';

  return 'No reliable result';
}

function createStatusLine(params: {
  level: AurenSearchConfidenceLevel;
  sourceCount: number;
  evidenceCount: number;
}) {
  const sourceText =
    params.sourceCount === 1
      ? '1 source'
      : `${params.sourceCount} sources`;

  const evidenceText =
    params.evidenceCount === 1
      ? '1 evidence item'
      : `${params.evidenceCount} evidence items`;

  if (params.level === 'none') {
    return 'Searched web · No reliable result';
  }

  if (params.sourceCount > 0 && params.evidenceCount > 0) {
    return `Searched web · ${getStatusLabel(params.level)} · ${sourceText} · ${evidenceText}`;
  }

  if (params.sourceCount > 0) {
    return `Searched web · ${getStatusLabel(params.level)} · ${sourceText}`;
  }

  return `Searched web · ${getStatusLabel(params.level)}`;
}

function buildWarnings(input: AurenConfidenceEngineInput, factors: AurenConfidenceFactors) {
  const warnings = [...(input.warnings ?? [])];

  if (input.rawResults.length === 0) {
    warnings.push('No raw search results were available for confidence evaluation.');
  }

  if (getSuccessfulRawResults(input.rawResults).length === 0) {
    warnings.push('No successful search result was available.');
  }

  if (input.sources.length === 0) {
    warnings.push('No accepted sources were available.');
  }

  if (input.evidence.length === 0) {
    warnings.push('No extracted evidence was available.');
  }

  if (input.conflicts.length > 0) {
    warnings.push('Conflicting evidence may reduce confidence.');
  }

  if (input.plan.sourcePolicy.requireMultipleSources && !hasEnoughSources(input)) {
    warnings.push('The source policy requested multiple sources, but not enough sources were available.');
  }

  if (input.decision.safety.riskLevel === 'high' && factors.sourceQualityScore < 0.7) {
    warnings.push('High-risk search did not reach strong source quality.');
  }

  if (factors.policyPenalty > 0.12) {
    warnings.push('Search policy was not fully satisfied.');
  }

  return Array.from(new Set(warnings));
}

export function evaluateAurenSearchConfidence(input: AurenConfidenceEngineInput): AurenConfidenceEngineResult {
  const factors = calculateFactors(input);
  const warnings = buildWarnings(input, factors);
  const score = calculateFinalScore({
    ...factors,
    warningPenalty: calculateWarningPenalty(warnings),
  });

  const successfulResultCount = getSuccessfulRawResults(input.rawResults).length;
  const failedResultCount = getFailedRawResults(input.rawResults).length;
  const strongEvidenceCount = getStrongEvidence(input.evidence).length;
  const usableEvidenceCount = getUsableEvidence(input.evidence).length;
  const conflictCount = input.conflicts.length;
  const majorConflictCount = getMajorConflicts(input.conflicts).length;
  const policySatisfied =
    (!input.plan.sourcePolicy.requireMultipleSources || hasEnoughSources(input)) &&
    (!input.decision.safety.requireSourceBackedClaims || usableEvidenceCount > 0 || input.sources.length > 0);

  const level = getConfidenceLevel({
    score,
    successfulResultCount,
    sourceCount: input.sources.length,
    majorConflictCount,
    usableEvidenceCount,
  });

  const confidence: AurenSearchConfidence = {
    level,
    score,
    reason: createReason({
      level,
      factors,
      successfulResultCount,
      sourceCount: input.sources.length,
      usableEvidenceCount,
      strongEvidenceCount,
      conflictCount,
      majorConflictCount,
      policySatisfied,
    }),
    supportingEvidenceCount: usableEvidenceCount,
    conflictingEvidenceCount: conflictCount + getContradictingEvidence(input.evidence).length,
    sourceQualityAverage: getSourceQualityAverage(input.sources),
  };

  return {
    confidence,
    factors,
    shouldUseSearchAnswer: shouldUseSearchAnswer({
      level,
      successfulResultCount,
      rawResults: input.rawResults,
    }),
    shouldMentionUncertainty: shouldMentionUncertainty({
      level,
      decision: input.decision,
      warnings,
      conflicts: input.conflicts,
      factors,
    }),
    shouldMentionSources: shouldMentionSources({
      decision: input.decision,
      sourceCount: input.sources.length,
      evidenceCount: input.evidence.length,
      level,
    }),
    suggestedStatusLine: createStatusLine({
      level,
      sourceCount: input.sources.length,
      evidenceCount: input.evidence.length,
    }),
    warnings,
    debug: {
      successfulResultCount,
      failedResultCount,
      sourceCount: input.sources.length,
      evidenceCount: input.evidence.length,
      strongEvidenceCount,
      usableEvidenceCount,
      conflictCount,
      majorConflictCount,
      policySatisfied,
    },
  };
}

export function createNoConfidenceResult(reason = 'Search was not used.'): AurenConfidenceEngineResult {
  const confidence: AurenSearchConfidence = {
    level: 'none',
    score: 0,
    reason,
    supportingEvidenceCount: 0,
    conflictingEvidenceCount: 0,
    sourceQualityAverage: 0,
  };

  return {
    confidence,
    factors: {
      rawResultScore: 0,
      sourceCoverageScore: 0,
      sourceQualityScore: 0,
      evidenceScore: 0,
      conflictPenalty: 0,
      riskPenalty: 0,
      warningPenalty: 0,
      policyPenalty: 0,
    },
    shouldUseSearchAnswer: false,
    shouldMentionUncertainty: true,
    shouldMentionSources: false,
    suggestedStatusLine: 'Searched web · No reliable result',
    warnings: [reason],
    debug: {
      successfulResultCount: 0,
      failedResultCount: 0,
      sourceCount: 0,
      evidenceCount: 0,
      strongEvidenceCount: 0,
      usableEvidenceCount: 0,
      conflictCount: 0,
      majorConflictCount: 0,
      policySatisfied: false,
    },
  };
}

export function shouldUseAurenSearchAnswer(result: AurenConfidenceEngineResult) {
  return result.shouldUseSearchAnswer;
}

export function shouldMentionAurenSearchUncertainty(result: AurenConfidenceEngineResult) {
  return result.shouldMentionUncertainty;
}

export function getAurenSearchConfidenceStatusLine(result: AurenConfidenceEngineResult) {
  return result.suggestedStatusLine;
}

export function getAurenSearchConfidenceLevel(result: AurenConfidenceEngineResult) {
  return result.confidence.level;
}

export function getAurenSearchConfidenceScore(result: AurenConfidenceEngineResult) {
  return result.confidence.score;
}

export function summarizeConfidenceEvaluation(result: AurenConfidenceEngineResult) {
  return {
    level: result.confidence.level,
    score: result.confidence.score,
    reason: result.confidence.reason,
    shouldUseSearchAnswer: result.shouldUseSearchAnswer,
    shouldMentionUncertainty: result.shouldMentionUncertainty,
    shouldMentionSources: result.shouldMentionSources,
    statusLine: result.suggestedStatusLine,
    supportingEvidenceCount: result.confidence.supportingEvidenceCount,
    conflictingEvidenceCount: result.confidence.conflictingEvidenceCount,
    sourceQualityAverage: result.confidence.sourceQualityAverage,
    warnings: result.warnings,
  };
}

export function serializeConfidenceDebug(result: AurenConfidenceEngineResult) {
  return {
    summary: summarizeConfidenceEvaluation(result),
    factors: result.factors,
    debug: result.debug,
    warnings: result.warnings,
  };
}
