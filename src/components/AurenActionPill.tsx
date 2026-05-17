import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors } from '../theme';

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
    height: 64,
    paddingHorizontal: 8,
    paddingTop: 10,
    paddingBottom: 9,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(17,24,39,0.045)',
    backgroundColor: 'rgba(255,255,255,0.54)',
    alignItems: 'center',
    justifyContent: 'space-between',
    shadowColor: '#111827',
    shadowOpacity: 0.028,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 7 },
    elevation: 1,
  },
  pressed: {
    transform: [{ scale: 0.99 }],
    opacity: 0.82,
  },
  icon: {
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
    opacity: 0.82,
  },
  label: {
    color: colors.text,
    fontSize: 12.1,
    lineHeight: 15,
    letterSpacing: -0.22,
    fontWeight: '500',
    textAlign: 'center',
    opacity: 0.9,
  },
});