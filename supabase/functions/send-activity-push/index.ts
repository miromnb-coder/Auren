import { createClient } from 'jsr:@supabase/supabase-js@2';

type PushRequestBody = {
  userId?: string;
  activityItemId?: string;
  title?: string;
  body?: string;
  data?: Record<string, unknown>;
};

type PushTokenRow = {
  id: string;
  token: string;
};

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
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

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!supabaseUrl || !anonKey || !serviceRoleKey) {
      return jsonResponse({ error: 'Missing Supabase environment variables.' }, 500);
    }

    const authorization = req.headers.get('Authorization') ?? '';
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authorization } },
    });
    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    const { data: userData, error: userError } = await userClient.auth.getUser();
    if (userError || !userData.user) {
      return jsonResponse({ error: 'Unauthorized.' }, 401);
    }

    const requestBody = (await req.json().catch(() => ({}))) as PushRequestBody;
    const userId = requestBody.userId;

    if (!userId || userId !== userData.user.id) {
      return jsonResponse({ error: 'Invalid user.' }, 403);
    }

    const title = requestBody.title?.trim() || 'Auren';
    const body = requestBody.body?.trim() || '';

    const { data: preferences, error: preferencesError } = await adminClient
      .from('notification_preferences')
      .select('push_enabled')
      .eq('user_id', userId)
      .maybeSingle();

    if (preferencesError) throw preferencesError;

    if (!preferences?.push_enabled) {
      return jsonResponse({ sent: 0, skipped: true, reason: 'Push is disabled.' });
    }

    const { data: tokenRows, error: tokenError } = await adminClient
      .from('push_tokens')
      .select('id, token')
      .eq('user_id', userId)
      .eq('enabled', true)
      .order('last_seen_at', { ascending: false });

    if (tokenError) throw tokenError;

    const tokens = ((tokenRows ?? []) as PushTokenRow[]).filter((row) => row.token.startsWith('ExponentPushToken['));
    if (tokens.length === 0) {
      return jsonResponse({ sent: 0, skipped: true, reason: 'No enabled Expo push tokens.' });
    }

    const messages = tokens.map((row) => ({
      to: row.token,
      sound: 'default',
      title,
      body,
      data: {
        screen: 'activity',
        activityItemId: requestBody.activityItemId ?? null,
        ...(requestBody.data ?? {}),
      },
    }));

    const expoResponse = await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Accept-Encoding': 'gzip, deflate',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(messages),
    });

    const expoJson = await expoResponse.json().catch(() => null);

    if (!expoResponse.ok) {
      return jsonResponse({ sent: 0, error: 'Expo push request failed.', details: expoJson }, 502);
    }

    return jsonResponse({ sent: messages.length, result: expoJson });
  } catch (error) {
    return jsonResponse({ error: error instanceof Error ? error.message : 'Unknown push error.' }, 500);
  }
});
