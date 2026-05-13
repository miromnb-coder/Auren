import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, shadows } from '../theme';
import { ChatIcon, ControlsIcon, MicIcon, PlusIcon, SendIcon } from './AurenIcons';

export function AurenComposer() {
  return (
    <View style={styles.shell}>
      <Text style={styles.placeholder} numberOfLines={1}>Ask anything, or assign a task</Text>
      <View style={styles.actionsRow}>
        <View style={styles.leftActions}>
          <Pressable style={styles.iconButton}><PlusIcon /></Pressable>
          <Pressable style={styles.iconButton}><ControlsIcon /></Pressable>
        </View>
        <View style={styles.rightActions}>
          <Pressable style={styles.iconButton}><ChatIcon /></Pressable>
          <Pressable style={styles.iconButton}><MicIcon /></Pressable>
          <Pressable style={[styles.iconButton, styles.sendButton]}><SendIcon muted /></Pressable>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  shell: {
    width: '100%',
    height: 112,
    borderRadius: 39,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.82)',
    backgroundColor: colors.surfaceStrong,
    paddingHorizontal: 19,
    paddingTop: 17,
    paddingBottom: 16,
    overflow: 'hidden',
    ...shadows.soft,
  },
  placeholder: {
    color: colors.mutedSoft,
    fontSize: 17,
    letterSpacing: -0.25,
  },
  actionsRow: {
    marginTop: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  leftActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  rightActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  iconButton: {
    width: 45,
    height: 45,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: 'rgba(255,255,255,0.46)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendButton: {
    backgroundColor: colors.disabled,
    borderColor: 'rgba(17,24,39,0.035)',
  },
});
