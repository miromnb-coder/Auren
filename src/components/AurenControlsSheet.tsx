import { useEffect, useMemo, useRef, useState } from 'react';
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
  status: 'Connected' | 'Connect';
  iconUri: string;
};

const SERVICES: ServiceItem[] = [
  {
    id: 'google-drive',
    name: 'Google Drive',
    description: 'Files and documents',
    status: 'Connected',
    iconUri: 'https://raw.githubusercontent.com/miromnb-coder/Auren/main/assets/services/google-drive.PNG',
  },
  {
    id: 'gmail',
    name: 'Gmail',
    description: 'Emails and receipts',
    status: 'Connected',
    iconUri: 'https://raw.githubusercontent.com/miromnb-coder/Auren/main/assets/services/gmail.PNG',
  },
  {
    id: 'google-calendar',
    name: 'Google Calendar',
    description: 'Events and schedule',
    status: 'Connected',
    iconUri: 'https://raw.githubusercontent.com/miromnb-coder/Auren/main/assets/services/google-calendar.PNG',
  },
  {
    id: 'outlook-calendar',
    name: 'Outlook Calendar',
    description: 'Work calendar',
    status: 'Connected',
    iconUri: 'https://raw.githubusercontent.com/miromnb-coder/Auren/main/assets/services/outlook-calendar.PNG',
  },
  {
    id: 'outlook-mail',
    name: 'Outlook Mail',
    description: 'Work email',
    status: 'Connected',
    iconUri: 'https://raw.githubusercontent.com/miromnb-coder/Auren/main/assets/services/outlook-mail.PNG',
  },
];

const FEATURED_SERVICES = [SERVICES[1], SERVICES[0], SERVICES[2]];
const FEATURED_ROTATION_MS = 2600;

const PEEK_HEIGHT_RATIO = 0.54;
const EXPANDED_HEIGHT_RATIO = 0.92;
const PEEK_MIN_HEIGHT = 390;
const PEEK_MAX_HEIGHT = 520;
const EXPANDED_MIN_HEIGHT = 690;
const DRAG_THRESHOLD = 72;
const FAST_SWIPE_VELOCITY = 0.85;

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

