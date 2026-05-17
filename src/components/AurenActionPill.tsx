import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, shadows } from '../theme';

type Props = {
  icon: ReactNode;
  label: string;
  width?: number;
  onPress?: () => void;
};

export function AurenActionPill({ icon, label, width = 110, onPress }: Props) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.card, { width }, pressed && styles.pressed]}>
      <View style={styles.icon}>{icon}</View>
      <Text style={styles.label} numberOfLines={1}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    height: 78,
    paddingHorizontal: 8,
    paddingTop: 14,
    paddingBottom: 12,
    borderRadius: 17,
    borderWidth: 1,
    borderColor: 'rgba(17,24,39,0.052)',
    backgroundColor: 'rgba(255,255,255,0.74)',
    alignItems: 'center',
    justifyContent: 'space-between',
    ...shadows.tiny,
  },
  pressed: {
    transform: [{ scale: 0.985 }],
    opacity: 0.86,
  },
  icon: {
    height: 30,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    color: colors.text,
    fontSize: 12.35,
    lineHeight: 16,
    letterSpacing: -0.22,
    fontWeight: '500',
    textAlign: 'center',
  },
});