import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import type { StudyFocusCard } from '../lib/aurenStudyFocus';
import { colors, shadows } from '../theme';
import {
  FocusBooksCapIcon,
  FocusChecklistIcon,
  FocusClockIcon,
  FocusFlameIcon,
  FocusProgressRing,
  FocusSparkleIcon,
  FocusTargetIcon,
} from './AurenStudyIcons';

const serifFont = Platform.select({
  ios: 'Georgia',
  android: 'serif',
  default: 'serif',
});

type Props = {
  focusCard?: StudyFocusCard | null;
  loading?: boolean;
  onPress?: () => void;
};

function clampProgress(progress: number) {
  return Math.min(Math.max(progress, 0), 1);
}

function getProgressPercent(progress: number) {
  return Math.round(clampProgress(progress) * 100);
}

function isEmptyFocus(focusCard: StudyFocusCard | null | undefined) {
  return !focusCard || focusCard.status === 'empty';
}

function getFocusTitle(focusCard: StudyFocusCard | null | undefined, loading: boolean) {
  if (loading) return 'Loading study focus';
  if (isEmptyFocus(focusCard)) return 'Set study focus';
  return focusCard?.title?.trim() || 'Study focus';
}

function getNextStep(focusCard: StudyFocusCard | null | undefined, loading: boolean) {
  if (loading) return 'Checking your study plan';
  if (isEmptyFocus(focusCard)) return 'Add your first task';
  return focusCard?.nextStep?.trim() || 'Start your next step';
}

function getSessionMinutes(focusCard: StudyFocusCard | null | undefined) {
  if (isEmptyFocus(focusCard)) return 25;
  return focusCard?.sessionMinutes ?? 25;
}

function getProgressLabel(focusCard: StudyFocusCard | null | undefined, loading: boolean) {
  if (loading) return '— / — tasks';
  if (isEmptyFocus(focusCard)) return '0 / 1 tasks';
  return `${focusCard?.completedSteps ?? 0} / ${focusCard?.totalSteps ?? 1} tasks`;
}