export function AurenControlsSheet({ stage, onStageChange }: AurenControlsSheetProps) {
  const { height } = useWindowDimensions();
  const [featuredIndex, setFeaturedIndex] = useState(1);

  const visibleFeaturedServices = useMemo(() => {
    const serviceCount = FEATURED_SERVICES.length;
    const previousIndex = (featuredIndex - 1 + serviceCount) % serviceCount;
    const nextIndex = (featuredIndex + 1) % serviceCount;

    return [
      FEATURED_SERVICES[previousIndex],
      FEATURED_SERVICES[featuredIndex],
      FEATURED_SERVICES[nextIndex],
    ];
  }, [featuredIndex]);

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

  useEffect(() => {
    if (stage === 'closed') return undefined;

    const rotationTimer = setInterval(() => {
      setFeaturedIndex((currentIndex) => (currentIndex + 1) % FEATURED_SERVICES.length);
    }, FEATURED_ROTATION_MS);

    return () => clearInterval(rotationTimer);
  }, [stage]);

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
          <Text style={styles.title}>Services</Text>
          <Text style={styles.subtitle}>Connect the apps you use every day. Auren will bring everything together.</Text>
        </View>

        <View style={styles.featuredRow}>
          {visibleFeaturedServices.map((service, index) => (
            <View
              key={`${service.id}-${index}`}
              style={[
                styles.featuredCard,
                index === 1 && styles.featuredCardActive,
              ]}
            >
              <Image source={{ uri: service.iconUri }} style={styles.featuredIcon} resizeMode="contain" />
              <Text style={styles.featuredName} numberOfLines={1}>{service.name.replace('Google ', '')}</Text>
              <Text style={styles.featuredDescription} numberOfLines={1}>{service.description}</Text>
            </View>
          ))}
        </View>

        <View style={styles.paginationRow}>
          {FEATURED_SERVICES.map((service, index) => (
            <View
              key={service.id}
              style={[
                styles.paginationDot,
                index === featuredIndex && styles.paginationDotActive,
              ]}
            />
          ))}
        </View>

        <Text style={styles.sectionLabel}>Connected services</Text>

        <View style={styles.servicesCard}>
          {SERVICES.map((service, index) => (
            <Pressable
              key={service.id}
              style={[
                styles.serviceRow,
                index === SERVICES.length - 1 && styles.serviceRowLast,
              ]}
            >
              <View style={styles.iconSlot}>
                <Image source={{ uri: service.iconUri }} style={styles.serviceIcon} resizeMode="contain" />
              </View>

              <View style={styles.serviceTextWrap}>
                <Text style={styles.serviceName} numberOfLines={1}>
                  {service.name}
                </Text>
                <Text style={styles.serviceDescription} numberOfLines={1}>
                  {service.description}
                </Text>
              </View>

              <View style={styles.statusPill}>
                <View style={styles.statusDot} />
                <Text style={styles.statusPillText} numberOfLines={1}>
                  {service.status}
                </Text>
              </View>

              <Text style={styles.chevron}>›</Text>
            </Pressable>
          ))}
        </View>

        <Pressable style={styles.addMoreButton}>
          <View style={styles.addMoreIcon}>
            <Text style={styles.addMorePlus}>+</Text>
          </View>
          <Text style={styles.addMoreText}>Add more services</Text>
          <Text style={styles.addMoreChevron}>›</Text>
        </Pressable>
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
  content: {
    paddingTop: 48,
    paddingHorizontal: 24,
    paddingBottom: 42,
  },
  headerBlock: {
    marginBottom: 26,
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
    maxWidth: 320,
    color: '#858891',
    fontSize: 17,
    lineHeight: 24,
    letterSpacing: -0.28,
  },
  featuredRow: {
    marginHorizontal: -8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  featuredCard: {
    flex: 1,
    minHeight: 126,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(17,24,39,0.045)',
    backgroundColor: 'rgba(255,255,255,0.54)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 10,
    ...shadows.tiny,
  },
  featuredCardActive: {
    minHeight: 146,
    backgroundColor: 'rgba(255,255,255,0.86)',
  },
  featuredIcon: {
    width: 48,
    height: 48,
    marginBottom: 14,
  },
  featuredName: {
    color: '#18191f',
    fontSize: 15,
    lineHeight: 19,
    fontWeight: '600',
    letterSpacing: -0.34,
  },
  featuredDescription: {
    marginTop: 5,
    color: '#8b8e98',
    fontSize: 12,
    lineHeight: 15,
    letterSpacing: -0.12,
  },
  paginationRow: {
    marginTop: 18,
    marginBottom: 28,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
  },
  paginationDot: {
    width: 8,
    height: 8,
    borderRadius: 999,
    backgroundColor: '#d8d9de',
  },
  paginationDotActive: {
    backgroundColor: '#3f4654',
  },
  sectionLabel: {
    marginBottom: 12,
    color: '#8e919b',
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '700',
    letterSpacing: 1.4,
    textTransform: 'uppercase',
  },
  servicesCard: {
    borderRadius: 23,
    overflow: 'hidden',
    gap: 8,
  },
  serviceRow: {
    minHeight: 76,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 22,
    borderWidth: 1,
    borderColor: 'rgba(17,24,39,0.055)',
    backgroundColor: 'rgba(255,255,255,0.78)',
    ...shadows.tiny,
  },
  serviceRowLast: {},
  iconSlot: {
    width: 48,
    height: 48,
    borderRadius: 16,
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
    marginLeft: 14,
    marginRight: 10,
  },
  serviceName: {
    color: '#202126',
    fontSize: 18,
    lineHeight: 23,
    fontWeight: '650',
    letterSpacing: -0.45,
  },
  serviceDescription: {
    marginTop: 3,
    color: '#858891',
    fontSize: 14,
    lineHeight: 18,
    letterSpacing: -0.18,
  },
  statusPill: {
    height: 32,
    paddingHorizontal: 12,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(34,197,94,0.18)',
    backgroundColor: 'rgba(34,197,94,0.09)',
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusDot: {
    width: 7,
    height: 7,
    borderRadius: 999,
    marginRight: 7,
    backgroundColor: '#18bf62',
  },
  statusPillText: {
    color: '#3f8d52',
    fontSize: 13,
    lineHeight: 17,
    fontWeight: '600',
    letterSpacing: -0.16,
  },
  chevron: {
    marginLeft: 9,
    color: '#a2a5ad',
    fontSize: 34,
    lineHeight: 36,
    fontWeight: '300',
  },
  addMoreButton: {
    marginTop: 20,
    minHeight: 66,
    paddingHorizontal: 19,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: 'rgba(17,24,39,0.065)',
    backgroundColor: 'rgba(246,247,249,0.88)',
    flexDirection: 'row',
    alignItems: 'center',
  },
  addMoreIcon: {
    width: 28,
    height: 28,
    borderRadius: 999,
    backgroundColor: '#585c66',
    alignItems: 'center',
    justifyContent: 'center',
  },
  addMorePlus: {
    color: '#ffffff',
    fontSize: 22,
    lineHeight: 25,
    fontWeight: '500',
  },
  addMoreText: {
    flex: 1,
    marginLeft: 16,
    color: '#3f424a',
    fontSize: 18,
    lineHeight: 23,
    fontWeight: '650',
    letterSpacing: -0.35,
  },
  addMoreChevron: {
    color: '#727680',
    fontSize: 34,
    lineHeight: 36,
    fontWeight: '300',
  },
});