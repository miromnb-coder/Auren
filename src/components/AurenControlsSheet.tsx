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

export type ControlsSheetStage = 'closed' | 'peek' | 'expanded';

type AurenControlsSheetProps = {
  stage: ControlsSheetStage;
  onStageChange: (stage: ControlsSheetStage) => void;
};

type SourceStatus = 'Connected' | 'Available' | 'Connect';
type IoniconName = keyof typeof Ionicons.glyphMap;

type ControlItem = {
  id: string;
  title: string;
  description: string;
  state: string;
  icon: IoniconName;
  active?: boolean;
};

type SourceItem = {
  id: string;
  name: string;
  description: string;
  status: SourceStatus;
  icon: IoniconName;
};

const PEEK_HEIGHT_RATIO = 0.54;
const EXPANDED_HEIGHT_RATIO = 0.92;
const PEEK_MIN_HEIGHT = 390;
const PEEK_MAX_HEIGHT = 520;
const EXPANDED_MIN_HEIGHT = 690;
const DRAG_THRESHOLD = 72;
const FAST_SWIPE_VELOCITY = 0.85;

const CONTROL_ITEMS: ControlItem[] = [
  {
    id: 'study-context',
    title: 'Study context',
    description: 'Use your focus, recent chats and study progress.',
    state: 'On',
    icon: 'school-outline',
    active: true,
  },
  {
    id: 'calendar-aware',
    title: 'Calendar aware',
    description: 'Let Auren notice exams, free time and deadlines.',
    state: 'On',
    icon: 'calendar-outline',
    active: true,
  },
  {
    id: 'web-search',
    title: 'Web search',
    description: 'Use current sources only when you ask for them.',
    state: 'Off',
    icon: 'search-outline',
  },
];

const SOURCE_ITEMS: SourceItem[] = [
  {
    id: 'google-calendar',
    name: 'Google Calendar',
    description: 'Exams, lessons and study sessions',
    status: 'Connected',
    icon: 'calendar-outline',
  },
  {
    id: 'google-drive',
    name: 'Google Drive',
    description: 'Notes, PDFs and assignments',
    status: 'Connected',
    icon: 'folder-open-outline',
  },
  {
    id: 'gmail',
    name: 'Gmail',
    description: 'School messages and deadlines',
    status: 'Connected',
    icon: 'mail-outline',
  },
  {
    id: 'notes',
    name: 'Notes',
    description: 'Quick notes and saved explanations',
    status: 'Available',
    icon: 'document-text-outline',
  },
];

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function statusStyle(status: SourceStatus) {
  if (status === 'Connected') return [styles.statusPill, styles.statusPillConnected];
  if (status === 'Available') return [styles.statusPill, styles.statusPillAvailable];
  return [styles.statusPill, styles.statusPillMuted];
}

function ControlRow({ item, last }: { item: ControlItem; last: boolean }) {
  return (
    <Pressable style={({ pressed }) => [styles.controlRow, !last && styles.rowBorder, pressed && styles.pressed]}>
      <View style={[styles.controlIconTile, item.active && styles.controlIconTileActive]}>
        <Ionicons name={item.icon} size={21} color={item.active ? '#111113' : '#777b84'} />
      </View>

      <View style={styles.rowTextWrap}>
        <Text style={styles.rowTitle}>{item.title}</Text>
        <Text style={styles.rowDescription} numberOfLines={2}>{item.description}</Text>
      </View>

      <View style={[styles.statePill, item.active && styles.statePillActive]}>
        <Text style={[styles.statePillText, item.active && styles.statePillTextActive]}>{item.state}</Text>
      </View>
    </Pressable>
  );
}

function SourceRow({ item, last }: { item: SourceItem; last: boolean }) {
  return (
    <Pressable style={({ pressed }) => [styles.sourceRow, !last && styles.rowBorder, pressed && styles.pressed]}>
      <View style={styles.sourceIconTile}>
        <Ionicons name={item.icon} size={21} color="#3f424a" />
      </View>

      <View style={styles.rowTextWrap}>
        <Text style={styles.rowTitle}>{item.name}</Text>
        <Text style={styles.rowDescription} numberOfLines={1}>{item.description}</Text>
      </View>

      <View style={statusStyle(item.status)}>
        <Text style={styles.statusText}>{item.status}</Text>
      </View>
    </Pressable>
  );
}

