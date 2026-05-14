import Ionicons from '@expo/vector-icons/Ionicons';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  PanResponder,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native';
import { supabase } from '../lib/supabase';
import { shadows } from '../theme';

export type AccountSheetStage = 'closed' | 'peek' | 'expanded';

type AccountSheetProfile = { name: string; email: string; initials: string };
type SheetView = 'account' | 'profile' | 'dataMemory' | 'subscription';
type RowItem = { id: string; label: string; icon: keyof typeof Ionicons.glyphMap; danger?: boolean };
type PlanId = 'free' | 'plus' | 'pro';

type AurenAccountSheetProps = {
  stage: AccountSheetStage;
  onStageChange: (stage: AccountSheetStage) => void;
  profile?: AccountSheetProfile;
  onProfileUpdated?: (profile: AccountSheetProfile) => void;
};

const DEFAULT_PROFILE: AccountSheetProfile = { name: 'Auren user', email: '', initials: 'AU' };
const PEEK_HEIGHT_RATIO = 0.54;
const EXPANDED_HEIGHT_RATIO = 0.92;
const PEEK_MIN_HEIGHT = 390;
const PEEK_MAX_HEIGHT = 520;
const EXPANDED_MIN_HEIGHT = 690;
const DRAG_THRESHOLD = 72;
const FAST_SWIPE_VELOCITY = 0.85;

const MAIN_ROWS: RowItem[] = [
  { id: 'profile', label: 'Profile', icon: 'person-outline' },
  { id: 'notifications', label: 'Notifications', icon: 'notifications-outline' },
  { id: 'data-memory', label: 'Data & Memory', icon: 'server-outline' },
  { id: 'appearance', label: 'Appearance', icon: 'sunny-outline' },
];

const SECONDARY_ROWS: RowItem[] = [
  { id: 'subscription', label: 'Subscription', icon: 'diamond-outline' },
  { id: 'help', label: 'Help', icon: 'help-circle-outline' },
  { id: 'sign-out', label: 'Sign out', icon: 'log-out-outline', danger: true },
];

const DATA_MAIN_ROWS: RowItem[] = [
  { id: 'saved-memories', label: 'Saved memories', icon: 'bookmark-outline' },
  { id: 'connected-data', label: 'Connected data', icon: 'server-outline' },
  { id: 'chat-history', label: 'Chat history', icon: 'chatbubble-outline' },
  { id: 'import-export', label: 'Import & export', icon: 'download-outline' },
];

const DATA_PRIVACY_ROWS: RowItem[] = [
  { id: 'manage-permissions', label: 'Manage permissions', icon: 'shield-outline' },
  { id: 'remove-chat-history', label: 'Delete chat ' + 'history', icon: 'trash-outline' },
  { id: 'clear-memory', label: 'Clear ' + 'memory', icon: 'warning-outline', danger: true },
];

const PLAN_OPTIONS: { id: PlanId; name: string; caption: string; recommended?: boolean }[] = [
  { id: 'free', name: 'Free', caption: '300 credits/day' },
  { id: 'plus', name: 'Plus', caption: '3,000 credits/day', recommended: true },
  { id: 'pro', name: 'Pro', caption: 'Highest limits' },
];

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function avatarInitial(initials: string) {
  return initials.trim().charAt(0).toUpperCase() || 'A';
}

function usernameFromEmail(email: string) {
  return email.split('@')[0]?.trim() || 'auren-user';
}

function initialsFromName(name: string, email: string) {
  const initials = name
    .trim()
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join('');
  return initials || email.charAt(0).toUpperCase() || 'A';
}

function SettingsRow({
  item,
  last = false,
  compact = false,
  disabled = false,
  onPress,
}: {
  item: RowItem;
  last?: boolean;
  compact?: boolean;
  disabled?: boolean;
  onPress?: () => void;
}) {
  return (
    <Pressable
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        compact ? styles.dataRow : styles.row,
        !last && styles.rowBorder,
        pressed && !disabled && styles.pressed,
        disabled && styles.disabled,
      ]}
    >
      <View style={compact ? styles.dataRowIconWrap : styles.rowIconWrap}>
        <Ionicons name={item.icon} size={compact ? 19 : 24} color={item.danger ? '#d4474b' : '#858891'} />
      </View>
      <Text style={[compact ? styles.dataRowLabel : styles.rowLabel, item.danger && styles.dangerText]}>{item.label}</Text>
      <Ionicons name="chevron-forward" size={compact ? 20 : 23} color="#a7a9b0" />
    </Pressable>
  );
}

