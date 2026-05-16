import type {
  AurenSearchConflict,
  AurenSearchEvidence,
  AurenSearchPlan,
  AurenSearchRawResult,
  AurenSearchSource,
  AurenSearchSourceType,
} from './types';

const MAX_CLAIM_LENGTH = 520;
const MAX_EVIDENCE_ITEMS = 24;
const MAX_SENTENCES_PER_RESULT = 8;
const MIN_CLAIM_LENGTH = 28;

export type AurenEvidenceExtractorInput = {
  plan: AurenSearchPlan;
  rawResults: AurenSearchRawResult[];
  sources: AurenSearchSource[];
};

export type AurenEvidenceExtractorResult = {
  evidence: AurenSearchEvidence[];
  conflicts: AurenSearchConflict[];
  warnings: string[];
};

type ClaimCandidate = {
  claim: string;
  rawResultId: string;
  queryIds: string[];
  confidenceHint: number;
  supportHint: AurenSearchEvidence['supportLevel'];
  notes?: string;
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

function clampScore(value: number) {
  return Math.min(Math.max(value, 0), 1);
}

function average(values: number[]) {
  if (values.length === 0) return 0;

  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function normalizeForDedupe(value: string) {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/https?:\/\/\S+/g, '')
    .replace(/[^a-z0-9åäö\s]/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function splitIntoSentences(text: string) {
  const normalized = cleanText(text)
    .replace(/\n+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  if (!normalized) return [];

  return normalized
    .split(/(?<=[.!?])\s+|(?<=\.)\s+(?=[A-ZÅÄÖ])/g)
    .map((sentence) => cleanText(sentence))
    .filter(Boolean);
}

function splitLongSentence(sentence: string) {
  if (sentence.length <= MAX_CLAIM_LENGTH) {
    return [sentence];
  }

  return sentence
    .split(/\s+(?:and|but|however|while|because|ja|mutta|kuitenkin|koska|sekä)\s+/i)
    .map((part) => cleanText(part))
    .filter((part) => part.length >= MIN_CLAIM_LENGTH)
    .map((part) => limitText(part, MAX_CLAIM_LENGTH));
}

function isProbablyUsefulClaim(sentence: string) {
  const cleaned = cleanText(sentence);

  if (cleaned.length < MIN_CLAIM_LENGTH) return false;
  if (/^(yes|no|kyllä|ei)\.?$/i.test(cleaned)) return false;
  if (/^(here'?s|tässä|tassa)\b/i.test(cleaned) && cleaned.length < 70) return false;
  if (/^(i can|voin|haluatko|if you want)/i.test(cleaned)) return false;

  return true;
}

function containsUrl(value: string) {
  return /https?:\/\/\S+/i.test(value);
}

function hasUncertaintyLanguage(value: string) {
  return /\b(may|might|could|appears|seems|likely|possibly|unclear|unknown|not enough|cannot verify|could not verify|ei varmaa|epäselv|todennäköisesti|mahdollisesti|saattaa|voi olla|en löytänyt|ei löytynyt)\b/i.test(
    value,
  );
}

function hasStrongSourceLanguage(value: string) {
  return /\b(according to|reported by|confirmed by|official|documentation|source|sources|per|mukaan|lähteen mukaan|virallinen|dokumentaatio|vahvistaa|kertoo)\b/i.test(
    value,
  );
}

function hasContradictionLanguage(value: string) {
  return /\b(however|but|contradict|conflict|different sources|unclear|disagree|toisaalta|mutta|kuitenkin|ristiriita|eri lähteet|epäselv)\b/i.test(
    value,
  );
}

function hasNoResultLanguage(value: string) {
  return /\b(no reliable|not enough|could not find|did not find|no public|cannot verify|ei löydy|en löytänyt|ei tarpeeksi|ei varmaa|ei julkista)\b/i.test(
    value,
  );
}

function getSourceQuality(source: AurenSearchSource | undefined) {
  if (!source) return 0;

  return average([source.trustScore, source.relevanceScore, source.freshnessScore]);
}

function getSourceTypeBoost(sourceType: AurenSearchSourceType) {
  if (sourceType === 'official') return 0.18;
  if (sourceType === 'documentation') return 0.16;
  if (sourceType === 'academic') return 0.15;
  if (sourceType === 'news') return 0.1;
  if (sourceType === 'company') return 0.08;
  if (sourceType === 'database') return 0.08;
  if (sourceType === 'commerce') return 0.03;
  if (sourceType === 'profile') return 0.02;
  if (sourceType === 'blog') return -0.02;
  if (sourceType === 'forum') return -0.12;
  if (sourceType === 'social') return -0.18;

  return 0;
}

function inferFallbackSourceType(plan: AurenSearchPlan): AurenSearchSourceType {
  if (plan.sourcePolicy.allowedSourceTypes.includes('official')) return 'official';
  if (plan.sourcePolicy.allowedSourceTypes.includes('documentation')) return 'documentation';
  if (plan.sourcePolicy.allowedSourceTypes.includes('news')) return 'news';
  if (plan.sourcePolicy.allowedSourceTypes.includes('company')) return 'company';
  if (plan.sourcePolicy.allowedSourceTypes.includes('database')) return 'database';

  return 'unknown';
}

function pickBestSourceForClaim(params: {
  claim: string;
  sources: AurenSearchSource[];
  fallbackIndex: number;
}) {
  const { claim, sources, fallbackIndex } = params;

  if (sources.length === 0) return undefined;

  const normalizedClaim = normalizeForDedupe(claim);

  const scoredSources = sources.map((source, index) => {
    const sourceText = normalizeForDedupe(
      [source.title, source.domain, source.snippet, source.notes].filter(Boolean).join(' '),
    );

    const claimWords = normalizedClaim.split(' ').filter((word) => word.length > 3);
    const matchedWords = claimWords.filter((word) => sourceText.includes(word));
    const lexicalScore = claimWords.length > 0 ? matchedWords.length / claimWords.length : 0;
    const qualityScore = getSourceQuality(source);
    const primaryBoost = source.isPrimarySource ? 0.12 : 0;

    return {
      source,
      index,
      score: lexicalScore * 0.48 + qualityScore * 0.42 + primaryBoost,
    };
  });

  const best = [...scoredSources].sort((a, b) => b.score - a.score)[0];

  if (best && best.score >= 0.28) {
    return best.source;
  }

  return sources[fallbackIndex % sources.length];
}

function inferSupportLevel(params: {
  claim: string;
  source?: AurenSearchSource;
  rawResult: AurenSearchRawResult;
}): AurenSearchEvidence['supportLevel'] {
  const { claim, source, rawResult } = params;

  if (hasNoResultLanguage(claim)) return 'weak';
  if (hasContradictionLanguage(claim)) return 'partial';
  if (!rawResult.success) return 'unknown';
  if (!source) return containsUrl(claim) || hasStrongSourceLanguage(claim) ? 'partial' : 'unknown';

  const quality = getSourceQuality(source);

  if (source.isPrimarySource && quality >= 0.7) return 'strong';
  if (quality >= 0.72 && hasStrongSourceLanguage(claim)) return 'strong';
  if (quality >= 0.5) return 'partial';

  return 'weak';
}

function getEvidenceConfidence(params: {
  claim: string;
  source?: AurenSearchSource;
  supportLevel: AurenSearchEvidence['supportLevel'];
  rawResult: AurenSearchRawResult;
}) {
  const { claim, source, supportLevel, rawResult } = params;

  let score = 0.42;

  if (rawResult.success) score += 0.14;
  if (source) score += 0.12;
  if (source) score += getSourceQuality(source) * 0.22;
  if (source) score += getSourceTypeBoost(source.sourceType);
  if (containsUrl(claim)) score += 0.04;
  if (hasStrongSourceLanguage(claim)) score += 0.06;
  if (hasUncertaintyLanguage(claim)) score -= 0.12;
  if (hasNoResultLanguage(claim)) score -= 0.18;

  if (supportLevel === 'strong') score += 0.16;
  if (supportLevel === 'partial') score += 0.06;
  if (supportLevel === 'weak') score -= 0.08;
  if (supportLevel === 'unknown') score -= 0.14;
  if (supportLevel === 'contradicts') score -= 0.18;

  return clampScore(score);
}

function getEvidenceRelevance(params: {
  claim: string;
  source?: AurenSearchSource;
  plan: AurenSearchPlan;
}) {
  const { claim, source, plan } = params;

  let score = 0.48;

  if (source) score += source.relevanceScore * 0.32;
  if (hasStrongSourceLanguage(claim)) score += 0.06;

  const queryText = normalizeForDedupe(plan.queries.map((query) => query.query).join(' '));
  const claimText = normalizeForDedupe(claim);
  const queryWords = queryText.split(' ').filter((word) => word.length > 4);
  const matchedWords = queryWords.filter((word) => claimText.includes(word));

  if (queryWords.length > 0) {
    score += Math.min(0.18, matchedWords.length / queryWords.length);
  }

  return clampScore(score);
}

function createClaimCandidates(rawResult: AurenSearchRawResult): ClaimCandidate[] {
  const answer = cleanAnswerText(rawResult.answer || rawResult.rawText);

  if (!answer) return [];

  const sentences = splitIntoSentences(answer);
  const candidates: ClaimCandidate[] = [];

  for (const sentence of sentences.slice(0, MAX_SENTENCES_PER_RESULT)) {
    const parts = splitLongSentence(sentence);

    for (const part of parts) {
      if (!isProbablyUsefulClaim(part)) continue;

      const uncertaintyPenalty = hasUncertaintyLanguage(part) ? -0.12 : 0;
      const sourceBoost = hasStrongSourceLanguage(part) || containsUrl(part) ? 0.1 : 0;
      const noResultPenalty = hasNoResultLanguage(part) ? -0.18 : 0;

      candidates.push({
        claim: limitText(part, MAX_CLAIM_LENGTH),
        rawResultId: rawResult.id,
        queryIds: rawResult.queryIds,
        confidenceHint: clampScore(0.55 + uncertaintyPenalty + sourceBoost + noResultPenalty),
        supportHint: hasNoResultLanguage(part)
          ? 'weak'
          : hasStrongSourceLanguage(part) || containsUrl(part)
            ? 'partial'
            : 'unknown',
        notes: hasUncertaintyLanguage(part) ? 'Claim contains uncertainty language.' : undefined,
      });
    }
  }

  return candidates;
}

function dedupeClaimCandidates(candidates: ClaimCandidate[]) {
  const seen = new Set<string>();
  const deduped: ClaimCandidate[] = [];

  for (const candidate of candidates) {
    const key = normalizeForDedupe(candidate.claim).slice(0, 180);

    if (!key || seen.has(key)) continue;

    seen.add(key);
    deduped.push(candidate);
  }

  return deduped;
}

function rankClaimCandidates(candidates: ClaimCandidate[]) {
  return [...candidates].sort((a, b) => {
    const confidenceDiff = b.confidenceHint - a.confidenceHint;

    if (confidenceDiff !== 0) return confidenceDiff;

    return b.claim.length - a.claim.length;
  });
}

function createEvidenceItem(params: {
  candidate: ClaimCandidate;
  rawResult: AurenSearchRawResult;
  source?: AurenSearchSource;
  plan: AurenSearchPlan;
}): AurenSearchEvidence {
  const { candidate, rawResult, source, plan } = params;
  const supportLevel =
    candidate.supportHint !== 'unknown'
      ? candidate.supportHint
      : inferSupportLevel({
          claim: candidate.claim,
          source,
          rawResult,
        });

  const sourceType = source?.sourceType ?? inferFallbackSourceType(plan);

  return {
    id: createId('search_evidence'),
    claim: candidate.claim,
    sourceId: source?.id,
    sourceTitle: source?.title,
    sourceUrl: source?.url,
    sourceType,
    supportLevel,
    confidence: getEvidenceConfidence({
      claim: candidate.claim,
      source,
      supportLevel,
      rawResult,
    }),
    relevance: getEvidenceRelevance({
      claim: candidate.claim,
      source,
      plan,
    }),
    extractedAt: nowIso(),
    notes: [candidate.notes, rawResult.error ? `Raw result warning: ${rawResult.error}` : undefined]
      .filter(Boolean)
      .join(' '),
  };
}

function getRawResultById(rawResults: AurenSearchRawResult[], id: string) {
  return rawResults.find((result) => result.id === id);
}

function extractEvidence(params: {
  plan: AurenSearchPlan;
  rawResults: AurenSearchRawResult[];
  sources: AurenSearchSource[];
}) {
  const { plan, rawResults, sources } = params;
  const candidates = rankClaimCandidates(
    dedupeClaimCandidates(rawResults.flatMap((rawResult) => createClaimCandidates(rawResult))),
  ).slice(0, MAX_EVIDENCE_ITEMS);

  const evidence: AurenSearchEvidence[] = [];

  candidates.forEach((candidate, index) => {
    const rawResult = getRawResultById(rawResults, candidate.rawResultId);

    if (!rawResult) return;

    const source = pickBestSourceForClaim({
      claim: candidate.claim,
      sources,
      fallbackIndex: index,
    });

    evidence.push(
      createEvidenceItem({
        candidate,
        rawResult,
        source,
        plan,
      }),
    );
  });

  return evidence;
}

function hasOpposingPolarity(a: string, b: string) {
  const negativeSignals = [
    /\bnot\b/i,
    /\bno\b/i,
    /\bnever\b/i,
    /\bwithout\b/i,
    /\bei\b/i,
    /\beivät\b/i,
    /\beivat\b/i,
    /\bilman\b/i,
    /\ben löytänyt\b/i,
    /\bei löytynyt\b/i,
  ];

  const positiveSignals = [
    /\bis\b/i,
    /\bare\b/i,
    /\bhas\b/i,
    /\bavailable\b/i,
    /\bconfirmed\b/i,
    /\bon\b/i,
    /\bovat\b/i,
    /\bsaatavilla\b/i,
    /\bvahvistettu\b/i,
  ];

  const aNegative = negativeSignals.some((pattern) => pattern.test(a));
  const bNegative = negativeSignals.some((pattern) => pattern.test(b));
  const aPositive = positiveSignals.some((pattern) => pattern.test(a));
  const bPositive = positiveSignals.some((pattern) => pattern.test(b));

  return (aNegative && bPositive) || (bNegative && aPositive);
}

function lexicalOverlap(a: string, b: string) {
  const aWords = new Set(normalizeForDedupe(a).split(' ').filter((word) => word.length > 4));
  const bWords = new Set(normalizeForDedupe(b).split(' ').filter((word) => word.length > 4));

  if (aWords.size === 0 || bWords.size === 0) return 0;

  let shared = 0;

  aWords.forEach((word) => {
    if (bWords.has(word)) shared += 1;
  });

  return shared / Math.min(aWords.size, bWords.size);
}

function detectConflicts(evidence: AurenSearchEvidence[]): AurenSearchConflict[] {
  const conflicts: AurenSearchConflict[] = [];

  for (let i = 0; i < evidence.length; i += 1) {
    for (let j = i + 1; j < evidence.length; j += 1) {
      const first = evidence[i];
      const second = evidence[j];

      if (!first || !second) continue;

      const overlap = lexicalOverlap(first.claim, second.claim);

      if (overlap < 0.32) continue;

      const contradiction =
        first.supportLevel === 'contradicts' ||
        second.supportLevel === 'contradicts' ||
        hasOpposingPolarity(first.claim, second.claim);

      if (!contradiction) continue;

      conflicts.push({
        id: createId('search_conflict'),
        summary: 'Possible conflict detected between two search evidence claims.',
        claims: [first.claim, second.claim],
        sourceIds: [first.sourceId, second.sourceId].filter((id): id is string => Boolean(id)),
        severity: first.confidence > 0.7 && second.confidence > 0.7 ? 'major' : 'moderate',
      });
    }
  }

  return conflicts.slice(0, 8);
}

function buildWarnings(params: {
  plan: AurenSearchPlan;
  rawResults: AurenSearchRawResult[];
  sources: AurenSearchSource[];
  evidence: AurenSearchEvidence[];
  conflicts: AurenSearchConflict[];
}) {
  const warnings: string[] = [];

  if (params.rawResults.length === 0) {
    warnings.push('No raw search results were available for evidence extraction.');
  }

  if (params.rawResults.every((result) => !result.success)) {
    warnings.push('All raw search results failed or returned fallback output.');
  }

  if (params.sources.length === 0) {
    warnings.push('No explicit source metadata was available; evidence was inferred from answer text.');
  }

  if (params.evidence.length === 0) {
    warnings.push('No usable evidence claims could be extracted from search results.');
  }

  if (params.plan.sourcePolicy.requireMultipleSources && params.sources.length < params.plan.sourcePolicy.minSourceCount) {
    warnings.push('Source policy requested multiple sources, but fewer sources were available.');
  }

  if (params.conflicts.length > 0) {
    warnings.push('Possible conflicting evidence was detected.');
  }

  if (params.plan.safety.riskLevel === 'high') {
    warnings.push('Evidence belongs to a high-risk search plan and should be used cautiously.');
  }

  return Array.from(new Set(warnings));
}

export function extractAurenSearchEvidence(input: AurenEvidenceExtractorInput): AurenEvidenceExtractorResult {
  const evidence = extractEvidence({
    plan: input.plan,
    rawResults: input.rawResults,
    sources: input.sources,
  });

  const conflicts = detectConflicts(evidence);

  return {
    evidence,
    conflicts,
    warnings: buildWarnings({
      plan: input.plan,
      rawResults: input.rawResults,
      sources: input.sources,
      evidence,
      conflicts,
    }),
  };
}

export function extractEvidenceFromRawResults(params: {
  plan: AurenSearchPlan;
  rawResults: AurenSearchRawResult[];
  sources?: AurenSearchSource[];
}) {
  return extractAurenSearchEvidence({
    plan: params.plan,
    rawResults: params.rawResults,
    sources: params.sources ?? [],
  });
}

export function getStrongEvidence(evidence: AurenSearchEvidence[]) {
  return evidence.filter((item) => item.supportLevel === 'strong' && item.confidence >= 0.7);
}

export function getUsableEvidence(evidence: AurenSearchEvidence[]) {
  return evidence.filter(
    (item) =>
      item.supportLevel !== 'contradicts' &&
      item.supportLevel !== 'unknown' &&
      item.confidence >= 0.45 &&
      item.relevance >= 0.42,
  );
}

export function getEvidenceConfidenceAverage(evidence: AurenSearchEvidence[]) {
  return average(evidence.map((item) => item.confidence));
}

export function getEvidenceRelevanceAverage(evidence: AurenSearchEvidence[]) {
  return average(evidence.map((item) => item.relevance));
}

export function summarizeEvidenceExtraction(result: AurenEvidenceExtractorResult) {
  const strongCount = result.evidence.filter((item) => item.supportLevel === 'strong').length;
  const partialCount = result.evidence.filter((item) => item.supportLevel === 'partial').length;
  const weakCount = result.evidence.filter((item) => item.supportLevel === 'weak').length;
  const unknownCount = result.evidence.filter((item) => item.supportLevel === 'unknown').length;
  const contradictsCount = result.evidence.filter((item) => item.supportLevel === 'contradicts').length;

  return {
    evidenceCount: result.evidence.length,
    strongCount,
    partialCount,
    weakCount,
    unknownCount,
    contradictsCount,
    conflictCount: result.conflicts.length,
    averageConfidence: getEvidenceConfidenceAverage(result.evidence),
    averageRelevance: getEvidenceRelevanceAverage(result.evidence),
    warnings: result.warnings,
  };
}

export function serializeEvidenceDebug(result: AurenEvidenceExtractorResult) {
  return {
    summary: summarizeEvidenceExtraction(result),
    evidence: result.evidence.map((item) => ({
      id: item.id,
      claimPreview: limitText(item.claim, 180),
      sourceTitle: item.sourceTitle,
      sourceUrl: item.sourceUrl,
      sourceType: item.sourceType,
      supportLevel: item.supportLevel,
      confidence: item.confidence,
      relevance: item.relevance,
      notes: item.notes,
    })),
    conflicts: result.conflicts,
    warnings: result.warnings,
  };
}
