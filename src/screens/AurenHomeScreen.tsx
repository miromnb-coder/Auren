import { Platform, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AurenActionPill } from '../components/AurenActionPill';
import { AurenComposer } from '../components/AurenComposer';
import { CalendarIcon, ChevronIcon, ListIcon, MenuIcon, SparkIcon } from '../components/AurenIcons';
import { colors, spacing } from '../theme';

export function AurenHomeScreen() {
  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <View style={styles.menuSlot}>
          <MenuIcon />
        </View>

        <View style={styles.brandWrap}>
          <Text style={styles.brand}>Auren</Text>
          <ChevronIcon />
        </View>

        <View style={styles.headerSpacer} />
      </View>

      <View style={styles.content}>
        <View style={styles.hero}>
          <Text style={styles.title}>Good evening, you&apos;ve got this.</Text>
          <Text style={styles.subtitle}>I&apos;m here to help you focus and get things done.</Text>
        </View>

        <View style={styles.pillsRow}>
          <AurenActionPill width={106} icon={<CalendarIcon />} label="Plan my day" />
          <AurenActionPill width={124} icon={<ListIcon />} label="Organize tasks" />
          <AurenActionPill width={110} icon={<SparkIcon />} label="Ask anything" />
        </View>
      </View>

      <View style={styles.composerWrap}>
        <AurenComposer />
      </View>
    </SafeAreaView>
  );
}

const serifFont = Platform.select({
  ios: 'Georgia',
  android: 'serif',
  default: 'serif',
});

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    height: 88,
    paddingHorizontal: spacing.screenX,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  menuSlot: {
    width: 68,
    alignItems: 'flex-start',
  },
  brandWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 148,
  },
  brand: {
    color: colors.text,
    fontSize: 28,
    lineHeight: 34,
    letterSpacing: -0.9,
    fontFamily: serifFont,
  },
  headerSpacer: {
    width: 68,
  },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 18,
    paddingBottom: 220,
  },
  hero: {
    alignItems: 'center',
    marginTop: 18,
    maxWidth: 360,
  },
  title: {
    color: '#686775',
    fontSize: 25,
    lineHeight: 31,
    letterSpacing: -0.75,
    textAlign: 'center',
    fontFamily: serifFont,
  },
  subtitle: {
    marginTop: 13,
    color: colors.muted,
    fontSize: 15.5,
    lineHeight: 22,
    letterSpacing: -0.12,
    textAlign: 'center',
    fontWeight: '500',
  },
  pillsRow: {
    marginTop: 48,
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  composerWrap: {
    position: 'absolute',
    left: 16,
    right: 16,
    bottom: 34,
  },
});
