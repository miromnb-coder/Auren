import Ionicons from '@expo/vector-icons/Ionicons';
import { useEffect, useMemo, useRef } from 'react';
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
import { shadows } from '../theme';

export type AccountSheetStage = 'closed' | 'peek' | 'expanded';

type AccountSheetProfile = {
  name: string;
  email: string;
  initials: string;
};

type AurenAccountSheetProps = {
  stage: AccountSheetStage;
  onStageChange: (stage: AccountSheetStage) => void;
  profile?: AccountSheetProfile;
};

type AccountRow = {
  id: string;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  danger?: boolean;
};

const PEEK_HEIGHT_RATIO = 0.54;
const EXPANDED_HEIGHT_RATIO = 0.92;
const PEEK_MIN_HEIGHT = 390;
const PEEK_MAX_HEIGHT = 520;
const EXPANDED_MIN_HEIGHT = 690;
const DRAG_THRESHOLD = 72;
const FAST_SWIPE_VELOCITY = 0.85;

const DEFAULT_PROFILE: AccountSheetProfile = {
  name: 'Auren user',
  email: '',
  initials: 'AU',
};

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

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function getAvatarInitial(initials: string) {
  const cleanInitials = initials.trim();
  return cleanInitials.charAt(0).toUpperCase() || 'A';
}

function AccountListRow({ row, last = false }: { row: AccountRow; last?: boolean }) {
  return (
    <Pressable style={({ pressed }) => [styles.row, !last && styles.rowBorder, pressed && styles.pressed]}>
      <View style={styles.rowIconWrap}>
        <Ionicons name={row.icon} size={24} color={row.danger ? '#d4474b' : '#858891'} />
      </View>
      <Text style={[styles.rowLabel, row.danger && styles.dangerText]}>{row.label}</Text>
      <Ionicons name="chevron-forward" size={23} color="#a7a9b0" />
    </Pressable>
  );
}

