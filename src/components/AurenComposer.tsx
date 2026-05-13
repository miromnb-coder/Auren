import { useMemo, useState } from 'react';
import { Keyboard, Pressable, StyleSheet, TextInput, View } from 'react-native';
import { colors, shadows } from '../theme';
import { ChatIcon, ControlsIcon, MicIcon, PlusIcon, SendIcon } from './AurenIcons';

const INPUT_LINE_HEIGHT = 22;
const MIN_INPUT_HEIGHT = 22;
const MAX_INPUT_HEIGHT = INPUT_LINE_HEIGHT * 5;

export function AurenComposer() {
  const [draft, setDraft] = useState('');
  const [inputHeight, setInputHeight] = useState(MIN_INPUT_HEIGHT);
  const [inputScrollable, setInputScrollable] = useState(false);

  const trimmedDraft = useMemo(() => draft.trim(), [draft]);
  const canSend = trimmedDraft.length > 0;

  function handleSend() {
    if (!canSend) {
      return;
    }

    console.log('[Auren] User message:', trimmedDraft);
    setDraft('');
    setInputHeight(MIN_INPUT_HEIGHT);
    setInputScrollable(false);
    Keyboard.dismiss();
  }

  return (
    <View style={styles.shell}>
      <TextInput
        value={draft}
        onChangeText={setDraft}
        onContentSizeChange={(event) => {
          const contentHeight = event.nativeEvent.contentSize.height;
          const nextHeight = Math.min(
            Math.max(contentHeight, MIN_INPUT_HEIGHT),
            MAX_INPUT_HEIGHT,
          );

          setInputHeight(nextHeight);
          setInputScrollable(contentHeight > MAX_INPUT_HEIGHT + 1);
        }}
        placeholder="Ask anything, or assign a task"
        placeholderTextColor={colors.mutedSoft}
        style={[styles.input, { height: inputHeight }]}
        multiline
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
    minHeight: 112,
    maxHeight: 200,
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