export function AurenControlsSheet({ stage, onStageChange }: AurenControlsSheetProps) {
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

  function getTargetY(nextStage: ControlsSheetStage) {
    if (nextStage === 'expanded') return expandedY;
    if (nextStage === 'peek') return peekY;
    return closedY;
  }

  function animateToStage(nextStage: ControlsSheetStage) {
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
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}
      >
        <View style={styles.headerBlock}>
          <Text style={styles.eyebrow}>Auren controls</Text>
          <Text style={styles.title}>Study setup</Text>
          <Text style={styles.subtitle}>Choose what Auren can use when it helps you plan, explain and revise.</Text>
        </View>

        <View style={styles.statusCard}>
          <View style={styles.statusIconCircle}>
            <Ionicons name="sparkles-outline" size={28} color="#111113" />
          </View>
          <View style={styles.statusTextWrap}>
            <Text style={styles.statusTitle}>Study agent ready</Text>
            <Text style={styles.statusSubtitle}>Calendar, files and study context are available for smarter answers.</Text>
          </View>
          <View style={styles.readyPill}>
            <Text style={styles.readyPillText}>Ready</Text>
          </View>
        </View>

        <Text style={styles.sectionLabel}>Chat controls</Text>
        <View style={styles.groupCard}>
          {CONTROL_ITEMS.map((item, index) => (
            <ControlRow key={item.id} item={item} last={index === CONTROL_ITEMS.length - 1} />
          ))}
        </View>

        <Text style={styles.sectionLabel}>Study sources</Text>
        <View style={styles.groupCard}>
          {SOURCE_ITEMS.map((item, index) => (
            <SourceRow key={item.id} item={item} last={index === SOURCE_ITEMS.length - 1} />
          ))}
        </View>

        <View style={styles.privacyCard}>
          <Ionicons name="shield-checkmark-outline" size={22} color="#686b75" />
          <View style={styles.privacyTextWrap}>
            <Text style={styles.privacyTitle}>You stay in control</Text>
            <Text style={styles.privacySubtitle}>Auren only uses connected sources to help with your study tasks.</Text>
          </View>
        </View>

        <Pressable style={({ pressed }) => [styles.addMoreButton, pressed && styles.pressed]}>
          <View style={styles.addMoreIcon}>
            <Ionicons name="add" size={21} color="#ffffff" />
          </View>
          <Text style={styles.addMoreText}>Add study source</Text>
          <Ionicons name="chevron-forward" size={22} color="#727680" />
        </Pressable>
      </ScrollView>
    </Animated.View>
  );
}

const baseCardShadow = {
  shadowColor: '#111827',
  shadowOpacity: 0.035,
  shadowRadius: 16,
  shadowOffset: { width: 0, height: 9 },
  elevation: 4,
};

