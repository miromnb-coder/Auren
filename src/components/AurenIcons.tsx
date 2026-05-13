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
        <View style={[styles.sliderDot, { left: 7 }]} />
      </View>
      <View style={styles.sliderRow}>
        <View style={styles.sliderLine} />
        <View style={[styles.sliderDot, { left: 17 }]} />
      </View>
      <View style={styles.sliderRow}>
        <View style={styles.sliderLine} />
        <View style={[styles.sliderDot, { left: 11 }]} />
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
    fontSize: 25,
    lineHeight: 25,
    color: '#1d1d1f',
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
    width: 19,
    height: 17,
    borderWidth: 1.75,
    borderColor: '#1d1d1f',
    borderRadius: 8,
    transform: [{ rotate: '-3deg' }],
  },
  chatTail: {
    position: 'absolute',
    left: 3,
    bottom: -4,
    width: 7,
    height: 6,
    borderLeftWidth: 1.75,
    borderBottomWidth: 1.75,
    borderColor: '#1d1d1f',
    borderBottomLeftRadius: 5,
    backgroundColor: 'transparent',
  },
  micWrap: {
    width: 21,
    height: 25,
    alignItems: 'center',
    justifyContent: 'center',
  },
  micCapsule: {
    width: 10,
    height: 18,
    borderWidth: 1.85,
    borderColor: '#1d1d1f',
    borderRadius: 8,
  },
  micStem: {
    width: 1.85,
    height: 5,
    backgroundColor: '#1d1d1f',
    borderRadius: 99,
  },
  micBase: {
    width: 13,
    height: 1.85,
    backgroundColor: '#1d1d1f',
    borderRadius: 99,
  },
  sendText: {
    fontSize: 22,
    lineHeight: 23,
    color: colors.mutedSoft,
    fontWeight: '300',
  },
  muted: {
    opacity: 0.68,
  },
  controlsWrap: {
    width: 23,
    height: 17,
    justifyContent: 'space-between',
  },
  sliderRow: {
    height: 3.8,
    justifyContent: 'center',
  },
  sliderLine: {
    height: 1.55,
    borderRadius: 99,
    backgroundColor: '#1d1d1f',
    opacity: 0.86,
  },
  sliderDot: {
    position: 'absolute',
    top: -0.15,
    width: 3.9,
    height: 3.9,
    borderRadius: 99,
    backgroundColor: colors.surfaceStrong,
    borderWidth: 1.25,
    borderColor: '#1d1d1f',
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
