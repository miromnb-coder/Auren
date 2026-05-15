import { supabase } from '../../supabase';
import type {
  AurenContext,
  AurenPlan,
  AurenResponseDraft,
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

type ModelSuggestion = {
  id?: unknown;
  label?: unknown;
  action?: unknown;
  payload?: unknown;
};

type ModelResponse = {
  answer?: unknown;
  suggestions?: unknown;
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
  'You are Auren, a personal AI agent inside a premium mobile app.',
  '',
  'Write the final user-facing answer.',
  '',
  'Core rules:',
  '- Reply in the same language the user naturally used, unless the user explicitly asked for another language.',
  '- Do not use a fixed language list. Let the model infer the best response language.',
  '- Do not expose internal metadata such as mode, intent, confidence, pipeline steps, raw plan objects, memory scores, or tool statuses.',
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
  '- Use **bold** for key words, short labels, or important section names.',
  '- Use numbered lists for clear steps or 2 to 5 important points.',
  '- Use short bullet lists for quick examples or grouped items.',
  '- Use the em dash — naturally for concise premium chat rhythm.',
  '- Keep Markdown subtle and clean, not decorative or heavy.',
  '- Avoid excessive headings, excessive bold text, and visual clutter.',
  '- Do not use horizontal rules.',
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

  const planStepSuggestions = plan.steps
    .filter((step) => cleanText(step.title))
    .slice(0, MAX_SUGGESTIONS)
    .map((step, index) =>
      createSuggestion(
        `plan_step_${index + 1}`,
        limitText(step.title, 32),
        `plan_step_${index + 1}`,
        basePayload,
      ),
    );

  if (planStepSuggestions.length > 0) {
    return dedupeSuggestions(planStepSuggestions);
  }

  return [
    createSuggestion('continue', 'Continue', 'continue', basePayload),
    createSuggestion('make_plan', 'Make a plan', 'make_plan', basePayload),
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

    if (typeof objectValue.answer === 'string' || Array.isArray(objectValue.suggestions)) {
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
    return null;
  }

  return parseModelResponse(response.data);
};

const createFallbackAnswer = (
  context: AurenContext,
  plan: AurenPlan,
  toolResults: AurenToolResult[],
) => {
  const userMessage = cleanText(context.message);
  const firstUsefulStep = plan.steps.find((step) => step.status === 'ready') ?? plan.steps[0];
  const unavailableTools = toolResults.filter((result) => !result.success);

  if (unavailableTools.length > 0) {
    const names = unavailableTools.map((result) => result.name).join(', ');
    return `I cannot use ${names} yet, but I can still help with the next step.`;
  }

  if (firstUsefulStep) {
    const title = cleanText(firstUsefulStep.title);
    const description = cleanText(firstUsefulStep.description);

    return [title, description].filter(Boolean).join(': ');
  }

  if (userMessage) {
    return 'I had trouble generating the full response, but I can still help continue from your last message.';
  }

  return 'Send me a message and I’ll help with the next step.';
};

export const generateFinalResponse = async (
  context: AurenContext,
  plan: AurenPlan,
  toolResults: AurenToolResult[],
): Promise<AurenResponseDraft> => {
  const modelResponse = await callResponseModel(context, plan, toolResults);
  const answer =
    typeof modelResponse?.answer === 'string' && cleanAnswerText(modelResponse.answer)
      ? limitAnswerText(modelResponse.answer, 8000)
      : createFallbackAnswer(context, plan, toolResults);

  return {
    answer,
    suggestions: normalizeSuggestions(modelResponse?.suggestions, context, plan),
  };
};
