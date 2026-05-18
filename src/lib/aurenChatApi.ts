import type { AurenThinkingEvent } from './auren-agent/core/types';
import { runAurenStudyAgent } from './auren-study-agent';
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

export async function sendAurenChatMessage(messages: AurenChatApiMessage[]) {
  const result = await runAurenStudyAgent({
    message: getLatestUserMessage(messages),
    userId: await getCurrentUserId(),
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

  const result = await runAurenStudyAgent(
    {
      message: getLatestUserMessage(messages),
      userId: await getCurrentUserId(options.userId),
      conversation: messages,
      metadata: {
        chatId: options.chatId,
        messageId: options.messageId,
        browserSearch: options.browserSearch === true,
        mode: options.mode ?? 'study',
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
