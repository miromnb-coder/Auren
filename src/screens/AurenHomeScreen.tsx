import Ionicons from '@expo/vector-icons/Ionicons';
import * as Haptics from 'expo-haptics';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Keyboard, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import type { Session } from '@supabase/supabase-js';
import { AurenActionPill } from '../components/AurenActionPill';
import { AurenComposer } from '../components/AurenComposer';
import { AurenControlsSheet, type ControlsSheetStage } from '../components/AurenControlsSheet';
import { CalendarIcon, ListIcon, MenuIcon, SparkIcon } from '../components/AurenIcons';
import { AurenMessageList, type AurenMessage } from '../components/AurenMessageList';
import { AurenPlusSheet, type PlusSheetStage } from '../components/AurenPlusSheet';
import { AurenSidebar } from '../components/AurenSidebar';
import { sendAurenChatMessageStream, type AurenChatMode } from '../lib/aurenChatApi';
import type { AurenThinkingEvent } from '../lib/auren-agent/core/types';
import {
  createChatTitle,
  createUserChat,
  formatChatTime,
  listUserChats,
  loadChatMessages,
  saveChatMessage,
  touchChat,
  type StoredChat,
} from '../lib/aurenChatStorage';
import { supabase } from '../lib/supabase';
import { colors, spacing } from '../theme';

const COMPOSER_CLOSED_BOTTOM = 34;
const COMPOSER_KEYBOARD_GAP = 12;
const COMPOSER_KEYBOARD_EXTRA_LIFT = 34;
const CONTENT_KEYBOARD_LIFT = 34;
const PILLS_KEYBOARD_LIFT = 20;

type AurenHomeScreenProps = {
  session: Session;
};

type SidebarProfile = {
  name: string;
  email: string;
  initials: string;
};

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

