import * as Haptics from 'expo-haptics';
import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Keyboard, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { AurenActionPill } from '../components/AurenActionPill';
import { AurenComposer } from '../components/AurenComposer';
import { CalendarIcon, ChevronIcon, ListIcon, MenuIcon, SparkIcon } from '../components/AurenIcons';
import { AurenPlusSheet, type PlusSheetStage } from '../components/AurenPlusSheet';
import { AurenSidebar } from '../components/AurenSidebar';
import { colors, spacing } from '../theme';

const COMPOSER_CLOSED_BOTTOM = 34;
const COMPOSER_KEYBOARD_GAP = 12;
const COMPOSER_KEYBOARD_EXTRA_LIFT = 34;
const CONTENT_KEYBOARD_LIFT = 34;
const PILLS_KEYBOARD_LIFT = 20;

function runHaptic(type: 'open' | 'close') {
  if (Platform.OS === 'web') return;

  if (type === 'open') {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    return;
  }

  void Haptics.selectionAsync();
}

export function AurenHomeScreen() {
  const insets = useSafeAreaInsets();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [plusSheetStage, setPlusSheetStage] = useState<PlusSheetStage>('closed');
  const composerBottom = useRef(new Animated.Value(COMPOSER_CLOSED_BOTTOM)).current;
  const contentTranslateY = useRef(new Animated.Value(0)).current;
  const pillsOpacity = useRef(new Animated.Value(1)).current;
  const pillsTranslateY = useRef(new Animated.Value(0)).current;
  const appCardProgress = useRef(new Animated.Value(0)).current;

  const plusSheetOpen = plusSheetStage !== 'closed';

  function setPlusStage(nextStage: PlusSheetStage) {
    setPlusSheetStage((current) => {
      if (current === nextStage) return current;

      if (current === 'closed' && nextStage !== 'closed') {
        runHaptic('open');
      } else if (current !== 'closed' && nextStage === 'closed') {
        runHaptic('close');
      } else if (current !== nextStage) {
        runHaptic('open');
      }

      return nextStage;
    });
  }

  function openSidebar() {
    Keyboard.dismiss();
    setPlusStage('closed');
    setSidebarOpen((current) => {
      if (current) return current;
      runHaptic('open');
      return true;
    });
  }

  function closeSidebar() {
    setSidebarOpen((current) => {
      if (!current) return current;
      runHaptic('close');
      return false;
    });
  }

  function openPlusSheet() {
    Keyboard.dismiss();
    setSidebarOpen(false);
    setPlusStage('peek');
  }

  function closePlusSheet() {
    setPlusStage('closed');
  }

  useEffect(() => {
    Animated.timing(appCardProgress, {
      toValue: plusSheetStage === 'expanded' ? 1 : 0,
      duration: plusSheetStage === 'expanded' ? 320 : 260,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [appCardProgress, plusSheetStage]);

  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';

    const showSubscription = Keyboard.addListener(showEvent, (event) => {
      const keyboardHeight = event.endCoordinates.height;
      const duration = event.duration ?? 250;
      const nextBottom = Math.max(
        COMPOSER_CLOSED_BOTTOM,
        keyboardHeight - insets.bottom + COMPOSER_KEYBOARD_GAP + COMPOSER_KEYBOARD_EXTRA_LIFT,
      );

      Animated.parallel([
        Animated.timing(composerBottom, {
          toValue: nextBottom,
          duration,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: false,
        }),
        Animated.timing(contentTranslateY, {
          toValue: -CONTENT_KEYBOARD_LIFT,
          duration,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(pillsOpacity, {
          toValue: 0,
          duration: Math.min(duration, 190),
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(pillsTranslateY, {
          toValue: -PILLS_KEYBOARD_LIFT,
          duration,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
      ]).start();
    });

    const hideSubscription = Keyboard.addListener(hideEvent, (event) => {
      const duration = event.duration ?? 220;

      Animated.parallel([
        Animated.timing(composerBottom, {
          toValue: COMPOSER_CLOSED_BOTTOM,
          duration,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: false,
        }),
        Animated.timing(contentTranslateY, {
          toValue: 0,
          duration,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(pillsOpacity, {
          toValue: 1,
          duration,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(pillsTranslateY, {
          toValue: 0,
          duration,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
      ]).start();
    });

    return () => {
      showSubscription.remove();
      hideSubscription.remove();
    };
  }, [composerBottom, contentTranslateY, insets.bottom, pillsOpacity, pillsTranslateY]);

  const appScale = appCardProgress.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 0.965],
  });
  const appTranslateY = appCardProgress.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 16],
  });
  const appDimOpacity = appCardProgress.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 0.12],
  });

  return (
    <AurenSidebar
      open={sidebarOpen}
      onOpen={openSidebar}
      onClose={closeSidebar}
      onNewChat={closeSidebar}
      onViewAll={closeSidebar}
      onOpenProfile={closeSidebar}
      onOpenRecentChat={closeSidebar}
    >
      <View style={styles.sceneRoot}>
        <Animated.View style={[styles.darkFrame, { opacity: appDimOpacity }]} />

        <Animated.View
          style={[
            styles.appCard,
            {
              borderRadius: plusSheetStage === 'expanded' ? 34 : 0,
              transform: [{ scale: appScale }, { translateY: appTranslateY }],
            },
          ]}
        >
          <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
            <Pressable style={styles.dismissArea} onPress={plusSheetOpen ? closePlusSheet : Keyboard.dismiss}>
              <View style={styles.header}>
                <Pressable
                  onPress={openSidebar}
                  hitSlop={14}
                  style={({ pressed }) => [styles.menuButton, pressed && styles.menuButtonPressed]}
                  accessibilityRole="button"
                  accessibilityLabel="Open menu"
                >
                  <MenuIcon />
                </Pressable>

                <View style={styles.brandWrap}>
                  <Text style={styles.brand}>Auren</Text>
                  <ChevronIcon />
                </View>

                <View style={styles.headerSpacer} />
              </View>

              <Animated.View style={[styles.content, { transform: [{ translateY: contentTranslateY }] }]}> 
                <View style={styles.hero}>
                  <Text style={styles.title}>Good evening, you&apos;ve got this.</Text>
                  <Text style={styles.subtitle}>I&apos;m here to help you focus and get things done.</Text>
                </View>

                <Animated.View
                  pointerEvents="box-none"
                  style={[
                    styles.pillsRow,
                    {
                      opacity: pillsOpacity,
                      transform: [{ translateY: pillsTranslateY }],
                    },
                  ]}
                >
                  <AurenActionPill width={106} icon={<CalendarIcon />} label="Plan my day" />
                  <AurenActionPill width={124} icon={<ListIcon />} label="Organize tasks" />
                  <AurenActionPill width={110} icon={<SparkIcon />} label="Ask anything" />
                </Animated.View>
              </Animated.View>
            </Pressable>

            <Animated.View style={[styles.composerWrap, { bottom: composerBottom }]}> 
              <AurenComposer onOpenPlus={openPlusSheet} plusActive={plusSheetOpen} />
            </Animated.View>
          </SafeAreaView>
        </Animated.View>

        {plusSheetOpen ? <Pressable style={styles.plusBackdrop} onPress={closePlusSheet} /> : null}
        <AurenPlusSheet stage={plusSheetStage} onStageChange={setPlusStage} />
      </View>
    </AurenSidebar>
  );
}

const serifFont = Platform.select({
  ios: 'Georgia',
  android: 'serif',
  default: 'serif',
});

const styles = StyleSheet.create({
  sceneRoot: {
    flex: 1,
    backgroundColor: '#050507',
  },
  darkFrame: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#050507',
  },
  appCard: {
    flex: 1,
    overflow: 'hidden',
    backgroundColor: colors.background,
  },
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  dismissArea: {
    flex: 1,
  },
  header: {
    height: 88,
    paddingHorizontal: spacing.screenX,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  menuButton: {
    width: 68,
    alignItems: 'flex-start',
    justifyContent: 'center',
  },
  menuButtonPressed: {
    opacity: 0.62,
  },
  brandWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 148,
  },
  brand: {
    color: colors.text,
    fontSize: 28,
    lineHeight: 34,
    letterSpacing: -0.9,
    fontFamily: serifFont,
  },
  headerSpacer: {
    width: 68,
  },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 18,
    paddingBottom: 220,
  },
  hero: {
    alignItems: 'center',
    marginTop: 18,
    maxWidth: 360,
  },
  title: {
    color: '#686775',
    fontSize: 25,
    lineHeight: 31,
    letterSpacing: -0.75,
    textAlign: 'center',
    fontFamily: serifFont,
  },
  subtitle: {
    marginTop: 13,
    color: colors.muted,
    fontSize: 15.5,
    lineHeight: 22,
    letterSpacing: -0.12,
    textAlign: 'center',
    fontWeight: '500',
  },
  pillsRow: {
    marginTop: 48,
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  composerWrap: {
    position: 'absolute',
    left: 16,
    right: 16,
  },
  plusBackdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 30,
  },
});
