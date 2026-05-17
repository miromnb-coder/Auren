import { supabase } from '../../supabase';
import {
  getSearchAnswerFromPipelineResult,
  getSearchMetadataFromReport,
  runSearchPipeline,
} from '../search/runSearchPipeline';
import type {
  AurenContext,
  AurenPlan,
  AurenResponseDraft,
  AurenResponseMetadata,
  AurenSuggestion,
  AurenToolResult,
} from '../core/types';

const AUREN_RESPONSE_FUNCTION = 'auren-generate-response';
const MODEL_TIMEOUT_MS = 18000;
const MAX_PLAN_STEPS = 6;
const MAX_MEMORY_ITEMS = 8;
const MAX_TOOL_RESULTS = 8;
const MAX_CONVERSATION_MESSAGES = 10;
const MAX_SUGGESTIONS = 4;

const INTERNAL_ANSWER_PATTERNS = [
  /^understand request\s*:/i,
  /^identify tool need\s*:/i,
  /^plan response\s*:/i,
  /^execute tool\s*:/i,
  /^generate response\s*:/i,
  /^determine whether\s*:/i,
  /^decide which tool\s*:/i,
  /^choose tool\s*:/i,
  /^analyze intent\s*:/i,
  /^route request\s*:/i,
  /^create plan\s*:/i,
  /^final response\s*:/i,
  /identify the smallest useful answer/i,
  /decide which tool or integration would be required/i,
  /internal auren agent context/i,
  /do not reveal the raw context/i,
];

type ModelSuggestion = {
  id?: unknown;
  label?: unknown;
  action?: unknown;
  payload?: unknown;
};

type ModelResponse = {
  answer?: unknown;
  suggestions?: unknown;
  fallback?: unknown;
  fallbackReason?: unknown;
  debug?: unknown;
  model?: unknown;
  groqStatus?: unknown;
  groqError?: unknown;
  groqErrorType?: unknown;
  recoveredFromPlainText?: unknown;
  browserSearchUsed?: unknown;
};

type CompactAgentContext = {
  userMessage: string;
  mode: AurenContext['mode'];
  intent: AurenContext['intent'];
  user: {
    userId?: string;
    displayName?: string;
    preferences: Record<string, unknown>;
  };
  study: AurenContext['study'];
  environment: AurenContext['environment'];
  conversation: {
    role: string;
    content: string;
  }[];
  memory: {
    used: boolean;
    saved: boolean;
    note?: string;
    items: {
      type: string;
      text: string;
      confidence: number;
    }[];
  };
  plan: {
    goal: string;
    summary: string;
    steps: {
      title: string;
      description: string;
      status: string;
    }[];
  };
  tools: {
    used: boolean;
    results: {
      name: string;
      success: boolean;
      status: string;
      message: string;
      data?: Record<string, unknown>;
    }[];
  };
};

