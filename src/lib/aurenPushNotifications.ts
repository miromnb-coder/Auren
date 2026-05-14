import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { supabase } from './supabase';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: false,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

function getExpoProjectId() {
  const easProjectId = Constants.easConfig?.projectId;
  const extraProjectId =
    typeof Constants.expoConfig?.extra?.eas === 'object' && Constants.expoConfig.extra.eas
      ? (Constants.expoConfig.extra.eas as { projectId?: string }).projectId
      : undefined;

  return easProjectId ?? extraProjectId;
}

function getPushPlatform() {
  if (Platform.OS === 'ios') return 'ios';
  if (Platform.OS === 'android') return 'android';
  if (Platform.OS === 'web') return 'web';
  return 'unknown';
}

export async function registerForAurenPushNotifications() {
  if (Platform.OS === 'web' || !Device.isDevice) {
    return { ok: false, token: null, reason: 'Push notifications require a physical iOS or Android device.' };
  }

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'Auren',
      importance: Notifications.AndroidImportance.DEFAULT,
      vibrationPattern: [0, 180, 120, 180],
      lightColor: '#111113',
    });
  }

  const existingPermissions = await Notifications.getPermissionsAsync();
  let finalStatus = existingPermissions.status;

  if (finalStatus !== 'granted') {
    const requestedPermissions = await Notifications.requestPermissionsAsync();
    finalStatus = requestedPermissions.status;
  }

  if (finalStatus !== 'granted') {
    await disableCurrentDevicePushToken();
    return { ok: false, token: null, reason: 'Notification permission was not granted.' };
  }

  const projectId = getExpoProjectId();
  const tokenResponse = projectId
    ? await Notifications.getExpoPushTokenAsync({ projectId })
    : await Notifications.getExpoPushTokenAsync();
  const token = tokenResponse.data;

  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError) throw userError;

  const userId = userData.user?.id;
  if (!userId) {
    return { ok: false, token: null, reason: 'Missing signed-in user.' };
  }

  await supabase
    .from('notification_preferences')
    .upsert({ user_id: userId, push_enabled: true }, { onConflict: 'user_id' });

  const { error } = await supabase.from('push_tokens').upsert(
    {
      user_id: userId,
      token,
      platform: getPushPlatform(),
      device_name: Device.deviceName ?? null,
      app_version: Constants.expoConfig?.version ?? null,
      enabled: true,
      last_seen_at: new Date().toISOString(),
    },
    { onConflict: 'user_id,token' },
  );

  if (error) throw error;

  return { ok: true, token, reason: null };
}

export async function disableCurrentDevicePushToken() {
  try {
    const projectId = getExpoProjectId();
    const tokenResponse = projectId
      ? await Notifications.getExpoPushTokenAsync({ projectId })
      : await Notifications.getExpoPushTokenAsync();
    const token = tokenResponse.data;

    const { data: userData } = await supabase.auth.getUser();
    const userId = userData.user?.id;
    if (!userId) return;

    await supabase
      .from('push_tokens')
      .update({ enabled: false, last_seen_at: new Date().toISOString() })
      .eq('user_id', userId)
      .eq('token', token);
  } catch {
    // Best effort only.
  }
}

export function addAurenNotificationResponseListener(onOpenActivity: () => void) {
  return Notifications.addNotificationResponseReceivedListener((response) => {
    const data = response.notification.request.content.data as { screen?: string } | undefined;
    if (data?.screen === 'activity') {
      onOpenActivity();
    }
  });
}

export async function sendTestAurenPushNotification() {
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError) throw userError;

  const userId = userData.user?.id;
  if (!userId) throw new Error('Missing signed-in user.');

  const { data, error } = await supabase.functions.invoke('send-activity-push', {
    body: {
      userId,
      title: 'Auren test notification',
      body: 'Push notifications are connected.',
      data: { screen: 'activity', type: 'test_push' },
    },
  });

  if (error) throw error;

  return data;
}
