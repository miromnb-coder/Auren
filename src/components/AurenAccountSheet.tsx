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

type AurenAccountSheetProps = {
  stage: AccountSheetStage;
  onStageChange: (stage: AccountSheetStage) => void;
  profile?: AccountSheetProfile;
  onProfileUpdated?: (profile: AccountSheetProfile) => void;
};

type AccountRow = {
  id: string;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  danger?: boolean;
};

type SheetView = 'account' | 'profile' | 'dataMemory';

const DEFAULT_PROFILE: AccountSheetProfile = { name: 'Auren user', email: '', initials: 'AU' };
const PEEK_HEIGHT_RATIO = 0.54;
const EXPANDED_HEIGHT_RATIO = 0.92;
const PEEK_MIN_HEIGHT = 390;
const PEEK_MAX_HEIGHT = 520;
const EXPANDED_MIN_HEIGHT = 690;
const DRAG_THRESHOLD = 72;
const FAST_SWIPE_VELOCITY = 0.85;

const MAIN_ROWS: AccountRow[] = [
  { id: 'profile', label: 'Profile', icon: 'person-outline' },
  { id: 'notifications', label: 'Notifications', icon: 'notifications-outline' },
  { id: 'data-memory', label: 'Data & Memory', icon: 'server-outline' },
  { id: 'appearance', label: 'Appearance', icon: 'sunny-outline' },
];

const SECONDARY_ROWS: AccountRow[] = [
  { id: 'subscription', label: 'Subscription', icon: 'diamond-outline' },
  { id: 'help', label: 'Help', icon: 'help-circle-outline' },
  { id: 'sign-out', label: 'Sign out', icon: 'log-out-outline', danger: true },
];

const DATA_MEMORY_MAIN_ROWS: AccountRow[] = [
  { id: 'saved-memories', label: 'Saved memories', icon: 'bookmark-outline' },
  { id: 'connected-data', label: 'Connected data', icon: 'server-outline' },
  { id: 'chat-history', label: 'Chat history', icon: 'chatbubble-outline' },
  { id: 'import-export', label: 'Import & export', icon: 'download-outline' },
];

const DATA_MEMORY_PRIVACY_ROWS: AccountRow[] = [
  { id: 'manage-permissions', label: 'Manage permissions', icon: 'shield-outline' },
  { id: 'delete-chat-history', label: 'Delete chat history', icon: 'trash-outline' },
  { id: 'clear-memory', label: 'Clear memory', icon: 'warning-outline', danger: true },
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

function AccountListRow({ row, last, disabled, onPress }: { row: AccountRow; last?: boolean; disabled?: boolean; onPress?: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [styles.row, !last && styles.rowBorder, pressed && !disabled && styles.pressed, disabled && styles.disabled]}
    >
      <View style={styles.rowIconWrap}>
        <Ionicons name={row.icon} size={24} color={row.danger ? '#d4474b' : '#858891'} />
      </View>
      <Text style={[styles.rowLabel, row.danger && styles.dangerText]}>{row.label}</Text>
      <Ionicons name="chevron-forward" size={23} color="#a7a9b0" />
    </Pressable>
  );
}

function DataMemoryRow({ row, last }: { row: AccountRow; last?: boolean }) {
  return (
    <Pressable style={({ pressed }) => [styles.dataRow, !last && styles.rowBorder, pressed && styles.pressed]}>
      <View style={styles.dataRowIconWrap}>
        <Ionicons name={row.icon} size={24} color={row.danger ? '#d4474b' : '#858891'} />
      </View>
      <Text style={[styles.dataRowLabel, row.danger && styles.dangerText]}>{row.label}</Text>
      <Ionicons name="chevron-forward" size={23} color="#a7a9b0" />
    </Pressable>
  );
}