const cardSurface = {
  borderWidth: 1,
  borderColor: 'rgba(17,24,39,0.055)',
  backgroundColor: 'rgba(255,255,255,0.72)',
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
  content: {
    paddingTop: 34,
    paddingHorizontal: 24,
    paddingBottom: 42,
  },
  headerBlock: {
    marginBottom: 22,
  },
  eyebrow: {
    color: '#8a8d96',
    fontSize: 12.5,
    lineHeight: 16,
    fontWeight: '700',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    marginBottom: 9,
  },
  title: {
    color: '#111217',
    fontSize: 39,
    lineHeight: 44,
    fontWeight: '700',
    letterSpacing: -1.25,
  },
  subtitle: {
    marginTop: 12,
    maxWidth: 335,
    color: '#858891',
    fontSize: 16.5,
    lineHeight: 23,
    letterSpacing: -0.24,
  },
  statusCard: {
    minHeight: 108,
    borderRadius: 24,
    paddingHorizontal: 18,
    paddingVertical: 16,
    flexDirection: 'row',
    alignItems: 'center',
    ...cardSurface,
  },
  statusIconCircle: {
    width: 58,
    height: 58,
    borderRadius: 19,
    marginRight: 15,
    backgroundColor: '#efedf2',
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusTextWrap: {
    flex: 1,
    minWidth: 0,
  },
  statusTitle: {
    color: '#18191f',
    fontSize: 19,
    lineHeight: 24,
    fontWeight: '650',
    letterSpacing: -0.38,
  },
  statusSubtitle: {
    marginTop: 4,
    color: '#7d8089',
    fontSize: 13.5,
    lineHeight: 18,
    letterSpacing: -0.12,
  },
  readyPill: {
    height: 31,
    paddingHorizontal: 12,
    borderRadius: 999,
    backgroundColor: '#111113',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 12,
  },
  readyPillText: {
    color: '#ffffff',
    fontSize: 12.5,
    lineHeight: 16,
    fontWeight: '650',
    letterSpacing: -0.08,
  },
  sectionLabel: {
    marginTop: 24,
    marginBottom: 11,
    color: '#8e919b',
    fontSize: 12.5,
    lineHeight: 17,
    fontWeight: '700',
    letterSpacing: 1.35,
    textTransform: 'uppercase',
  },
  groupCard: {
    borderRadius: 23,
    overflow: 'hidden',
    ...cardSurface,
  },
  controlRow: {
    minHeight: 78,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.42)',
  },
  sourceRow: {
    minHeight: 74,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.42)',
  },
  rowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(17,24,39,0.07)',
  },
  controlIconTile: {
    width: 44,
    height: 44,
    borderRadius: 15,
    marginRight: 14,
    backgroundColor: '#f1f0f3',
    alignItems: 'center',
    justifyContent: 'center',
  },
  controlIconTileActive: {
    backgroundColor: '#ecebf0',
  },
  sourceIconTile: {
    width: 44,
    height: 44,
    borderRadius: 15,
    marginRight: 14,
    backgroundColor: '#f4f3f5',
    borderWidth: 1,
    borderColor: 'rgba(17,24,39,0.035)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowTextWrap: {
    flex: 1,
    minWidth: 0,
  },
  rowTitle: {
    color: '#202126',
    fontSize: 16.8,
    lineHeight: 21,
    fontWeight: '620',
    letterSpacing: -0.32,
  },
  rowDescription: {
    marginTop: 4,
    color: '#858891',
    fontSize: 13.2,
    lineHeight: 17,
    letterSpacing: -0.1,
  },
  statePill: {
    minWidth: 47,
    height: 30,
    borderRadius: 999,
    paddingHorizontal: 11,
    marginLeft: 10,
    borderWidth: 1,
    borderColor: 'rgba(17,24,39,0.08)',
    backgroundColor: 'rgba(245,245,247,0.8)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  statePillActive: {
    backgroundColor: '#111113',
    borderColor: '#111113',
  },
  statePillText: {
    color: '#7b7e87',
    fontSize: 12.4,
    lineHeight: 15,
    fontWeight: '650',
    letterSpacing: -0.08,
  },
  statePillTextActive: {
    color: '#ffffff',
  },
  statusPill: {
    height: 30,
    borderRadius: 999,
    paddingHorizontal: 10,
    marginLeft: 10,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusPillConnected: {
    backgroundColor: '#111113',
    borderColor: '#111113',
  },
  statusPillAvailable: {
    backgroundColor: 'rgba(245,245,247,0.88)',
    borderColor: 'rgba(17,24,39,0.08)',
  },
  statusPillMuted: {
    backgroundColor: 'rgba(245,245,247,0.72)',
    borderColor: 'rgba(17,24,39,0.075)',
  },
  statusText: {
    color: '#ffffff',
    fontSize: 11.8,
    lineHeight: 15,
    fontWeight: '650',
    letterSpacing: -0.05,
  },
  privacyCard: {
    marginTop: 22,
    minHeight: 74,
    borderRadius: 22,
    paddingHorizontal: 18,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(246,247,249,0.78)',
    borderWidth: 1,
    borderColor: 'rgba(17,24,39,0.055)',
  },
  privacyTextWrap: {
    flex: 1,
    minWidth: 0,
    marginLeft: 14,
  },
  privacyTitle: {
    color: '#33363d',
    fontSize: 15.5,
    lineHeight: 19,
    fontWeight: '650',
    letterSpacing: -0.2,
  },
  privacySubtitle: {
    marginTop: 3,
    color: '#858891',
    fontSize: 12.8,
    lineHeight: 16.5,
    letterSpacing: -0.08,
  },
  addMoreButton: {
    marginTop: 18,
    minHeight: 62,
    paddingHorizontal: 19,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: 'rgba(17,24,39,0.065)',
    backgroundColor: 'rgba(246,247,249,0.88)',
    flexDirection: 'row',
    alignItems: 'center',
  },
  addMoreIcon: {
    width: 30,
    height: 30,
    borderRadius: 999,
    backgroundColor: '#111113',
    alignItems: 'center',
    justifyContent: 'center',
  },
  addMoreText: {
    flex: 1,
    marginLeft: 15,
    color: '#3f424a',
    fontSize: 17,
    lineHeight: 22,
    fontWeight: '650',
    letterSpacing: -0.32,
  },
  pressed: {
    opacity: 0.68,
    transform: [{ scale: 0.993 }],
  },
});
