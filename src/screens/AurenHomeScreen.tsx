import Ionicons from '@expo/vector-icons/Ionicons';
import * as Haptics from 'expo-haptics';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Keyboard, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { AurenActionPill } from '../components/AurenActionPill';
import { AurenComposer } from '../components/AurenComposer';
import { AurenControlsSheet, type ControlsSheetStage } from '../components/AurenControlsSheet';
import { CalendarIcon, ChevronIcon, ListIcon, MenuIcon, SparkIcon } from '../components/AurenIcons';
import { AurenMessageList, type AurenMessage } from '../components/AurenMessageList';
import { AurenPlusSheet, type PlusSheetStage } from '../components/AurenPlusSheet';
import { AurenSidebar } from '../components/AurenSidebar';
import { sendAurenChatMessageStream, type AurenChatMode } from '../lib/aurenChatApi';
import { colors, spacing } from '../theme';

const COMPOSER_CLOSED_BOTTOM = 34;
const COMPOSER_KEYBOARD_GAP = 12;
const COMPOSER_KEYBOARD_EXTRA_LIFT = 34;
const CONTENT_KEYBOARD_LIFT = 34;
const PILLS_KEYBOARD_LIFT = 20;

const CHAT_MODE_OPTIONS: Array<{
  mode: AurenChatMode;
  title: string;
  subtitle: string;
  icon: keyof typeof Ionicons.glyphMap;
}> = [
  {
    mode: 'personal',
    title: 'Personal',
    subtitle: 'Everyday tasks and decisions.',
    icon: 'chatbubble-outline',
  },
  {
    mode: 'study',
    title: 'Study',
    subtitle: 'Explain, quiz, learn and plan.',
    icon: 'school-outline',
  },
  {
    mode: 'money',
    title: 'Money',
    subtitle: 'Budget, spending and subscriptions.',
    icon: 'wallet-outline',
  },
];

function runHaptic(type: 'open' | 'close') {
  if (Platform.OS === 'web') return;

  if (type === 'open') {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    return;
  }

  void Haptics.selectionAsync();
}

