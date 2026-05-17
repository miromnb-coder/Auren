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
import { MenuIcon } from '../components/AurenIcons';
import { AurenMessageList, type AurenMessage } from '../components/AurenMessageList';
import { AurenPlusSheet, type PlusSheetStage } from '../components/AurenPlusSheet';
import { AurenSidebar } from '../components/AurenSidebar';
import { AurenStudyFocusSetupSheet, type AurenStudyFocusSetupInput } from '../components/AurenStudyFocusSetupSheet';
import { StudyBookIcon, StudyCalendarIcon, StudyQuizIcon } from '../components/AurenStudyIcons';
import { AurenTodayFocusCard } from '../components/AurenTodayFocusCard';
import { sendAurenChatMessageStream, type AurenChatMode } from '../lib/aurenChatApi';
import type { AurenThinkingEvent } from '../lib/auren-agent/core/types';
import { createChatTitle, createUserChat, formatChatTime, listUserChats, loadChatMessages, saveChatMessage, touchChat, type StoredChat } from '../lib/aurenChatStorage';
import { createFocusCardFromTask, createStudySubject, createStudyTask, createStudyTaskSteps, listStudySubjects, loadTodayStudyFocusCard, type StudyFocusCard, type StudySubject, type StudyTaskType } from '../lib/aurenStudyFocus';
import { colors, spacing } from '../theme';

const STUDY_MODE: AurenChatMode = 'study';
const COMPOSER_CLOSED_BOTTOM = 38;
const COMPOSER_KEYBOARD_GAP = 12;
const COMPOSER_KEYBOARD_EXTRA_LIFT = 34;
const CONTENT_KEYBOARD_LIFT = 34;
const PILLS_KEYBOARD_LIFT = 20;
const STUDY_ACTION_ICON_COLOR = '#70717a';

type AurenHomeScreenProps = { session: Session };
type SidebarProfile = { name: string; email: string; initials: string };

const CHAT_MODE_OPTIONS: Array<{ mode: AurenChatMode; title: string; icon: keyof typeof Ionicons.glyphMap }> = [
  { mode: 'personal', title: 'Personal', icon: 'chatbubble-outline' },
  { mode: 'study', title: 'Study', icon: 'school-outline' },
  { mode: 'money', title: 'Money', icon: 'wallet-outline' },
];

const serifFont = Platform.select({ ios: 'Georgia', android: 'serif', default: 'serif' });

function runHaptic(type: 'open' | 'close') {
  if (Platform.OS === 'web') return;
  if (type === 'open') void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  else void Haptics.selectionAsync();
}