export function AurenAccountSheet({ stage, onStageChange, profile = DEFAULT_PROFILE }: AurenAccountSheetProps) {
  const { height } = useWindowDimensions();

  const { closedY, expandedHeight, expandedY, peekY } = useMemo(() => {
    const nextExpandedHeight = Math.min(
      Math.max(height * EXPANDED_HEIGHT_RATIO, EXPANDED_MIN_HEIGHT),
      height,
    );
    const nextPeekHeight = Math.min(
      Math.max(height * PEEK_HEIGHT_RATIO, PEEK_MIN_HEIGHT),
      Math.min(PEEK_MAX_HEIGHT, nextExpandedHeight - 80),
    );

    return {
      expandedHeight: nextExpandedHeight,
      expandedY: 0,
      peekY: nextExpandedHeight - nextPeekHeight,
      closedY: nextExpandedHeight + 28,
    };
  }, [height]);

  const translateY = useRef(new Animated.Value(stage === 'closed' ? closedY : stage === 'expanded' ? expandedY : peekY)).current;
  const currentY = useRef(stage === 'closed' ? closedY : stage === 'expanded' ? expandedY : peekY);
  const dragStartY = useRef(currentY.current);

  function getTargetY(nextStage: AccountSheetStage) {
    if (nextStage === 'expanded') return expandedY;
    if (nextStage === 'peek') return peekY;
    return closedY;
  }

  function animateToStage(nextStage: AccountSheetStage) {
    const targetY = getTargetY(nextStage);
    currentY.current = targetY;

    Animated.timing(translateY, {
      toValue: targetY,
      duration: nextStage === 'closed' ? 250 : 320,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }

  useEffect(() => {
    animateToStage(stage);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stage, closedY, expandedY, peekY]);

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
          const nextY = clamp(dragStartY.current + gestureState.dy, expandedY, closedY);
          currentY.current = nextY;
          translateY.setValue(nextY);
        },
        onPanResponderRelease: (_event, gestureState) => {
          const draggedUp = gestureState.dy < -DRAG_THRESHOLD || gestureState.vy < -FAST_SWIPE_VELOCITY;
          const draggedDown = gestureState.dy > DRAG_THRESHOLD || gestureState.vy > FAST_SWIPE_VELOCITY;

          if (stage === 'peek') {
            if (draggedUp) {
              onStageChange('expanded');
              return;
            }

            if (draggedDown) {
              onStageChange('closed');
              return;
            }

            onStageChange('peek');
            return;
          }

          if (stage === 'expanded') {
            if (draggedDown) {
              onStageChange('peek');
              return;
            }

            onStageChange('expanded');
          }
        },
        onPanResponderTerminate: () => {
          onStageChange(stage === 'expanded' ? 'expanded' : stage === 'peek' ? 'peek' : 'closed');
        },
      }),
    [closedY, expandedY, onStageChange, stage, translateY],
  );

  return (
    <Animated.View
      pointerEvents={stage === 'closed' ? 'none' : 'auto'}
      {...panResponder.panHandlers}
      style={[
        styles.sheet,
        {
          height: expandedHeight,
          transform: [{ translateY }],
        },
      ]}
    >
      <View style={styles.solidFill} />
      <View style={styles.handle} />
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        bounces={false}
      >
        <Text style={styles.title}>Account</Text>

        <Pressable style={({ pressed }) => [styles.profileCard, pressed && styles.pressed]}>
          <View style={styles.largeAvatar}>
            <Text style={styles.largeAvatarText}>{getAvatarInitial(profile.initials)}</Text>
          </View>
          <View style={styles.profileTextWrap}>
            <Text style={styles.profileName} numberOfLines={1}>{profile.name}</Text>
            <Text style={styles.profileEmail} numberOfLines={1}>{profile.email}</Text>
          </View>
          <Ionicons name="chevron-forward" size={27} color="#a7a9b0" />
        </Pressable>

        <View style={styles.groupCard}>
          {MAIN_ROWS.map((row, index) => (
            <AccountListRow key={row.id} row={row} last={index === MAIN_ROWS.length - 1} />
          ))}
        </View>

        {SECONDARY_ROWS.map((row) => (
          <View key={row.id} style={styles.singleCard}>
            <AccountListRow row={row} last />
          </View>
        ))}
      </ScrollView>
    </Animated.View>
  );
}

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
  solidFill: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#fbfbfa',
  },
  handle: {
    alignSelf: 'center',
    width: 48,
    height: 5,
    borderRadius: 999,
    marginTop: 18,
    backgroundColor: 'rgba(110,113,124,0.28)',
  },
  scrollView: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 23,
    paddingTop: 31,
    paddingBottom: 44,
  },
  title: {
    color: '#1d1d20',
    fontSize: 19,
    lineHeight: 25,
    fontWeight: '620',
    letterSpacing: -0.22,
    textAlign: 'center',
    marginBottom: 39,
  },
  profileCard: {
    minHeight: 98,
    borderRadius: 20,
    paddingHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.78)',
    borderWidth: 1,
    borderColor: 'rgba(17,24,39,0.045)',
    shadowColor: '#111827',
    shadowOpacity: 0.045,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
    elevation: 5,
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
  largeAvatarText: {
    color: '#111113',
    fontSize: 39,
    lineHeight: 44,
    fontWeight: '430',
    letterSpacing: -1.2,
  },
  profileTextWrap: {
    flex: 1,
    minWidth: 0,
  },
  profileName: {
    color: '#1d1d20',
    fontSize: 22,
    lineHeight: 27,
    fontWeight: '650',
    letterSpacing: -0.45,
  },
  profileEmail: {
    marginTop: 2,
    color: '#7f838c',
    fontSize: 14.5,
    lineHeight: 19,
    fontWeight: '440',
    letterSpacing: -0.12,
  },
  groupCard: {
    marginTop: 27,
    borderRadius: 18,
    overflow: 'hidden',
    backgroundColor: 'rgba(255,255,255,0.82)',
    borderWidth: 1,
    borderColor: 'rgba(17,24,39,0.045)',
    shadowColor: '#111827',
    shadowOpacity: 0.035,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 8 },
    elevation: 4,
  },
  singleCard: {
    marginTop: 22,
    borderRadius: 18,
    overflow: 'hidden',
    backgroundColor: 'rgba(255,255,255,0.82)',
    borderWidth: 1,
    borderColor: 'rgba(17,24,39,0.045)',
    shadowColor: '#111827',
    shadowOpacity: 0.035,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 8 },
    elevation: 4,
  },
  row: {
    minHeight: 67,
    paddingHorizontal: 22,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.82)',
  },
  rowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(17,24,39,0.07)',
  },
  rowIconWrap: {
    width: 39,
    marginRight: 15,
    alignItems: 'flex-start',
    justifyContent: 'center',
  },
  rowLabel: {
    flex: 1,
    color: '#1f2228',
    fontSize: 16,
    lineHeight: 21,
    fontWeight: '450',
    letterSpacing: -0.17,
  },
  dangerText: {
    color: '#d4474b',
  },
  pressed: {
    opacity: 0.68,
    transform: [{ scale: 0.993 }],
  },
});
