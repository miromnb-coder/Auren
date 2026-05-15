import { supabase } from '../../supabase';
import type { AurenAgentInput, AurenUserContext } from '../core/types';

type UserContextRow = {
  user_id: string;
  display_name: string | null;
  preferences: Record<string, unknown> | null;
  active_goals: unknown[] | null;
  active_projects: unknown[] | null;
  metadata: Record<string, unknown> | null;
};

type ProfileRow = {
  display_name: string | null;
  email: string | null;
};

const getObject = (value: unknown): Record<string, unknown> => {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }

  return {};
};

const getArray = (value: unknown): unknown[] => {
  return Array.isArray(value) ? value : [];
};

export async function getUserContext(input: AurenAgentInput): Promise<AurenUserContext> {
  const userId = input.userId?.trim();

  if (!userId) {
    return {
      userId: input.userId,
      preferences: {},
    };
  }

  const [contextResult, profileResult] = await Promise.all([
    supabase
      .from('auren_user_context')
      .select('user_id, display_name, preferences, active_goals, active_projects, metadata')
      .eq('user_id', userId)
      .maybeSingle(),
    supabase.from('profiles').select('display_name, email').eq('id', userId).maybeSingle(),
  ]);

  const contextData = contextResult.data as UserContextRow | null;
  const profileData = profileResult.data as ProfileRow | null;
  const displayName = contextData?.display_name ?? profileData?.display_name ?? undefined;

  if (!contextData && !contextResult.error) {
    await supabase.from('auren_user_context').upsert({
      user_id: userId,
      display_name: displayName ?? null,
      preferences: {},
      active_goals: [],
      active_projects: [],
      metadata: {
        created_by: 'auren-agent',
      },
    });
  }

  return {
    userId,
    displayName,
    preferences: {
      ...getObject(contextData?.preferences),
      activeGoals: getArray(contextData?.active_goals),
      activeProjects: getArray(contextData?.active_projects),
      ...(profileData?.email ? { email: profileData.email } : {}),
      ...getObject(contextData?.metadata),
    },
  };
}
