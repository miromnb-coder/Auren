import type { AurenIntent, AurenIntentResult, AurenToolName } from '../core/types';

type IntentCandidate = {
  intent: AurenIntent;
  score: number;
  reasons: string[];
};

type IntentSignalGroup = {
  intent: AurenIntent;
  weight: number;
  reason: string;
  signals: string[];
  patterns?: RegExp[];
};

type ToolSignalGroup = {
  tool: AurenToolName;
  signals: string[];
  patterns?: RegExp[];
};

const normalizeForRouting = (value: string) => {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[’`´]/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
};

const INTENT_PRIORITY: AurenIntent[] = [
  'recall_memory',
  'save_memory',
  'study_help',
  'daily_planning',
  'focus_help',
  'create_plan',
  'tool_request',
  'general_chat',
  'unknown',
];

const INTENT_SIGNAL_GROUPS: IntentSignalGroup[] = [
  {
    intent: 'recall_memory',
    weight: 4.2,
    reason: 'The user is asking what Auren remembers.',
    signals: [
      'what do you remember',
      'what have you saved',
      'show memory',
      'recall memory',
      'stored about me',
      'mita muistat',
      'mitä muistat',
      'nayta muisti',
      'näytä muisti',
      'muistissa minusta',
      'mitä tiedät minusta',
      'mita tiedat minusta',
    ],
  },
  {
    intent: 'save_memory',
    weight: 4,
    reason: 'The user wants Auren to remember or save useful context.',
    signals: [
      'remember that',
      'remember this',
      'save this',
      'save that',
      'keep in mind',
      'tallenna tama',
      'tallenna tämä',
      'muista etta',
      'muista että',
      'laita muistiin',
      'pidä mielessä',
      'pida mielessa',
    ],
  },
  {
    intent: 'study_help',
    weight: 3.6,
    reason: 'The request looks related to learning, studying, explaining, or practice.',
    signals: [
      'study',
      'learn',
      'learning',
      'exam',
      'test',
      'quiz',
      'homework',
      'assignment',
      'explain',
      'summarize',
      'practice',
      'flashcards',
      'opisk',
      'oppia',
      'koe',
      'kokeeseen',
      'läksy',
      'laks',
      'tehtava',
      'tehtävä',
      'selita',
      'selitä',
      'tiivista',
      'tiivistä',
      'harjoit',
    ],
  },
  {
    intent: 'daily_planning',
    weight: 3.3,
    reason: 'The request looks like daily planning or deciding what matters now.',
    signals: [
      'today',
      'tomorrow',
      'this morning',
      'tonight',
      'my day',
      'plan my day',
      'daily plan',
      'schedule my day',
      'what should i do now',
      'what should i do next',
      'tanaan',
      'tänään',
      'huomenna',
      'paiva',
      'päivä',
      'aamu',
      'ilta',
      'mitä teen nyt',
      'mita teen nyt',
      'mitä seuraavaksi',
      'mita seuraavaksi',
      'suunnittele päivä',
      'suunnittele paiva',
    ],
  },
  {
    intent: 'focus_help',
    weight: 3.2,
    reason: 'The user wants help focusing, starting, or reducing distraction.',
    signals: [
      'focus',
      'concentrate',
      'pomodoro',
      'deep work',
      'distraction',
      'procrastinating',
      'start working',
      'keskity',
      'keskittya',
      'keskittyä',
      'häiriö',
      'hairio',
      'aloittaa',
      'en saa aloitettua',
      'motivation',
      'motivaatio',
    ],
  },
  {
    intent: 'create_plan',
    weight: 3,
    reason: 'The user is asking for a plan, structure, steps, or roadmap.',
    signals: [
      'make a plan',
      'create a plan',
      'plan this',
      'roadmap',
      'step by step',
      'steps',
      'structure',
      'strategy',
      'suunnitelma',
      'suunnittele',
      'tee suunnitelma',
      'vaiheet',
      'askel',
      'rakenne',
      'strategia',
    ],
  },
];

const TOOL_SIGNAL_GROUPS: ToolSignalGroup[] = [
  {
    tool: 'calendar',
    signals: [
      'calendar',
      'schedule',
      'event',
      'meeting',
      'appointment',
      'kalenteri',
      'aikataulu',
      'tapaaminen',
      'palaveri',
    ],
    patterns: [
      /\b\d{1,2}[:.]\d{2}\b/,
      /\b\d{1,2}[./-]\d{1,2}([./-]\d{2,4})?\b/,
    ],
  },
  {
    tool: 'gmail',
    signals: [
      'gmail',
      'email',
      'e-mail',
      'inbox',
      'mail',
      'message',
      'sahkoposti',
      'sähköposti',
      'saapuneet',
      'viesti',
    ],
  },
  {
    tool: 'tasks',
    signals: [
      'task',
      'todo',
      'to-do',
      'reminder',
      'remind me',
      'deadline',
      'tehtava',
      'tehtävä',
      'muistutus',
      'muistuta',
      'deadline',
    ],
  },
  {
    tool: 'notes',
    signals: [
      'note',
      'notes',
      'notebook',
      'write down',
      'muistiinpano',
      'muistiinpanot',
      'kirjoita ylos',
      'kirjoita ylös',
    ],
  },
  {
    tool: 'finance',
    signals: [
      'money',
      'finance',
      'budget',
      'subscription',
      'spending',
      'expense',
      'invoice',
      'payment',
      'raha',
      'budjetti',
      'tilaus',
      'kulutus',
      'meno',
      'lasku',
      'maksu',
      'saasto',
      'säästö',
    ],
  },
];

const createCandidates = (): Record<AurenIntent, IntentCandidate> => {
  return {
    general_chat: {
      intent: 'general_chat',
      score: 0,
      reasons: [],
    },
    study_help: {
      intent: 'study_help',
      score: 0,
      reasons: [],
    },
    daily_planning: {
      intent: 'daily_planning',
      score: 0,
      reasons: [],
    },
    save_memory: {
      intent: 'save_memory',
      score: 0,
      reasons: [],
    },
    recall_memory: {
      intent: 'recall_memory',
      score: 0,
      reasons: [],
    },
    create_plan: {
      intent: 'create_plan',
      score: 0,
      reasons: [],
    },
    focus_help: {
      intent: 'focus_help',
      score: 0,
      reasons: [],
    },
    tool_request: {
      intent: 'tool_request',
      score: 0,
      reasons: [],
    },
    unknown: {
      intent: 'unknown',
      score: 0,
      reasons: [],
    },
  };
};

const getMatchedSignals = (
  normalizedMessage: string,
  signals: string[],
  patterns: RegExp[] = [],
) => {
  const matchedSignals = signals.filter((signal) => {
    const normalizedSignal = normalizeForRouting(signal);
    return normalizedSignal.length > 0 && normalizedMessage.includes(normalizedSignal);
  });

  const matchedPatterns = patterns
    .filter((pattern) => pattern.test(normalizedMessage))
    .map((pattern) => pattern.source);

  return [...matchedSignals, ...matchedPatterns];
};

const addScore = (
  candidates: Record<AurenIntent, IntentCandidate>,
  intent: AurenIntent,
  score: number,
  reason: string,
) => {
  candidates[intent].score += score;

  if (!candidates[intent].reasons.includes(reason)) {
    candidates[intent].reasons.push(reason);
  }
};

const getToolHints = (normalizedMessage: string): AurenToolName[] => {
  const toolHints = new Set<AurenToolName>();

  for (const group of TOOL_SIGNAL_GROUPS) {
    const matches = getMatchedSignals(normalizedMessage, group.signals, group.patterns);

    if (matches.length > 0) {
      toolHints.add(group.tool);
    }
  }

  return Array.from(toolHints);
};

const scoreIntentSignals = (
  normalizedMessage: string,
  candidates: Record<AurenIntent, IntentCandidate>,
) => {
  for (const group of INTENT_SIGNAL_GROUPS) {
    const matches = getMatchedSignals(normalizedMessage, group.signals, group.patterns);

    if (matches.length === 0) continue;

    const matchBonus = Math.min(matches.length - 1, 3) * 0.35;

    addScore(candidates, group.intent, group.weight + matchBonus, group.reason);
  }
};

const scoreToolSignals = (
  toolHints: AurenToolName[],
  candidates: Record<AurenIntent, IntentCandidate>,
) => {
  if (toolHints.length === 0) return;

  const toolBonus = Math.min(toolHints.length, 3) * 0.45;

  addScore(
    candidates,
    'tool_request',
    2.6 + toolBonus,
    'The user mentioned a tool, integration, data source, or external action.',
  );
};

const getPriorityIndex = (intent: AurenIntent) => {
  const index = INTENT_PRIORITY.indexOf(intent);
  return index === -1 ? INTENT_PRIORITY.length : index;
};

const pickBestCandidate = (candidates: Record<AurenIntent, IntentCandidate>) => {
  return Object.values(candidates).sort((left, right) => {
    if (right.score !== left.score) {
      return right.score - left.score;
    }

    return getPriorityIndex(left.intent) - getPriorityIndex(right.intent);
  })[0];
};

const getRunnerUpScore = (
  candidates: Record<AurenIntent, IntentCandidate>,
  bestIntent: AurenIntent,
) => {
  const runnerUp = Object.values(candidates)
    .filter((candidate) => candidate.intent !== bestIntent)
    .sort((left, right) => right.score - left.score)[0];

  return runnerUp?.score ?? 0;
};

const getConfidence = (score: number, runnerUpScore: number) => {
  if (score <= 0) {
    return 0.5;
  }

  const separation = Math.max(0, score - runnerUpScore);
  const confidence = 0.42 + score * 0.08 + separation * 0.04;

  return Math.max(0.25, Math.min(confidence, 0.92));
};

const shouldUseMemory = (intent: AurenIntent) => {
  return (
    intent === 'general_chat' ||
    intent === 'study_help' ||
    intent === 'daily_planning' ||
    intent === 'create_plan' ||
    intent === 'focus_help' ||
    intent === 'save_memory' ||
    intent === 'recall_memory'
  );
};

const createReason = (
  candidate: IntentCandidate,
  toolHints: AurenToolName[],
  usedFallback: boolean,
) => {
  if (usedFallback) {
    return 'No strong intent signal was found, so Auren used the safe general chat route.';
  }

  const reasons = candidate.reasons.slice(0, 3).join(' ');
  const toolText =
    toolHints.length > 0 ? ` Tool hints detected: ${toolHints.join(', ')}.` : '';

  return `${reasons || 'Auren detected the most likely route from lightweight intent signals.'}${toolText}`;
};

export function routeIntent(message: string): AurenIntentResult {
  const normalizedMessage = normalizeForRouting(message);

  if (!normalizedMessage) {
    return {
      intent: 'unknown',
      confidence: 0.2,
      reason: 'The message is empty, so Auren cannot infer intent yet.',
      needsMemory: false,
      needsTools: false,
      toolHints: [],
    };
  }

  const candidates = createCandidates();
  const toolHints = getToolHints(normalizedMessage);

  scoreIntentSignals(normalizedMessage, candidates);
  scoreToolSignals(toolHints, candidates);

  const bestCandidate = pickBestCandidate(candidates);
  const runnerUpScore = getRunnerUpScore(candidates, bestCandidate.intent);
  const usedFallback = bestCandidate.score < 2.2;
  const intent = usedFallback ? 'general_chat' : bestCandidate.intent;
  const confidence = usedFallback ? 0.52 : getConfidence(bestCandidate.score, runnerUpScore);

  return {
    intent,
    confidence,
    reason: createReason(bestCandidate, toolHints, usedFallback),
    needsMemory: shouldUseMemory(intent),
    needsTools: toolHints.length > 0 || intent === 'tool_request',
    toolHints,
  };
}
