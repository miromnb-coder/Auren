import { useMemo, useState } from 'react';
import { Keyboard, Pressable, StyleSheet, TextInput, View } from 'react-native';
import { colors, shadows } from '../theme';
import { ChatIcon, ControlsIcon, MicIcon, PlusIcon, SendIcon } from './AurenIcons';

export function AurenComposer() {
  const [draft, setDraft] = useState('');

  const trimmedDraft = useMemo(() => draft.trim(), [draft]);
  const canSend = trimmedDraft.length > 0;

  function handleSend() {
    if (!canSend) {
      return;
    }

    console.log('[Auren] User message:', trimmedDraft);
    setDraft('');
    Keyboard.dismiss();
  }

  return (
    <View style={styles.shell}>
      <TextInput
        value={draft}
        onChangeText={setDraft}
        placeholder="Ask anything, or assign a task"
        placeholderTextColor={colors.mutedSoft}
        style={styles.input}
        multiline
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
    height: 112,
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
    minHeight: 22,
    maxHeight: 36,
    padding: 0,
    margin: 0,
    color: colors.text,
    fontSize: 17,
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
