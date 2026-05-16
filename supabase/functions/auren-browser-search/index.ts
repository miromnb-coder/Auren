const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

type BrowserSearchRequest = {
  message?: unknown;
  instructions?: unknown;
  context?: unknown;
};

type GroqChoice = {
  message?: {
    content?: unknown;
  };
};

type GroqChatResponse = {
  choices?: GroqChoice[];
  model?: unknown;
  usage?: unknown;
  error?: {
    message?: unknown;
    type?: unknown;
  };
};

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json',
    },
  });
}

function cleanText(value: unknown, maxLength = 8000) {
  if (typeof value !== 'string') return '';

  const cleaned = value.replace(/\s+/g, ' ').trim();

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

function buildPrompt(input: BrowserSearchRequest) {
  const message = cleanText(input.message, 4000);
  const instructions = cleanText(input.instructions, 4000);
  const context = safeJsonStringify(input.context ?? {});

  return [
    instructions || 'You are Auren. Use browser search to answer with current, source-backed information.',
    '',
    'Important response rules:',
    '- Answer in the same language the user used.',
    '- Keep the answer clear and mobile-friendly.',
    '- Do not expose internal JSON or raw context.',
    '- If the search results are weak or unclear, say so briefly.',
    '- Return only the user-facing answer text.',
    '',
    'User message:',
    message,
    '',
    'Internal Auren context:',
    context,
  ].join('\n');
}

function getAnswer(data: GroqChatResponse) {
  const content = data.choices?.[0]?.message?.content;

  return typeof content === 'string' ? content.trim() : '';
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (request.method !== 'POST') {
    return jsonResponse({ answer: 'Method not allowed.', fallback: true }, 405);
  }

  const groqApiKey = Deno.env.get('GROQ_API_KEY');

  if (!groqApiKey) {
    return jsonResponse(
      {
        answer: 'Web search is not configured yet. Add GROQ_API_KEY to Supabase Edge Function secrets.',
        fallback: true,
        fallbackReason: 'missing_groq_api_key',
        browserSearchUsed: true,
      },
      200,
    );
  }

  try {
    const input = (await request.json()) as BrowserSearchRequest;
    const prompt = buildPrompt(input);

    const groqResponse = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${groqApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'openai/gpt-oss-20b',
        messages: [
          {
            role: 'user',
            content: prompt,
          },
        ],
        temperature: 0.7,
        max_completion_tokens: 2048,
        top_p: 1,
        stream: false,
        reasoning_effort: 'low',
        tool_choice: 'required',
        tools: [
          {
            type: 'browser_search',
          },
        ],
      }),
    });

    const data = (await groqResponse.json()) as GroqChatResponse;

    if (!groqResponse.ok || data.error) {
      const message = cleanText(data.error?.message, 1000) || 'Groq browser search failed.';

      return jsonResponse({
        answer: 'I could not complete web search right now, but you can try again in a moment.',
        fallback: true,
        fallbackReason: message,
        model: 'openai/gpt-oss-20b',
        groqStatus: groqResponse.status,
        groqError: message,
        groqErrorType: cleanText(data.error?.type, 300),
        browserSearchUsed: true,
      });
    }

    const answer = getAnswer(data);

    if (!answer) {
      return jsonResponse({
        answer: 'I searched, but I could not generate a useful answer from the results.',
        fallback: true,
        fallbackReason: 'empty_browser_search_answer',
        model: 'openai/gpt-oss-20b',
        browserSearchUsed: true,
      });
    }

    return jsonResponse({
      answer,
      suggestions: [],
      model: typeof data.model === 'string' ? data.model : 'openai/gpt-oss-20b',
      browserSearchUsed: true,
      debug: {
        browserSearchUsed: true,
        usage: data.usage,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown browser search error.';

    return jsonResponse({
      answer: 'I could not complete web search right now, but you can try again in a moment.',
      fallback: true,
      fallbackReason: message,
      browserSearchUsed: true,
    });
  }
});
