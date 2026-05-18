import Ionicons from '@expo/vector-icons/Ionicons';
import { useEffect, useMemo, useRef } from 'react';
import {
  Animated,
  Easing,
  Image,
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

type ServiceItem = {
  id: string;
  name: string;
  description: string;
  iconUri: string;
};

const PEEK_HEIGHT_RATIO = 0.54;
const EXPANDED_HEIGHT_RATIO = 0.92;
const PEEK_MIN_HEIGHT = 390;
const PEEK_MAX_HEIGHT = 520;
const EXPANDED_MIN_HEIGHT = 690;
const DRAG_THRESHOLD = 72;
const FAST_SWIPE_VELOCITY = 0.85;

const STUDY_SOURCES: ServiceItem[] = [
  {
    id: 'google-calendar',
    name: 'Google Calendar',
    description: 'Events, exams and deadlines',
    iconUri: 'https://raw.githubusercontent.com/miromnb-coder/Auren/main/assets/services/google-calendar.PNG',
  },
  {
    id: 'google-drive',
    name: 'Google Drive',
    description: 'Notes, PDFs and assignments',
    iconUri: 'https://raw.githubusercontent.com/miromnb-coder/Auren/main/assets/services/google-drive.PNG',
  },
  {
    id: 'gmail',
    name: 'Gmail',
    description: 'School emails and reminders',
    iconUri: 'https://raw.githubusercontent.com/miromnb-coder/Auren/main/assets/services/gmail.PNG',
  },
];

const MORE_SOURCES: ServiceItem[] = [
  {
    id: 'outlook-calendar',
    name: 'Outlook Calendar',
    description: 'Work or school calendar',
    iconUri: 'https://raw.githubusercontent.com/miromnb-coder/Auren/main/assets/services/outlook-calendar.PNG',
  },
  {
    id: 'outlook-mail',
    name: 'Outlook Mail',
    description: 'Work or school email',
    iconUri: 'https://raw.githubusercontent.com/miromnb-coder/Auren/main/assets/services/outlook-mail.PNG',
  },
];

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function ServiceRow({ item, last }: { item: ServiceItem; last: boolean }) {
  return (
    <Pressable style={({ pressed }) => [styles.serviceRow, !last && styles.rowBorder, pressed && styles.pressed]}>
      <View style={styles.iconSlot}>
        <Image source={{ uri: item.iconUri }} style={styles.serviceIcon} resizeMode="contain" />
      </View>

      <View style={styles.serviceTextWrap}>
        <Text style={styles.serviceName} numberOfLines={1}>{item.name}</Text>
        <Text style={styles.serviceDescription} numberOfLines={1}>{item.description}</Text>
      </View>

      <View style={styles.connectButton}>
        <Text style={styles.connectButtonText}>Connect</Text>
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

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        <View style={styles.headerBlock}>
          <Text style={styles.eyebrow}>Auren sources</Text>
          <Text style={styles.title}>Sources</Text>
          <Text style={styles.subtitle}>Connect the apps Auren can use to help with your studies.</Text>
        </View>

        <View style={styles.summaryCard}>
          <View style={styles.summaryIconCircle}>
            <Ionicons name="layers-outline" size={28} color="#111113" />
          </View>
          <View style={styles.summaryTextWrap}>
            <Text style={styles.summaryTitle}>5 sources available</Text>
            <Text style={styles.summarySubtitle}>Calendar, files and mail can make Auren more useful.</Text>
          </View>
        </View>

        <Text style={styles.sectionLabel}>Study sources</Text>
        <View style={styles.groupCard}>
          {STUDY_SOURCES.map((item, index) => (
            <ServiceRow key={item.id} item={item} last={index === STUDY_SOURCES.length - 1} />
          ))}
        </View>

        <Text style={styles.sectionLabel}>More sources</Text>
        <View style={styles.groupCard}>
          {MORE_SOURCES.map((item, index) => (
            <ServiceRow key={item.id} item={item} last={index === MORE_SOURCES.length - 1} />
          ))}
        </View>

        <View style={styles.privacyCard}>
          <Ionicons name="shield-checkmark-outline" size={22} color="#686b75" />
          <View style={styles.privacyTextWrap}>
            <Text style={styles.privacyTitle}>You stay in control</Text>
            <Text style={styles.privacySubtitle}>Auren only uses sources you choose to connect.</Text>
          </View>
        </View>

        <Pressable style={({ pressed }) => [styles.addMoreButton, pressed && styles.pressed]}>
          <View style={styles.addMoreIcon}>
            <Ionicons name="add" size={21} color="#ffffff" />
          </View>
          <Text style={styles.addMoreText}>Add another source</Text>
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
    fontSize: 42,
    lineHeight: 47,
    fontWeight: '700',
    letterSpacing: -1.35,
  },
  subtitle: {
    marginTop: 12,
    maxWidth: 335,
    color: '#858891',
    fontSize: 16.5,
    lineHeight: 23,
    letterSpacing: -0.24,
  },
  summaryCard: {
    minHeight: 104,
    borderRadius: 24,
    paddingHorizontal: 18,
    paddingVertical: 16,
    flexDirection: 'row',
    alignItems: 'center',
    ...cardSurface,
  },
  summaryIconCircle: {
    width: 58,
    height: 58,
    borderRadius: 19,
    marginRight: 15,
    backgroundColor: '#efedf2',
    alignItems: 'center',
    justifyContent: 'center',
  },
  summaryTextWrap: {
    flex: 1,
    minWidth: 0,
  },
  summaryTitle: {
    color: '#18191f',
    fontSize: 19,
    lineHeight: 24,
    fontWeight: '650',
    letterSpacing: -0.38,
  },
  summarySubtitle: {
    marginTop: 4,
    color: '#7d8089',
    fontSize: 13.5,
    lineHeight: 18,
    letterSpacing: -0.12,
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
  serviceRow: {
    minHeight: 78,
    paddingHorizontal: 15,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.42)',
  },
  rowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(17,24,39,0.07)',
  },
  iconSlot: {
    width: 48,
    height: 48,
    borderRadius: 16,
    marginRight: 14,
    borderWidth: 1,
    borderColor: 'rgba(17,24,39,0.045)',
    backgroundColor: 'rgba(255,255,255,0.72)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  serviceIcon: {
    width: 34,
    height: 34,
  },
  serviceTextWrap: {
    flex: 1,
    minWidth: 0,
    marginRight: 10,
  },
  serviceName: {
    color: '#202126',
    fontSize: 17.2,
    lineHeight: 22,
    fontWeight: '650',
    letterSpacing: -0.38,
  },
  serviceDescription: {
    marginTop: 4,
    color: '#858891',
    fontSize: 13.2,
    lineHeight: 17,
    letterSpacing: -0.1,
  },
  connectButton: {
    height: 34,
    minWidth: 78,
    borderRadius: 999,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: 'rgba(17,24,39,0.105)',
    backgroundColor: 'rgba(246,247,249,0.86)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  connectButtonText: {
    color: '#3f424a',
    fontSize: 13.2,
    lineHeight: 16,
    fontWeight: '650',
    letterSpacing: -0.12,
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