const SYSTEM_INSTRUCTIONS = [
  'You are Auren, a personal AI Study Agent inside a premium mobile app.',
  '',
  'Write the final user-facing answer.',
  '',
  'Study agent identity:',
  '- Auren is study-first. It helps the user know what to study next, learn faster, stay focused, and make progress.',
  '- Do not behave like a generic chatbot when study context is available.',
  '- Use the study context as the primary source for personalized study decisions.',
  '- The study context may include todayFocus, activeTasks, openSteps, subjects, recentSessions, skillAreas, and summary.suggestedNextAction.',
  '- If todayFocus exists, treat it as the default next study priority unless the user clearly asks for something else.',
  '- If the user asks what to do, what to study, how to start, or asks a broad study question, answer from todayFocus or summary.suggestedNextAction first.',
  '- If no study context exists yet, help the user create a first focus, subject, task, exam, or next step.',
  '- Keep study answers actionable: give the next step, suggested session length, and what done looks like when useful.',
  '- Do not invent deadlines, progress, subjects, or tasks. Only use study data that appears in context or is provided by the user.',
  '',
  'Core rules:',
  '- Reply in the same language the user naturally used, unless the user explicitly asked for another language.',
  '- Do not use a fixed language list. Let the model infer the best response language.',
  '- Do not expose internal metadata such as mode, intent, confidence, pipeline steps, raw plan objects, memory scores, tool statuses, or raw study context.',
  '- Use the agent context to make the answer better, but keep the visible answer natural.',
  '- Use memory only when it is relevant and helpful.',
  '- Use tool results only when they are available and successful.',
  '- If a tool is missing or not connected, explain it naturally only when it matters.',
  '- Never claim that an action was completed unless the context or tool result proves it.',
  '- Do not mention that you are using JSON, prompts, internal context, or a pipeline.',
  '',
  'Auren mobile response style:',
  '- Write for a narrow phone screen.',
  '- Keep simple answers short by default.',
  '- Prefer 1 to 3 short paragraphs for simple explanations.',
  '- Avoid long wall-of-text answers.',
  '- Use whitespace to make the answer easy to scan on mobile.',
  '- Use short bullet lists or numbered steps only when they genuinely improve clarity.',
  '- Avoid markdown tables completely.',
  '- Avoid code blocks unless the user explicitly asks for code.',
  '- Give the direct answer first, then add details only if helpful.',
  '- For longer answers, use clear section titles and a calm, premium, practical tone.',
  '- End with one useful next step only when it feels natural.',
  '',
  'Light markdown + mobile-friendly rhythm:',
  '- Use light Markdown when it improves scanability.',
  '- Use **bold** for important words, short labels, or key section names.',
  '- Use numbered lists for clear steps or 2 to 5 important points.',
  '- Use short bullet lists for quick examples or grouped items.',
  '- Use the em dash — naturally for concise premium chat rhythm.',
  '- Use soft section dividers only between clearly separate long sections. In Markdown this is --- on its own line.',
  '- Use blockquotes only for important notes, warnings, decisions, or short summaries.',
  '- Use blank lines between paragraphs for mobile rhythm.',
  '- Keep Markdown subtle and clean, not decorative or heavy.',
  '- Avoid excessive headings, excessive bold text, and visual clutter.',
  '',
  'Auren icon status markers:',
  '- Never use colorful emoji status markers such as checkmarks, warning signs, magnifying glasses, lightbulbs, or brains.',
  '- Use an Auren marker tag only when the answer confirms state, completion, memory, warning, checking, or an idea.',
  '- The marker tag must appear at the start of its own line, followed by the visible label and text.',
  '- Available marker tags: [auren:memory], [auren:saved], [auren:done], [auren:alert], [auren:search], [auren:idea].',
  '- If you use an Auren marker line, do not repeat the same confirmation again in the next paragraph.',
  '- If you use [auren:memory] or [auren:saved], write one clean confirmation line, then only add new useful context if needed.',
  '- Good example: [auren:memory] **Muisti** — tallensin tämän tulevia keskusteluja varten.',
  '- Good example: [auren:saved] **Tallennettu** — lisäsin tämän muistiin.',
  '- Good example: [auren:done] **Valmis** — tämä osa on nyt kunnossa.',
  '- Good example: [auren:alert] **Huomio** — tässä on yksi riski.',
  '- Good example: [auren:search] **Tarkistin** — löysin todennäköisen syyn.',
  '- Good example: [auren:idea] **Idea** — tästä voisi tehdä paremman version.',
  '- Bad example: [auren:memory] **Muisti** — tallensin tämän. Muistettu! I saved this again.',
  '- Do not use marker tags in normal explanations or every answer.',
  '- Keep marker tags rare, functional, and premium — never decorative.',
  '',
  'Formatting:',
  '- Preserve paragraph breaks in the answer string using newline characters.',
  '- For a simple explanation, use short paragraphs separated by blank lines.',
  '- Do not put the entire answer into one long paragraph.',
  '',
  'Response length:',
  '- If the user asks a simple definition or quick question, answer briefly and clearly.',
  '- If the user asks for planning, studying, focus, money, or complex help, use more structure.',
  '- If the user asks for a detailed explanation, provide detail but keep paragraphs short.',
  '',
  'Return strict JSON only:',
  '{',
  '  "answer": "natural user-facing answer",',
  '  "suggestions": [',
  '    { "id": "short-id", "label": "short button label", "action": "machine_action" }',
  '  ]',
  '}',
].join('\n');

const cleanText = (value: string | null | undefined) => {
  return value?.replace(/\s+/g, ' ').trim() ?? '';
};

const cleanAnswerText = (value: string | null | undefined) => {
  return (
    value
      ?.replace(/\r\n/g, '\n')
      .replace(/\r/g, '\n')
      .replace(/[ \t]+/g, ' ')
      .replace(/ *\n */g, '\n')
      .replace(/\n{3,}/g, '\n\n')
      .trim() ?? ''
  );
};

const isInternalAnswer = (value: string | null | undefined) => {
  const cleaned = cleanAnswerText(value);

  if (!cleaned) {
    return false;
  }

  return INTERNAL_ANSWER_PATTERNS.some((pattern) => pattern.test(cleaned));
};

