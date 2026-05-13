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
import { colors, shadows } from '../theme';

type RecentChat = {
  id: string;
  title: string;
  time: string;
  icon: keyof typeof Ionicons.glyphMap;
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
};

const DRAWER_WIDTH_RATIO = 0.82;
const DRAWER_MIN_WIDTH = 315;
const DRAWER_MAX_WIDTH = 620;
const SWIPE_DISTANCE = 42;
const SWIPE_EDGE_WIDTH = 96;
const EDGE_SWIPE_TOP_OFFSET = 112;
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
  onViewAll,
  onOpenProfile,
  onOpenRecentChat,
  recentChats = DEFAULT_RECENT_CHATS,
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
                <View style={styles.recentIconBox}>
                  <Ionicons name={chat.icon} size={22} color="#6f7079" />
                </View>

                <Text style={styles.recentTitle} numberOfLines={1}>
                  {chat.title}
                </Text>

                <Text style={styles.recentTime} numberOfLines={1}>
                  {chat.time}
                </Text>
              </Pressable>
            ))}
          </View>

          <Pressable onPress={onViewAll} style={({ pressed }) => [styles.viewAllRow, pressed && styles.pressed]}>
            <Text style={styles.viewAllText}>View all</Text>
            <Ionicons name="chevron-forward" size={22} color="#8d8f98" />
          </Pressable>

          <View style={styles.divider} />

          <Pressable onPress={onOpenProfile} style={({ pressed }) => [styles.profileRow, pressed && styles.pressed]}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>AB</Text>
            </View>

            <View style={styles.profileTextWrap}>
              <Text style={styles.profileName} numberOfLines={1}>Auren Bayu</Text>
              <Text style={styles.profileEmail} numberOfLines={1}>auren.bayu@example.com</Text>
            </View>

            <Ionicons name="chevron-forward" size={22} color="#8d8f98" />
          </Pressable>

          <Pressable onPress={onNewChat} style={({ pressed }) => [styles.newChatButton, pressed && styles.pressed]}>
            <View style={styles.newChatIconCircle}>
              <Ionicons name="add" size={30} color="#111113" />
            </View>
            <Text style={styles.newChatText}>New chat</Text>
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
    bottom: 0,
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
    paddingTop: 92,
    paddingHorizontal: 28,
    paddingBottom: 34,
  },
  brand: {
    color: colors.text,
    fontFamily: 'Georgia',
    fontSize: 42,
    lineHeight: 49,
    letterSpacing: -1.25,
  },
  emptyTopSpace: {
    height: 164,
  },
  divider: {
    height: 1,
    width: '100%',
    backgroundColor: 'rgba(17,24,39,0.07)',
  },
  recentHeaderRow: {
    marginTop: 34,
    marginBottom: 18,
  },
  sectionTitle: {
    color: '#686b75',
    fontSize: 15,
    fontWeight: '600',
    letterSpacing: -0.1,
  },
  recentList: {
    gap: 18,
  },
  recentRow: {
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  pressed: {
    opacity: 0.68,
    transform: [{ scale: 0.992 }],
  },
  recentIconBox: {
    width: 44,
    height: 44,
    borderRadius: 13,
    borderWidth: 1,
    borderColor: 'rgba(17,24,39,0.055)',
    backgroundColor: 'rgba(255,255,255,0.58)',
    alignItems: 'center',
    justifyContent: 'center',
    ...shadows.tiny,
  },
  recentTitle: {
    flex: 1,
    color: '#555866',
    fontSize: 16.5,
    fontWeight: '500',
    letterSpacing: -0.22,
  },
  recentTime: {
    width: 78,
    color: '#888b95',
    fontSize: 14.5,
    textAlign: 'right',
    letterSpacing: -0.08,
  },
  viewAllRow: {
    marginTop: 28,
    marginBottom: 32,
    minHeight: 36,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  viewAllText: {
    color: '#3f414b',
    fontSize: 18,
    letterSpacing: -0.3,
  },
  profileRow: {
    marginTop: 25,
    minHeight: 58,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  avatar: {
    width: 46,
    height: 46,
    borderRadius: 999,
    backgroundColor: '#ececef',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    color: '#62646e',
    fontSize: 16,
    fontWeight: '600',
    letterSpacing: -0.2,
  },
  profileTextWrap: {
    flex: 1,
  },
  profileName: {
    color: '#4d505b',
    fontSize: 17,
    fontWeight: '600',
    letterSpacing: -0.24,
  },
  profileEmail: {
    marginTop: 3,
    color: '#8b8e99',
    fontSize: 13.5,
    letterSpacing: -0.08,
  },
  newChatButton: {
    marginTop: 'auto',
    height: 64,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(17,24,39,0.065)',
    backgroundColor: 'rgba(255,255,255,0.72)',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    gap: 14,
    ...shadows.tiny,
  },
  newChatIconCircle: {
    width: 44,
    height: 44,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(17,24,39,0.055)',
    backgroundColor: 'rgba(255,255,255,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  newChatText: {
    color: '#4f515b',
    fontSize: 18,
    fontWeight: '500',
    letterSpacing: -0.24,
  },
});
