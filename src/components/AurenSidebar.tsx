import Ionicons from '@expo/vector-icons/Ionicons';
import type { ReactNode } from 'react';
import { useEffect, useMemo, useRef } from 'react';
import {
  Animated,
  Easing,
  PanResponder,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
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
  onOpenRecentChat?: (chatId: string) => void;
  recentChats?: RecentChat[];
  profile?: SidebarProfile;
};

const DRAWER_WIDTH_RATIO = 0.82;
const DRAWER_MIN_WIDTH = 315;
const DRAWER_MAX_WIDTH = 620;
const SWIPE_DISTANCE = 42;
const SWIPE_EDGE_WIDTH = 96;
const EDGE_SWIPE_TOP_OFFSET = 112;
const EDGE_SWIPE_BOTTOM_OFFSET = 178;
const HORIZONTAL_LOCK_RATIO = 1.25;

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
  onOpenRecentChat,
  recentChats = DEFAULT_RECENT_CHATS,
  profile = DEFAULT_PROFILE,
}: AurenSidebarProps) {
  const { width } = useWindowDimensions();
  const drawerWidth = useMemo(() => {
    const measuredWidth = width * DRAWER_WIDTH_RATIO;
    return Math.min(Math.max(measuredWidth, DRAWER_MIN_WIDTH), Math.min(DRAWER_MAX_WIDTH, width - 72));
  }, [width]);

  const progress = useRef(new Animated.Value(open ? 1 : 0)).current;

  useEffect(() => {
    Animated.timing(progress, {
      toValue: open ? 1 : 0,
      duration: open ? 310 : 260,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [open, progress]);

  const openSwipeResponder = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_event, gestureState) => {
          if (open) return false;
          return isHorizontalGesture(gestureState.dx, gestureState.dy) && gestureState.dx > 8;
        },
        onMoveShouldSetPanResponderCapture: (_event, gestureState) => {
          if (open) return false;
          return isHorizontalGesture(gestureState.dx, gestureState.dy) && gestureState.dx > 8;
        },
        onPanResponderRelease: (_event, gestureState) => {
          if (gestureState.dx > SWIPE_DISTANCE) {
            onOpen?.();
          }
        },
        onPanResponderTerminate: (_event, gestureState) => {
          if (gestureState.dx > SWIPE_DISTANCE) {
            onOpen?.();
          }
        },
      }),
    [onOpen, open],
  );

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

  return (
    <View style={styles.root}>
      <Animated.View
        style={[
          styles.mainScreen,
          {
            transform: [{ translateX: mainTranslateX }],
          },
        ]}
      >
        {children}
      </Animated.View>

      {!open ? <View style={styles.edgeSwipeArea} {...openSwipeResponder.panHandlers} /> : null}

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
          <Text style={styles.brand}>Auren</Text>

          <View style={styles.emptyTopSpace} />

          <View style={styles.divider} />

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

          <View style={styles.recentDivider} />

          <Pressable onPress={onOpenProfile} style={({ pressed }) => [styles.profileRow, pressed && styles.pressed]}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{profile.initials}</Text>
            </View>

            <View style={styles.profileTextWrap}>
              <Text style={styles.profileName} numberOfLines={1}>{profile.name}</Text>
              <Text style={styles.profileEmail} numberOfLines={1}>{profile.email}</Text>
            </View>

            <Ionicons name="chevron-forward" size={26} color="#8d8f98" />
          </Pressable>

          <Pressable onPress={onNewChat} style={({ pressed }) => [styles.newChatButton, pressed && styles.pressed]}>
            <Ionicons name="create-outline" size={28} color="#ffffff" />
          </Pressable>
        </View>
      </Animated.View>
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
  edgeSwipeArea: {
    position: 'absolute',
    top: EDGE_SWIPE_TOP_OFFSET,
    left: 0,
    bottom: EDGE_SWIPE_BOTTOM_OFFSET,
    width: SWIPE_EDGE_WIDTH,
    zIndex: 30,
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
    paddingTop: 100,
    paddingHorizontal: 28,
    paddingBottom: 42,
  },
  brand: {
    color: colors.text,
    fontFamily: 'Georgia',
    fontSize: 30,
    lineHeight: 37,
    letterSpacing: -0.85,
  },
  emptyTopSpace: {
    height: 230,
  },
  divider: {
    height: 1,
    width: '100%',
    backgroundColor: 'rgba(17,24,39,0.07)',
  },
  recentHeaderRow: {
    marginTop: 38,
    marginBottom: 25,
  },
  sectionTitle: {
    color: '#686b75',
    fontSize: 16,
    fontWeight: '650',
    letterSpacing: -0.16,
  },
  recentList: {
    gap: 28,
  },
  recentRow: {
    minHeight: 30,
    justifyContent: 'center',
  },
  pressed: {
    opacity: 0.68,
    transform: [{ scale: 0.992 }],
  },
  recentTitle: {
    color: '#555866',
    fontSize: 19,
    fontWeight: '520',
    letterSpacing: -0.28,
  },
  recentDivider: {
    marginTop: 36,
    height: 1,
    width: '100%',
    backgroundColor: 'rgba(17,24,39,0.07)',
  },
  profileRow: {
    marginTop: 38,
    minHeight: 58,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: 999,
    backgroundColor: '#ececef',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    color: '#62646e',
    fontSize: 18,
    fontWeight: '600',
    letterSpacing: -0.2,
  },
  profileTextWrap: {
    flex: 1,
  },
  profileName: {
    color: '#4d505b',
    fontSize: 20,
    fontWeight: '650',
    letterSpacing: -0.32,
  },
  profileEmail: {
    marginTop: 2,
    color: '#8b8e99',
    fontSize: 15,
    letterSpacing: -0.12,
  },
  newChatButton: {
    marginTop: 'auto',
    alignSelf: 'flex-end',
    width: 52,
    height: 52,
    borderRadius: 13,
    backgroundColor: '#111113',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000000',
    shadowOpacity: 0.18,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 10 },
    elevation: 10,
  },
});
