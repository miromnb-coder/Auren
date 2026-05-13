import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, shadows, spacing } from '../theme';

type Props = {
  icon: ReactNode;
  label: string;
  onPress?: () => void;
};

export function AurenActionPill({ icon, label, onPress }: Props) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.pill, pressed && styles.pressed]}>
      <View style={styles.icon}>{icon}</View>
      <Text style={styles.label} numberOfLines={1}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  pill: {
    width: 104,
    height: 38,
    paddingHorizontal: 10,
    borderRadius: spacing.radiusFull,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    ...shadows.tiny,
  },
  pressed: {
    transform: [{ scale: 0.985 }],
    opacity: 0.82,
  },
  icon: {
    width: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    flexShrink: 1,
    color: colors.muted,
    fontSize: 13.5,
    letterSpacing: -0.15,
    fontWeight: '500',
  },
});
