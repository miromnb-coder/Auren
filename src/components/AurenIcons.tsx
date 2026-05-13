import { StyleSheet, Text, View } from 'react-native';
import { colors } from '../theme';

type IconProps = {
  muted?: boolean;
};

export function MenuIcon() {
  return (
    <View style={styles.menu}>
      <View style={[styles.menuLine, { width: 25 }]} />
      <View style={[styles.menuLine, { width: 18 }]} />
    </View>
  );
}

export function PlusIcon() {
  return <Text style={styles.iconText}>+</Text>;
}

export function ChevronIcon() {
  return <Text style={styles.chevron}>{'>'}</Text>;
}

export function ChatIcon() {
  return (
    <View style={styles.chatBubble}>
      <View style={styles.chatTail} />
    </View>
  );
}

export function MicIcon() {
  return (
    <View style={styles.micWrap}>
      <View style={styles.micCapsule} />
      <View style={styles.micStem} />
      <View style={styles.micBase} />
    </View>
  );
}

export function SendIcon({ muted }: IconProps) {
  return <Text style={[styles.sendText, muted && styles.muted]}>↑</Text>;
}

export function ControlsIcon() {
  return (
    <View style={styles.controlsWrap}>
      <View style={styles.sliderRow}>
        <View style={styles.sliderLine} />
        <View style={[styles.sliderDot, { left: 10 }]} />
      </View>
      <View style={styles.sliderRow}>
        <View style={styles.sliderLine} />
        <View style={[styles.sliderDot, { left: 23 }]} />
      </View>
      <View style={styles.sliderRow}>
        <View style={styles.sliderLine} />
        <View style={[styles.sliderDot, { left: 16 }]} />
      </View>
    </View>
  );
}

export function CalendarIcon() {
  return (
    <View style={styles.calendar}>
      <View style={styles.calendarTop} />
    </View>
  );
}

export function ListIcon() {
  return (
    <View style={styles.listWrap}>
      <View style={styles.listRow} />
      <View style={styles.listRow} />
      <View style={styles.listRow} />
    </View>
  );
}

export function SparkIcon() {
  return <Text style={styles.spark}>✦</Text>;
}

const styles = StyleSheet.create({
  menu: {
    gap: 9,
    width: 30,
    alignItems: 'flex-start',
  },
  menuLine: {
    height: 2,
    borderRadius: 99,
    backgroundColor: colors.muted,
  },
  iconText: {
    fontSize: 31,
    lineHeight: 32,
    color: colors.icon,
    fontWeight: '300',
  },
  chevron: {
    marginLeft: 17,
    marginTop: 2,
    color: colors.muted,
    fontSize: 33,
    lineHeight: 35,
    fontWeight: '300',
  },
  chatBubble: {
    width: 26,
    height: 23,
    borderWidth: 2.2,
    borderColor: colors.icon,
    borderRadius: 10,
    transform: [{ rotate: '-3deg' }],
  },
  chatTail: {
    position: 'absolute',
    left: 4,
    bottom: -5,
    width: 10,
    height: 8,
    borderLeftWidth: 2.2,
    borderBottomWidth: 2.2,
    borderColor: colors.icon,
    borderBottomLeftRadius: 7,
    backgroundColor: 'transparent',
  },
  micWrap: {
    width: 28,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  micCapsule: {
    width: 12,
    height: 22,
    borderWidth: 2.2,
    borderColor: colors.icon,
    borderRadius: 8,
  },
  micStem: {
    width: 2.2,
    height: 7,
    backgroundColor: colors.icon,
    borderRadius: 99,
  },
  micBase: {
    width: 17,
    height: 2.2,
    backgroundColor: colors.icon,
    borderRadius: 99,
  },
  sendText: {
    fontSize: 27,
    lineHeight: 30,
    color: colors.mutedSoft,
    fontWeight: '300',
  },
  muted: {
    opacity: 0.7,
  },
  controlsWrap: {
    width: 32,
    height: 25,
    justifyContent: 'space-between',
  },
  sliderRow: {
    height: 5,
    justifyContent: 'center',
  },
  sliderLine: {
    height: 1.7,
    borderRadius: 99,
    backgroundColor: colors.icon,
    opacity: 0.82,
  },
  sliderDot: {
    position: 'absolute',
    top: 0.3,
    width: 4.5,
    height: 4.5,
    borderRadius: 99,
    backgroundColor: colors.surfaceStrong,
    borderWidth: 1.5,
    borderColor: colors.icon,
  },
  calendar: {
    width: 22,
    height: 23,
    borderWidth: 1.8,
    borderColor: colors.muted,
    borderRadius: 4,
  },
  calendarTop: {
    height: 6,
    borderBottomWidth: 1.8,
    borderBottomColor: colors.muted,
  },
  listWrap: {
    width: 24,
    gap: 5,
  },
  listRow: {
    width: 22,
    height: 2,
    borderRadius: 99,
    backgroundColor: colors.muted,
  },
  spark: {
    color: colors.muted,
    fontSize: 22,
    lineHeight: 24,
  },
});