export function AurenAccountSheet({ stage, onStageChange, profile = DEFAULT_PROFILE, onProfileUpdated }: AurenAccountSheetProps) {
  const { height } = useWindowDimensions();
  const [view, setView] = useState<SheetView>('account');
  const [selectedPlan, setSelectedPlan] = useState<PlanId>('plus');
  const [signingOut, setSigningOut] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);
  const [localProfile, setLocalProfile] = useState<AccountSheetProfile>(profile);
  const [draftName, setDraftName] = useState(profile.name);

  const sheet = useMemo(() => {
    const expandedHeight = Math.min(Math.max(height * EXPANDED_HEIGHT_RATIO, EXPANDED_MIN_HEIGHT), height);
    const peekHeight = Math.min(Math.max(height * PEEK_HEIGHT_RATIO, PEEK_MIN_HEIGHT), Math.min(PEEK_MAX_HEIGHT, expandedHeight - 80));
    return { expandedHeight, expandedY: 0, peekY: expandedHeight - peekHeight, closedY: expandedHeight + 28 };
  }, [height]);

  const translateY = useRef(new Animated.Value(stage === 'closed' ? sheet.closedY : stage === 'expanded' ? sheet.expandedY : sheet.peekY)).current;
  const currentY = useRef(stage === 'closed' ? sheet.closedY : stage === 'expanded' ? sheet.expandedY : sheet.peekY);
  const dragStartY = useRef(currentY.current);

  function targetY(nextStage: AccountSheetStage) {
    if (nextStage === 'expanded') return sheet.expandedY;
    if (nextStage === 'peek') return sheet.peekY;
    return sheet.closedY;
  }

  function animateToStage(nextStage: AccountSheetStage) {
    const nextY = targetY(nextStage);
    currentY.current = nextY;
    Animated.timing(translateY, { toValue: nextY, duration: nextStage === 'closed' ? 250 : 320, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
  }

  function openProfile() {
    setDraftName(localProfile.name);
    setView('profile');
    onStageChange('expanded');
  }

  function openDataMemory() {
    setView('dataMemory');
    onStageChange('expanded');
  }

  function openSubscription() {
    setView('subscription');
    onStageChange('expanded');
  }

  function handleUpgradePress() {
    setSelectedPlan('plus');
  }

  function handleChoosePlanPress() {
    // Payment will be connected later with RevenueCat, StoreKit, Stripe, or another billing provider.
    // For now this keeps the selected plan active visually without changing the real account plan.
  }

  async function saveProfile() {
    const nextName = draftName.replace(/\s+/g, ' ').trim();
    if (!nextName || savingProfile) return;
    setSavingProfile(true);
    try {
      const { data, error } = await supabase.auth.getUser();
      if (error) throw error;
      const userId = data.user?.id;
      const email = data.user?.email ?? localProfile.email;
      if (!userId) throw new Error('Missing user');
      const nextProfile = { name: nextName, email, initials: initialsFromName(nextName, email) };
      const { error: profileError } = await supabase.from('profiles').upsert({ id: userId, email, display_name: nextName });
      if (profileError) throw profileError;
      await supabase.auth.updateUser({ data: { display_name: nextName, full_name: nextName } });
      setLocalProfile(nextProfile);
      setDraftName(nextName);
      onProfileUpdated?.(nextProfile);
    } catch {
      // Keep current profile visible if saving fails.
    } finally {
      setSavingProfile(false);
    }
  }

  async function handleSignOut() {
    if (signingOut) return;
    setSigningOut(true);
    onStageChange('closed');
    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
    } catch {
      setSigningOut(false);
      onStageChange('expanded');
    }
  }

  function handleRowPress(item: RowItem) {
    if (item.id === 'profile') return openProfile();
    if (item.id === 'data-memory') return openDataMemory();
    if (item.id === 'subscription') return openSubscription();
    if (item.id === 'sign-out') void handleSignOut();
  }

  useEffect(() => {
    animateToStage(stage);
    if (stage === 'closed') setView('account');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stage, sheet.closedY, sheet.expandedY, sheet.peekY]);

  useEffect(() => {
    setLocalProfile(profile);
    setDraftName(profile.name);
  }, [profile.email, profile.initials, profile.name]);

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_event, gestureState) => stage !== 'closed' && Math.abs(gestureState.dy) > 8 && Math.abs(gestureState.dy) > Math.abs(gestureState.dx) * 1.25,
        onMoveShouldSetPanResponderCapture: (_event, gestureState) => stage !== 'closed' && Math.abs(gestureState.dy) > 8 && Math.abs(gestureState.dy) > Math.abs(gestureState.dx) * 1.25,
        onPanResponderGrant: () => {
          dragStartY.current = currentY.current;
          translateY.stopAnimation((value) => {
            currentY.current = value;
            dragStartY.current = value;
          });
        },
        onPanResponderMove: (_event, gestureState) => {
          const nextY = clamp(dragStartY.current + gestureState.dy, sheet.expandedY, sheet.closedY);
          currentY.current = nextY;
          translateY.setValue(nextY);
        },
        onPanResponderRelease: (_event, gestureState) => {
          const draggedUp = gestureState.dy < -DRAG_THRESHOLD || gestureState.vy < -FAST_SWIPE_VELOCITY;
          const draggedDown = gestureState.dy > DRAG_THRESHOLD || gestureState.vy > FAST_SWIPE_VELOCITY;
          if (stage === 'peek') {
            if (draggedUp) return onStageChange('expanded');
            if (draggedDown) return onStageChange('closed');
            return onStageChange('peek');
          }
          if (stage === 'expanded') {
            if (draggedDown) return onStageChange('peek');
            return onStageChange('expanded');
          }
        },
        onPanResponderTerminate: () => onStageChange(stage === 'expanded' ? 'expanded' : stage === 'peek' ? 'peek' : 'closed'),
      }),
    [onStageChange, sheet.closedY, sheet.expandedY, stage, translateY],
  );

  return (
    <Animated.View pointerEvents={stage === 'closed' ? 'none' : 'auto'} {...panResponder.panHandlers} style={[styles.sheet, { height: sheet.expandedHeight, transform: [{ translateY }] }]}>
      <View style={styles.solidFill} />
      <View style={styles.handle} />
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={
          view === 'profile'
            ? styles.profileContent
            : view === 'dataMemory'
              ? styles.dataMemoryContent
              : view === 'subscription'
                ? styles.subscriptionContent
                : styles.content
        }
        showsVerticalScrollIndicator={false}
        bounces={false}
        keyboardShouldPersistTaps="handled"
      >
        {view === 'profile' ? (
          <>
            <Text style={styles.title}>Profile</Text>
            <View style={styles.profileHeroCard}>
              <View style={styles.profileHeroAvatar}><Text style={styles.profileHeroAvatarText}>{avatarInitial(localProfile.initials)}</Text></View>
              <Text style={styles.profileHeroName} numberOfLines={1}>{localProfile.name}</Text>
              <Text style={styles.profileHeroEmail} numberOfLines={1}>{localProfile.email}</Text>
            </View>
            <View style={styles.profileFieldsCard}>
              <View style={[styles.profileFieldRow, styles.profileFieldBorder]}>
                <View style={styles.profileFieldTextWrap}>
                  <Text style={styles.profileFieldLabel}>Full name</Text>
                  <TextInput value={draftName} onChangeText={setDraftName} placeholder="Your name" placeholderTextColor="#a4a7af" autoCapitalize="words" autoCorrect={false} returnKeyType="done" style={styles.profileFieldInput} />
                </View>
                <Ionicons name="pencil-outline" size={22} color="#858891" />
              </View>
              <View style={[styles.profileFieldRow, styles.profileFieldBorder]}>
                <View style={styles.profileFieldTextWrap}><Text style={styles.profileFieldLabel}>Email</Text><Text style={styles.profileFieldLockedValue} numberOfLines={1}>{localProfile.email}</Text></View>
                <Ionicons name="lock-closed-outline" size={21} color="#858891" />
              </View>
              <View style={styles.profileFieldRow}>
                <View style={styles.profileFieldTextWrap}><Text style={styles.profileFieldLabel}>Username</Text><Text style={styles.profileFieldValue} numberOfLines={1}>{usernameFromEmail(localProfile.email)}</Text></View>
                <Ionicons name="pencil-outline" size={22} color="#858891" />
              </View>
            </View>
            <View style={styles.aboutCard}>
              <View style={styles.profileFieldTextWrap}><Text style={styles.profileFieldLabel}>About</Text><Text style={styles.aboutPlaceholder}>Tell others a little bit about yourself.</Text></View>
              <Ionicons name="pencil-outline" size={22} color="#858891" />
            </View>
            <Pressable onPress={saveProfile} disabled={savingProfile || draftName.trim().length === 0} style={({ pressed }) => [styles.saveButton, pressed && styles.pressed, (savingProfile || draftName.trim().length === 0) && styles.disabled]}>
              <Text style={styles.saveButtonText}>{savingProfile ? 'Saving…' : 'Save changes'}</Text>
            </Pressable>
            <Pressable onPress={() => setView('account')} style={({ pressed }) => [styles.backButton, pressed && styles.pressed]}><Text style={styles.backButtonText}>Back</Text></Pressable>
          </>
        ) : view === 'dataMemory' ? (
          <>
            <Text style={styles.dataTitle}>Data & Memory</Text>
            <View style={styles.memorySummaryCard}>
              <View style={styles.memorySummaryIcon}><Ionicons name="server-outline" size={30} color="#858891" /></View>
              <View style={styles.memorySummaryTextWrap}>
                <Text style={styles.memorySummaryTitle}>Memory is on</Text>
                <Text style={styles.memorySummaryLine}>12 saved memories</Text>
                <Text style={styles.memorySummaryLine}>Last updated today</Text>
                <Text style={styles.memorySummarySmall}>Auren uses memory to personalize responses.</Text>
              </View>
            </View>
            <View style={styles.dataGroupCard}>{DATA_MAIN_ROWS.map((item, index) => <SettingsRow key={item.id} item={item} compact last={index === DATA_MAIN_ROWS.length - 1} />)}</View>
            <View style={styles.storageCard}>
              <View style={styles.storageTopRow}><Text style={styles.storageTitle}>Storage used</Text><Text style={styles.storageValue}>128 MB</Text></View>
              <View style={styles.storageTrack}><View style={styles.storageFill} /></View>
              <View style={styles.storageBottomRow}><Text style={styles.storageMeta}>128 MB of 5 GB used</Text><Text style={styles.storageMeta}>2%</Text></View>
            </View>
            <View style={styles.dataPrivacyCard}>{DATA_PRIVACY_ROWS.map((item, index) => <SettingsRow key={item.id} item={item} compact last={index === DATA_PRIVACY_ROWS.length - 1} />)}</View>
            <Pressable style={({ pressed }) => [styles.saveButton, styles.dataSaveButton, pressed && styles.pressed]}><Text style={styles.saveButtonText}>Save changes</Text></Pressable>
            <Pressable onPress={() => setView('account')} style={({ pressed }) => [styles.backButton, styles.dataBackButton, pressed && styles.pressed]}><Text style={styles.backButtonText}>Back</Text></Pressable>
          </>
        ) : view === 'subscription' ? (
          <>
            <Text style={styles.subscriptionTitle}>Subscription</Text>

            <View style={styles.currentPlanCard}>
              <View style={styles.planIconCircle}>
                <Ionicons name="diamond-outline" size={31} color="#858891" />
              </View>
              <View style={styles.currentPlanTextWrap}>
                <Text style={styles.currentPlanKicker}>Current plan</Text>
                <Text style={styles.currentPlanName}>Free</Text>
                <Text style={styles.currentPlanCredits}>300 daily credits</Text>
                <View style={styles.refreshRow}>
                  <Ionicons name="refresh-outline" size={14} color="#858891" />
                  <Text style={styles.refreshText}>Resets every day</Text>
                </View>
              </View>
              <Pressable onPress={handleUpgradePress} style={({ pressed }) => [styles.upgradeButton, pressed && styles.pressed]}>
                <Text style={styles.upgradeButtonText}>Upgrade</Text>
              </Pressable>
            </View>

            <View style={styles.creditsCard}>
              <Text style={styles.creditsTitle}>Credits overview</Text>
              <View style={[styles.creditRow, styles.creditBorder]}>
                <View style={styles.creditIconWrap}><Ionicons name="server-outline" size={21} color="#858891" /></View>
                <Text style={styles.creditLabel}>Credits balance</Text>
                <Text style={styles.creditValueStrong}>184</Text>
              </View>
              <View style={[styles.creditRow, styles.creditBorder]}>
                <View style={styles.creditIconWrap}><Ionicons name="refresh-outline" size={22} color="#858891" /></View>
                <Text style={styles.creditLabel}>Daily refresh</Text>
                <Text style={styles.creditValue}>300 / day</Text>
              </View>
              <View style={[styles.creditRow, styles.creditBorder]}>
                <View style={styles.creditIconWrap}><Ionicons name="chatbubble-ellipses-outline" size={21} color="#858891" /></View>
                <Text style={styles.creditLabel}>AI chat</Text>
                <Text style={styles.creditValue}>from 5 credits</Text>
                <Ionicons name="chevron-forward" size={21} color="#a7a9b0" />
              </View>
              <View style={styles.creditRow}>
                <View style={styles.creditIconWrap}><Ionicons name="sparkles-outline" size={21} color="#858891" /></View>
                <Text style={styles.creditLabel}>Advanced tasks</Text>
                <Text style={styles.creditValue}>from 20 credits</Text>
                <Ionicons name="chevron-forward" size={21} color="#a7a9b0" />
              </View>
            </View>

            <Text style={styles.choosePlanLabel}>Choose a plan</Text>
            <View style={styles.planOptionsRow}>
              {PLAN_OPTIONS.map((plan) => {
                const active = selectedPlan === plan.id;
                return (
                  <Pressable
                    key={plan.id}
                    onPress={() => setSelectedPlan(plan.id)}
                    style={({ pressed }) => [styles.planOptionCard, active && styles.planOptionCardActive, pressed && styles.pressed]}
                  >
                    {plan.recommended ? (
                      <View style={styles.recommendedBadge}>
                        <Text style={styles.recommendedBadgeText}>Recommended</Text>
                      </View>
                    ) : null}
                    <View style={styles.planOptionIconCircle}>
                      <Ionicons name="diamond-outline" size={23} color="#858891" />
                    </View>
                    <Text style={styles.planOptionName}>{plan.name}</Text>
                    <Text style={styles.planOptionCaption} numberOfLines={1}>{plan.caption}</Text>
                  </Pressable>
                );
              })}
            </View>

            <Pressable onPress={handleChoosePlanPress} style={({ pressed }) => [styles.saveButton, styles.choosePlanButton, pressed && styles.pressed]}>
              <Text style={styles.saveButtonText}>Choose plan</Text>
            </Pressable>
            <Pressable onPress={() => setView('account')} style={({ pressed }) => [styles.backButton, styles.subscriptionBackButton, pressed && styles.pressed]}>
              <Text style={styles.backButtonText}>Back</Text>
            </Pressable>
          </>
        ) : (
          <>
            <Text style={styles.title}>Account</Text>
            <Pressable onPress={openProfile} style={({ pressed }) => [styles.profileCard, pressed && styles.pressed]}>
              <View style={styles.largeAvatar}><Text style={styles.largeAvatarText}>{avatarInitial(localProfile.initials)}</Text></View>
              <View style={styles.profileTextWrap}><Text style={styles.profileName} numberOfLines={1}>{localProfile.name}</Text><Text style={styles.profileEmail} numberOfLines={1}>{localProfile.email}</Text></View>
              <Ionicons name="chevron-forward" size={27} color="#a7a9b0" />
            </Pressable>
            <View style={styles.groupCard}>{MAIN_ROWS.map((item, index) => <SettingsRow key={item.id} item={item} last={index === MAIN_ROWS.length - 1} onPress={() => handleRowPress(item)} />)}</View>
            {SECONDARY_ROWS.map((item) => <View key={item.id} style={styles.singleCard}><SettingsRow item={item} last disabled={item.id === 'sign-out' && signingOut} onPress={() => handleRowPress(item)} /></View>)}
          </>
        )}
      </ScrollView>
    </Animated.View>
  );
}

