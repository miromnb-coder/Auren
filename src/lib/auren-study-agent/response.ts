import { supabase } from '../supabase';
import type {
  StudyAgentAction,
  StudyAgentContext,
  StudyAgentIntent,
  StudyAgentResponseDraft,
  StudyAgentSuggestion,
} from './types';

const AUREN_RESPONSE_FUNCTION = 'auren-generate-response';
const MODEL_TIMEOUT_MS = 18_000;
const MAX_CONVERSATION_MESSAGES = 8;

type ModelResponse = {
  answer?: unknown;
  suggestions?: unknown;
  actions?: unknown;
  fallback?: unknown;
  fallbackReason?: unknown;
  debug?: unknown;
};

function createSuggestion(id: string, label: string, action: string, payload?: Record<string, unknown>): StudyAgentSuggestion {
  return {
    id,
    label,
    action,
    ...(payload ? { payload } : {}),
  };
}

function cleanText(value: unknown, fallback = '') {
  if (typeof value !== 'string') return fallback;
  return value.replace(/\s+/g, ' ').trim() || fallback;
}

function cleanAnswer(value: unknown, fallback = '') {
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

function safeJsonStringify(value: unknown) {
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return '{}';
  }
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;

  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => reject(new Error('Auren Study Agent response timed out.')), timeoutMs);
  });

  return Promise.race([promise, timeoutPromise]).finally(() => {
    if (timeoutId) clearTimeout(timeoutId);
  });
}

function isFinnish(context: StudyAgentContext) {
  return context.route.language === 'fi';
}

function getIntentLabel(intent: StudyAgentIntent) {
  if (intent === 'explain_concept') return 'explanation';
  if (intent === 'quiz_user') return 'quiz';
  if (intent === 'make_study_plan') return 'study plan';
  if (intent === 'review_notes') return 'notes review';
  if (intent === 'prepare_for_exam') return 'exam preparation';
  if (intent === 'solve_homework') return 'homework support';
  if (intent === 'start_focus_session') return 'focus session';
  if (intent === 'set_today_focus') return 'today focus';
  if (intent === 'track_progress') return 'progress check';
  return 'study chat';
}

function createDefaultSuggestions(context: StudyAgentContext): StudyAgentSuggestion[] {
  const payload = {
    intent: context.route.intent,
    hasFocus: Boolean(context.study.todayFocus && context.study.todayFocus.status !== 'empty'),
  };

  if (isFinnish(context)) {
    if (context.route.intent === 'quiz_user') {
      return [
        createSuggestion('explain_first', 'Selitä ensin', 'explain_first', payload),
        createSuggestion('harder_questions', 'Vaikeammat kysymykset', 'harder_questions', payload),
        createSuggestion('make_plan', 'Tee suunnitelma', 'make_study_plan', payload),
      ];
    }

    if (context.route.intent === 'explain_concept') {
      return [
        createSuggestion('give_example', 'Anna esimerkki', 'give_example', payload),
        createSuggestion('quiz_me', 'Kysy minulta', 'quiz_me', payload),
        createSuggestion('make_simpler', 'Selitä helpommin', 'make_simpler', payload),
      ];
    }

    return [
      createSuggestion('start_session', 'Aloita sessio', 'start_focus_session', payload),
      createSuggestion('quiz_me', 'Kysy minulta', 'quiz_me', payload),
      createSuggestion('make_plan', 'Tee suunnitelma', 'make_study_plan', payload),
    ];
  }

  if (context.route.intent === 'quiz_user') {
    return [
      createSuggestion('explain_first', 'Explain first', 'explain_first', payload),
      createSuggestion('harder_questions', 'Harder questions', 'harder_questions', payload),
      createSuggestion('make_plan', 'Make a plan', 'make_study_plan', payload),
    ];
  }

  if (context.route.intent === 'explain_concept') {
    return [
      createSuggestion('give_example', 'Give example', 'give_example', payload),
      createSuggestion('quiz_me', 'Quiz me', 'quiz_me', payload),
      createSuggestion('make_simpler', 'Make simpler', 'make_simpler', payload),
    ];
  }

  return [
    createSuggestion('start_session', 'Start session', 'start_focus_session', payload),
    createSuggestion('quiz_me', 'Quiz me', 'quiz_me', payload),
    createSuggestion('make_plan', 'Make a plan', 'make_study_plan', payload),
  ];
}

