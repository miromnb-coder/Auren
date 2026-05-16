import type {
  AurenSearchEvidence,
  AurenSearchPlan,
  AurenSearchRawResult,
  AurenSearchSource,
  AurenSearchSourcePolicy,
  AurenSearchSourceType,
} from './types';

const MAX_SOURCE_COUNT = 12;
const MAX_SNIPPET_LENGTH = 420;
const MAX_TITLE_LENGTH = 180;
const MAX_NOTES_LENGTH = 360;

export type AurenSourceEvaluatorInput = {
  plan: AurenSearchPlan;
  sources?: AurenSearchSource[];
  rawResults?: AurenSearchRawResult[];
  evidence?: AurenSearchEvidence[];
  now?: string;
};

export type AurenRejectedSource = {
  source: AurenSearchSource;
  reason: string;
};

export type AurenSourceQualitySummary = {
  sourceCount: number;
  acceptedSourceCount: number;
  rejectedSourceCount: number;
  uniqueDomainCount: number;
  primarySourceCount: number;
  officialSourceCount: number;
  explicitSourceCount: number;
  syntheticSourceCount: number;
  averageTrustScore: number;
  averageRelevanceScore: number;
  averageFreshnessScore: number;
  overallQualityScore: number;
};

export type AurenSourceEvaluatorResult = {
  sources: AurenSearchSource[];
  acceptedSources: AurenSearchSource[];
  rejectedSources: AurenRejectedSource[];
  quality: AurenSourceQualitySummary;
  warnings: string[];
};

