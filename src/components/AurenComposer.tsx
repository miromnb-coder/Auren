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
  placeholder: {
    color: colors.mutedSoft,
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
});
