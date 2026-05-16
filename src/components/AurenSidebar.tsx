import Ionicons from '@expo/vector-icons/Ionicons';
import type { ReactNode } from 'react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  PanResponder,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { PanGestureHandler, State, type PanGestureHandlerStateChangeEvent } from 'react-native-gesture-handler';
import { AurenAccountSheet, type AccountSheetStage } from './AurenAccountSheet';
import { AurenActivityScreen } from './AurenActivityScreen';
import { addAurenNotificationResponseListener, registerForAurenPushNotifications } from '../lib/aurenPushNotifications';
import { supabase } from '../lib/supabase';
import { colors } from '../theme';

type RecentChat = {
  id: string;
  title: string;
  time: string;
  icon: keyof typeof Ionicons.glyphMap;
};

type SidebarProfile = {
  name: string;
  email: string;
  initials: string;
};

type AurenSidebarProps = {
  open: boolean;
  children: ReactNode;
  onOpen?: () => void;
  onClose?: () => void;
  onNewChat?: () => void;
  onViewAll?: () => void;
  onOpenProfile?: () => void;
  onOpenActivity?: () => void;
  onOpenRecentChat?: (chatId: string) => void;
  recentChats?: RecentChat[];
  profile?: SidebarProfile;
};

const DRAWER_WIDTH_RATIO = 0.82;
const DRAWER_MIN_WIDTH = 315;
const DRAWER_MAX_WIDTH = 620;
const SWIPE_DISTANCE = 42;
const SWIPE_EDGE_WIDTH = 96;
const SWIPE_START_DISTANCE = 10;
const EDGE_SWIPE_TOP_OFFSET = 112;
const EDGE_SWIPE_BOTTOM_OFFSET = 178;
const HORIZONTAL_LOCK_RATIO = 1.25;
const OPEN_EDGE_VERTICAL_FAIL_OFFSET = 14;

const DEFAULT_RECENT_CHATS: RecentChat[] = [
  {
    id: 'project-proposal',
    title: 'Finish project proposal',
    time: '18:45',
    icon: 'locate-outline',
  },
  {
    id: 'weekly-planning',
    title: 'Weekly planning',
    time: '16:20',
    icon: 'book-outline',
  },
  {
    id: 'study-plan',
    title: 'Study plan for exams',
    time: 'Yesterday',
    icon: 'sparkles-outline',
  },
];

const DEFAULT_PROFILE: SidebarProfile = {
  name: 'Auren user',
  email: '',
  initials: 'AU',
};

function isHorizontalGesture(dx: number, dy: number) {
  const horizontalDistance = Math.abs(dx);
  const verticalDistance = Math.abs(dy);
  return horizontalDistance > 10 && horizontalDistance > verticalDistance * HORIZONTAL_LOCK_RATIO;
}

