import { supabase } from './supabase';

export type ActivityCategory = 'updates' | 'messages' | 'agent' | 'credits' | 'system';
export type ActivityPriority = 'low' | 'normal' | 'high' | 'urgent';
export type NotificationSmartMode = 'minimal' | 'smart' | 'all';

export type NotificationPreferences = {
  user_id: string;
  in_app_enabled: boolean;
  push_enabled: boolean;
  smart_mode: NotificationSmartMode;
  daily_briefing_enabled: boolean;
  task_reminders_enabled: boolean;
  ai_suggestions_enabled: boolean;
  calendar_alerts_enabled: boolean;
  credits_alerts_enabled: boolean;
  subscription_alerts_enabled: boolean;
  security_alerts_enabled: boolean;
  quiet_hours_enabled: boolean;
  quiet_hours_start: string;
  quiet_hours_end: string;
  timezone: string;
};

export type ActivityItemRow = {
  id: string;
  user_id: string;
  category: ActivityCategory;
  type: string;
  title: string;
  body: string | null;
  icon: string | null;
  action_label: string | null;
  action_route: string | null;
  metadata: Record<string, unknown>;
  priority: ActivityPriority;
  read_at: string | null;
  archived_at: string | null;
  created_at: string;
  updated_at: string;
};

export type CreateActivityItemInput = {
  userId: string;
  category?: ActivityCategory;
  type: string;
  title: string;
  body?: string;
  icon?: string;
  actionLabel?: string;
  actionRoute?: string;
  metadata?: Record<string, unknown>;
  priority?: ActivityPriority;
  dedupeKey?: string;
  pushCandidate?: boolean;
  forceCreate?: boolean;
};

export type NotificationDeliveryDecision = {
  shouldCreateActivity: boolean;
  shouldBadge: boolean;
  shouldPush: boolean;
  priority: ActivityPriority;
  category: ActivityCategory;
  reason: string;
};

const DEFAULT_PREFERENCES: Omit<NotificationPreferences, 'user_id'> = {
  in_app_enabled: true,
  push_enabled: false,
  smart_mode: 'smart',
  daily_briefing_enabled: true,
  task_reminders_enabled: true,
  ai_suggestions_enabled: true,
  calendar_alerts_enabled: true,
  credits_alerts_enabled: true,
  subscription_alerts_enabled: true,
  security_alerts_enabled: true,
  quiet_hours_enabled: true,
  quiet_hours_start: '22:00:00',
  quiet_hours_end: '08:00:00',
  timezone: 'Europe/Helsinki',
};

function parseClockMinutes(value: string) {
  const [hourValue, minuteValue] = value.split(':');
  const hour = Number(hourValue);
  const minute = Number(minuteValue ?? 0);

  if (!Number.isFinite(hour) || !Number.isFinite(minute)) return null;
  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) return null;

  return hour * 60 + minute;
}

function isInsideQuietHours(preferences: NotificationPreferences, now = new Date()) {
  if (!preferences.quiet_hours_enabled) return false;

  const start = parseClockMinutes(preferences.quiet_hours_start);
  const end = parseClockMinutes(preferences.quiet_hours_end);

  if (start === null || end === null || start === end) return false;

  const current = now.getHours() * 60 + now.getMinutes();

  if (start < end) {
    return current >= start && current < end;
  }

  return current >= start || current < end;
}

function isCategoryEnabled(type: string, category: ActivityCategory, preferences: NotificationPreferences) {
  if (!preferences.in_app_enabled) return false;

  if (category === 'credits') return preferences.credits_alerts_enabled;
  if (category === 'messages') return true;
  if (type.includes('daily_briefing')) return preferences.daily_briefing_enabled;
  if (type.includes('task') || type.includes('reminder')) return preferences.task_reminders_enabled;
  if (type.includes('calendar')) return preferences.calendar_alerts_enabled;
  if (type.includes('subscription')) return preferences.subscription_alerts_enabled;
  if (type.includes('security')) return preferences.security_alerts_enabled;
  if (type.includes('suggestion') || category === 'agent') return preferences.ai_suggestions_enabled;

  return true;
}

function shouldCreateForMode(priority: ActivityPriority, smartMode: NotificationSmartMode) {
  if (smartMode === 'all') return true;
  if (smartMode === 'minimal') return priority === 'high' || priority === 'urgent';
  return priority !== 'low';
}

function shouldPushForMode(priority: ActivityPriority, smartMode: NotificationSmartMode, pushCandidate: boolean) {
  if (!pushCandidate && priority !== 'urgent') return false;
  if (smartMode === 'minimal') return priority === 'urgent';
  if (smartMode === 'all') return priority === 'normal' || priority === 'high' || priority === 'urgent';
  return priority === 'high' || priority === 'urgent';
}

