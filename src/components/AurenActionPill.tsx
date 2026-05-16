import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, shadows, spacing } from '../theme';

type Props = {
  icon: ReactNode;
  label: string;
  width?: number;
  onPress?: () => void;
};

export function AurenActionPill({ icon, label, width = 112, onPress }: Props) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.pill, { width }, pressed && styles.pressed]}>
      <View style={styles.icon}>{icon}</View>
      <Text style={styles.label} numberOfLines={1}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  pill: {
    height: 38,
    paddingHorizontal: 8,
    borderRadius: spacing.radiusFull,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    ...shadows.tiny,
  },
  pressed: {
    transform: [{ scale: 0.985 }],
    opacity: 0.82,
  },
  icon: {
    width: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    flexShrink: 1,
    color: colors.muted,
    fontSize: 12.35,
    letterSpacing: -0.22,
    fontWeight: '550',
  },
});