function getEmailLocalName(email: string) {
  const localPart = email.split('@')[0] ?? '';
  const cleaned = localPart.replace(/[._-]+/g, ' ').trim();

  if (!cleaned) return 'Auren user';

  return cleaned
    .split(' ')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function getInitials(name: string, email: string) {
  const source = name.trim() || getEmailLocalName(email);
  const initials = source
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join('');

  return initials || 'AU';
}

function createSidebarProfile(name: string | null | undefined, email: string | null | undefined): SidebarProfile {
  const safeEmail = email?.trim() ?? '';
  const safeName = name?.trim() || (safeEmail ? getEmailLocalName(safeEmail) : 'Auren user');

  return {
    name: safeName,
    email: safeEmail,
    initials: getInitials(safeName, safeEmail),
  };
}

function getUserMetadataName(session: Session) {
  const metadata = session.user.user_metadata;
  const displayName = metadata?.display_name;
  const fullName = metadata?.full_name;
  const name = metadata?.name;

  if (typeof displayName === 'string' && displayName.trim()) return displayName;
  if (typeof fullName === 'string' && fullName.trim()) return fullName;
  if (typeof name === 'string' && name.trim()) return name;

  return null;
}

function toAurenMessage(row: { id: string; role: string; content: string; created_at: string }): AurenMessage | null {
  if (row.role !== 'user' && row.role !== 'assistant') return null;

  return {
    id: row.id,
    role: row.role,
    content: row.content,
    createdAt: new Date(row.created_at).getTime(),
  };
}

export function AurenHomeScreen({ session }: AurenHomeScreenProps) {
  const insets = useSafeAreaInsets();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [plusSheetStage, setPlusSheetStage] = useState<PlusSheetStage>('closed');
  const [controlsSheetStage, setControlsSheetStage] = useState<ControlsSheetStage>('closed');
  const [chatMode, setChatMode] = useState<AurenChatMode>('personal');
  const [modeMenuOpen, setModeMenuOpen] = useState(false);
  const [webSearchEnabled, setWebSearchEnabled] = useState(false);
  const [chats, setChats] = useState<StoredChat[]>([]);
  const [activeChatId, setActiveChatId] = useState<string | null>(null);
  const [messages, setMessages] = useState<AurenMessage[]>([]);
  const [assistantThinking, setAssistantThinking] = useState(false);
  const [thinkingState, setThinkingState] = useState<AurenThinkingEvent | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [sidebarProfile, setSidebarProfile] = useState<SidebarProfile>(() =>
    createSidebarProfile(getUserMetadataName(session), session.user.email),
  );
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
  const recentChats = chats.map((chat) => ({
    id: chat.id,
    title: chat.title,
    time: formatChatTime(chat.updated_at),
    icon: getModeOption(chat.mode).icon,
  }));

  async function refreshChats() {
    const nextChats = await listUserChats(session.user.id);
    setChats(nextChats);
  }

  function clearThinkingState() {
    setThinkingState(null);
  }

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

  function toggleWebSearch() {
    setWebSearchEnabled((current) => !current);
    setPlusStage('closed');
    runHaptic(webSearchEnabled ? 'close' : 'open');
  }

  function clearWebSearch() {
    setWebSearchEnabled(false);
    runHaptic('close');
  }

  function stopGenerating() {
    if (!abortControllerRef.current) return;

    abortControllerRef.current.abort();
    abortControllerRef.current = null;
    setAssistantThinking(false);
    clearThinkingState();
    setIsGenerating(false);
    runHaptic('close');
  }

  async function startNewChat() {
    abortControllerRef.current?.abort();
    abortControllerRef.current = null;
    setAssistantThinking(false);
    clearThinkingState();
    setIsGenerating(false);
    setWebSearchEnabled(false);

    try {
      const chat = await createUserChat(session.user.id, 'New chat', chatMode);
      setActiveChatId(chat.id);
      setMessages([]);
      setChats((currentChats) => [chat, ...currentChats.filter((item) => item.id !== chat.id)]);
    } catch (error) {
      setActiveChatId(null);
      setMessages([]);
    } finally {
      closeSidebar();
    }
  }

  async function openStoredChat(chatId: string) {
    abortControllerRef.current?.abort();
    abortControllerRef.current = null;
    setAssistantThinking(false);
    clearThinkingState();
    setIsGenerating(false);
    setWebSearchEnabled(false);
    closeSidebar();

    const selectedChat = chats.find((chat) => chat.id === chatId);
    if (selectedChat) {
      setChatMode(selectedChat.mode);
    }

    setActiveChatId(chatId);

    try {
      const storedMessages = await loadChatMessages(session.user.id, chatId);
      setMessages(storedMessages.map(toAurenMessage).filter((message): message is AurenMessage => Boolean(message)));
    } catch (error) {
      setMessages([]);
    }
  }

  async function ensureActiveChat(firstMessage: string) {
    if (activeChatId) return activeChatId;

    const chat = await createUserChat(session.user.id, createChatTitle(firstMessage), chatMode);
    setActiveChatId(chat.id);
    setChats((currentChats) => [chat, ...currentChats.filter((item) => item.id !== chat.id)]);
    return chat.id;
  }

  async function handleSendMessage(message: string) {
    const useWebSearch = webSearchEnabled;

    closeAllSheets();
    setWebSearchEnabled(false);
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
    let assistantContent = '';
    let chatIdForSend: string | null = null;

    abortControllerRef.current = abortController;
    setMessages([...nextMessages, assistantMessage]);
    clearThinkingState();
    setAssistantThinking(true);
    setIsGenerating(true);

    try {
      chatIdForSend = await ensureActiveChat(message);
      await saveChatMessage({
        chatId: chatIdForSend,
        userId: session.user.id,
        role: 'user',
        content: message,
      });

      const activeChat = chats.find((chat) => chat.id === chatIdForSend);
      const shouldUpdateTitle = !activeChat || activeChat.title === 'New chat';
      const nextTitle = shouldUpdateTitle ? createChatTitle(message) : undefined;

      if (nextTitle) {
        setChats((currentChats) =>
          currentChats.map((chat) => (chat.id === chatIdForSend ? { ...chat, title: nextTitle } : chat)),
        );
      }

      await sendAurenChatMessageStream(
        nextMessages.map((item) => ({
          role: item.role,
          content: item.content,
        })),
        {
          mode: chatMode,
          browserSearch: useWebSearch,
          signal: abortController.signal,
          onThinkingState: setThinkingState,
          onToken: (token) => {
            receivedAnyToken = true;
            assistantContent += token;
            setAssistantThinking(false);
            clearThinkingState();
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

      if (assistantContent.trim()) {
        await saveChatMessage({
          chatId: chatIdForSend,
          userId: session.user.id,
          role: 'assistant',
          content: assistantContent,
        });
      }

      await touchChat({ chatId: chatIdForSend, userId: session.user.id, title: nextTitle });
      await refreshChats();
    } catch (error) {
      if (abortController.signal.aborted) return;

      const fallbackText = receivedAnyToken
        ? '\n\nConnection stopped before Auren finished.'
        : getErrorMessage(error);
      assistantContent += fallbackText;

      setMessages((currentMessages) =>
        currentMessages.map((currentMessage) =>
          currentMessage.id === assistantMessageId
            ? { ...currentMessage, content: currentMessage.content + fallbackText }
            : currentMessage,
        ),
      );

      if (chatIdForSend && assistantContent.trim()) {
        try {
          await saveChatMessage({
            chatId: chatIdForSend,
            userId: session.user.id,
            role: 'assistant',
            content: assistantContent,
          });
          await touchChat({ chatId: chatIdForSend, userId: session.user.id });
          await refreshChats();
        } catch {
          // Keep local chat usable even if persistence fails.
        }
      }
    } finally {
      if (abortControllerRef.current === abortController) {
        abortControllerRef.current = null;
      }
      setAssistantThinking(false);
      clearThinkingState();
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
    let active = true;
    const fallbackEmail = session.user.email ?? '';
    const fallbackName = getUserMetadataName(session);

    setSidebarProfile(createSidebarProfile(fallbackName, fallbackEmail));

    async function loadProfile() {
      const { data } = await supabase
        .from('profiles')
        .select('email, display_name, avatar_url')
        .eq('id', session.user.id)
        .maybeSingle();

      if (!active) return;

      if (data) {
        const nextEmail = data.email ?? fallbackEmail;
        const nextName = data.display_name ?? fallbackName;
        setSidebarProfile(createSidebarProfile(nextName, nextEmail));
        return;
      }

      await supabase.from('profiles').upsert({
        id: session.user.id,
        email: fallbackEmail,
        display_name: fallbackName,
      });

      if (active) {
        setSidebarProfile(createSidebarProfile(fallbackName, fallbackEmail));
      }
    }

    void loadProfile();

    return () => {
      active = false;
    };
  }, [session]);

  useEffect(() => {
    let active = true;

    async function loadChats() {
      try {
        const nextChats = await listUserChats(session.user.id);
        if (active) {
          setChats(nextChats);
        }
      } catch {
        if (active) {
          setChats([]);
        }
      }
    }

    void loadChats();

    return () => {
      active = false;
    };
  }, [session.user.id]);

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
      onOpenRecentChat={openStoredChat}
      recentChats={recentChats}
      profile={sidebarProfile}
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
                  <AurenMessageList
                    messages={messages}
                    assistantThinking={assistantThinking}
                    thinkingState={thinkingState}
                  />
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
                onClearWebSearch={clearWebSearch}
                isGenerating={isGenerating}
                plusActive={plusSheetOpen}
                controlsActive={controlsSheetOpen}
                chatModeActive={modeMenuOpen}
                webSearchActive={webSearchEnabled}
              />
            </Animated.View>
          </SafeAreaView>
        </Animated.View>

        {anySheetOpen ? <Pressable style={styles.plusBackdrop} onPress={closeActiveSheet} /> : null}
        <AurenPlusSheet
          stage={plusSheetStage}
          onStageChange={setPlusStage}
          webSearchActive={webSearchEnabled}
          onWebSearchPress={toggleWebSearch}
        />
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