export function AurenTodayFocusCard({ focusCard, loading = false, onPress }: Props) {
  const title = getFocusTitle(focusCard, loading);
  const nextStep = getNextStep(focusCard, loading);
  const sessionMinutes = getSessionMinutes(focusCard);
  const progress = clampProgress(loading ? 0 : focusCard?.progress ?? 0);
  const progressPercent = getProgressPercent(progress);
  const progressLabel = getProgressLabel(focusCard, loading);
  const empty = isEmptyFocus(focusCard);

  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress || loading}
      style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
      accessibilityRole="button"
      accessibilityLabel="Open Today’s Focus"
    >
      <View style={styles.cardHeader}>
        <View style={styles.cardEyebrowWrap}>
          <FocusTargetIcon size={17} color="#8f909a" strokeWidth={1.65} />
          <Text style={styles.eyebrow}>TODAY&apos;S FOCUS</Text>
        </View>
        <View style={styles.streakPill}>
          <FocusFlameIcon size={13} color="#82838d" strokeWidth={1.8} />
          <Text style={styles.streakText}>{empty ? 'Ready' : '4 day streak'}</Text>
        </View>
      </View>

      <View style={styles.mainRow}>
        <View style={styles.iconBubble}>
          <FocusBooksCapIcon size={40} color="#737480" strokeWidth={1.65} />
        </View>

        <View style={styles.taskContent}>
          <Text style={styles.taskTitle} numberOfLines={1}>{title}</Text>
          <Text style={styles.nextStep} numberOfLines={1}>
            Next step: <Text style={styles.nextStepStrong}>{nextStep}</Text>
          </Text>
        </View>
      </View>

      <View style={styles.divider} />

      <View style={styles.metricsRow}>
        <View style={styles.metricBlock}>
          <View style={styles.metricHeadingRow}>
            <FocusClockIcon size={18} color="#797a85" strokeWidth={1.7} />
            <Text style={styles.metricLabel}>SESSION</Text>
          </View>
          <Text style={styles.metricValue}>{sessionMinutes} min</Text>
          <Text style={styles.metricCaption}>{empty ? 'Setup session' : 'Focused session'}</Text>
        </View>

        <View style={styles.ringWrap}>
          <FocusProgressRing size={64} color="#696a76" progress={progress} />
          <Text style={styles.ringText}>{progressPercent}%</Text>
        </View>

        <View style={styles.metricBlockRight}>
          <View style={styles.metricHeadingRow}>
            <FocusChecklistIcon size={18} color="#797a85" strokeWidth={1.7} />
            <Text style={styles.metricLabel}>PROGRESS</Text>
          </View>
          <Text style={styles.metricValue}>{progressLabel}</Text>
          <Text style={styles.metricCaption}>{empty ? 'Start today' : 'Keep it going'}</Text>
        </View>
      </View>

      <View style={styles.focusTimePill}>
        <FocusSparkleIcon size={17} color="#8b8c96" strokeWidth={1.65} />
        <Text style={styles.focusTimeText}>Best focus time: <Text style={styles.focusTimeStrong}>now</Text></Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    width: '100%',
    maxWidth: 370,
    height: 250,
    borderRadius: 28,
    borderWidth: 1,
    borderColor: 'rgba(17,24,39,0.052)',
    backgroundColor: 'rgba(255,255,255,0.76)',
    paddingHorizontal: 18,
    paddingTop: 16,
    paddingBottom: 15,
    ...shadows.soft,
  },
  cardPressed: {
    transform: [{ scale: 0.99 }],
    opacity: 0.92,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  cardEyebrowWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
  },
  eyebrow: {
    color: '#8b8c96',
    fontSize: 12.1,
    lineHeight: 16,
    letterSpacing: 4.2,
    fontWeight: '650',
  },
  streakPill: {
    height: 28,
    paddingHorizontal: 11,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(17,24,39,0.055)',
    backgroundColor: 'rgba(246,246,247,0.78)',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  streakText: {
    color: '#6f717b',
    fontSize: 12.6,
    lineHeight: 16,
    letterSpacing: -0.12,
    fontWeight: '650',
  },
  mainRow: {
    marginTop: 23,
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconBubble: {
    width: 72,
    height: 72,
    borderRadius: 999,
    marginRight: 18,
    backgroundColor: 'rgba(245,245,246,0.92)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  taskContent: {
    flex: 1,
    minWidth: 0,
  },
  taskTitle: {
    color: colors.text,
    fontSize: 22.5,
    lineHeight: 28,
    letterSpacing: -0.72,
    fontFamily: serifFont,
  },
  nextStep: {
    marginTop: 7,
    color: colors.muted,
    fontSize: 14.9,
    lineHeight: 20,
    letterSpacing: -0.16,
    fontWeight: '500',
  },
  nextStepStrong: {
    color: '#62646f',
    fontWeight: '750',
  },
  divider: {
    marginTop: 20,
    height: 1,
    backgroundColor: 'rgba(17,24,39,0.055)',
  },
  metricsRow: {
    marginTop: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  metricBlock: {
    width: 98,
  },
  metricBlockRight: {
    width: 108,
  },
  metricHeadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  metricLabel: {
    color: '#92939c',
    fontSize: 11.7,
    lineHeight: 15,
    letterSpacing: 0.8,
    fontWeight: '650',
  },
  metricValue: {
    marginTop: 7,
    color: colors.text,
    fontSize: 21.5,
    lineHeight: 25,
    letterSpacing: -0.55,
    fontFamily: serifFont,
  },
  metricCaption: {
    marginTop: 3,
    color: '#8f9099',
    fontSize: 12.3,
    lineHeight: 16,
    letterSpacing: -0.08,
    fontWeight: '500',
  },
  ringWrap: {
    width: 66,
    height: 66,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ringText: {
    position: 'absolute',
    color: colors.text,
    fontSize: 18.5,
    lineHeight: 23,
    letterSpacing: -0.45,
    fontWeight: '500',
  },
  focusTimePill: {
    marginTop: 15,
    height: 31,
    borderRadius: 13,
    backgroundColor: 'rgba(247,247,248,0.76)',
    borderWidth: 1,
    borderColor: 'rgba(17,24,39,0.025)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  focusTimeText: {
    color: '#858691',
    fontSize: 13.3,
    lineHeight: 17,
    letterSpacing: -0.12,
    fontWeight: '500',
  },
  focusTimeStrong: {
    color: '#656771',
    fontWeight: '750',
  },
});