export function AurenSidebar({
  open,
  children,
  onOpen,
  onClose,
  onNewChat,
  onViewAll: _onViewAll,
  onOpenProfile,
  onOpenActivity,
  onOpenRecentChat,
  recentChats = DEFAULT_RECENT_CHATS,
  profile = DEFAULT_PROFILE,
}: AurenSidebarProps) {
  const { width } = useWindowDimensions();
  const [accountSheetStage, setAccountSheetStage] = useState<AccountSheetStage>('closed');
  const [activityOpen, setActivityOpen] = useState(false);
  const [activityUnreadCount, setActivityUnreadCount] = useState(0);
  const [currentProfile, setCurrentProfile] = useState<SidebarProfile>(profile);
  const accountSheetOpen = accountSheetStage !== 'closed';
  const drawerWidth = useMemo(() => {
    const measuredWidth = width * DRAWER_WIDTH_RATIO;
    return Math.min(Math.max(measuredWidth, DRAWER_MIN_WIDTH), Math.min(DRAWER_MAX_WIDTH, width - 72));
  }, [width]);

  const progress = useRef(new Animated.Value(open ? 1 : 0)).current;

  const refreshUnreadCount = useCallback(async () => {
    try {
      const { data: userData, error: userError } = await supabase.auth.getUser();
      if (userError) throw userError;
      const userId = userData.user?.id;
      if (!userId) {
        setActivityUnreadCount(0);
        return;
      }

      const { count, error } = await supabase
        .from('activity_items')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', userId)
        .is('read_at', null)
        .is('archived_at', null);

      if (error) throw error;
      setActivityUnreadCount(count ?? 0);
    } catch {
      setActivityUnreadCount(0);
    }
  }, []);

  const openActivityScreen = useCallback(() => {
    setActivityOpen(true);
    onOpenActivity?.();
    onClose?.();
    void registerForAurenPushNotifications();
  }, [onClose, onOpenActivity]);

  useEffect(() => {
    Animated.timing(progress, {
      toValue: open ? 1 : 0,
      duration: open ? 310 : 260,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [open, progress]);

  useEffect(() => {
    setCurrentProfile(profile);
  }, [profile.email, profile.initials, profile.name]);

  useEffect(() => {
    void refreshUnreadCount();
  }, [refreshUnreadCount]);

  useEffect(() => {
    const subscription = addAurenNotificationResponseListener(openActivityScreen);
    return () => subscription.remove();
  }, [openActivityScreen]);

  useEffect(() => {
    if (open || activityOpen) {
      void refreshUnreadCount();
    }
  }, [activityOpen, open, refreshUnreadCount]);

  const closeSwipeResponder = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_event, gestureState) => {
          if (!open) return false;
          return isHorizontalGesture(gestureState.dx, gestureState.dy) && gestureState.dx < -8;
        },
        onMoveShouldSetPanResponderCapture: (_event, gestureState) => {
          if (!open) return false;
          return isHorizontalGesture(gestureState.dx, gestureState.dy) && gestureState.dx < -8;
        },
        onPanResponderRelease: (_event, gestureState) => {
          if (gestureState.dx < -SWIPE_DISTANCE) {
            onClose?.();
          }
        },
        onPanResponderTerminate: (_event, gestureState) => {
          if (gestureState.dx < -SWIPE_DISTANCE) {
            onClose?.();
          }
        },
      }),
    [onClose, open],
  );

  const drawerTranslateX = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [-drawerWidth, 0],
  });

  const mainTranslateX = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [0, drawerWidth],
  });

  const openSwipeHitSlop = useMemo(
    () => ({
      left: 0,
      top: EDGE_SWIPE_TOP_OFFSET,
      bottom: EDGE_SWIPE_BOTTOM_OFFSET,
      width: SWIPE_EDGE_WIDTH,
    }),
    [],
  );

  function handleOpenSwipeStateChange(event: PanGestureHandlerStateChangeEvent) {
    if (open || activityOpen) return;

    const { state, translationX, translationY } = event.nativeEvent;
    const gestureFinished = state === State.END || state === State.CANCELLED || state === State.FAILED;

    if (!gestureFinished) return;

    if (translationX > SWIPE_DISTANCE && isHorizontalGesture(translationX, translationY)) {
      onOpen?.();
    }
  }

  function openAccountSheet() {
    setAccountSheetStage('expanded');
    onOpenProfile?.();
  }

  function closeActivityScreen() {
    setActivityOpen(false);
    void refreshUnreadCount();
  }

  return (
    <View style={styles.root}>
      <PanGestureHandler
        enabled={!open && !activityOpen}
        activeOffsetX={SWIPE_START_DISTANCE}
        failOffsetY={[-OPEN_EDGE_VERTICAL_FAIL_OFFSET, OPEN_EDGE_VERTICAL_FAIL_OFFSET]}
        hitSlop={openSwipeHitSlop}
        onHandlerStateChange={handleOpenSwipeStateChange}
      >
        <Animated.View
          collapsable={false}
          style={[
            styles.mainScreen,
            {
              transform: [{ translateX: mainTranslateX }],
            },
          ]}
        >
          {children}
        </Animated.View>
      </PanGestureHandler>

      {open ? (
        <Pressable style={styles.peekCloseArea} onPress={onClose} {...closeSwipeResponder.panHandlers} />
      ) : null}

      <Animated.View
        pointerEvents={open ? 'auto' : 'none'}
        {...closeSwipeResponder.panHandlers}
        style={[
          styles.drawer,
          {
            width: drawerWidth,
            transform: [{ translateX: drawerTranslateX }],
          },
        ]}
      >
        <View style={styles.drawerInner}>
          <View style={styles.drawerHeader}>
            <Text style={styles.brand}>Auren</Text>
            <Pressable
              onPress={openActivityScreen}
              hitSlop={16}
              style={({ pressed }) => [styles.activityButton, pressed && styles.pressed]}
              accessibilityRole="button"
              accessibilityLabel="Open activity"
            >
              <Ionicons name="notifications-outline" size={24} color="#343743" />
              {activityUnreadCount > 0 ? (
                <View style={styles.unreadBadge}>
                  <Text style={styles.unreadBadgeText}>{activityUnreadCount > 99 ? '99+' : activityUnreadCount}</Text>
                </View>
              ) : null}
            </Pressable>
          </View>

          <ScrollView
            style={styles.scrollArea}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
            bounces
          >
            <View style={styles.emptyTopSpace} />

            <View style={styles.recentHeaderRow}>
              <Text style={styles.sectionTitle}>Recent chats</Text>
            </View>

            <View style={styles.recentList}>
              {recentChats.map((chat) => (
                <Pressable
                  key={chat.id}
                  onPress={() => onOpenRecentChat?.(chat.id)}
                  style={({ pressed }) => [styles.recentRow, pressed && styles.pressed]}
                >
                  <Text style={styles.recentTitle} numberOfLines={1}>
                    {chat.title}
                  </Text>
                </Pressable>
              ))}
            </View>
          </ScrollView>

          <View style={styles.bottomArea}>
            <Pressable onPress={openAccountSheet} style={({ pressed }) => [styles.profileRow, pressed && styles.pressed]}>
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>{currentProfile.initials}</Text>
              </View>

              <View style={styles.profileTextWrap}>
                <Text style={styles.profileName} numberOfLines={1}>{currentProfile.name}</Text>
                <Text style={styles.profileEmail} numberOfLines={1}>{currentProfile.email}</Text>
              </View>

              <Ionicons name="chevron-forward" size={16} color="#8d8f98" />
            </Pressable>

            <Pressable onPress={onNewChat} style={({ pressed }) => [styles.newChatButton, pressed && styles.pressed]}>
              <Ionicons name="create-outline" size={30} color="#ffffff" />
            </Pressable>
          </View>
        </View>
      </Animated.View>

      {accountSheetOpen ? (
        <Pressable style={styles.accountSheetBackdrop} onPress={() => setAccountSheetStage('closed')} />
      ) : null}
      <AurenAccountSheet
        stage={accountSheetStage}
        onStageChange={setAccountSheetStage}
        profile={currentProfile}
        onProfileUpdated={setCurrentProfile}
      />

      {activityOpen ? <AurenActivityScreen onClose={closeActivityScreen} onUnreadCountChange={setActivityUnreadCount} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    overflow: 'hidden',
    backgroundColor: colors.background,
  },
  mainScreen: {
    ...StyleSheet.absoluteFillObject,
  },
  peekCloseArea: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    width: 92,
    zIndex: 15,
  },
  drawer: {
    position: 'absolute',
    top: 0,
    left: 0,
    bottom: 0,
    zIndex: 20,
    overflow: 'hidden',
    borderTopRightRadius: 30,
    borderBottomRightRadius: 30,
    backgroundColor: '#f7f7f5',
    shadowColor: '#111827',
    shadowOpacity: 0.12,
    shadowRadius: 34,
    shadowOffset: { width: 20, height: 0 },
    elevation: 14,
  },
  drawerInner: {
    flex: 1,
    paddingTop: 72,
    paddingHorizontal: 28,
    paddingBottom: 42,
  },
  drawerHeader: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  brand: {
    color: colors.text,
    fontFamily: 'Georgia',
    fontSize: 30,
    lineHeight: 37,
    letterSpacing: -0.85,
  },
  activityButton: {
    width: 44,
    height: 44,
    marginRight: -6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  unreadBadge: {
    position: 'absolute',
    top: 5,
    right: 2,
    minWidth: 18,
    height: 18,
    borderRadius: 999,
    paddingHorizontal: 5,
    backgroundColor: '#111113',
    borderWidth: 2,
    borderColor: '#f7f7f5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  unreadBadgeText: {
    color: '#ffffff',
    fontSize: 9.5,
    lineHeight: 11,
    fontWeight: '700',
    letterSpacing: -0.05,
  },
  scrollArea: {
    flex: 1,
    marginTop: 0,
  },
  scrollContent: {
    paddingBottom: 24,
  },
  emptyTopSpace: {
    height: 300,
  },
  recentHeaderRow: {
    marginBottom: 25,
  },
  sectionTitle: {
    color: '#686b75',
    fontSize: 16,
    fontWeight: '520',
    letterSpacing: -0.16,
  },
  recentList: {
    gap: 36,
  },
  recentRow: {
    minHeight: 28,
    justifyContent: 'center',
  },
  pressed: {
    opacity: 0.68,
    transform: [{ scale: 0.992 }],
  },
  recentTitle: {
    color: '#555866',
    fontSize: 19,
    fontWeight: '500',
    letterSpacing: -0.28,
  },
  bottomArea: {
    minHeight: 76,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 16,
  },
  profileRow: {
    flex: 1,
    minWidth: 0,
    minHeight: 42,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  avatar: {
    width: 31,
    height: 31,
    borderRadius: 999,
    backgroundColor: '#ececef',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    color: '#62646e',
    fontSize: 12.5,
    fontWeight: '600',
    letterSpacing: -0.12,
  },
  profileTextWrap: {
    flex: 1,
    minWidth: 0,
  },
  profileName: {
    color: '#4d505b',
    fontSize: 13.5,
    lineHeight: 17,
    fontWeight: '600',
    letterSpacing: -0.18,
  },
  profileEmail: {
    marginTop: 1,
    color: '#8b8e99',
    fontSize: 10.5,
    lineHeight: 13,
    letterSpacing: -0.06,
  },
  newChatButton: {
    width: 58,
    height: 58,
    borderRadius: 15,
    backgroundColor: '#111113',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000000',
    shadowOpacity: 0.2,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
    elevation: 10,
  },
  accountSheetBackdrop: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 35,
    backgroundColor: 'rgba(5,5,7,0.08)',
  },
});
