import { useMemo, useState } from 'react';
import { Keyboard, Pressable, StyleSheet, TextInput, View } from 'react-native';
import { colors, shadows } from '../theme';
import { ChatIcon, ControlsIcon, MicIcon, PlusIcon, SendIcon } from './AurenIcons';

const INPUT_LINE_HEIGHT = 22;
const MIN_VISIBLE_LINES = 1;
const MAX_VISIBLE_LINES = 5;
const BASE_COMPOSER_HEIGHT = 112;
const MIN_INPUT_HEIGHT = INPUT_LINE_HEIGHT * MIN_VISIBLE_LINES;
const MAX_INPUT_HEIGHT = INPUT_LINE_HEIGHT * MAX_VISIBLE_LINES;
const APPROX_CHARS_PER_LINE = 31;

function getVisualLineCount(text: string) {
  if (text.length === 0) {
    return MIN_VISIBLE_LINES;
  }

  return text.split('\n').reduce((total, line) => {
    const wrappedLineCount = Math.max(1, Math.ceil(line.length / APPROX_CHARS_PER_LINE));
    return total + wrappedLineCount;
  }, 0);
}

export function AurenComposer() {
  const [draft, setDraft] = useState('');
  const [visibleLineCount, setVisibleLineCount] = useState(MIN_VISIBLE_LINES);

  const trimmedDraft = useMemo(() => draft.trim(), [draft]);
  const canSend = trimmedDraft.length > 0;
  const inputHeight = Math.min(visibleLineCount, MAX_VISIBLE_LINES) * INPUT_LINE_HEIGHT;
  const inputScrollable = visibleLineCount > MAX_VISIBLE_LINES;
  const composerHeight = BASE_COMPOSER_HEIGHT + inputHeight - MIN_INPUT_HEIGHT;

  function updateDraft(nextDraft: string) {
    setDraft(nextDraft);
    setVisibleLineCount(getVisualLineCount(nextDraft));
  }

  function handleSend() {
    if (!canSend) return;

    console.log('[Auren] User message:', trimmedDraft);
    setDraft('');
    setVisibleLineCount(MIN_VISIBLE_LINES);
    Keyboard.dismiss();
  }

  return (
    <View style={[styles.shell, { height: composerHeight }]}>
      <TextInput
        value={draft}
        onChangeText={updateDraft}
        placeholder="Ask anything, or assign a task"
        placeholderTextColor={colors.mutedSoft}
        style={[styles.input, { height: inputHeight }]}
        multiline
        numberOfLines={Math.min(visibleLineCount, MAX_VISIBLE_LINES)}
        scrollEnabled={inputScrollable}
        maxLength={1000}
        textAlignVertical="top"
        autoCorrect
        spellCheck
        returnKeyType="default"
        keyboardAppearance="light"
        accessibilityLabel="Auren message input"
      />

      <View style={styles.actionsRow}>
        <View style={styles.leftActions}>
          <Pressable style={styles.iconButton} accessibilityLabel="Add attachment"><PlusIcon /></Pressable>
          <Pressable style={styles.iconButton} accessibilityLabel="Open controls"><ControlsIcon /></Pressable>
        </View>
        <View style={styles.rightActions}>
          <Pressable style={styles.iconButton} accessibilityLabel="Chat mode"><ChatIcon /></Pressable>
          <Pressable style={styles.iconButton} accessibilityLabel="Voice input"><MicIcon /></Pressable>
          <Pressable
            disabled={!canSend}
            onPress={handleSend}
            style={[styles.iconButton, styles.sendButton, canSend && styles.sendButtonActive]}
            accessibilityLabel="Send message"
          >
            <SendIcon muted={!canSend} />
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  shell: {
    width: '100%',
    minHeight: BASE_COMPOSER_HEIGHT,
    maxHeight: BASE_COMPOSER_HEIGHT + MAX_INPUT_HEIGHT - MIN_INPUT_HEIGHT,
    borderRadius: 40,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.84)',
    backgroundColor: colors.surfaceStrong,
    paddingHorizontal: 20,
    paddingTop: 17,
    paddingBottom: 17,
    overflow: 'hidden',
    ...shadows.soft,
  },
  input: {
    padding: 0,
    margin: 0,
    color: colors.text,
    fontSize: 17,
    lineHeight: INPUT_LINE_HEIGHT,
    letterSpacing: -0.25,
    includeFontPadding: false,
  },
  actionsRow: {
    marginTop: 17,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  leftActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 13,
  },
  rightActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 13,
  },
  iconButton: {
    width: 38,
    height: 38,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(17,24,39,0.055)',
    backgroundColor: 'rgba(255,255,255,0.34)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendButton: {
    backgroundColor: 'rgba(225,226,232,0.78)',
    borderColor: 'rgba(17,24,39,0.025)',
  },
  sendButtonActive: {
    backgroundColor: 'rgba(29,29,31,0.92)',
  },
});