const limitText = (value: string, maxLength: number) => {
  const cleaned = cleanText(value);

  if (cleaned.length <= maxLength) {
    return cleaned;
  }

  return `${cleaned.slice(0, maxLength - 1).trim()}…`;
};

const limitAnswerText = (value: string, maxLength: number) => {
  const cleaned = cleanAnswerText(value);

  if (cleaned.length <= maxLength) {
    return cleaned;
  }

  return `${cleaned.slice(0, maxLength - 1).trim()}…`;
};

const slugify = (value: string) => {
  const slug = value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 48);

  return slug || 'action';
};

const safeJsonStringify = (value: unknown) => {
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return '{}';
  }
};

const withTimeout = async <T>(promise: Promise<T>, timeoutMs: number): Promise<T> => {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;

  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => {
      reject(new Error('Auren response generation timed out.'));
    }, timeoutMs);
  });

  try {
    return await Promise.race([promise, timeoutPromise]);
  } finally {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
  }
};

const createSuggestion = (
  id: string,
  label: string,
  action: string,
  payload?: AurenSuggestion['payload'],
): AurenSuggestion => {
  return {
    id,
    label,
    action,
    ...(payload ? { payload } : {}),
  };
};

const normalizeSuggestion = (
  suggestion: ModelSuggestion,
  index: number,
  basePayload: AurenSuggestion['payload'],
): AurenSuggestion | null => {
  const rawLabel = typeof suggestion.label === 'string' ? cleanText(suggestion.label) : '';
  const rawAction = typeof suggestion.action === 'string' ? cleanText(suggestion.action) : '';
  const rawId = typeof suggestion.id === 'string' ? cleanText(suggestion.id) : '';

  if (!rawLabel) {
    return null;
  }

  const action = rawAction || slugify(rawLabel);
  const id = rawId || `${slugify(action)}_${index + 1}`;

  return createSuggestion(id, limitText(rawLabel, 32), action, {
    ...basePayload,
    ...(suggestion.payload && typeof suggestion.payload === 'object' && !Array.isArray(suggestion.payload)
      ? (suggestion.payload as Record<string, unknown>)
      : {}),
  });
};

const dedupeSuggestions = (suggestions: AurenSuggestion[]) => {
  const uniqueSuggestions = new Map<string, AurenSuggestion>();

  for (const suggestion of suggestions) {
    const key = suggestion.action || suggestion.id;

    if (!uniqueSuggestions.has(key)) {
      uniqueSuggestions.set(key, suggestion);
    }
  }

  return Array.from(uniqueSuggestions.values()).slice(0, MAX_SUGGESTIONS);
};

const getFallbackSuggestions = (
  context: AurenContext,
  plan: AurenPlan,
): AurenSuggestion[] => {
  const basePayload = {
    mode: context.mode,
    intent: context.intent.intent,
    planGoal: plan.goal,
  };

  return [
    createSuggestion('try_again', 'Try again', 'try_again', basePayload),
    createSuggestion('ask_differently', 'Ask differently', 'ask_differently', basePayload),
  ];
};

const normalizeSuggestions = (
  value: unknown,
  context: AurenContext,
  plan: AurenPlan,
) => {
  const basePayload = {
    mode: context.mode,
    intent: context.intent.intent,
    planGoal: plan.goal,
  };

  if (!Array.isArray(value)) {
    return getFallbackSuggestions(context, plan);
  }

  const suggestions = value
    .map((item, index) => {
      if (!item || typeof item !== 'object') {
        return null;
      }

      return normalizeSuggestion(item as ModelSuggestion, index, basePayload);
    })
    .filter((item): item is AurenSuggestion => Boolean(item));

  if (suggestions.length === 0) {
    return getFallbackSuggestions(context, plan);
  }

  return dedupeSuggestions(suggestions);
};

