import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, Text, View } from 'react-native';
import { colors } from '../theme';

type IconProps = {
  muted?: boolean;
};

const ink = '#1d1d1f';
const softInk = '#70717a';

export function MenuIcon() {
  return (
    <View style={styles.menu}>
      <View style={[styles.menuLine, { width: 24 }]} />
      <View style={[styles.menuLine, { width: 18 }]} />
    </View>
  );
}

export function PlusIcon() {
  return <Ionicons name="add" size={25} color={ink} />;
}

export function ChevronIcon() {
  return <Text style={styles.chevron}>{'>'}</Text>;
}

export function ChatIcon() {
  return <Ionicons name="chatbubble-outline" size={20} color={ink} />;
}

export function MicIcon() {
  return <Ionicons name="mic-outline" size={22} color={ink} />;
}

export function SendIcon({ muted }: IconProps) {
  return <Ionicons name="arrow-up" size={20} color={muted ? colors.mutedSoft : ink} />;
}

export function ControlsIcon() {
  return <Ionicons name="options-outline" size={22} color={ink} />;
}

export function CalendarIcon() {
  return <Ionicons name="calendar-outline" size={17} color={softInk} />;
}

export function ListIcon() {
  return <Ionicons name="list-outline" size={20} color={softInk} />;
}

export function SparkIcon() {
  return <Ionicons name="sparkles" size={16} color={softInk} />;
}

const styles = StyleSheet.create({
  menu: {
    gap: 8,
    width: 28,
    alignItems: 'flex-start',
  },
  menuLine: {
    height: 2,
    borderRadius: 99,
    backgroundColor: colors.muted,
  },
  chevron: {
    marginLeft: 15,
    marginTop: 2,
    color: colors.muted,
    fontSize: 28,
    lineHeight: 30,
    fontWeight: '300',
  },
});