function createMessageId(role: AurenMessage['role']) {
  return `${role}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error && error.message.trim().length > 0) {
    return error.message;
  }

  return 'Auren had trouble connecting. Try again in a moment.';
}

function getModeOption(mode: AurenChatMode) {
  return CHAT_MODE_OPTIONS.find((option) => option.mode === mode) ?? CHAT_MODE_OPTIONS[0];
}

export function AurenHomeScreen() {
  const insets = useSafeAreaInsets();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [plusSheetStage, setPlusSheetStage] = useState<PlusSheetStage>('closed');
  const [controlsSheetStage, setControlsSheetStage] = useState<ControlsSheetStage>('closed');
  const [chatMode, setChatMode] = useState<AurenChatMode>('personal');
  const [modeMenuOpen, setModeMenuOpen] = useState(false);
  const [messages, setMessages] = useState<AurenMessage[]>([]);
  const [assistantThinking, setAssistantThinking] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const composerBottom = useRef(new Animated.Value(COMPOSER_CLOSED_BOTTOM)).current;
  const contentTranslateY = useRef(new Animated.Value(0)).current;
  const pillsOpacity = useRef(new Animated.Value(1)).current;
  const pillsTranslateY = useRef(new Animated.Value(0)).current;
  const appCardProgress = useRef(new Animated.Value(0)).current;
  const abortControllerRef = useRef<AbortController | null>(null);

  const plusSheetOpen = plusSheetStage !== 'closed';
  const controlsSheetOpen = controlsSheetStage !== 'closed';
  const anySheetOpen = plusSheetOpen || controlsSheetOpen;
  const anySheetExpanded = plusSheetStage === 'expanded' || controlsSheetStage === 'expanded';
  const hasMessages = messages.length > 0;
  const selectedModeOption = getModeOption(chatMode);

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

  function setControlsStage(nextStage: ControlsSheetStage) {
    setControlsSheetStage((current) => {
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

  function closeModeMenu() {
    setModeMenuOpen((current) => {
      if (!current) return current;
      runHaptic('close');
      return false;
    });
  }

  function closeAllSheets() {
    if (plusSheetOpen) {
      setPlusStage('closed');
    }

    if (controlsSheetOpen) {
      setControlsStage('closed');
    }

    if (modeMenuOpen) {
      setModeMenuOpen(false);
    }
  }

  function openModeMenu() {
    Keyboard.dismiss();
    setSidebarOpen(false);
    if (plusSheetOpen) {
      setPlusSheetStage('closed');
    }
    if (controlsSheetOpen) {
      setControlsSheetStage('closed');
    }

    setModeMenuOpen((current) => {
      runHaptic(current ? 'close' : 'open');
      return !current;
    });
  }

  function selectChatMode(nextMode: AurenChatMode) {
    setChatMode(nextMode);
    setModeMenuOpen(false);
    runHaptic('close');
  }

  function openSidebar() {
    Keyboard.dismiss();
    closeAllSheets();
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

  function stopGenerating() {
    if (!abortControllerRef.current) return;

    abortControllerRef.current.abort();
    abortControllerRef.current = null;
    setAssistantThinking(false);
    setIsGenerating(false);
    runHaptic('close');
  }

  function startNewChat() {
    abortControllerRef.current?.abort();
    abortControllerRef.current = null;
    setMessages([]);
    setAssistantThinking(false);
    setIsGenerating(false);
    closeSidebar();
  }

  async function handleSendMessage(message: string) {
    closeAllSheets();
    abortControllerRef.current?.abort();

    const userMessage: AurenMessage = {
      id: createMessageId('user'),
      role: 'user',
      content: message,
      createdAt: Date.now(),
    };
    const assistantMessageId = createMessageId('assistant');
    const assistantMessage: AurenMessage = {
      id: assistantMessageId,
      role: 'assistant',
      content: '',
      createdAt: Date.now(),
    };
    const nextMessages = [...messages, userMessage];
    const abortController = new AbortController();
    let receivedAnyToken = false;

    abortControllerRef.current = abortController;
    setMessages([...nextMessages, assistantMessage]);
    setAssistantThinking(true);
    setIsGenerating(true);

    try {
      await sendAurenChatMessageStream(
        nextMessages.map((item) => ({
          role: item.role,
          content: item.content,
        })),
        {
          mode: chatMode,
          signal: abortController.signal,
          onToken: (token) => {
            receivedAnyToken = true;
            setAssistantThinking(false);
            setMessages((currentMessages) =>
              currentMessages.map((currentMessage) =>
                currentMessage.id === assistantMessageId
                  ? { ...currentMessage, content: currentMessage.content + token }
                  : currentMessage,
              ),
            );
          },
        },
      );
    } catch (error) {
      if (abortController.signal.aborted) return;

      const fallbackText = receivedAnyToken
        ? '\n\nConnection stopped before Auren finished.'
        : getErrorMessage(error);

      setMessages((currentMessages) =>
        currentMessages.map((currentMessage) =>
          currentMessage.id === assistantMessageId
            ? { ...currentMessage, content: currentMessage.content + fallbackText }
            : currentMessage,
        ),
      );
    } finally {
      if (abortControllerRef.current === abortController) {
        abortControllerRef.current = null;
      }
      setAssistantThinking(false);
      setIsGenerating(false);
    }
  }

  function openPlusSheet() {
    Keyboard.dismiss();
    setSidebarOpen(false);
    setModeMenuOpen(false);
    if (controlsSheetOpen) {
      setControlsSheetStage('closed');
    }
    setPlusStage('peek');
  }

  function openControlsSheet() {
    Keyboard.dismiss();
    setSidebarOpen(false);
    setModeMenuOpen(false);
    if (plusSheetOpen) {
      setPlusSheetStage('closed');
    }
    setControlsStage('peek');
  }

  function closeActiveSheet() {
    closeAllSheets();
  }

  useEffect(() => {
    Animated.timing(appCardProgress, {
      toValue: anySheetExpanded ? 1 : 0,
      duration: anySheetExpanded ? 320 : 260,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [anySheetExpanded, appCardProgress]);

  useEffect(() => {
    return () => {
      abortControllerRef.current?.abort();
    };
  }, []);

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
    outputRange: [1, 0.945],
  });
  const appTranslateY = appCardProgress.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 42],
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
      onNewChat={startNewChat}
      onViewAll={closeSidebar}
      onOpenProfile={closeSidebar}
      onOpenRecentChat={closeSidebar}
    >
      <View style={styles.sceneRoot}>
        <StatusBar style={anySheetExpanded ? 'light' : 'dark'} />
        <Animated.View style={[styles.darkFrame, { opacity: appDimOpacity }]} />

        <Animated.View
          style={[
            styles.appCard,
            {
              borderRadius: anySheetExpanded ? 34 : 0,
              transform: [{ scale: appScale }, { translateY: appTranslateY }],
            },
          ]}
        >
          <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
            <View style={styles.dismissArea}>
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

                <Pressable
                  onPress={openModeMenu}
                  hitSlop={12}
                  style={({ pressed }) => [styles.brandButton, pressed && styles.brandButtonPressed]}
                  accessibilityRole="button"
                  accessibilityLabel={`Change Auren mode. Current mode is ${selectedModeOption.title}`}
                >
                  <Text style={styles.brand}>Auren</Text>
                  <View style={styles.modeBadge}>
                    <Ionicons name={selectedModeOption.icon} size={15} color="#555863" />
                  </View>
                  <ChevronIcon />
                </Pressable>

                <View style={styles.headerSpacer} />
              </View>

              {modeMenuOpen ? (
                <>
                  <Pressable style={styles.modeMenuBackdrop} onPress={closeModeMenu} />
                  <View style={styles.modeMenu}>
                    {CHAT_MODE_OPTIONS.map((option, index) => {
                      const selected = option.mode === chatMode;

                      return (
                        <Pressable
                          key={option.mode}
                          onPress={() => selectChatMode(option.mode)}
                          style={({ pressed }) => [
                            styles.modeMenuItem,
                            index < CHAT_MODE_OPTIONS.length - 1 && styles.modeMenuItemBorder,
                            pressed && styles.modeMenuItemPressed,
                          ]}
                          accessibilityRole="button"
                          accessibilityLabel={`Use ${option.title} mode`}
                        >
                          <View style={styles.modeCheckWrap}>
                            {selected ? <Text style={styles.modeCheck}>✓</Text> : null}
                          </View>
                          <View style={[styles.modeIconBubble, selected && styles.modeIconBubbleSelected]}>
                            <Ionicons name={option.icon} size={16} color="#1d1d1f" />
                          </View>
                          <View style={styles.modeTextWrap}>
                            <Text style={styles.modeTitle}>{option.title}</Text>
                            <Text style={styles.modeSubtitle}>{option.subtitle}</Text>
                          </View>
                        </Pressable>
                      );
                    })}
                  </View>
                </>
              ) : null}

              <Animated.View
                style={[
                  styles.content,
                  hasMessages ? styles.chatContent : styles.startContent,
                  { transform: [{ translateY: contentTranslateY }] },
                ]}
              >
                {hasMessages ? (
                  <AurenMessageList messages={messages} assistantThinking={assistantThinking} />
                ) : (
                  <Pressable style={styles.startDismissArea} onPress={Keyboard.dismiss}>
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
                  </Pressable>
                )}
              </Animated.View>
            </View>

            <Animated.View style={[styles.composerWrap, { bottom: composerBottom }]}> 
              <AurenComposer
                onOpenPlus={openPlusSheet}
                onOpenControls={openControlsSheet}
                onOpenChatMode={openModeMenu}
                onSendMessage={handleSendMessage}
                onStopGenerating={stopGenerating}
                isGenerating={isGenerating}
                plusActive={plusSheetOpen}
                controlsActive={controlsSheetOpen}
                chatModeActive={modeMenuOpen}
              />
            </Animated.View>
          </SafeAreaView>
        </Animated.View>

        {anySheetOpen ? <Pressable style={styles.plusBackdrop} onPress={closeActiveSheet} /> : null}
        <AurenPlusSheet stage={plusSheetStage} onStageChange={setPlusStage} />
        <AurenControlsSheet stage={controlsSheetStage} onStageChange={setControlsStage} />
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
  startDismissArea: {
    flex: 1,
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  header: {
    zIndex: 60,
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
  brandButton: {
    minWidth: 148,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  brandButtonPressed: {
    opacity: 0.68,
  },
  brand: {
    color: colors.text,
    fontSize: 28,
    lineHeight: 34,
    letterSpacing: -0.9,
    fontFamily: serifFont,
  },
  modeBadge: {
    width: 27,
    height: 27,
    borderRadius: 999,
    marginLeft: 9,
    borderWidth: 1,
    borderColor: 'rgba(17,24,39,0.065)',
    backgroundColor: 'rgba(255,255,255,0.54)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerSpacer: {
    width: 68,
  },
  modeMenuBackdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 45,
  },
  modeMenu: {
    position: 'absolute',
    top: 80,
    alignSelf: 'center',
    width: 304,
    zIndex: 70,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(17,24,39,0.06)',
    backgroundColor: 'rgba(252,252,251,0.96)',
    overflow: 'hidden',
    shadowColor: '#000000',
    shadowOpacity: 0.12,
    shadowRadius: 22,
    shadowOffset: { width: 0, height: 14 },
    elevation: 20,
  },
  modeMenuItem: {
    minHeight: 74,
    paddingHorizontal: 14,
    paddingVertical: 11,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.74)',
  },
  modeMenuItemBorder: {
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(17,24,39,0.065)',
  },
  modeMenuItemPressed: {
    backgroundColor: 'rgba(241,242,244,0.92)',
  },
  modeCheckWrap: {
    width: 19,
    alignItems: 'flex-start',
    justifyContent: 'center',
  },
  modeCheck: {
    color: colors.text,
    fontSize: 20,
    lineHeight: 22,
    fontWeight: '650',
  },
  modeIconBubble: {
    width: 34,
    height: 34,
    borderRadius: 999,
    marginRight: 11,
    borderWidth: 1,
    borderColor: 'rgba(17,24,39,0.055)',
    backgroundColor: 'rgba(255,255,255,0.62)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modeIconBubbleSelected: {
    backgroundColor: 'rgba(232,233,237,0.92)',
  },
  modeTextWrap: {
    flex: 1,
  },
  modeTitle: {
    color: colors.text,
    fontSize: 18.5,
    lineHeight: 23,
    letterSpacing: -0.34,
    fontWeight: '620',
  },
  modeSubtitle: {
    marginTop: 1,
    color: colors.muted,
    fontSize: 14.5,
    lineHeight: 20,
    letterSpacing: -0.18,
    fontWeight: '480',
  },
  content: {
    flex: 1,
    width: '100%',
    paddingHorizontal: 18,
  },
  startContent: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingBottom: 220,
  },
  chatContent: {
    alignItems: 'stretch',
    justifyContent: 'flex-end',
    paddingHorizontal: 0,
    paddingBottom: 0,
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