function createFallbackAnswer(context: StudyAgentContext) {
  const focus = context.study.todayFocus && context.study.todayFocus.status !== 'empty' ? context.study.todayFocus : null;
  const nextTask = context.study.upcomingTasks[0];
  const intentLabel = getIntentLabel(context.route.intent);

  if (isFinnish(context)) {
    if (focus) {
      return `Keskitytään tähän: **${focus.title}**.\n\nSeuraava askel on: **${focus.nextStep}**. Tee siitä ${focus.sessionMinutes} minuutin kevyt sessio ja lopeta, kun olet saanut yhden selkeän osan valmiiksi.\n\nVoin auttaa nyt ${intentLabel === 'quiz' ? 'kysymällä harjoituskysymyksiä' : 'pilkkomalla tämän helpommaksi'}.`;
    }

    if (nextTask) {
      return `Aloitetaan opiskelusta: **${nextTask.title}**.\n\nParas seuraava askel on tehdä pieni 15–25 minuutin aloitus: avaa materiaali, valitse yksi kohta ja ratkaise tai kertaa vain se.\n\nSen jälkeen voin tehdä sinulle nopean kyselyn tai suunnitelman.`;
    }

    return `Tehdään Aurenista sinulle opiskeluagentti yksi askel kerrallaan.\n\nKerro ensin mitä opiskelet juuri nyt, mikä koe tai tehtävä on tulossa, tai lähetä aihe jonka haluat ymmärtää. Sen jälkeen teen sinulle selkeän seuraavan askeleen.`;
  }

  if (focus) {
    return `Let’s focus on **${focus.title}**.\n\nYour next step is: **${focus.nextStep}**. Make it a ${focus.sessionMinutes}-minute session and stop when one clear piece is done.\n\nI can help by turning this into a simple explanation, a quiz, or a small study plan.`;
  }

  if (nextTask) {
    return `Start with **${nextTask.title}**.\n\nThe best next step is a small 15–25 minute start: open the material, choose one part, and work only on that.\n\nAfter that, I can quiz you or turn it into a study plan.`;
  }

  return `Let’s set up your study focus.\n\nTell me what you’re studying, what exam or assignment is coming up, or paste the topic you want to understand. I’ll turn it into a clear next step.`;
}

function normalizeSuggestions(value: unknown, context: StudyAgentContext) {
  if (!Array.isArray(value)) return createDefaultSuggestions(context);

  const normalized = value
    .map((item, index): StudyAgentSuggestion | null => {
      if (!item || typeof item !== 'object' || Array.isArray(item)) return null;
      const raw = item as Record<string, unknown>;
      const label = limitText(cleanText(raw.label), 32);
      if (!label) return null;
      const action = limitText(cleanText(raw.action, label.toLowerCase().replace(/[^a-z0-9]+/g, '_')), 48);
      const id = limitText(cleanText(raw.id, `${action}_${index + 1}`), 64);
      const payload = raw.payload && typeof raw.payload === 'object' && !Array.isArray(raw.payload)
        ? (raw.payload as Record<string, unknown>)
        : undefined;
      return createSuggestion(id, label, action, payload);
    })
    .filter((item): item is StudyAgentSuggestion => Boolean(item));

  return normalized.length > 0 ? normalized.slice(0, 4) : createDefaultSuggestions(context);
}

function normalizeActions(value: unknown): StudyAgentAction[] {
  if (!Array.isArray(value)) return [];

  return value
    .map((item): StudyAgentAction | null => {
      if (!item || typeof item !== 'object' || Array.isArray(item)) return null;
      const raw = item as Record<string, unknown>;
      const type = raw.type;

      if (type === 'create_focus') {
        const title = cleanText(raw.title);
        const nextStep = cleanText(raw.nextStep);
        const minutes = typeof raw.minutes === 'number' && Number.isFinite(raw.minutes) ? Math.max(5, Math.min(120, Math.round(raw.minutes))) : 25;
        if (!title || !nextStep) return null;
        return { type, title, nextStep, minutes, source: 'agent' };
      }

      if (type === 'start_quiz') {
        const topic = cleanText(raw.topic);
        if (!topic) return null;
        return { type, topic, source: 'agent' };
      }

      if (type === 'save_study_memory') {
        const text = cleanText(raw.text);
        if (!text) return null;
        return { type, text, source: 'agent' };
      }

      return null;
    })
    .filter((item): item is StudyAgentAction => Boolean(item))
    .slice(0, 4);
}

