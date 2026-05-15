import { runAurenAgent } from './auren-agent/core/runAurenAgent';
import type { AurenMode } from './auren-agent/core/types';

export type AurenChatMode = 'personal' | 'study' | 'money';

type AurenChatApiMessage = {
  role: 'user' | 'assistant';
  content: string;
};

type AurenChatStreamOptions = {
  onToken: (token: string) => void;
  signal?: AbortSignal;
  mode?: AurenChatMode;
  userId?: string;
  chatId?: string;
  messageId?: string;
};

const DEFAULT_AUREN_CHAT_MODE: AurenChatMode = 'personal';

function mapChatModeToAgentMode(mode: AurenChatMode): AurenMode {
  if (mode === 'study') return 'study';
  if (mode === 'money') return 'money';

  return 'general';
}

function getLatestUserMessage(messages: AurenChatApiMessage[]) {
  const latestUserMessage = [...messages].reverse().find((message) => message.role === 'user');
  const latestMessage = latestUserMessage ?? messages[messages.length - 1];

  return latestMessage?.content.trim() ?? '';
}

function throwIfAborted(signal?: AbortSignal) {
  if (!signal?.aborted) return;

  throw new Error('Auren request was stopped.');
}

export async function sendAurenChatMessage(
  messages: AurenChatApiMessage[],
  mode: AurenChatMode = DEFAULT_AUREN_CHAT_MODE,
) {
  const result = await runAurenAgent({
    message: getLatestUserMessage(messages),
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

  const result = await runAurenAgent({
    message: getLatestUserMessage(messages),
    userId: options.userId,
    mode: mapChatModeToAgentMode(options.mode ?? DEFAULT_AUREN_CHAT_MODE),
    conversation: messages,
    metadata: {
      chatId: options.chatId,
      messageId: options.messageId,
    },
  });

  throwIfAborted(options.signal);

  if (!result.answer.trim()) {
    throw new Error('Auren returned an empty response. Try again in a moment.');
  }

  options.onToken(result.answer);
}
