import { StyleSheet, Text, View } from 'react-native';
import { colors } from '../theme';

type IconProps = {
  muted?: boolean;
};

export function MenuIcon() {
  return (
    <View style={styles.menu}>
      <View style={[styles.menuLine, { width: 24 }]} />
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
        <View style={[styles.sliderDot, { left: 8 }]} />
      </View>
      <View style={styles.sliderRow}>
        <View style={styles.sliderLine} />
        <View style={[styles.sliderDot, { left: 18 }]} />
      </View>
      <View style={styles.sliderRow}>
        <View style={styles.sliderLine} />
        <View style={[styles.sliderDot, { left: 12 }]} />
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
    gap: 8,
    width: 28,
    alignItems: 'flex-start',
  },
  menuLine: {
    height: 2,
    borderRadius: 99,
    backgroundColor: colors.muted,
  },
  iconText: {
    fontSize: 27,
    lineHeight: 28,
    color: colors.icon,
    fontWeight: '300',
  },
  chevron: {
    marginLeft: 15,
    marginTop: 2,
    color: colors.muted,
    fontSize: 28,
    lineHeight: 30,
    fontWeight: '300',
  },
  chatBubble: {
    width: 22,
    height: 19,
    borderWidth: 2,
    borderColor: colors.icon,
    borderRadius: 9,
    transform: [{ rotate: '-3deg' }],
  },
  chatTail: {
    position: 'absolute',
    left: 4,
    bottom: -5,
    width: 8,
    height: 7,
    borderLeftWidth: 2,
    borderBottomWidth: 2,
    borderColor: colors.icon,
    borderBottomLeftRadius: 6,
    backgroundColor: 'transparent',
  },
  micWrap: {
    width: 24,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  micCapsule: {
    width: 11,
    height: 20,
    borderWidth: 2,
    borderColor: colors.icon,
    borderRadius: 8,
  },
  micStem: {
    width: 2,
    height: 6,
    backgroundColor: colors.icon,
    borderRadius: 99,
  },
  micBase: {
    width: 15,
    height: 2,
    backgroundColor: colors.icon,
    borderRadius: 99,
  },
  sendText: {
    fontSize: 24,
    lineHeight: 26,
    color: colors.mutedSoft,
    fontWeight: '300',
  },
  muted: {
    opacity: 0.7,
  },
  controlsWrap: {
    width: 25,
    height: 19,
    justifyContent: 'space-between',
  },
  sliderRow: {
    height: 4,
    justifyContent: 'center',
  },
  sliderLine: {
    height: 1.6,
    borderRadius: 99,
    backgroundColor: colors.icon,
    opacity: 0.82,
  },
  sliderDot: {
    position: 'absolute',
    top: -0.1,
    width: 4.2,
    height: 4.2,
    borderRadius: 99,
    backgroundColor: colors.surfaceStrong,
    borderWidth: 1.4,
    borderColor: colors.icon,
  },
  calendar: {
    width: 17,
    height: 18,
    borderWidth: 1.6,
    borderColor: colors.muted,
    borderRadius: 3.5,
  },
  calendarTop: {
    height: 5,
    borderBottomWidth: 1.6,
    borderBottomColor: colors.muted,
  },
  listWrap: {
    width: 18,
    gap: 4,
  },
  listRow: {
    width: 18,
    height: 1.7,
    borderRadius: 99,
    backgroundColor: colors.muted,
  },
  spark: {
    color: colors.muted,
    fontSize: 17,
    lineHeight: 19,
  },
});
