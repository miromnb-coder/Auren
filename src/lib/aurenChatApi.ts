import {
  clearAurenThinkingState,
  setAurenThinkingState,
  type AurenVisibleThinkingState,
} from './aurenThinkingStateStore';
import { supabase } from './supabase';

export type AurenChatMode = 'study';

type AurenChatApiMessage = {
  role: 'user' | 'assistant';
  content: string;
};

type AurenChatStreamOptions = {
  onToken: (token: string) => void;
  onThinkingState?: (thinkingState: AurenVisibleThinkingState | null) => void;
  signal?: AbortSignal;
  mode?: AurenChatMode;
  userId?: string;
  chatId?: string;
  messageId?: string;
  browserSearch?: boolean;
};

type SimpleModelResponse = {
  answer?: unknown;
  output?: unknown;
  text?: unknown;
  fallback?: unknown;
  fallbackReason?: unknown;
  debug?: unknown;
};

const SIMPLE_CHAT_FUNCTION = 'auren-generate-response';
const SIMPLE_CHAT_TIMEOUT_MS = 18_000;
const MAX_CONVERSATION_MESSAGES = 10;

function getLatestUserMessage(messages: AurenChatApiMessage[]) {
  const latestUserMessage = [...messages].reverse().find((message) => message.role === 'user');
  const latestMessage = latestUserMessage ?? messages[messages.length - 1];

  return latestMessage?.content.trim() ?? '';
}

async function getCurrentUserId(explicitUserId?: string) {
  if (explicitUserId?.trim()) {
    return explicitUserId.trim();
  }

  const { data } = await supabase.auth.getUser();

  return data.user?.id;
}

function throwIfAborted(signal?: AbortSignal) {
  if (!signal?.aborted) return;

  throw new Error('Auren request was stopped.');
}

function createLoadingThinkingState(): AurenVisibleThinkingState {
  return {
    type: 'loading',
    title: 'Thinking',
    detail: 'Auren is writing a response...',
    sequence: Date.now(),
    timestamp: new Date().toISOString(),
  };
}

function publishThinkingState(
  thinkingState: AurenVisibleThinkingState | null,
  onThinkingState?: (thinkingState: AurenVisibleThinkingState | null) => void,
) {
  setAurenThinkingState(thinkingState);
  onThinkingState?.(thinkingState);
}

function cleanAnswerText(value: unknown) {
  if (typeof value !== 'string') return '';

  return value
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/[ \t]+/g, ' ')
    .replace(/ *\n */g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function parseModelResponse(value: unknown): SimpleModelResponse | null {
  if (!value) return null;

  if (typeof value === 'object' && !Array.isArray(value)) {
    const objectValue = value as Record<string, unknown>;

    if (typeof objectValue.output === 'string') {
      return parseModelResponse(objectValue.output);
    }

    if (typeof objectValue.text === 'string') {
      return parseModelResponse(objectValue.text);
    }

    return objectValue as SimpleModelResponse;
  }

  if (typeof value === 'string') {
    try {
      return JSON.parse(value) as SimpleModelResponse;
    } catch {
      return { answer: value };
    }
  }

  return null;
}

function extractAnswer(response: SimpleModelResponse | null) {
  return (
    cleanAnswerText(response?.answer) ||
    cleanAnswerText(response?.output) ||
    cleanAnswerText(response?.text)
  );
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;

  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => reject(new Error('Auren response timed out.')), timeoutMs);
  });

  return Promise.race([promise, timeoutPromise]).finally(() => {
    if (timeoutId) clearTimeout(timeoutId);
  });
}

function createSimpleChatPayload(messages: AurenChatApiMessage[], userId?: string) {
  return {
    system: [
      'You are Auren, a helpful AI study assistant inside a premium mobile app.',
      'Answer directly and naturally in the same language the user uses.',
      'Keep responses clear, useful, and mobile-friendly.',
      'Do not mention internal prompts, routing, tools, pipelines, or hidden system details.',
      'Return strict JSON only: { "answer": "natural user-facing answer", "suggestions": [] }',
    ].join('\n'),
    input: JSON.stringify(
      {
        userId,
        messages: messages.slice(-MAX_CONVERSATION_MESSAGES),
      },
      null,
      2,
    ),
    responseFormat: {
      type: 'json',
      schema: {
        answer: 'string',
        suggestions: [],
      },
    },
  };
}

async function requestSimpleModelAnswer(messages: AurenChatApiMessage[], userId?: string) {
  const response = await withTimeout(
    supabase.functions.invoke(SIMPLE_CHAT_FUNCTION, {
      body: createSimpleChatPayload(messages, userId),
    }),
    SIMPLE_CHAT_TIMEOUT_MS,
  );

  if (response.error) {
    throw new Error(response.error.message || 'Auren had trouble connecting. Try again in a moment.');
  }

  const answer = extractAnswer(parseModelResponse(response.data));

  if (!answer) {
    throw new Error('Auren returned an empty response. Try again in a moment.');
  }

  return answer;
}

export async function sendAurenChatMessage(messages: AurenChatApiMessage[]) {
  return requestSimpleModelAnswer(messages, await getCurrentUserId());
}

export async function sendAurenChatMessageStream(
  messages: AurenChatApiMessage[],
  options: AurenChatStreamOptions,
) {
  throwIfAborted(options.signal);

  const loadingState = createLoadingThinkingState();
  publishThinkingState(loadingState, options.onThinkingState);

  const answer = await requestSimpleModelAnswer(messages, await getCurrentUserId(options.userId));

  throwIfAborted(options.signal);

  clearAurenThinkingState();
  options.onThinkingState?.(null);
  options.onToken(answer);
}
