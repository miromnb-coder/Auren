import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import type { StudyFocusCard } from '../lib/aurenStudyFocus';
import { colors, shadows } from '../theme';
import { FocusClockIcon, FocusNotebookIcon, FocusTargetIcon, MoreDotsIcon } from './AurenStudyIcons';

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

function getProgressWidth(progress: number) {
  const safeProgress = Math.min(Math.max(progress, 0), 1);
  return `${Math.round(safeProgress * 100)}%` as const;
}

function getFocusTitle(focusCard: StudyFocusCard | null | undefined, loading: boolean) {
  if (loading) return 'Loading focus…';
  return focusCard?.title?.trim() || 'Set your study focus';
}

function getNextStep(focusCard: StudyFocusCard | null | undefined, loading: boolean) {
  if (loading) return 'Checking your study plan';
  return focusCard?.nextStep?.trim() || 'Tell Auren what you are working on today';
}

function getSessionText(focusCard: StudyFocusCard | null | undefined, loading: boolean) {
  if (loading) return 'Loading session';
  if (!focusCard || focusCard.status === 'empty') return 'Add first focus';
  return `${focusCard.sessionMinutes} min session`;
}

function getProgressLabel(focusCard: StudyFocusCard | null | undefined, loading: boolean) {
  if (loading) return '— / — tasks';
  if (!focusCard || focusCard.status === 'empty') return '0 / 1 tasks';
  return `${focusCard.completedSteps} / ${focusCard.totalSteps} tasks`;
}

export function AurenTodayFocusCard({ focusCard, loading = false, onPress }: Props) {
  const title = getFocusTitle(focusCard, loading);
  const nextStep = getNextStep(focusCard, loading);
  const sessionText = getSessionText(focusCard, loading);
  const progressLabel = getProgressLabel(focusCard, loading);
  const progressWidth = getProgressWidth(loading ? 0 : focusCard?.progress ?? 0);

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
          <FocusTargetIcon size={18} color="#8f909a" strokeWidth={1.65} />
          <Text style={styles.eyebrow}>TODAY&apos;S FOCUS</Text>
        </View>
        <MoreDotsIcon size={25} color="#92939d" />
      </View>

      <View style={styles.contentRow}>
        <View style={styles.iconBubble}>
          <FocusNotebookIcon size={34} color="#737480" strokeWidth={1.7} />
        </View>

        <View style={styles.taskContent}>
          <Text style={styles.taskTitle} numberOfLines={1}>{title}</Text>
          <Text style={styles.nextStep} numberOfLines={1}>
            Next step: <Text style={styles.nextStepStrong}>{nextStep}</Text>
          </Text>
          <View style={styles.timeRow}>
            <FocusClockIcon size={18} color="#8a8b95" strokeWidth={1.75} />
            <Text style={styles.timeText}>{sessionText}</Text>
          </View>
        </View>
      </View>

      <View style={styles.progressRow}>
        <View style={styles.progressTrack}>
          <View style={[styles.progressFill, { width: progressWidth }]} />
        </View>
        <Text style={styles.progressLabel}>{progressLabel}</Text>
      </View>
    </Pressable>
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
  cardPressed: {
    transform: [{ scale: 0.99 }],
    opacity: 0.9,
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