function createMessageId(role: AurenMessage['role']) {
  return `${role}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function getErrorMessage(error: unknown) {
  return error instanceof Error && error.message.trim() ? error.message : 'Auren had trouble connecting. Try again in a moment.';
}

function getModeOption(mode: AurenChatMode) {
  return CHAT_MODE_OPTIONS.find((option) => option.mode === mode) ?? CHAT_MODE_OPTIONS[1];
}

function getEmailLocalName(email: string) {
  const cleaned = (email.split('@')[0] ?? '').replace(/[._-]+/g, ' ').trim();
  if (!cleaned) return 'Auren user';
  return cleaned.split(' ').filter(Boolean).map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join(' ');
}

function createSidebarProfile(session: Session): SidebarProfile {
  const email = session.user.email ?? '';
  const metadata = session.user.user_metadata;
  const name = (typeof metadata?.display_name === 'string' && metadata.display_name.trim()) ||
    (typeof metadata?.full_name === 'string' && metadata.full_name.trim()) ||
    (typeof metadata?.name === 'string' && metadata.name.trim()) ||
    getEmailLocalName(email);
  const initials = name.split(' ').filter(Boolean).slice(0, 2).map((part) => part.charAt(0).toUpperCase()).join('') || 'AU';
  return { name, email, initials };
}

function toAurenMessage(row: { id: string; role: string; content: string; created_at: string }): AurenMessage | null {
  if (row.role !== 'user' && row.role !== 'assistant') return null;
  return { id: row.id, role: row.role, content: row.content, createdAt: new Date(row.created_at).getTime() };
}

function inferStudyTaskType(value: string): StudyTaskType {
  const text = value.toLowerCase();
  if (text.includes('exam') || text.includes('test') || text.includes('koe')) return 'exam';
  if (text.includes('essay') || text.includes('essee')) return 'essay';
  if (text.includes('quiz')) return 'quiz';
  if (text.includes('read') || text.includes('luk')) return 'reading';
  if (text.includes('practice') || text.includes('harjoit')) return 'practice';
  return 'general_goal';
}

function parseDeadlineText(value: string) {
  const cleanValue = value.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(cleanValue)) return null;
  const date = new Date(`${cleanValue}T12:00:00`);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

async function findOrCreateStudySubject(userId: string, subjectName: string): Promise<StudySubject | null> {
  const cleanSubject = subjectName.trim();
  if (!cleanSubject) return null;
  const subjects = await listStudySubjects(userId);
  const existing = subjects.find((subject) => subject.name.toLowerCase() === cleanSubject.toLowerCase());
  if (existing) return existing;
  try {
    return await createStudySubject({ userId, name: cleanSubject });
  } catch {
    const nextSubjects = await listStudySubjects(userId);
    return nextSubjects.find((subject) => subject.name.toLowerCase() === cleanSubject.toLowerCase()) ?? null;
  }
}

export function AurenHomeScreen({ session }: AurenHomeScreenProps) {
  const insets = useSafeAreaInsets();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [plusSheetStage, setPlusSheetStage] = useState<PlusSheetStage>('closed');
  const [controlsSheetStage, setControlsSheetStage] = useState<ControlsSheetStage>('closed');
  const [focusSetupOpen, setFocusSetupOpen] = useState(false);
  const [focusSetupSaving, setFocusSetupSaving] = useState(false);
  const [focusSetupError, setFocusSetupError] = useState<string | null>(null);
  const [webSearchEnabled, setWebSearchEnabled] = useState(false);
  const [chats, setChats] = useState<StoredChat[]>([]);
  const [activeChatId, setActiveChatId] = useState<string | null>(null);
  const [messages, setMessages] = useState<AurenMessage[]>([]);
  const [todayFocusCard, setTodayFocusCard] = useState<StudyFocusCard | null>(null);
  const [todayFocusLoading, setTodayFocusLoading] = useState(true);
  const [assistantThinking, setAssistantThinking] = useState(false);
  const [thinkingState, setThinkingState] = useState<AurenThinkingEvent | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const composerBottom = useRef(new Animated.Value(COMPOSER_CLOSED_BOTTOM)).current;
  const contentTranslateY = useRef(new Animated.Value(0)).current;
  const pillsOpacity = useRef(new Animated.Value(1)).current;
  const pillsTranslateY = useRef(new Animated.Value(0)).current;
  const appCardProgress = useRef(new Animated.Value(0)).current;
  const abortControllerRef = useRef<AbortController | null>(null);

  const plusSheetOpen = plusSheetStage !== 'closed';
  const controlsSheetOpen = controlsSheetStage !== 'closed';
  const anySheetOpen = plusSheetOpen || controlsSheetOpen || focusSetupOpen;
  const anySheetExpanded = plusSheetStage === 'expanded' || controlsSheetStage === 'expanded' || focusSetupOpen;
  const hasMessages = messages.length > 0;
  const profile = createSidebarProfile(session);
  const recentChats = chats.map((chat) => ({ id: chat.id, title: chat.title, time: formatChatTime(chat.updated_at), icon: getModeOption(chat.mode).icon }));

  async function refreshChats() {
    setChats(await listUserChats(session.user.id));
  }

  async function refreshTodayFocus() {
    setTodayFocusCard(await loadTodayStudyFocusCard(session.user.id));
  }

  function clearThinkingState() { setThinkingState(null); }

  function setPlusStage(nextStage: PlusSheetStage) {
    setPlusSheetStage((current) => {
      if (current === nextStage) return current;
      runHaptic(nextStage === 'closed' ? 'close' : 'open');
      return nextStage;
    });
  }

  function setControlsStage(nextStage: ControlsSheetStage) {
    setControlsSheetStage((current) => {
      if (current === nextStage) return current;
      runHaptic(nextStage === 'closed' ? 'close' : 'open');
      return nextStage;
    });
  }

  function closeAllSheets() {
    if (plusSheetOpen) setPlusStage('closed');
    if (controlsSheetOpen) setControlsStage('closed');
    if (focusSetupOpen) setFocusSetupOpen(false);
    setFocusSetupError(null);
  }

  function openSidebar() { Keyboard.dismiss(); closeAllSheets(); setSidebarOpen(true); runHaptic('open'); }
  function closeSidebar() { setSidebarOpen(false); runHaptic('close'); }
  function clearWebSearch() { setWebSearchEnabled(false); runHaptic('close'); }

  function toggleWebSearch() {
    setWebSearchEnabled((current) => !current);
    setPlusStage('closed');
    runHaptic(webSearchEnabled ? 'close' : 'open');
  }

  function openFocusSetup() {
    Keyboard.dismiss();
    setSidebarOpen(false);
    setPlusSheetStage('closed');
    setControlsSheetStage('closed');
    setFocusSetupError(null);
    setFocusSetupOpen(true);
    runHaptic('open');
  }

  function closeFocusSetup() {
    if (focusSetupSaving) return;
    setFocusSetupOpen(false);
    setFocusSetupError(null);
    runHaptic('close');
  }

  async function saveStudyFocusSetup(input: AurenStudyFocusSetupInput) {
    if (focusSetupSaving) return;
    setFocusSetupSaving(true);
    setFocusSetupError(null);
    try {
      const subject = await findOrCreateStudySubject(session.user.id, input.subject);
      const dueAt = parseDeadlineText(input.deadlineText);
      const task = await createStudyTask({
        userId: session.user.id,
        title: input.taskTitle,
        subjectId: subject?.id ?? null,
        description: input.deadlineText ? `Deadline: ${input.deadlineText}` : null,
        type: inferStudyTaskType(input.taskTitle),
        dueAt,
        priority: dueAt ? 'high' : 'normal',
        estimatedMinutes: input.sessionMinutes,
        source: 'manual',
      });
      const steps = await createStudyTaskSteps({
        userId: session.user.id,
        taskId: task.id,
        subjectId: subject?.id ?? null,
        steps: [{ title: input.nextStep, estimatedMinutes: input.sessionMinutes }],
      });
      const focusCard = await createFocusCardFromTask({
        userId: session.user.id,
        task,
        steps,
        selectedBy: 'user',
        reason: 'Created from Today’s Focus setup',
        priorityScore: dueAt ? 72 : 55,
      });
      setTodayFocusCard(focusCard);
      setTodayFocusLoading(false);
      setFocusSetupOpen(false);
      runHaptic('close');
    } catch (error) {
      setFocusSetupError(getErrorMessage(error));
    } finally {
      setFocusSetupSaving(false);
    }
  }

  function stopGenerating() {
    abortControllerRef.current?.abort();
    abortControllerRef.current = null;
    setAssistantThinking(false);
    clearThinkingState();
    setIsGenerating(false);
    runHaptic('close');
  }

  async function startNewChat() {
    abortControllerRef.current?.abort();
    setAssistantThinking(false);
    clearThinkingState();
    setIsGenerating(false);
    setWebSearchEnabled(false);
    try {
      const chat = await createUserChat(session.user.id, 'New chat', STUDY_MODE);
      setActiveChatId(chat.id);
      setMessages([]);
      setChats((currentChats) => [chat, ...currentChats.filter((item) => item.id !== chat.id)]);
    } catch {
      setActiveChatId(null);
      setMessages([]);
    } finally {
      closeSidebar();
    }
  }

  async function openStoredChat(chatId: string) {
    abortControllerRef.current?.abort();
    setAssistantThinking(false);
    clearThinkingState();
    setIsGenerating(false);
    setWebSearchEnabled(false);
    closeSidebar();
    setActiveChatId(chatId);
    try {
      const storedMessages = await loadChatMessages(session.user.id, chatId);
      setMessages(storedMessages.map(toAurenMessage).filter((message): message is AurenMessage => Boolean(message)));
    } catch {
      setMessages([]);
    }
  }

  async function ensureActiveChat(firstMessage: string) {
    if (activeChatId) return activeChatId;
    const chat = await createUserChat(session.user.id, createChatTitle(firstMessage), STUDY_MODE);
    setActiveChatId(chat.id);
    setChats((currentChats) => [chat, ...currentChats.filter((item) => item.id !== chat.id)]);
    return chat.id;
  }

  async function handleSendMessage(message: string) {
    const useWebSearch = webSearchEnabled;
    closeAllSheets();
    setWebSearchEnabled(false);
    abortControllerRef.current?.abort();

    const userMessage: AurenMessage = { id: createMessageId('user'), role: 'user', content: message, createdAt: Date.now() };
    const assistantMessageId = createMessageId('assistant');
    const assistantMessage: AurenMessage = { id: assistantMessageId, role: 'assistant', content: '', createdAt: Date.now() };
    const nextMessages = [...messages, userMessage];
    const abortController = new AbortController();
    let assistantContent = '';
    let chatIdForSend: string | null = null;

    abortControllerRef.current = abortController;
    setMessages([...nextMessages, assistantMessage]);
    clearThinkingState();
    setAssistantThinking(true);
    setIsGenerating(true);

    try {
      chatIdForSend = await ensureActiveChat(message);
      await saveChatMessage({ chatId: chatIdForSend, userId: session.user.id, role: 'user', content: message });
      const activeChat = chats.find((chat) => chat.id === chatIdForSend);
      const nextTitle = !activeChat || activeChat.title === 'New chat' ? createChatTitle(message) : undefined;
      if (nextTitle) setChats((currentChats) => currentChats.map((chat) => (chat.id === chatIdForSend ? { ...chat, title: nextTitle } : chat)));
      await sendAurenChatMessageStream(nextMessages.map((item) => ({ role: item.role, content: item.content })), {
        mode: STUDY_MODE,
        browserSearch: useWebSearch,
        signal: abortController.signal,
        onThinkingState: setThinkingState,
        onToken: (token) => {
          assistantContent += token;
          setAssistantThinking(false);
          clearThinkingState();
          setMessages((currentMessages) => currentMessages.map((currentMessage) => currentMessage.id === assistantMessageId ? { ...currentMessage, content: currentMessage.content + token } : currentMessage));
        },
      });
      if (assistantContent.trim()) await saveChatMessage({ chatId: chatIdForSend, userId: session.user.id, role: 'assistant', content: assistantContent });
      await touchChat({ chatId: chatIdForSend, userId: session.user.id, title: nextTitle });
      await refreshChats();
      await refreshTodayFocus();
    } catch (error) {
      if (abortController.signal.aborted) return;
      const fallbackText = assistantContent ? '\n\nConnection stopped before Auren finished.' : getErrorMessage(error);
      assistantContent += fallbackText;
      setMessages((currentMessages) => currentMessages.map((currentMessage) => currentMessage.id === assistantMessageId ? { ...currentMessage, content: currentMessage.content + fallbackText } : currentMessage));
      if (chatIdForSend && assistantContent.trim()) {
        try {
          await saveChatMessage({ chatId: chatIdForSend, userId: session.user.id, role: 'assistant', content: assistantContent });
          await touchChat({ chatId: chatIdForSend, userId: session.user.id });
          await refreshChats();
        } catch {}
      }
    } finally {
      if (abortControllerRef.current === abortController) abortControllerRef.current = null;
      setAssistantThinking(false);
      clearThinkingState();
      setIsGenerating(false);
    }
  }

  function openPlusSheet() {
    Keyboard.dismiss();
    setSidebarOpen(false);
    setControlsSheetStage('closed');
    setFocusSetupOpen(false);
    setPlusStage('peek');
  }

  function openControlsSheet() {
    Keyboard.dismiss();
    setSidebarOpen(false);
    setPlusSheetStage('closed');
    setFocusSetupOpen(false);
    setControlsStage('peek');
  }

  useEffect(() => { void refreshChats(); }, [session.user.id]);

  useEffect(() => {
    let active = true;
    async function loadTodayFocus() {
      setTodayFocusLoading(true);
      try {
        const card = await loadTodayStudyFocusCard(session.user.id);
        if (active) setTodayFocusCard(card);
      } catch {
        if (active) setTodayFocusCard(null);
      } finally {
        if (active) setTodayFocusLoading(false);
      }
    }
    void loadTodayFocus();
    return () => { active = false; };
  }, [session.user.id]);

  useEffect(() => {
    Animated.timing(appCardProgress, { toValue: anySheetExpanded ? 1 : 0, duration: anySheetExpanded ? 320 : 260, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
  }, [anySheetExpanded, appCardProgress]);

  useEffect(() => () => { abortControllerRef.current?.abort(); }, []);

  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const showSub = Keyboard.addListener(showEvent, (event) => {
      const duration = event.duration ?? 250;
      const nextBottom = Math.max(COMPOSER_CLOSED_BOTTOM, event.endCoordinates.height - insets.bottom + COMPOSER_KEYBOARD_GAP + COMPOSER_KEYBOARD_EXTRA_LIFT);
      Animated.parallel([
        Animated.timing(composerBottom, { toValue: nextBottom, duration, easing: Easing.out(Easing.cubic), useNativeDriver: false }),
        Animated.timing(contentTranslateY, { toValue: -CONTENT_KEYBOARD_LIFT, duration, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
        Animated.timing(pillsOpacity, { toValue: 0, duration: Math.min(duration, 190), easing: Easing.out(Easing.cubic), useNativeDriver: true }),
        Animated.timing(pillsTranslateY, { toValue: -PILLS_KEYBOARD_LIFT, duration, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      ]).start();
    });
    const hideSub = Keyboard.addListener(hideEvent, (event) => {
      const duration = event.duration ?? 220;
      Animated.parallel([
        Animated.timing(composerBottom, { toValue: COMPOSER_CLOSED_BOTTOM, duration, easing: Easing.out(Easing.cubic), useNativeDriver: false }),
        Animated.timing(contentTranslateY, { toValue: 0, duration, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
        Animated.timing(pillsOpacity, { toValue: 1, duration, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
        Animated.timing(pillsTranslateY, { toValue: 0, duration, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      ]).start();
    });
    return () => { showSub.remove(); hideSub.remove(); };
  }, [composerBottom, contentTranslateY, insets.bottom, pillsOpacity, pillsTranslateY]);

  const appScale = appCardProgress.interpolate({ inputRange: [0, 1], outputRange: [1, 0.945] });
  const appTranslateY = appCardProgress.interpolate({ inputRange: [0, 1], outputRange: [0, 42] });
  const appDimOpacity = appCardProgress.interpolate({ inputRange: [0, 1], outputRange: [0, 0.12] });

  return (
    <AurenSidebar open={sidebarOpen} onOpen={openSidebar} onClose={closeSidebar} onNewChat={startNewChat} onViewAll={closeSidebar} onOpenProfile={closeSidebar} onOpenRecentChat={openStoredChat} recentChats={recentChats} profile={profile}>
      <View style={styles.sceneRoot}>
        <StatusBar style={anySheetExpanded ? 'light' : 'dark'} />
        <Animated.View style={[styles.darkFrame, { opacity: appDimOpacity }]} />
        <Animated.View style={[styles.appCard, { borderRadius: anySheetExpanded ? 34 : 0, transform: [{ scale: appScale }, { translateY: appTranslateY }] }]}>
          <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
            <View style={styles.dismissArea}>
              <View style={styles.header}>
                <Pressable onPress={openSidebar} hitSlop={14} style={({ pressed }) => [styles.menuButton, pressed && styles.menuButtonPressed]} accessibilityRole="button" accessibilityLabel="Open menu"><MenuIcon /></Pressable>
                <View style={styles.brandButton} accessibilityRole="header"><Text style={styles.brand}>Auren</Text></View>
                <View style={styles.headerSpacer} />
              </View>
              <Animated.View style={[styles.content, hasMessages ? styles.chatContent : styles.startContent, { transform: [{ translateY: contentTranslateY }] }]}>
                {hasMessages ? <AurenMessageList messages={messages} assistantThinking={assistantThinking} thinkingState={thinkingState} /> : (
                  <Pressable style={styles.startDismissArea} onPress={Keyboard.dismiss}>
                    <View style={styles.hero}>
                      <Text style={styles.title}>{'Good evening,\nlet’s study smarter.'}</Text>
                      <Text style={styles.subtitle}>{'I’m here to help you focus, learn faster,\nand stay on track.'}</Text>
                    </View>
                    <Animated.View pointerEvents="box-none" style={[styles.pillsRow, { opacity: pillsOpacity, transform: [{ translateY: pillsTranslateY }] }]}>
                      <AurenActionPill width={104} icon={<StudyBookIcon size={23} color={STUDY_ACTION_ICON_COLOR} strokeWidth={1.7} />} label="Explain a concept" />
                      <AurenActionPill width={104} icon={<StudyQuizIcon size={23} color={STUDY_ACTION_ICON_COLOR} strokeWidth={1.7} />} label="Quiz me" />
                      <AurenActionPill width={104} icon={<StudyCalendarIcon size={23} color={STUDY_ACTION_ICON_COLOR} strokeWidth={1.7} />} label="Make a study plan" />
                    </Animated.View>
                    <View style={styles.focusCardWrap} pointerEvents="none"><AurenTodayFocusCard focusCard={todayFocusCard} loading={todayFocusLoading} onPress={openFocusSetup} /></View>
                  </Pressable>
                )}
              </Animated.View>
            </View>
            <Animated.View style={[styles.composerWrap, { bottom: composerBottom }]}> 
              <AurenComposer onOpenPlus={openPlusSheet} onOpenControls={openControlsSheet} onSendMessage={handleSendMessage} onStopGenerating={stopGenerating} onClearWebSearch={clearWebSearch} isGenerating={isGenerating} plusActive={plusSheetOpen} controlsActive={controlsSheetOpen} webSearchActive={webSearchEnabled} />
            </Animated.View>
          </SafeAreaView>
        </Animated.View>
        {anySheetOpen ? <Pressable style={styles.plusBackdrop} onPress={closeAllSheets} /> : null}
        <AurenPlusSheet stage={plusSheetStage} onStageChange={setPlusStage} webSearchActive={webSearchEnabled} onWebSearchPress={toggleWebSearch} />
        <AurenControlsSheet stage={controlsSheetStage} onStageChange={setControlsStage} />
        <AurenStudyFocusSetupSheet open={focusSetupOpen} saving={focusSetupSaving} error={focusSetupError} onClose={closeFocusSetup} onSave={saveStudyFocusSetup} />
      </View>
    </AurenSidebar>
  );
}

const styles = StyleSheet.create({
  sceneRoot: { flex: 1, backgroundColor: '#050507' },
  darkFrame: { ...StyleSheet.absoluteFillObject, backgroundColor: '#050507' },
  appCard: { flex: 1, overflow: 'hidden', backgroundColor: colors.background },
  safeArea: { flex: 1, backgroundColor: colors.background },
  dismissArea: { flex: 1 },
  startDismissArea: { flex: 1, width: '100%', alignItems: 'center', justifyContent: 'flex-start' },
  header: { zIndex: 60, height: 82, paddingHorizontal: spacing.screenX, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  menuButton: { width: 68, alignItems: 'flex-start', justifyContent: 'center' },
  menuButtonPressed: { opacity: 0.62 },
  brandButton: { minWidth: 148, alignItems: 'center', justifyContent: 'center' },
  brand: { color: colors.text, fontSize: 28, lineHeight: 34, letterSpacing: -0.9, fontFamily: serifFont },
  headerSpacer: { width: 68 },
  content: { flex: 1, width: '100%', paddingHorizontal: 18 },
  startContent: { alignItems: 'center', justifyContent: 'flex-start', paddingTop: 66, paddingBottom: 190 },
  chatContent: { alignItems: 'stretch', justifyContent: 'flex-end', paddingHorizontal: 0, paddingBottom: 0 },
  hero: { alignItems: 'center', maxWidth: 370 },
  title: { color: '#686775', fontSize: 33.5, lineHeight: 40, letterSpacing: -1.08, textAlign: 'center', fontFamily: serifFont },
  subtitle: { marginTop: 14, color: colors.muted, fontSize: 15.8, lineHeight: 22.5, letterSpacing: -0.14, textAlign: 'center', fontWeight: '500' },
  pillsRow: { marginTop: 32, width: '100%', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10 },
  focusCardWrap: { display: 'none', width: '100%', alignItems: 'center', marginTop: 24, paddingHorizontal: 6 },
  composerWrap: { position: 'absolute', left: 16, right: 16 },
  plusBackdrop: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 30 },
});