export async function getOrCreateNotificationPreferences(userId: string) {
  const { data, error } = await supabase
    .from('notification_preferences')
    .select(
      'user_id,in_app_enabled,push_enabled,smart_mode,daily_briefing_enabled,task_reminders_enabled,ai_suggestions_enabled,calendar_alerts_enabled,credits_alerts_enabled,subscription_alerts_enabled,security_alerts_enabled,quiet_hours_enabled,quiet_hours_start,quiet_hours_end,timezone',
    )
    .eq('user_id', userId)
    .maybeSingle();

  if (error) throw error;

  if (data) return data as NotificationPreferences;

  const fallback = { user_id: userId, ...DEFAULT_PREFERENCES };
  const { data: created, error: createError } = await supabase
    .from('notification_preferences')
    .upsert(fallback, { onConflict: 'user_id' })
    .select(
      'user_id,in_app_enabled,push_enabled,smart_mode,daily_briefing_enabled,task_reminders_enabled,ai_suggestions_enabled,calendar_alerts_enabled,credits_alerts_enabled,subscription_alerts_enabled,security_alerts_enabled,quiet_hours_enabled,quiet_hours_start,quiet_hours_end,timezone',
    )
    .single();

  if (createError) throw createError;

  return created as NotificationPreferences;
}

export function decideNotificationDelivery(input: {
  category?: ActivityCategory;
  type: string;
  priority?: ActivityPriority;
  preferences: NotificationPreferences;
  pushCandidate?: boolean;
  forceCreate?: boolean;
}): NotificationDeliveryDecision {
  const category = input.category ?? 'updates';
  const priority = input.priority ?? 'normal';
  const pushCandidate = Boolean(input.pushCandidate);
  const categoryEnabled = isCategoryEnabled(input.type, category, input.preferences);

  if (!categoryEnabled && !input.forceCreate) {
    return {
      shouldCreateActivity: false,
      shouldBadge: false,
      shouldPush: false,
      priority,
      category,
      reason: 'Disabled by notification preferences.',
    };
  }

  const createByMode = shouldCreateForMode(priority, input.preferences.smart_mode);
  const shouldCreateActivity = input.forceCreate || createByMode;
  const quietHours = isInsideQuietHours(input.preferences);
  const pushByMode = shouldPushForMode(priority, input.preferences.smart_mode, pushCandidate);
  const shouldPush = Boolean(input.preferences.push_enabled && pushByMode && (!quietHours || priority === 'urgent'));

  return {
    shouldCreateActivity,
    shouldBadge: shouldCreateActivity && priority !== 'low',
    shouldPush,
    priority,
    category,
    reason: shouldPush
      ? 'Eligible for push delivery.'
      : quietHours
        ? 'Saved to Activity without push because quiet hours are active.'
        : shouldCreateActivity
          ? 'Saved to Activity only.'
          : 'Filtered by smart notification mode.',
  };
}

async function hasRecentDuplicate(input: CreateActivityItemInput) {
  const dedupeKey = input.dedupeKey?.trim();
  if (!dedupeKey) return false;

  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const { data, error } = await supabase
    .from('activity_items')
    .select('id')
    .eq('user_id', input.userId)
    .contains('metadata', { dedupeKey })
    .gte('created_at', oneHourAgo)
    .limit(1);

  if (error) return false;

  return (data ?? []).length > 0;
}

export async function createActivityItem(input: CreateActivityItemInput) {
  const preferences = await getOrCreateNotificationPreferences(input.userId);
  const decision = decideNotificationDelivery({
    category: input.category,
    type: input.type,
    priority: input.priority,
    preferences,
    pushCandidate: input.pushCandidate,
    forceCreate: input.forceCreate,
  });

  if (!decision.shouldCreateActivity) {
    return { item: null, decision };
  }

  const duplicate = await hasRecentDuplicate(input);
  if (duplicate && !input.forceCreate) {
    return {
      item: null,
      decision: {
        ...decision,
        shouldCreateActivity: false,
        shouldBadge: false,
        shouldPush: false,
        reason: 'Skipped because a similar activity item already exists.',
      },
    };
  }

  const metadata = {
    ...(input.metadata ?? {}),
    ...(input.dedupeKey ? { dedupeKey: input.dedupeKey } : {}),
    notificationDecision: decision,
  };

  const { data, error } = await supabase
    .from('activity_items')
    .insert({
      user_id: input.userId,
      category: decision.category,
      type: input.type,
      title: input.title,
      body: input.body ?? null,
      icon: input.icon ?? 'notifications-outline',
      action_label: input.actionLabel ?? null,
      action_route: input.actionRoute ?? null,
      metadata,
      priority: decision.priority,
      read_at: decision.shouldBadge ? null : new Date().toISOString(),
    })
    .select('id,user_id,category,type,title,body,icon,action_label,action_route,metadata,priority,read_at,archived_at,created_at,updated_at')
    .single();

  if (error) throw error;

  return { item: data as ActivityItemRow, decision };
}