const createCompactContext = (
  context: AurenContext,
  plan: AurenPlan,
  toolResults: AurenToolResult[],
): CompactAgentContext => {
  return {
    userMessage: context.message,
    mode: context.mode,
    intent: context.intent,
    user: {
      userId: context.user.userId,
      displayName: context.user.displayName,
      preferences: context.user.preferences,
    },
    study: context.study,
    environment: context.environment,
    conversation: context.conversation
      .slice(-MAX_CONVERSATION_MESSAGES)
      .map((message) => ({
        role: message.role,
        content: limitText(message.content, 1200),
      })),
    memory: {
      used: context.memory.used,
      saved: context.memory.saved,
      note: context.memory.note,
      items: context.memory.items.slice(0, MAX_MEMORY_ITEMS).map((item) => ({
        type: item.type,
        text: limitText(item.text, 800),
        confidence: item.confidence,
      })),
    },
    plan: {
      goal: limitText(plan.goal, 1000),
      summary: limitText(plan.summary, 1000),
      steps: plan.steps.slice(0, MAX_PLAN_STEPS).map((step) => ({
        title: limitText(step.title, 240),
        description: limitText(step.description, 600),
        status: step.status,
      })),
    },
    tools: {
      used: toolResults.length > 0,
      results: toolResults.slice(0, MAX_TOOL_RESULTS).map((result) => ({
        name: result.name,
        success: result.success,
        status: result.status,
        message: limitText(result.message, 600),
        data: result.data,
      })),
    },
  };
};

const createModelPayload = (
  context: AurenContext,
  plan: AurenPlan,
  toolResults: AurenToolResult[],
) => {
  const compactContext = createCompactContext(context, plan, toolResults);

  return {
    system: SYSTEM_INSTRUCTIONS,
    input: [
      'Use this internal Auren agent context to write the final answer.',
      'Prioritize study.todayFocus, study.activeTasks, study.openSteps, study.skillAreas, and study.summary when they are relevant.',
      'Do not reveal the raw context.',
      '',
      safeJsonStringify(compactContext),
    ].join('\n'),
    responseFormat: {
      type: 'json',
      schema: {
        answer: 'string',
        suggestions: [
          {
            id: 'string',
            label: 'string',
            action: 'string',
          },
        ],
      },
    },
  };
};

const parseModelResponse = (value: unknown): ModelResponse | null => {
  if (!value) {
    return null;
  }

  if (typeof value === 'object' && !Array.isArray(value)) {
    const objectValue = value as Record<string, unknown>;

    if (
      typeof objectValue.answer === 'string' ||
      Array.isArray(objectValue.suggestions) ||
      typeof objectValue.fallback === 'boolean' ||
      objectValue.debug
    ) {
      return objectValue as ModelResponse;
    }

    if (typeof objectValue.output === 'string') {
      try {
        return JSON.parse(objectValue.output) as ModelResponse;
      } catch {
        return {
          answer: objectValue.output,
          suggestions: [],
        };
      }
    }

    if (typeof objectValue.text === 'string') {
      try {
        return JSON.parse(objectValue.text) as ModelResponse;
      } catch {
        return {
          answer: objectValue.text,
          suggestions: [],
        };
      }
    }
  }

  if (typeof value === 'string') {
    try {
      return JSON.parse(value) as ModelResponse;
    } catch {
      return {
        answer: value,
        suggestions: [],
      };
    }
  }

  return null;
};

const getStringField = (value: unknown) => {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
};

const getNumberField = (value: unknown) => {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
};

const getBooleanField = (value: unknown) => {
  return typeof value === 'boolean' ? value : undefined;
};

const getDebugField = (value: unknown) => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return undefined;
  }

  return value as Record<string, unknown>;
};

const createResponseMetadata = (modelResponse: ModelResponse | null): AurenResponseMetadata | undefined => {
  if (!modelResponse) {
    return undefined;
  }

  const debug = getDebugField(modelResponse.debug);
  const debugFallback = debug?.fallback;
  const debugFallbackReason = debug?.fallbackReason;
  const debugModel = debug?.model;
  const debugGroqStatus = debug?.groqStatus;
  const debugGroqError = debug?.groqError;
  const debugGroqErrorType = debug?.groqErrorType;
  const debugBrowserSearchUsed = debug?.browserSearchUsed;

  const metadata: AurenResponseMetadata = {
    fallback: getBooleanField(modelResponse.fallback) ?? getBooleanField(debugFallback),
    fallbackReason: getStringField(modelResponse.fallbackReason) ?? getStringField(debugFallbackReason),
    debug,
    model: getStringField(modelResponse.model) ?? getStringField(debugModel),
    groqStatus: getNumberField(modelResponse.groqStatus) ?? getNumberField(debugGroqStatus),
    groqError: getStringField(modelResponse.groqError) ?? getStringField(debugGroqError),
    groqErrorType: getStringField(modelResponse.groqErrorType) ?? getStringField(debugGroqErrorType),
    recoveredFromPlainText: getBooleanField(modelResponse.recoveredFromPlainText),
    ...(getBooleanField(modelResponse.browserSearchUsed) ?? getBooleanField(debugBrowserSearchUsed)
      ? {
          debug: {
            ...(debug ?? {}),
            browserSearchUsed: true,
          },
        }
      : {}),
  };

  const hasMetadata = Object.values(metadata).some((value) => value !== undefined);

  return hasMetadata ? metadata : undefined;
};

