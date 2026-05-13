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
      <Text style={styles.label}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  pill: {
    minWidth: 134,
    height: 50,
    paddingHorizontal: 18,
    borderRadius: spacing.radiusFull,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 11,
    ...shadows.tiny,
  },
  pressed: {
    transform: [{ scale: 0.985 }],
    opacity: 0.82,
  },
  icon: {
    width: 23,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    color: colors.muted,
    fontSize: 17,
    letterSpacing: -0.2,
    fontWeight: '500',
  },
});
