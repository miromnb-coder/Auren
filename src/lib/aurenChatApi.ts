import { runAurenAgent } from './auren-agent/core/runAurenAgent';
import type { AurenMode, AurenThinkingEvent } from './auren-agent/core/types';
import { clearAurenThinkingState, setAurenThinkingState } from './aurenThinkingStateStore';
import { supabase } from './supabase';

export type AurenChatMode = 'study';

type AurenChatApiMessage = {
  role: 'user' | 'assistant';
  content: string;
};

type AurenChatStreamOptions = {
  onToken: (token: string) => void;
  onThinkingState?: (thinkingState: AurenThinkingEvent | null) => void;
  signal?: AbortSignal;
  mode?: AurenChatMode;
  userId?: string;
  chatId?: string;
  messageId?: string;
  browserSearch?: boolean;
};

const DEFAULT_AUREN_CHAT_MODE: AurenChatMode = 'study';

function mapChatModeToAgentMode(_mode: AurenChatMode): AurenMode {
  return 'study';
}

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

function publishThinkingState(
  thinkingState: AurenThinkingEvent | null,
  onThinkingState?: (thinkingState: AurenThinkingEvent | null) => void,
) {
  setAurenThinkingState(thinkingState);
  onThinkingState?.(thinkingState);
}

export async function sendAurenChatMessage(
  messages: AurenChatApiMessage[],
  mode: AurenChatMode = DEFAULT_AUREN_CHAT_MODE,
) {
  const result = await runAurenAgent({
    message: getLatestUserMessage(messages),
    userId: await getCurrentUserId(),
    mode: mapChatModeToAgentMode(mode),
    conversation: messages,
  });

  return result.answer;
}

export async function sendAurenChatMessageStream(
  messages: AurenChatApiMessage[],
  options: AurenChatStreamOptions,
) {
  throwIfAborted(options.signal);
  clearAurenThinkingState();
  options.onThinkingState?.(null);

  const result = await runAurenAgent(
    {
      message: getLatestUserMessage(messages),
      userId: await getCurrentUserId(options.userId),
      mode: mapChatModeToAgentMode(options.mode ?? DEFAULT_AUREN_CHAT_MODE),
      conversation: messages,
      metadata: {
        chatId: options.chatId,
        messageId: options.messageId,
        browserSearch: options.browserSearch === true,
      },
    },
    {
      onEvent: (event) => {
        if (event.type === 'thinking_state') {
          publishThinkingState(event.thinking, options.onThinkingState);
        }
      },
    },
  );

  throwIfAborted(options.signal);

  if (!result.answer.trim()) {
    clearAurenThinkingState();
    options.onThinkingState?.(null);
    throw new Error('Auren returned an empty response. Try again in a moment.');
  }

  clearAurenThinkingState();
  options.onThinkingState?.(null);
  options.onToken(result.answer);
}
