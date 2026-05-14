type AurenChatApiMessage = {
  role: 'user' | 'assistant';
  content: string;
};

const AUREN_CHAT_FUNCTION_URL = 'https://eeyserphexequckonzsh.supabase.co/functions/v1/auren-chat';
const SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVleXNlcnBoZXhlcXVja29uenNoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg3NDU0MzgsImV4cCI6MjA5NDMyMTQzOH0.bcbw8jf2p5gBj1JPN4TxIu5WfweP8em4dTx_5so9hgw';

async function readJsonResponse(response: Response) {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

export async function sendAurenChatMessage(messages: AurenChatApiMessage[]) {
  const response = await fetch(AUREN_CHAT_FUNCTION_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
    },
    body: JSON.stringify({
      messages: messages.map((message) => ({
        role: message.role,
        content: message.content,
      })),
    }),
  });

  const data = await readJsonResponse(response);

  if (!response.ok) {
    const message =
      typeof data?.message === 'string'
        ? data.message
        : 'Auren had trouble connecting. Try again in a moment.';

    throw new Error(message);
  }

  if (typeof data?.message !== 'string' || data.message.trim().length === 0) {
    throw new Error('Auren returned an empty response. Try again in a moment.');
  }

  return data.message.trim();
}