function parseModelResponse(value: unknown): ModelResponse | null {
  if (!value) return null;

  if (typeof value === 'object' && !Array.isArray(value)) {
    const objectValue = value as Record<string, unknown>;
    if (typeof objectValue.output === 'string') return parseModelResponse(objectValue.output);
    if (typeof objectValue.text === 'string') return parseModelResponse(objectValue.text);
    return objectValue as ModelResponse;
  }

  if (typeof value === 'string') {
    try {
      return JSON.parse(value) as ModelResponse;
    } catch {
      return { answer: value, suggestions: [] };
    }
  }

  return null;
}

function createModelPayload(context: StudyAgentContext) {
  const compactContext = {
    message: context.message,
    route: context.route,
    study: {
      available: context.study.available,
      todayFocus: context.study.todayFocus
        ? {
            title: context.study.todayFocus.title,
            nextStep: context.study.todayFocus.nextStep,
            sessionMinutes: context.study.todayFocus.sessionMinutes,
            progress: context.study.todayFocus.progress,
            status: context.study.todayFocus.status,
          }
        : null,
      subjects: context.study.subjects.slice(0, 8).map((subject) => ({
        name: subject.name,
        level: subject.level,
      })),
      activeTasks: context.study.activeTasks.slice(0, 8).map((task) => ({
        title: task.title,
        description: task.description,
        dueAt: task.dueAt,
        scheduledFor: task.scheduledFor,
        priority: task.priority,
        estimatedMinutes: task.estimatedMinutes,
        difficulty: task.difficulty,
      })),
      suggestedNextAction: context.study.suggestedNextAction,
    },
    conversation: context.conversation.slice(-MAX_CONVERSATION_MESSAGES).map((message) => ({
      role: message.role,
      content: limitText(message.content, 1200),
    })),
    environment: context.environment,
  };

  return {
    system: [
      'You are Auren Study Intelligence v1, a focused AI study agent inside a premium mobile app.',
      'Auren is only for studying: explaining concepts, quizzes, plans, exam prep, note review, homework support, and study focus.',
      'Do not act like a generic personal assistant. Always move the user closer to learning or completing one study step.',
      'Use todayFocus and activeTasks when they are relevant. Never invent deadlines, progress, subjects, or tasks.',
      'Reply in the same natural language the user used.',
      'Write for a narrow phone screen: short paragraphs, practical tone, no tables.',
      'Return strict JSON only with answer, suggestions, and actions.',
      'Actions are optional. Only include actions when useful. Supported action types: create_focus, start_quiz, save_study_memory.',
    ].join('\n'),
    input: [
      'Create the next Auren study-agent response from this context.',
      'The answer must be user-facing. Do not expose the raw context or internal route.',
      '',
      safeJsonStringify(compactContext),
    ].join('\n'),
    responseFormat: {
      type: 'json',
      schema: {
        answer: 'string',
        suggestions: [{ id: 'string', label: 'string', action: 'string' }],
        actions: [{ type: 'string' }],
      },
    },
  };
}

async function callModel(context: StudyAgentContext): Promise<ModelResponse | null> {
  const response = await withTimeout(
    supabase.functions.invoke(AUREN_RESPONSE_FUNCTION, {
      body: createModelPayload(context),
    }),
    MODEL_TIMEOUT_MS,
  );

  if (response.error) {
    return {
      answer: undefined,
      suggestions: [],
      fallback: true,
      fallbackReason: response.error.message || 'supabase_function_error',
      debug: { source: 'auren-study-agent.response.callModel' },
    };
  }

  return parseModelResponse(response.data);
}

export async function createStudyAgentResponse(context: StudyAgentContext): Promise<StudyAgentResponseDraft> {
  let modelResponse: ModelResponse | null = null;

  try {
    modelResponse = await callModel(context);
  } catch (error) {
    modelResponse = {
      answer: undefined,
      suggestions: [],
      fallback: true,
      fallbackReason: error instanceof Error ? error.message : 'unknown_model_error',
      debug: { source: 'auren-study-agent.response.createStudyAgentResponse' },
    };
  }

  const answer = cleanAnswer(modelResponse?.answer, createFallbackAnswer(context));

  return {
    answer,
    suggestions: normalizeSuggestions(modelResponse?.suggestions, context),
    actions: normalizeActions(modelResponse?.actions),
    metadata: {
      engine: 'auren-study-agent-v1',
      modelFallback: modelResponse?.fallback === true,
      fallbackReason: cleanText(modelResponse?.fallbackReason),
      debug: modelResponse?.debug,
    },
  };
}
