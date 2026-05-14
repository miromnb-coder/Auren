export type AurenChatMode = 'personal' | 'study' | 'money';

type AurenChatApiMessage = {
  role: 'user' | 'assistant';
  content: string;
};

type AurenChatStreamOptions = {
  onToken: (token: string) => void;
  signal?: AbortSignal;
  mode?: AurenChatMode;
};

const DEFAULT_AUREN_CHAT_MODE: AurenChatMode = 'personal';
const AUREN_CHAT_FUNCTION_URL = 'https://eeyserphexequckonzsh.supabase.co/functions/v1/auren-chat';
const SUPABASE_ANON_KEY = [
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9',
  'eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVleXNlcnBoZXhlcXVja29uenNoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg3NDU0MzgsImV4cCI6MjA5NDMyMTQzOH0',
  'bcbw8jf2p5gBj1JPN4TxIu5WfweP8em4dTx_5so9hgw',
].join('.');

function createRequestBody(messages: AurenChatApiMessage[], stream: boolean, mode: AurenChatMode) {
  return JSON.stringify({
    stream,
    mode,
    messages: messages.map((message) => ({
      role: message.role,
      content: message.content,
    })),
  });
}

function createHeaders() {
  return {
    'Content-Type': 'application/json',
    apikey: SUPABASE_ANON_KEY,
    Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
  };
}

async function readJsonResponse(response: Response) {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

async function readTextResponse(response: Response) {
  try {
    return await response.text();
  } catch {
    return '';
  }
}

function getMessageFromJson(data: unknown) {
  if (
    data &&
    typeof data === 'object' &&
    'message' in data &&
    typeof data.message === 'string' &&
    data.message.trim().length > 0
  ) {
    return data.message.trim();
  }

  return null;
}

function getErrorMessageFromJson(data: unknown) {
  return getMessageFromJson(data) ?? 'Auren had trouble connecting. Try again in a moment.';
}

function tryReadMessageFromJsonText(text: string) {
  try {
    return getMessageFromJson(JSON.parse(text));
  } catch {
    return null;
  }
}

export async function sendAurenChatMessage(
  messages: AurenChatApiMessage[],
  mode: AurenChatMode = DEFAULT_AUREN_CHAT_MODE,
) {
  const response = await fetch(AUREN_CHAT_FUNCTION_URL, {
    method: 'POST',
    headers: createHeaders(),
    body: createRequestBody(messages, false, mode),
  });

  const data = await readJsonResponse(response);

  if (!response.ok) {
    throw new Error(getErrorMessageFromJson(data));
  }

  const message = getMessageFromJson(data);

  if (!message) {
    throw new Error('Auren returned an empty response. Try again in a moment.');
  }

  return message;
}

export async function sendAurenChatMessageStream(
  messages: AurenChatApiMessage[],
  options: AurenChatStreamOptions,
) {
  const response = await fetch(AUREN_CHAT_FUNCTION_URL, {
    method: 'POST',
    headers: createHeaders(),
    body: createRequestBody(messages, true, options.mode ?? DEFAULT_AUREN_CHAT_MODE),
    signal: options.signal,
  });

  if (!response.ok) {
    const data = await readJsonResponse(response);
    throw new Error(getErrorMessageFromJson(data));
  }

  const contentType = response.headers.get('content-type') ?? '';

  if (contentType.includes('application/json')) {
    const data = await readJsonResponse(response);
    const message = getMessageFromJson(data);

    if (!message) {
      throw new Error('Auren returned an empty response. Try again in a moment.');
    }

    options.onToken(message);
    return;
  }

  const responseBody = response.body as unknown as {
    getReader?: () => {
      read: () => Promise<{ value?: Uint8Array; done: boolean }>;
      releaseLock?: () => void;
    };
  } | null;

  if (!responseBody?.getReader || typeof TextDecoder === 'undefined') {
    const text = await readTextResponse(response);
    const jsonMessage = tryReadMessageFromJsonText(text);
    const message = jsonMessage ?? text.trim();

    if (!message) {
      throw new Error('Auren returned an empty response. Try again in a moment.');
    }

    options.onToken(message);
    return;
  }

  const reader = responseBody.getReader();
  const decoder = new TextDecoder();
  let receivedAnyToken = false;

  try {
    while (true) {
      const { value, done } = await reader.read();

      if (done) break;
      if (!value) continue;

      const token = decoder.decode(value, { stream: true });

      if (token.length > 0) {
        receivedAnyToken = true;
        options.onToken(token);
      }
    }

    const finalToken = decoder.decode();

    if (finalToken.length > 0) {
      receivedAnyToken = true;
      options.onToken(finalToken);
    }
  } finally {
    reader.releaseLock?.();
  }

  if (!receivedAnyToken) {
    throw new Error('Auren returned an empty response. Try again in a moment.');
  }
}