export function AurenAccountSheet({ stage, onStageChange, profile = DEFAULT_PROFILE, onProfileUpdated }: AurenAccountSheetProps) {
  const { height } = useWindowDimensions();
  const [view, setView] = useState<SheetView>('account');
  const [signingOut, setSigningOut] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);
  const [localProfile, setLocalProfile] = useState<AccountSheetProfile>(profile);
  const [draftName, setDraftName] = useState(profile.name);

  const sheet = useMemo(() => {
    const expandedHeight = Math.min(Math.max(height * EXPANDED_HEIGHT_RATIO, EXPANDED_MIN_HEIGHT), height);
    const peekHeight = Math.min(
      Math.max(height * PEEK_HEIGHT_RATIO, PEEK_MIN_HEIGHT),
      Math.min(PEEK_MAX_HEIGHT, expandedHeight - 80),
    );

    return {
      expandedHeight,
      expandedY: 0,
      peekY: expandedHeight - peekHeight,
      closedY: expandedHeight + 28,
    };
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
    Animated.timing(translateY, {
      toValue: nextY,
      duration: nextStage === 'closed' ? 250 : 320,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
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
      // Keep the existing visible profile if saving fails.
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

  function handleRowPress(row: AccountRow) {
    if (row.id === 'profile') return openProfile();
    if (row.id === 'data-memory') return openDataMemory();
    if (row.id === 'sign-out') void handleSignOut();
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
        onMoveShouldSetPanResponder: (_event, gestureState) => {
          if (stage === 'closed') return false;
          const verticalDistance = Math.abs(gestureState.dy);
          const horizontalDistance = Math.abs(gestureState.dx);
          return verticalDistance > 8 && verticalDistance > horizontalDistance * 1.25;
        },
        onMoveShouldSetPanResponderCapture: (_event, gestureState) => {
          if (stage === 'closed') return false;
          const verticalDistance = Math.abs(gestureState.dy);
          const horizontalDistance = Math.abs(gestureState.dx);
          return verticalDistance > 8 && verticalDistance > horizontalDistance * 1.25;
        },
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
        onPanResponderTerminate: () => {
          onStageChange(stage === 'expanded' ? 'expanded' : stage === 'peek' ? 'peek' : 'closed');
        },
      }),
    [onStageChange, sheet.closedY, sheet.expandedY, stage, translateY],
  );

  const editIconSize = 22;

  return (
    <Animated.View
      pointerEvents={stage === 'closed' ? 'none' : 'auto'}
      {...panResponder.panHandlers}
      style={[styles.sheet, { height: sheet.expandedHeight, transform: [{ translateY }] }]}
    >
      <View style={styles.solidFill} />
      <View style={styles.handle} />
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={view === 'profile' ? styles.profileContent : view === 'dataMemory' ? styles.dataMemoryContent : styles.content}
        showsVerticalScrollIndicator={false}
        bounces={false}
        keyboardShouldPersistTaps="handled"
      >
        {view === 'profile' ? (
          <>
            <Text style={styles.title}>Profile</Text>
            <View style={styles.profileHeroCard}>
              <View style={styles.profileHeroAvatar}>
                <Text style={styles.profileHeroAvatarText}>{avatarInitial(localProfile.initials)}</Text>
              </View>
              <Text style={styles.profileHeroName} numberOfLines={1}>{localProfile.name}</Text>
              <Text style={styles.profileHeroEmail} numberOfLines={1}>{localProfile.email}</Text>
            </View>

            <View style={styles.profileFieldsCard}>
              <View style={[styles.profileFieldRow, styles.profileFieldBorder]}>
                <View style={styles.profileFieldTextWrap}>
                  <Text style={styles.profileFieldLabel}>Full name</Text>
                  <TextInput
                    value={draftName}
                    onChangeText={setDraftName}
                    placeholder="Your name"
                    placeholderTextColor="#a4a7af"
                    autoCapitalize="words"
                    autoCorrect={false}
                    returnKeyType="done"
                    style={styles.profileFieldInput}
                  />
                </View>
                <Ionicons name="pencil-outline" size={editIconSize} color="#858891" />
              </View>
              <View style={[styles.profileFieldRow, styles.profileFieldBorder]}>
                <View style={styles.profileFieldTextWrap}>
                  <Text style={styles.profileFieldLabel}>Email</Text>
                  <Text style={styles.profileFieldLockedValue} numberOfLines={1}>{localProfile.email}</Text>
                </View>
                <Ionicons name="lock-closed-outline" size={21} color="#858891" />
              </View>
              <View style={styles.profileFieldRow}>
                <View style={styles.profileFieldTextWrap}>
                  <Text style={styles.profileFieldLabel}>Username</Text>
                  <Text style={styles.profileFieldValue} numberOfLines={1}>{usernameFromEmail(localProfile.email)}</Text>
                </View>
                <Ionicons name="pencil-outline" size={editIconSize} color="#858891" />
              </View>
            </View>

            <View style={styles.aboutCard}>
              <View style={styles.profileFieldTextWrap}>
                <Text style={styles.profileFieldLabel}>About</Text>
                <Text style={styles.aboutPlaceholder}>Tell others a little bit about yourself.</Text>
              </View>
              <Ionicons name="pencil-outline" size={editIconSize} color="#858891" />
            </View>

            <Pressable
              onPress={saveProfile}
              disabled={savingProfile || draftName.trim().length === 0}
              style={({ pressed }) => [styles.saveButton, pressed && styles.pressed, (savingProfile || draftName.trim().length === 0) && styles.disabled]}
            >
              <Text style={styles.saveButtonText}>{savingProfile ? 'Saving…' : 'Save changes'}</Text>
            </Pressable>
            <Pressable onPress={() => setView('account')} style={({ pressed }) => [styles.backButton, pressed && styles.pressed]}>
              <Text style={styles.backButtonText}>Back</Text>
            </Pressable>
          </>
        ) : view === 'dataMemory' ? (
          <>
            <Text style={styles.dataTitle}>Data & Memory</Text>

            <View style={styles.memorySummaryCard}>
              <View style={styles.memorySummaryIcon}>
                <Ionicons name="server-outline" size={43} color="#858891" />
              </View>
              <View style={styles.memorySummaryTextWrap}>
                <Text style={styles.memorySummaryTitle}>Memory is on</Text>
                <Text style={styles.memorySummaryLine}>12 saved memories</Text>
                <Text style={styles.memorySummaryLine}>Last updated today</Text>
                <Text style={styles.memorySummarySmall}>Auren uses memory to personalize responses.</Text>
              </View>
            </View>

            <View style={styles.dataGroupCard}>
              {DATA_MEMORY_MAIN_ROWS.map((row, index) => (
                <DataMemoryRow key={row.id} row={row} last={index === DATA_MEMORY_MAIN_ROWS.length - 1} />
              ))}
            </View>

            <View style={styles.storageCard}>
              <View style={styles.storageTopRow}>
                <Text style={styles.storageTitle}>Storage used</Text>
                <Text style={styles.storageValue}>128 MB</Text>
              </View>
              <View style={styles.storageTrack}>
                <View style={styles.storageFill} />
              </View>
              <View style={styles.storageBottomRow}>
                <Text style={styles.storageMeta}>128 MB of 5 GB used</Text>
                <Text style={styles.storageMeta}>2%</Text>
              </View>
            </View>

            <View style={styles.dataPrivacyCard}>
              {DATA_MEMORY_PRIVACY_ROWS.map((row, index) => (
                <DataMemoryRow key={row.id} row={row} last={index === DATA_MEMORY_PRIVACY_ROWS.length - 1} />
              ))}
            </View>

            <Pressable style={({ pressed }) => [styles.saveButton, styles.dataSaveButton, pressed && styles.pressed]}>
              <Text style={styles.saveButtonText}>Save changes</Text>
            </Pressable>
            <Pressable onPress={() => setView('account')} style={({ pressed }) => [styles.backButton, styles.dataBackButton, pressed && styles.pressed]}>
              <Text style={styles.backButtonText}>Back</Text>
            </Pressable>
          </>
        ) : (
          <>
            <Text style={styles.title}>Account</Text>
            <Pressable onPress={openProfile} style={({ pressed }) => [styles.profileCard, pressed && styles.pressed]}>
              <View style={styles.largeAvatar}>
                <Text style={styles.largeAvatarText}>{avatarInitial(localProfile.initials)}</Text>
              </View>
              <View style={styles.profileTextWrap}>
                <Text style={styles.profileName} numberOfLines={1}>{localProfile.name}</Text>
                <Text style={styles.profileEmail} numberOfLines={1}>{localProfile.email}</Text>
              </View>
              <Ionicons name="chevron-forward" size={27} color="#a7a9b0" />
            </Pressable>
            <View style={styles.groupCard}>
              {MAIN_ROWS.map((row, index) => (
                <AccountListRow key={row.id} row={row} last={index === MAIN_ROWS.length - 1} onPress={() => handleRowPress(row)} />
              ))}
            </View>
            {SECONDARY_ROWS.map((row) => (
              <View key={row.id} style={styles.singleCard}>
                <AccountListRow row={row} last disabled={row.id === 'sign-out' && signingOut} onPress={() => handleRowPress(row)} />
              </View>
            ))}
          </>
        )}
      </ScrollView>
    </Animated.View>
  );
}

const baseCardShadow = {
  shadowColor: '#111827',
  shadowOpacity: 0.032,
  shadowRadius: 14,
  shadowOffset: { width: 0, height: 8 },
  elevation: 4,
};

const cardBase = {
  backgroundColor: 'rgba(255,255,255,0.82)',
  borderWidth: 1,
  borderColor: 'rgba(17,24,39,0.045)',
  ...baseCardShadow,
};

const styles = StyleSheet.create({
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 40,
    elevation: 40,
    borderTopLeftRadius: 38,
    borderTopRightRadius: 38,
    backgroundColor: '#fbfbfa',
    borderWidth: 1,
    borderColor: 'rgba(17,24,39,0.04)',
    overflow: 'hidden',
    ...shadows.soft,
  },
  solidFill: { ...StyleSheet.absoluteFillObject, backgroundColor: '#fbfbfa' },
  handle: {
    alignSelf: 'center',
    width: 48,
    height: 5,
    borderRadius: 999,
    marginTop: 18,
    backgroundColor: 'rgba(110,113,124,0.28)',
  },
  scrollView: { flex: 1 },
  content: { paddingHorizontal: 23, paddingTop: 31, paddingBottom: 44 },
  profileContent: { paddingHorizontal: 24, paddingTop: 12, paddingBottom: 26 },
  dataMemoryContent: { paddingHorizontal: 24, paddingTop: 12, paddingBottom: 26 },
  title: {
    color: '#1d1d20',
    fontSize: 19,
    lineHeight: 25,
    fontWeight: '620',
    letterSpacing: -0.22,
    textAlign: 'center',
    marginBottom: 31,
  },
  profileCard: {
    minHeight: 98,
    borderRadius: 20,
    paddingHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'center',
    ...cardBase,
  },
  largeAvatar: {
    width: 80,
    height: 80,
    borderRadius: 999,
    marginRight: 19,
    backgroundColor: '#eeedf2',
    alignItems: 'center',
    justifyContent: 'center',
  },
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
  profileHeroCard: {
    minHeight: 164,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    paddingVertical: 18,
    ...cardBase,
  },
  profileHeroAvatar: {
    width: 76,
    height: 76,
    borderRadius: 999,
    backgroundColor: '#eeedf2',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
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
  saveButton: {
    height: 56,
    marginTop: 28,
    borderRadius: 14,
    backgroundColor: '#111113',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000000',
    shadowOpacity: 0.15,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 8 },
    elevation: 7,
  },
  saveButtonText: { color: '#ffffff', fontSize: 17, lineHeight: 22, fontWeight: '520', letterSpacing: -0.2 },
  backButton: {
    height: 56,
    marginTop: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(17,24,39,0.08)',
    backgroundColor: 'rgba(255,255,255,0.7)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  backButtonText: { color: '#777b84', fontSize: 17, lineHeight: 22, fontWeight: '500', letterSpacing: -0.2 },
  dataTitle: {
    color: '#1d1d20',
    fontSize: 19,
    lineHeight: 25,
    fontWeight: '620',
    letterSpacing: -0.22,
    textAlign: 'center',
    marginBottom: 31,
  },
  memorySummaryCard: {
    minHeight: 122,
    borderRadius: 18,
    paddingHorizontal: 22,
    paddingVertical: 18,
    flexDirection: 'row',
    alignItems: 'center',
    ...cardBase,
  },
  memorySummaryIcon: {
    width: 76,
    height: 76,
    borderRadius: 999,
    marginRight: 20,
    backgroundColor: '#eeedf2',
    alignItems: 'center',
    justifyContent: 'center',
  },
  memorySummaryTextWrap: { flex: 1, minWidth: 0 },
  memorySummaryTitle: { color: '#1d1d20', fontSize: 21, lineHeight: 26, fontWeight: '520', letterSpacing: -0.36 },
  memorySummaryLine: { color: '#777b84', fontSize: 14.5, lineHeight: 20, fontWeight: '440', letterSpacing: -0.12 },
  memorySummarySmall: { marginTop: 7, color: '#777b84', fontSize: 12.5, lineHeight: 17, fontWeight: '430', letterSpacing: -0.06 },
  dataGroupCard: { marginTop: 25, borderRadius: 18, overflow: 'hidden', ...cardBase },
  dataPrivacyCard: { marginTop: 25, borderRadius: 18, overflow: 'hidden', ...cardBase },
  dataRow: { minHeight: 61, paddingHorizontal: 25, flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.82)' },
  dataRowIconWrap: { width: 42, marginRight: 18, alignItems: 'flex-start', justifyContent: 'center' },
  dataRowLabel: { flex: 1, color: '#1f2228', fontSize: 16, lineHeight: 21, fontWeight: '450', letterSpacing: -0.17 },
  storageCard: { minHeight: 105, marginTop: 24, borderRadius: 18, paddingHorizontal: 20, paddingVertical: 17, ...cardBase },
  storageTopRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  storageTitle: { color: '#1f2228', fontSize: 15.5, lineHeight: 20, fontWeight: '500', letterSpacing: -0.16 },
  storageValue: { color: '#777b84', fontSize: 15.5, lineHeight: 20, fontWeight: '500', letterSpacing: -0.16 },
  storageTrack: { height: 8, borderRadius: 999, marginTop: 20, backgroundColor: '#e4e1ea', overflow: 'hidden' },
  storageFill: { width: '4%', height: '100%', borderRadius: 999, backgroundColor: '#858891' },
  storageBottomRow: { marginTop: 17, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  storageMeta: { color: '#777b84', fontSize: 13.5, lineHeight: 18, fontWeight: '440', letterSpacing: -0.08 },
  dataSaveButton: { marginTop: 25 },
  dataBackButton: { marginTop: 14 },
  pressed: { opacity: 0.68, transform: [{ scale: 0.993 }] },
  disabled: { opacity: 0.55 },
});
