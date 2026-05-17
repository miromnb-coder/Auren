import Ionicons from '@expo/vector-icons/Ionicons';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors } from '../theme';
import { AurenShareSheet } from './AurenShareSheet';

type IconProps = {
  muted?: boolean;
  active?: boolean;
};

export type AurenStatusIconType = 'memory' | 'saved' | 'done' | 'alert' | 'search' | 'idea';

const ink = '#1d1d1f';
const lightInk = '#f8f8f6';
const softInk = '#70717a';
const headerInk = '#2b2c2f';

const STATUS_ICON_MAP: Record<AurenStatusIconType, keyof typeof Ionicons.glyphMap> = {
  memory: 'sparkles',
  saved: 'bookmark-outline',
  done: 'checkmark-circle-outline',
  alert: 'warning-outline',
  search: 'search-outline',
  idea: 'bulb-outline',
};

export function MenuIcon() {
  return (
    <View style={styles.menu}>
      <View style={[styles.menuLine, { width: 24 }]} />
      <View style={[styles.menuLine, { width: 18 }]} />
    </View>
  );
}

export function HeaderShareIcon() {
  const [shareSheetOpen, setShareSheetOpen] = useState(false);

  return (
    <>
      <Pressable
        onPress={() => setShareSheetOpen(true)}
        hitSlop={10}
        style={({ pressed }) => [styles.headerIconPressable, pressed && styles.headerIconPressed]}
        accessibilityRole="button"
        accessibilityLabel="Share conversation"
      >
        <Ionicons name="arrow-redo-outline" size={30} color={headerInk} />
      </Pressable>
      <AurenShareSheet open={shareSheetOpen} onClose={() => setShareSheetOpen(false)} />
    </>
  );
}

export function HeaderMoreIcon() {
  return <Ionicons name="ellipsis-horizontal" size={29} color={headerInk} />;
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

export function SendIcon({ muted, active }: IconProps) {
  return <Ionicons name="arrow-up" size={20} color={active ? lightInk : muted ? colors.mutedSoft : ink} />;
}

export function StopIcon() {
  return <Ionicons name="stop" size={16} color={lightInk} />;
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

export function AurenStatusIcon({ type, size = 17 }: { type: AurenStatusIconType; size?: number }) {
  return <Ionicons name={STATUS_ICON_MAP[type]} size={size} color={ink} />;
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
  headerIconPressable: {
    width: 34,
    height: 34,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerIconPressed: {
    opacity: 0.58,
  },
  chevron: {
    marginLeft: 8,
    marginTop: 2,
    color: colors.muted,
    fontSize: 22,
    lineHeight: 24,
    fontWeight: '300',
  },
});