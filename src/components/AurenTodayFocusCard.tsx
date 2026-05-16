import Ionicons from '@expo/vector-icons/Ionicons';
import { Platform, StyleSheet, Text, View } from 'react-native';
import { colors, shadows } from '../theme';

const serifFont = Platform.select({
  ios: 'Georgia',
  android: 'serif',
  default: 'serif',
});

export function AurenTodayFocusCard() {
  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <View style={styles.cardEyebrowWrap}>
          <Ionicons name="radio-button-on-outline" size={17} color="#8f909a" />
          <Text style={styles.eyebrow}>TODAY&apos;S FOCUS</Text>
        </View>
        <Ionicons name="ellipsis-horizontal" size={24} color="#92939d" />
      </View>

      <View style={styles.contentRow}>
        <View style={styles.iconBubble}>
          <Ionicons name="reader-outline" size={32} color="#737480" />
        </View>

        <View style={styles.taskContent}>
          <Text style={styles.taskTitle}>Math exam prep</Text>
          <Text style={styles.nextStep}>
            Next step: <Text style={styles.nextStepStrong}>Review equations</Text>
          </Text>
          <View style={styles.timeRow}>
            <Ionicons name="time-outline" size={17} color="#8a8b95" />
            <Text style={styles.timeText}>25 min session</Text>
          </View>
        </View>
      </View>

      <View style={styles.progressRow}>
        <View style={styles.progressTrack}>
          <View style={styles.progressFill} />
        </View>
        <Text style={styles.progressLabel}>2 / 5 tasks</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    width: '100%',
    maxWidth: 370,
    height: 176,
    borderRadius: 27,
    borderWidth: 1,
    borderColor: 'rgba(17,24,39,0.055)',
    backgroundColor: 'rgba(255,255,255,0.72)',
    paddingHorizontal: 18,
    paddingTop: 16,
    paddingBottom: 16,
    ...shadows.soft,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  cardEyebrowWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  eyebrow: {
    color: '#8b8c96',
    fontSize: 12.2,
    lineHeight: 16,
    letterSpacing: 4,
    fontWeight: '650',
  },
  contentRow: {
    marginTop: 16,
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconBubble: {
    width: 70,
    height: 70,
    borderRadius: 999,
    marginRight: 16,
    backgroundColor: 'rgba(245,245,246,0.9)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  taskContent: {
    flex: 1,
    minWidth: 0,
  },
  taskTitle: {
    color: colors.text,
    fontSize: 21,
    lineHeight: 26,
    letterSpacing: -0.55,
    fontFamily: serifFont,
  },
  nextStep: {
    marginTop: 5,
    color: colors.muted,
    fontSize: 15.2,
    lineHeight: 20,
    letterSpacing: -0.18,
    fontWeight: '500',
  },
  nextStepStrong: {
    color: '#686a75',
    fontWeight: '700',
  },
  timeRow: {
    marginTop: 13,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  timeText: {
    color: '#858691',
    fontSize: 14.5,
    lineHeight: 19,
    letterSpacing: -0.15,
    fontWeight: '500',
  },
  progressRow: {
    marginTop: 15,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 18,
  },
  progressTrack: {
    flex: 1,
    height: 5,
    borderRadius: 999,
    backgroundColor: 'rgba(232,232,235,0.88)',
    overflow: 'hidden',
  },
  progressFill: {
    width: '40%',
    height: '100%',
    borderRadius: 999,
    backgroundColor: '#777886',
  },
  progressLabel: {
    color: '#777886',
    fontSize: 15.5,
    lineHeight: 19,
    letterSpacing: -0.22,
    fontWeight: '600',
  },
});