const createSearchResponseMetadata = (
  searchMetadata: ReturnType<typeof getSearchMetadataFromReport>,
  debug?: Record<string, unknown>,
): AurenResponseMetadata => {
  return {
    debug: {
      ...(debug ?? {}),
      browserSearchUsed: searchMetadata.used,
      search: searchMetadata,
    },
    model: searchMetadata.model,
  };
};

const callResponseModel = async (
  context: AurenContext,
  plan: AurenPlan,
  toolResults: AurenToolResult[],
): Promise<ModelResponse | null> => {
  const payload = createModelPayload(context, plan, toolResults);

  const response = await withTimeout(
    supabase.functions.invoke(AUREN_RESPONSE_FUNCTION, {
      body: payload,
    }),
    MODEL_TIMEOUT_MS,
  );

  if (response.error) {
    return {
      answer: undefined,
      suggestions: [],
      fallback: true,
      fallbackReason: response.error.message || 'supabase_function_error',
      debug: {
        fallback: true,
        fallbackReason: response.error.message || 'supabase_function_error',
        source: 'finalResponse.callResponseModel',
      },
    };
  }

  return parseModelResponse(response.data);
};

const inferFallbackLanguage = (context: AurenContext) => {
  const text = `${context.message} ${context.input.message}`.toLowerCase();
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

  return finnishSignals.some((signal) => text.includes(signal)) ? 'fi' : 'en';
};

const createSafeFallbackAnswer = (context: AurenContext, toolResults: AurenToolResult[]) => {
  const language = inferFallbackLanguage(context);
  const unavailableTools = toolResults.filter((result) => !result.success);
  const wantsWebSearch = context.input.metadata?.browserSearch === true;

  if (wantsWebSearch) {
    return language === 'fi'
      ? 'En saanut web-hakua valmiiksi juuri nyt. Kokeile hetken päästä uudelleen tai kysy sama hieman lyhyemmin.'
      : 'I could not complete web search right now. Try again in a moment or ask a shorter version.';
  }

  if (unavailableTools.length > 0) {
    return language === 'fi'
      ? 'En saanut tarvittavaa työkalua käyttöön juuri nyt, mutta voin silti auttaa jatkamaan tästä.'
      : 'I could not use the needed tool right now, but I can still help continue from here.';
  }

  if (context.study?.summary?.suggestedNextAction && context.study.summary.hasFocus) {
    return language === 'fi'
      ? `En saanut muodostettua kokonaista vastausta juuri nyt, mutta seuraava opiskeluaskeleesi on: ${context.study.summary.suggestedNextAction}`
      : `I could not generate the full response right now, but your next study step is: ${context.study.summary.suggestedNextAction}`;
  }

  return language === 'fi'
    ? 'En saanut muodostettua kokonaista vastausta juuri nyt, mutta voin silti auttaa. Kokeile kysyä uudelleen hieman lyhyemmin.'
    : 'I could not generate the full response right now, but I can still help. Try asking again with a shorter version.';
};

export const generateFinalResponse = async (
  context: AurenContext,
  plan: AurenPlan,
  toolResults: AurenToolResult[],
): Promise<AurenResponseDraft> => {
  const searchResult = await runSearchPipeline({
    context,
    plan,
    toolResults,
    metadata: context.input.metadata,
  });

  if (searchResult.shouldUseSearchAnswer) {
    const searchAnswer = getSearchAnswerFromPipelineResult(searchResult);
    const searchMetadata = getSearchMetadataFromReport(searchResult.report);

    return {
      answer: limitAnswerText(searchAnswer, 8000),
      suggestions: getFallbackSuggestions(context, plan),
      metadata: createSearchResponseMetadata(searchMetadata, searchResult.report.debug),
    };
  }

  const modelResponse = await callResponseModel(context, plan, toolResults);
  const metadata = createResponseMetadata(modelResponse);
  const modelAnswer = typeof modelResponse?.answer === 'string' ? cleanAnswerText(modelResponse.answer) : '';
  const answer = modelAnswer && !isInternalAnswer(modelAnswer)
    ? limitAnswerText(modelAnswer, 8000)
    : createSafeFallbackAnswer(context, toolResults);

  return {
    answer,
    suggestions: normalizeSuggestions(modelResponse?.suggestions, context, plan),
    ...(metadata ? { metadata } : {}),
  };
};