type SourceCandidate = Partial<AurenSearchSource> & {
  raw?: Record<string, unknown>;
  synthetic?: boolean;
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

function limitText(value: string | undefined, maxLength: number) {
  const cleaned = cleanText(value);

  if (!cleaned) return undefined;
  if (cleaned.length <= maxLength) return cleaned;

  return `${cleaned.slice(0, maxLength - 1).trim()}…`;
}

function clampScore(value: number) {
  if (!Number.isFinite(value)) return 0;

  return Math.min(Math.max(value, 0), 1);
}

function average(values: number[]) {
  if (values.length === 0) return 0;

  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function normalizeForMatch(value: string | undefined) {
  return cleanText(value)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/https?:\/\/\S+/g, ' ')
    .replace(/[^a-z0-9åäö\s.-]/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function getDomainFromUrl(url: string | undefined) {
  if (!url) return undefined;

  try {
    return new URL(url).hostname.replace(/^www\./, '').toLowerCase();
  } catch {
    return undefined;
  }
}

function getUrlProtocol(url: string | undefined) {
  if (!url) return undefined;

  try {
    return new URL(url).protocol.replace(':', '');
  } catch {
    return undefined;
  }
}

function isLikelyOfficialDomain(domain: string | undefined) {
  if (!domain) return false;

  return (
    domain.endsWith('.gov') ||
    domain.endsWith('.edu') ||
    domain.endsWith('.fi') && /\b(gov|vero|kela|traficom|valtioneuvosto|oph|thl|finlex)\b/i.test(domain) ||
    /\b(official|developer|docs|support|help|about|press)\b/i.test(domain)
  );
}

function isLikelyDocumentationDomain(domain: string | undefined) {
  if (!domain) return false;

  return (
    /\b(docs|developer|developers|api|reference|learn|guides|support|help)\b/i.test(domain) ||
    domain.includes('github.com') ||
    domain.includes('npmjs.com')
  );
}

function isLikelyNewsDomain(domain: string | undefined) {
  if (!domain) return false;

  return /\b(reuters|apnews|bbc|cnn|cnbc|bloomberg|guardian|nytimes|washingtonpost|techcrunch|theverge|wired|yle|hs|iltalehti|is.fi|kauppalehti|talouselama)\b/i.test(
    domain,
  );
}

function isLikelyAcademicDomain(domain: string | undefined) {
  if (!domain) return false;

  return (
    domain.endsWith('.edu') ||
    domain.includes('arxiv.org') ||
    domain.includes('scholar.google') ||
    domain.includes('pubmed.ncbi') ||
    domain.includes('nature.com') ||
    domain.includes('science.org') ||
    domain.includes('acm.org') ||
    domain.includes('ieee.org')
  );
}

function isLikelyCommerceDomain(domain: string | undefined) {
  if (!domain) return false;

  return /\b(amazon|ebay|bestbuy|walmart|target|verkkokauppa|gigantti|power|prisma|tokmanni|shop|store|marketplace|aliexpress)\b/i.test(
    domain,
  );
}

function isLikelySocialDomain(domain: string | undefined) {
  if (!domain) return false;

  return /\b(x\.com|twitter|facebook|instagram|tiktok|snapchat|threads|youtube|linkedin)\b/i.test(domain);
}

function isLikelyForumDomain(domain: string | undefined) {
  if (!domain) return false;

  return /\b(reddit|stackoverflow|stackexchange|quora|forum|discord)\b/i.test(domain);
}

function normalizeSourceType(value: unknown, candidate?: SourceCandidate): AurenSearchSourceType {
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

  const domain = candidate?.domain ?? getDomainFromUrl(candidate?.url);
  const text = normalizeForMatch([candidate?.title, candidate?.snippet, candidate?.notes].filter(Boolean).join(' '));

  if (isLikelyAcademicDomain(domain)) return 'academic';
  if (isLikelyDocumentationDomain(domain) || /\b(api|sdk|docs|documentation|release notes|changelog)\b/i.test(text)) {
    return 'documentation';
  }
  if (isLikelyOfficialDomain(domain)) return 'official';
  if (isLikelyNewsDomain(domain)) return 'news';
  if (isLikelyCommerceDomain(domain)) return 'commerce';
  if (isLikelyForumDomain(domain)) return 'forum';
  if (isLikelySocialDomain(domain)) return domain?.includes('linkedin') ? 'profile' : 'social';
  if (/\b(company|pricing|product|about us|press release)\b/i.test(text)) return 'company';
  if (/\b(blog|opinion|review)\b/i.test(text)) return 'blog';

  return 'unknown';
}

function getBaseTrustForSourceType(sourceType: AurenSearchSourceType) {
  if (sourceType === 'official') return 0.88;
  if (sourceType === 'documentation') return 0.84;
  if (sourceType === 'academic') return 0.82;
  if (sourceType === 'database') return 0.76;
  if (sourceType === 'news') return 0.74;
  if (sourceType === 'company') return 0.66;
  if (sourceType === 'profile') return 0.54;
  if (sourceType === 'commerce') return 0.5;
  if (sourceType === 'blog') return 0.44;
  if (sourceType === 'forum') return 0.32;
  if (sourceType === 'social') return 0.24;

  return 0.4;
}

function calculateTrustScore(params: {
  source: SourceCandidate;
  sourceType: AurenSearchSourceType;
  policy: AurenSearchSourcePolicy;
}) {
  const { source, sourceType, policy } = params;
  const domain = source.domain ?? getDomainFromUrl(source.url);
  const protocol = getUrlProtocol(source.url);

  let score = getBaseTrustForSourceType(sourceType);

  if (source.isPrimarySource) score += 0.12;
  if (protocol === 'https') score += 0.03;
  if (!source.url && !source.domain) score -= 0.12;
  if (isLikelyOfficialDomain(domain)) score += 0.08;
  if (policy.preferOfficialSources && sourceType === 'official') score += 0.08;
  if (policy.preferOfficialSources && sourceType === 'documentation') score += 0.05;
  if (policy.blockedSourceTypes.includes(sourceType)) score -= 0.45;
  if (domain && policy.blockedDomains.some((blocked) => domain.includes(blocked))) score -= 0.55;
  if (domain && policy.preferredDomains.some((preferred) => domain.includes(preferred))) score += 0.12;
  if (source.synthetic) score -= 0.14;

  return clampScore(score);
}

function getQueryText(plan: AurenSearchPlan) {
  return normalizeForMatch(plan.queries.map((query) => query.query).join(' '));
}

function getEvidenceText(evidence: AurenSearchEvidence[] | undefined) {
  return normalizeForMatch((evidence ?? []).map((item) => item.claim).join(' '));
}

function lexicalOverlap(a: string, b: string) {
  const aWords = new Set(normalizeForMatch(a).split(' ').filter((word) => word.length > 4));
  const bWords = new Set(normalizeForMatch(b).split(' ').filter((word) => word.length > 4));

  if (aWords.size === 0 || bWords.size === 0) return 0;

  let shared = 0;

  aWords.forEach((word) => {
    if (bWords.has(word)) shared += 1;
  });

  return shared / Math.min(aWords.size, bWords.size);
}

function calculateRelevanceScore(params: {
  source: SourceCandidate;
  plan: AurenSearchPlan;
  evidence?: AurenSearchEvidence[];
}) {
  const sourceText = normalizeForMatch(
    [params.source.title, params.source.domain, params.source.snippet, params.source.notes].filter(Boolean).join(' '),
  );
  const queryText = getQueryText(params.plan);
  const evidenceText = getEvidenceText(params.evidence);

  let score = 0.42;

  score += lexicalOverlap(sourceText, queryText) * 0.42;
  score += lexicalOverlap(sourceText, evidenceText) * 0.22;

  if (params.source.isPrimarySource) score += 0.08;
  if (params.plan.sourcePolicy.preferredDomains.some((domain) => params.source.domain?.includes(domain))) score += 0.12;
  if (params.source.synthetic) score -= 0.08;

  return clampScore(score);
}

function getDateAgeDays(value: string | undefined, now: string) {
  if (!value) return undefined;

  const dateMs = new Date(value).getTime();
  const nowMs = new Date(now).getTime();

  if (!Number.isFinite(dateMs) || !Number.isFinite(nowMs)) return undefined;

  return Math.max(0, (nowMs - dateMs) / 86_400_000);
}

function calculateFreshnessScore(params: {
  source: SourceCandidate;
  plan: AurenSearchPlan;
  now: string;
}) {
  const ageDays = getDateAgeDays(params.source.publishedAt, params.now);

  if (params.plan.depth === 'none') return 0;

  if (!params.plan.sourcePolicy.preferRecentSources) {
    return ageDays === undefined ? 0.58 : clampScore(0.78 - Math.min(ageDays / 3650, 0.42));
  }

  if (ageDays === undefined) {
    return params.source.synthetic ? 0.5 : 0.46;
  }

  if (ageDays <= 1) return 0.98;
  if (ageDays <= 7) return 0.9;
  if (ageDays <= 30) return 0.78;
  if (ageDays <= 90) return 0.64;
  if (ageDays <= 365) return 0.48;

  return 0.28;
}

function normalizeScore(value: unknown, fallback: number) {
  return typeof value === 'number' && Number.isFinite(value) ? clampScore(value) : fallback;
}

function normalizeSource(params: {
  candidate: SourceCandidate;
  plan: AurenSearchPlan;
  evidence?: AurenSearchEvidence[];
  now: string;
}): AurenSearchSource {
  const candidate = params.candidate;
  const url = limitText(candidate.url, 1000);
  const domain = cleanText(candidate.domain) || getDomainFromUrl(url);
  const sourceType = normalizeSourceType(candidate.sourceType, {
    ...candidate,
    url,
    domain,
  });

  const trustScore = calculateTrustScore({
    source: {
      ...candidate,
      url,
      domain,
    },
    sourceType,
    policy: params.plan.sourcePolicy,
  });

  const relevanceScore = calculateRelevanceScore({
    source: {
      ...candidate,
      url,
      domain,
    },
    plan: params.plan,
    evidence: params.evidence,
  });

  const freshnessScore = calculateFreshnessScore({
    source: {
      ...candidate,
      url,
      domain,
    },
    plan: params.plan,
    now: params.now,
  });

  return {
    id: cleanText(candidate.id) || createId('search_source'),
    title: limitText(candidate.title, MAX_TITLE_LENGTH),
    url,
    domain,
    sourceType,
    snippet: limitText(candidate.snippet, MAX_SNIPPET_LENGTH),
    author: limitText(candidate.author, 140),
    publishedAt: cleanText(candidate.publishedAt) || undefined,
    accessedAt: cleanText(candidate.accessedAt) || params.now,
    isPrimarySource: candidate.isPrimarySource === true || sourceType === 'official' || sourceType === 'documentation',
    trustScore: normalizeScore(candidate.trustScore, trustScore),
    relevanceScore: normalizeScore(candidate.relevanceScore, relevanceScore),
    freshnessScore: normalizeScore(candidate.freshnessScore, freshnessScore),
    notes: limitText(candidate.notes, MAX_NOTES_LENGTH),
  };
}

function extractSourcesFromRawResultUsage(rawResults: AurenSearchRawResult[]) {
  const candidates: SourceCandidate[] = [];

  for (const rawResult of rawResults) {
    const usage = rawResult.usage;

    if (!usage || typeof usage !== 'object' || Array.isArray(usage)) continue;

    const maybeSources = (usage as Record<string, unknown>).sources;

    if (!Array.isArray(maybeSources)) continue;

    for (const source of maybeSources) {
      if (!source || typeof source !== 'object' || Array.isArray(source)) continue;

      const sourceObject = source as Record<string, unknown>;

      candidates.push({
        id: typeof sourceObject.id === 'string' ? sourceObject.id : undefined,
        title: typeof sourceObject.title === 'string' ? sourceObject.title : undefined,
        url: typeof sourceObject.url === 'string' ? sourceObject.url : undefined,
        domain: typeof sourceObject.domain === 'string' ? sourceObject.domain : undefined,
        sourceType: normalizeSourceType(sourceObject.sourceType),
        snippet: typeof sourceObject.snippet === 'string' ? sourceObject.snippet : undefined,
        author: typeof sourceObject.author === 'string' ? sourceObject.author : undefined,
        publishedAt: typeof sourceObject.publishedAt === 'string' ? sourceObject.publishedAt : undefined,
        accessedAt: typeof sourceObject.accessedAt === 'string' ? sourceObject.accessedAt : rawResult.completedAt,
        isPrimarySource: sourceObject.isPrimarySource === true,
        trustScore: typeof sourceObject.trustScore === 'number' ? sourceObject.trustScore : undefined,
        relevanceScore: typeof sourceObject.relevanceScore === 'number' ? sourceObject.relevanceScore : undefined,
        freshnessScore: typeof sourceObject.freshnessScore === 'number' ? sourceObject.freshnessScore : undefined,
        notes: typeof sourceObject.notes === 'string' ? sourceObject.notes : `Extracted from raw result ${rawResult.id}.`,
        raw: sourceObject,
      });
    }
  }

  return candidates;
}

function inferSourceTypeFromPolicy(policy: AurenSearchSourcePolicy): AurenSearchSourceType {
  if (policy.allowedSourceTypes.includes('official')) return 'official';
  if (policy.allowedSourceTypes.includes('documentation')) return 'documentation';
  if (policy.allowedSourceTypes.includes('news')) return 'news';
  if (policy.allowedSourceTypes.includes('academic')) return 'academic';
  if (policy.allowedSourceTypes.includes('company')) return 'company';
  if (policy.allowedSourceTypes.includes('database')) return 'database';

  return 'unknown';
}

function createSyntheticSources(params: {
  plan: AurenSearchPlan;
  rawResults: AurenSearchRawResult[];
}) {
  return params.rawResults
    .filter((result) => result.success && cleanText(result.answer || result.rawText))
    .map<SourceCandidate>((result) => ({
      id: createId('search_source_synthetic'),
      title: 'Browser search result',
      sourceType: inferSourceTypeFromPolicy(params.plan.sourcePolicy),
      snippet: limitText(result.answer || result.rawText, MAX_SNIPPET_LENGTH),
      accessedAt: result.completedAt ?? nowIso(),
      isPrimarySource: false,
      trustScore: params.plan.sourcePolicy.preferOfficialSources ? 0.56 : 0.5,
      relevanceScore: 0.68,
      freshnessScore: params.plan.sourcePolicy.preferRecentSources ? 0.58 : 0.5,
      notes: 'Synthetic source placeholder created because explicit source metadata was not returned.',
      synthetic: true,
    }));
}

function getSourceCandidates(input: AurenSourceEvaluatorInput): SourceCandidate[] {
  const explicitSources = input.sources ?? [];
  const usageSources = extractSourcesFromRawResultUsage(input.rawResults ?? []);
  const syntheticSources =
    explicitSources.length === 0 && usageSources.length === 0
      ? createSyntheticSources({
          plan: input.plan,
          rawResults: input.rawResults ?? [],
        })
      : [];

  return [
    ...explicitSources.map((source) => ({
      ...source,
      synthetic: false,
    })),
    ...usageSources,
    ...syntheticSources,
  ];
}

function getDedupeKey(source: AurenSearchSource) {
  if (source.url) return `url:${source.url.toLowerCase()}`;
  if (source.domain && source.title) return `domain_title:${source.domain.toLowerCase()}:${source.title.toLowerCase()}`;
  if (source.domain) return `domain:${source.domain.toLowerCase()}`;
  if (source.title) return `title:${source.title.toLowerCase()}`;

  return `id:${source.id}`;
}

function dedupeSources(sources: AurenSearchSource[]) {
  const map = new Map<string, AurenSearchSource>();

  for (const source of sources) {
    const key = getDedupeKey(source);
    const existing = map.get(key);

    if (!existing) {
      map.set(key, source);
      continue;
    }

    const existingScore = average([existing.trustScore, existing.relevanceScore, existing.freshnessScore]);
    const nextScore = average([source.trustScore, source.relevanceScore, source.freshnessScore]);

    if (nextScore > existingScore) {
      map.set(key, {
        ...source,
        notes: [existing.notes, source.notes].filter(Boolean).join(' '),
      });
    }
  }

  return Array.from(map.values());
}

function isDomainBlocked(domain: string | undefined, policy: AurenSearchSourcePolicy) {
  if (!domain) return false;

  return policy.blockedDomains.some((blockedDomain) => domain.includes(blockedDomain));
}

function getRejectionReason(source: AurenSearchSource, policy: AurenSearchSourcePolicy) {
  if (policy.blockedSourceTypes.includes(source.sourceType)) {
    return `Blocked source type: ${source.sourceType}.`;
  }

  if (isDomainBlocked(source.domain, policy)) {
    return `Blocked domain: ${source.domain}.`;
  }

  if (source.trustScore < 0.12) {
    return 'Trust score is too low.';
  }

  return undefined;
}

function splitAcceptedAndRejected(sources: AurenSearchSource[], policy: AurenSearchSourcePolicy) {
  const acceptedSources: AurenSearchSource[] = [];
  const rejectedSources: AurenRejectedSource[] = [];

  for (const source of sources) {
    const reason = getRejectionReason(source, policy);

    if (reason) {
      rejectedSources.push({ source, reason });
      continue;
    }

    acceptedSources.push(source);
  }

  return {
    acceptedSources,
    rejectedSources,
  };
}

function sortSources(sources: AurenSearchSource[]) {
  return [...sources].sort((a, b) => {
    const aScore = average([a.trustScore, a.relevanceScore, a.freshnessScore]);
    const bScore = average([b.trustScore, b.relevanceScore, b.freshnessScore]);

    if (bScore !== aScore) return bScore - aScore;
    if (a.isPrimarySource !== b.isPrimarySource) return a.isPrimarySource ? -1 : 1;

    return a.sourceType.localeCompare(b.sourceType);
  });
}

function limitSourceCount(sources: AurenSearchSource[], policy: AurenSearchSourcePolicy) {
  const limit = Math.max(1, Math.min(policy.maxSourceCount || MAX_SOURCE_COUNT, MAX_SOURCE_COUNT));

  return sources.slice(0, limit);
}

function createQualitySummary(params: {
  sources: AurenSearchSource[];
  acceptedSources: AurenSearchSource[];
  rejectedSources: AurenRejectedSource[];
}) {
  const uniqueDomains = new Set(params.acceptedSources.map((source) => source.domain).filter(Boolean));
  const trustScores = params.acceptedSources.map((source) => source.trustScore);
  const relevanceScores = params.acceptedSources.map((source) => source.relevanceScore);
  const freshnessScores = params.acceptedSources.map((source) => source.freshnessScore);
  const averageTrustScore = average(trustScores);
  const averageRelevanceScore = average(relevanceScores);
  const averageFreshnessScore = average(freshnessScores);

  const explicitSourceCount = params.acceptedSources.filter(
    (source) => !source.notes?.toLowerCase().includes('synthetic source placeholder'),
  ).length;

  const syntheticSourceCount = params.acceptedSources.length - explicitSourceCount;

  return {
    sourceCount: params.sources.length,
    acceptedSourceCount: params.acceptedSources.length,
    rejectedSourceCount: params.rejectedSources.length,
    uniqueDomainCount: uniqueDomains.size,
    primarySourceCount: params.acceptedSources.filter((source) => source.isPrimarySource).length,
    officialSourceCount: params.acceptedSources.filter(
      (source) => source.sourceType === 'official' || source.sourceType === 'documentation',
    ).length,
    explicitSourceCount,
    syntheticSourceCount,
    averageTrustScore,
    averageRelevanceScore,
    averageFreshnessScore,
    overallQualityScore: clampScore(average([averageTrustScore, averageRelevanceScore, averageFreshnessScore])),
  };
}

function buildWarnings(params: {
  plan: AurenSearchPlan;
  sources: AurenSearchSource[];
  acceptedSources: AurenSearchSource[];
  rejectedSources: AurenRejectedSource[];
  quality: AurenSourceQualitySummary;
}) {
  const warnings: string[] = [];

  if (params.sources.length === 0) {
    warnings.push('No sources were available for evaluation.');
  }

  if (params.acceptedSources.length === 0 && params.sources.length > 0) {
    warnings.push('All sources were rejected by source policy.');
  }

  if (params.quality.syntheticSourceCount > 0) {
    warnings.push('Some sources are synthetic placeholders because explicit source metadata was not returned.');
  }

  if (
    params.plan.sourcePolicy.requireMultipleSources &&
    params.acceptedSources.length < params.plan.sourcePolicy.minSourceCount
  ) {
    warnings.push('Source policy requested multiple sources, but too few accepted sources were available.');
  }

  if (params.quality.overallQualityScore < 0.45 && params.acceptedSources.length > 0) {
    warnings.push('Accepted source quality is low.');
  }

  if (params.rejectedSources.length > 0) {
    warnings.push('Some sources were rejected by source policy.');
  }

  if (params.plan.safety.riskLevel === 'high' && params.quality.overallQualityScore < 0.7) {
    warnings.push('High-risk search has less than strong source quality.');
  }

  return Array.from(new Set(warnings));
}

export function evaluateAurenSearchSources(input: AurenSourceEvaluatorInput): AurenSourceEvaluatorResult {
  const now = input.now ?? nowIso();
  const candidates = getSourceCandidates(input);

  const normalizedSources = candidates.map((candidate) =>
    normalizeSource({
      candidate,
      plan: input.plan,
      evidence: input.evidence,
      now,
    }),
  );

  const dedupedSources = dedupeSources(normalizedSources);
  const { acceptedSources, rejectedSources } = splitAcceptedAndRejected(dedupedSources, input.plan.sourcePolicy);
  const sortedAcceptedSources = sortSources(acceptedSources);
  const limitedAcceptedSources = limitSourceCount(sortedAcceptedSources, input.plan.sourcePolicy);
  const quality = createQualitySummary({
    sources: dedupedSources,
    acceptedSources: limitedAcceptedSources,
    rejectedSources,
  });

  return {
    sources: limitedAcceptedSources,
    acceptedSources: limitedAcceptedSources,
    rejectedSources,
    quality,
    warnings: buildWarnings({
      plan: input.plan,
      sources: dedupedSources,
      acceptedSources: limitedAcceptedSources,
      rejectedSources,
      quality,
    }),
  };
}

export function evaluateSourcesFromRawResults(params: {
  plan: AurenSearchPlan;
  rawResults: AurenSearchRawResult[];
  evidence?: AurenSearchEvidence[];
}) {
  return evaluateAurenSearchSources({
    plan: params.plan,
    rawResults: params.rawResults,
    evidence: params.evidence,
  });
}

export function getBestAurenSearchSources(sources: AurenSearchSource[], limit = 5) {
  return sortSources(sources).slice(0, Math.max(0, limit));
}

export function getSourceQualityScore(source: AurenSearchSource) {
  return clampScore(average([source.trustScore, source.relevanceScore, source.freshnessScore]));
}

export function getSourceQualityAverage(sources: AurenSearchSource[]) {
  return average(sources.map(getSourceQualityScore));
}

export function hasEnoughSourcesForPolicy(sources: AurenSearchSource[], policy: AurenSearchSourcePolicy) {
  if (!policy.requireMultipleSources) {
    return sources.length >= Math.max(1, policy.minSourceCount);
  }

  return sources.length >= Math.max(2, policy.minSourceCount);
}

export function summarizeSourceEvaluation(result: AurenSourceEvaluatorResult) {
  return {
    sourceCount: result.quality.sourceCount,
    acceptedSourceCount: result.quality.acceptedSourceCount,
    rejectedSourceCount: result.quality.rejectedSourceCount,
    uniqueDomainCount: result.quality.uniqueDomainCount,
    primarySourceCount: result.quality.primarySourceCount,
    officialSourceCount: result.quality.officialSourceCount,
    explicitSourceCount: result.quality.explicitSourceCount,
    syntheticSourceCount: result.quality.syntheticSourceCount,
    overallQualityScore: result.quality.overallQualityScore,
    warnings: result.warnings,
  };
}

export function serializeSourceEvaluationDebug(result: AurenSourceEvaluatorResult) {
  return {
    summary: summarizeSourceEvaluation(result),
    sources: result.sources.map((source) => ({
      id: source.id,
      title: source.title,
      url: source.url,
      domain: source.domain,
      sourceType: source.sourceType,
      isPrimarySource: source.isPrimarySource,
      trustScore: source.trustScore,
      relevanceScore: source.relevanceScore,
      freshnessScore: source.freshnessScore,
      qualityScore: getSourceQualityScore(source),
      notes: source.notes,
    })),
    rejectedSources: result.rejectedSources.map((item) => ({
      id: item.source.id,
      title: item.source.title,
      domain: item.source.domain,
      sourceType: item.source.sourceType,
      reason: item.reason,
    })),
    warnings: result.warnings,
  };
}