const baseCardShadow = { shadowColor: '#111827', shadowOpacity: 0.032, shadowRadius: 14, shadowOffset: { width: 0, height: 8 }, elevation: 4 };
const cardBase = { backgroundColor: 'rgba(255,255,255,0.82)', borderWidth: 1, borderColor: 'rgba(17,24,39,0.045)', ...baseCardShadow };

const styles = StyleSheet.create({
  sheet: { position: 'absolute', left: 0, right: 0, bottom: 0, zIndex: 40, elevation: 40, borderTopLeftRadius: 38, borderTopRightRadius: 38, backgroundColor: '#fbfbfa', borderWidth: 1, borderColor: 'rgba(17,24,39,0.04)', overflow: 'hidden', ...shadows.soft },
  solidFill: { ...StyleSheet.absoluteFillObject, backgroundColor: '#fbfbfa' },
  handle: { alignSelf: 'center', width: 48, height: 5, borderRadius: 999, marginTop: 18, backgroundColor: 'rgba(110,113,124,0.28)' },
  scrollView: { flex: 1 },
  content: { paddingHorizontal: 23, paddingTop: 31, paddingBottom: 44 },
  profileContent: { paddingHorizontal: 24, paddingTop: 12, paddingBottom: 26 },
  dataMemoryContent: { paddingHorizontal: 24, paddingTop: 6, paddingBottom: 8 },
  subscriptionContent: { paddingHorizontal: 24, paddingTop: 5, paddingBottom: 8 },
  title: { color: '#1d1d20', fontSize: 19, lineHeight: 25, fontWeight: '620', letterSpacing: -0.22, textAlign: 'center', marginBottom: 31 },
  profileCard: { minHeight: 98, borderRadius: 20, paddingHorizontal: 20, flexDirection: 'row', alignItems: 'center', ...cardBase },
  largeAvatar: { width: 80, height: 80, borderRadius: 999, marginRight: 19, backgroundColor: '#eeedf2', alignItems: 'center', justifyContent: 'center' },
  largeAvatarText: { color: '#111113', fontSize: 39, lineHeight: 44, fontWeight: '430', letterSpacing: -1.2 },
  profileTextWrap: { flex: 1, minWidth: 0 },
  profileName: { color: '#1d1d20', fontSize: 22, lineHeight: 27, fontWeight: '650', letterSpacing: -0.45 },
  profileEmail: { marginTop: 2, color: '#7f838c', fontSize: 14.5, lineHeight: 19, fontWeight: '440', letterSpacing: -0.12 },
  groupCard: { marginTop: 27, borderRadius: 18, overflow: 'hidden', ...cardBase },
  singleCard: { marginTop: 22, borderRadius: 18, overflow: 'hidden', ...cardBase },
  row: { minHeight: 67, paddingHorizontal: 22, flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.82)' },
  rowBorder: { borderBottomWidth: 1, borderBottomColor: 'rgba(17,24,39,0.07)' },
  rowIconWrap: { width: 39, marginRight: 15, alignItems: 'flex-start', justifyContent: 'center' },
  rowLabel: { flex: 1, color: '#1f2228', fontSize: 16, lineHeight: 21, fontWeight: '450', letterSpacing: -0.17 },
  dangerText: { color: '#d4474b' },
  profileHeroCard: { minHeight: 164, borderRadius: 20, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24, paddingVertical: 18, ...cardBase },
  profileHeroAvatar: { width: 76, height: 76, borderRadius: 999, backgroundColor: '#eeedf2', alignItems: 'center', justifyContent: 'center', marginBottom: 14 },
  profileHeroAvatarText: { color: '#111113', fontSize: 42, lineHeight: 48, fontWeight: '400', letterSpacing: -1.4 },
  profileHeroName: { color: '#111113', fontSize: 26, lineHeight: 31, fontWeight: '500', letterSpacing: -0.72 },
  profileHeroEmail: { marginTop: 2, color: '#777b84', fontSize: 14.5, lineHeight: 19, fontWeight: '440', letterSpacing: -0.14 },
  profileFieldsCard: { marginTop: 23, borderRadius: 18, overflow: 'hidden', ...cardBase },
  profileFieldRow: { minHeight: 62, paddingHorizontal: 25, flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.82)' },
  profileFieldBorder: { borderBottomWidth: 1, borderBottomColor: 'rgba(17,24,39,0.07)' },
  profileFieldTextWrap: { flex: 1, minWidth: 0 },
  profileFieldLabel: { color: '#737780', fontSize: 12.5, lineHeight: 16, fontWeight: '500', letterSpacing: -0.05, marginBottom: 4 },
  profileFieldInput: { minHeight: 25, padding: 0, color: '#1d1d20', fontSize: 17, lineHeight: 22, fontWeight: '440', letterSpacing: -0.22 },
  profileFieldValue: { color: '#1d1d20', fontSize: 17, lineHeight: 22, fontWeight: '440', letterSpacing: -0.22 },
  profileFieldLockedValue: { color: '#777b84', fontSize: 17, lineHeight: 22, fontWeight: '440', letterSpacing: -0.22 },
  aboutCard: { minHeight: 64, marginTop: 21, borderRadius: 18, paddingHorizontal: 25, flexDirection: 'row', alignItems: 'center', ...cardBase },
  aboutPlaceholder: { color: '#777b84', fontSize: 14.5, lineHeight: 19, fontWeight: '430', letterSpacing: -0.11 },
  saveButton: { height: 56, marginTop: 28, borderRadius: 14, backgroundColor: '#111113', alignItems: 'center', justifyContent: 'center', shadowColor: '#000000', shadowOpacity: 0.15, shadowRadius: 14, shadowOffset: { width: 0, height: 8 }, elevation: 7 },
  saveButtonText: { color: '#ffffff', fontSize: 17, lineHeight: 22, fontWeight: '520', letterSpacing: -0.2 },
  backButton: { height: 56, marginTop: 14, borderRadius: 14, borderWidth: 1, borderColor: 'rgba(17,24,39,0.08)', backgroundColor: 'rgba(255,255,255,0.7)', alignItems: 'center', justifyContent: 'center' },
  backButtonText: { color: '#777b84', fontSize: 17, lineHeight: 22, fontWeight: '500', letterSpacing: -0.2 },
  dataTitle: { color: '#1d1d20', fontSize: 18.5, lineHeight: 23, fontWeight: '620', letterSpacing: -0.22, textAlign: 'center', marginBottom: 10 },
  memorySummaryCard: { minHeight: 80, borderRadius: 18, paddingHorizontal: 20, paddingVertical: 9, flexDirection: 'row', alignItems: 'center', ...cardBase },
  memorySummaryIcon: { width: 48, height: 48, borderRadius: 999, marginRight: 16, backgroundColor: '#eeedf2', alignItems: 'center', justifyContent: 'center' },
  memorySummaryTextWrap: { flex: 1, minWidth: 0 },
  memorySummaryTitle: { color: '#1d1d20', fontSize: 17.5, lineHeight: 21, fontWeight: '520', letterSpacing: -0.3 },
  memorySummaryLine: { color: '#777b84', fontSize: 12, lineHeight: 15, fontWeight: '440', letterSpacing: -0.08 },
  memorySummarySmall: { marginTop: 3, color: '#777b84', fontSize: 10.8, lineHeight: 13.5, fontWeight: '430', letterSpacing: -0.03 },
  dataGroupCard: { marginTop: 10, borderRadius: 18, overflow: 'hidden', ...cardBase },
  dataPrivacyCard: { marginTop: 10, borderRadius: 18, overflow: 'hidden', ...cardBase },
  dataRow: { minHeight: 42, paddingHorizontal: 25, flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.82)' },
  dataRowIconWrap: { width: 34, marginRight: 14, alignItems: 'flex-start', justifyContent: 'center' },
  dataRowLabel: { flex: 1, color: '#1f2228', fontSize: 15, lineHeight: 19, fontWeight: '450', letterSpacing: -0.15 },
  storageCard: { minHeight: 62, marginTop: 10, borderRadius: 18, paddingHorizontal: 20, paddingVertical: 9, ...cardBase },
  storageTopRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  storageTitle: { color: '#1f2228', fontSize: 14, lineHeight: 18, fontWeight: '500', letterSpacing: -0.13 },
  storageValue: { color: '#777b84', fontSize: 14, lineHeight: 18, fontWeight: '500', letterSpacing: -0.13 },
  storageTrack: { height: 6, borderRadius: 999, marginTop: 8, backgroundColor: '#e4e1ea', overflow: 'hidden' },
  storageFill: { width: '4%', height: '100%', borderRadius: 999, backgroundColor: '#858891' },
  storageBottomRow: { marginTop: 7, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  storageMeta: { color: '#777b84', fontSize: 12, lineHeight: 15, fontWeight: '440', letterSpacing: -0.05 },
  dataSaveButton: { height: 46, marginTop: 10 },
  dataBackButton: { height: 44, marginTop: 8 },
  subscriptionTitle: { color: '#1d1d20', fontSize: 20, lineHeight: 25, fontWeight: '620', letterSpacing: -0.26, textAlign: 'center', marginBottom: 18 },
  currentPlanCard: { minHeight: 108, borderRadius: 18, paddingHorizontal: 20, paddingVertical: 13, flexDirection: 'row', alignItems: 'center', ...cardBase },
  planIconCircle: { width: 64, height: 64, borderRadius: 999, marginRight: 16, backgroundColor: '#eeedf2', alignItems: 'center', justifyContent: 'center' },
  currentPlanTextWrap: { flex: 1, minWidth: 0 },
  currentPlanKicker: { color: '#777b84', fontSize: 13.5, lineHeight: 17, fontWeight: '440', letterSpacing: -0.1 },
  currentPlanName: { marginTop: 3, color: '#111113', fontSize: 26, lineHeight: 31, fontWeight: '500', letterSpacing: -0.7 },
  currentPlanCredits: { marginTop: 3, color: '#777b84', fontSize: 14.5, lineHeight: 18, fontWeight: '440', letterSpacing: -0.14 },
  refreshRow: { marginTop: 8, flexDirection: 'row', alignItems: 'center', gap: 7 },
  refreshText: { color: '#858891', fontSize: 11.5, lineHeight: 14, fontWeight: '440', letterSpacing: -0.06 },
  upgradeButton: { width: 88, height: 42, borderRadius: 11, marginLeft: 10, backgroundColor: '#111113', alignItems: 'center', justifyContent: 'center', shadowColor: '#000000', shadowOpacity: 0.15, shadowRadius: 12, shadowOffset: { width: 0, height: 7 }, elevation: 6 },
  upgradeButtonText: { color: '#ffffff', fontSize: 15, lineHeight: 19, fontWeight: '600', letterSpacing: -0.18 },
  creditsCard: { marginTop: 16, borderRadius: 18, paddingHorizontal: 20, paddingTop: 14, paddingBottom: 1, ...cardBase },
  creditsTitle: { color: '#33363d', fontSize: 15.5, lineHeight: 20, fontWeight: '500', letterSpacing: -0.12, marginBottom: 8 },
  creditRow: { minHeight: 42, flexDirection: 'row', alignItems: 'center' },
  creditBorder: { borderBottomWidth: 1, borderBottomColor: 'rgba(17,24,39,0.08)' },
  creditIconWrap: { width: 40, alignItems: 'flex-start', justifyContent: 'center' },
  creditLabel: { flex: 1, color: '#1f2228', fontSize: 14.5, lineHeight: 18, fontWeight: '450', letterSpacing: -0.14 },
  creditValue: { color: '#777b84', fontSize: 14, lineHeight: 18, fontWeight: '440', letterSpacing: -0.12, marginRight: 8 },
  creditValueStrong: { color: '#111113', fontSize: 15, lineHeight: 19, fontWeight: '600', letterSpacing: -0.12 },
  choosePlanLabel: { marginTop: 14, marginLeft: 11, color: '#33363d', fontSize: 15.5, lineHeight: 20, fontWeight: '500', letterSpacing: -0.13 },
  planOptionsRow: { marginTop: 10, flexDirection: 'row', gap: 10 },
  planOptionCard: { flex: 1, minHeight: 122, borderRadius: 14, borderWidth: 1, borderColor: 'rgba(17,24,39,0.12)', backgroundColor: 'rgba(255,255,255,0.68)', alignItems: 'center', justifyContent: 'flex-start', paddingHorizontal: 6, paddingTop: 33, paddingBottom: 8 },
  planOptionCardActive: { borderColor: '#111113', borderWidth: 1.25, backgroundColor: 'rgba(246,246,250,0.78)' },
  recommendedBadge: { position: 'absolute', top: 8, height: 22, borderRadius: 999, paddingHorizontal: 10, backgroundColor: '#20232a', alignItems: 'center', justifyContent: 'center' },
  recommendedBadgeText: { color: '#ffffff', fontSize: 10, lineHeight: 12, fontWeight: '600', letterSpacing: -0.08 },
  planOptionIconCircle: { width: 44, height: 44, borderRadius: 999, marginBottom: 7, backgroundColor: '#f0eff3', alignItems: 'center', justifyContent: 'center' },
  planOptionName: { color: '#111113', fontSize: 16, lineHeight: 19, fontWeight: '500', letterSpacing: -0.18 },
  planOptionCaption: { marginTop: 3, color: '#858891', fontSize: 11.5, lineHeight: 14, fontWeight: '440', textAlign: 'center', letterSpacing: -0.06 },
  choosePlanButton: { height: 50, marginTop: 17 },
  subscriptionBackButton: { height: 44, marginTop: 10 },
  pressed: { opacity: 0.68, transform: [{ scale: 0.993 }] },
  disabled: { opacity: 0.55 },
});
