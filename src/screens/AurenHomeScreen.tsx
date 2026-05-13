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
          <AurenActionPill icon={<CalendarIcon />} label="Plan my day" />
          <AurenActionPill icon={<ListIcon />} label="Organize tasks" />
          <AurenActionPill icon={<SparkIcon />} label="Ask anything" />
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
    height: 96,
    paddingHorizontal: spacing.screenX,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  menuSlot: {
    width: 70,
    alignItems: 'flex-start',
  },
  brandWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 170,
  },
  brand: {
    color: colors.text,
    fontSize: 32,
    lineHeight: 38,
    letterSpacing: -1.1,
    fontFamily: serifFont,
  },
  headerSpacer: {
    width: 70,
  },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 28,
    paddingBottom: 80,
  },
  hero: {
    alignItems: 'center',
    marginTop: 50,
  },
  title: {
    color: '#666575',
    fontSize: 31,
    lineHeight: 38,
    letterSpacing: -1,
    textAlign: 'center',
    fontFamily: serifFont,
  },
  subtitle: {
    marginTop: 13,
    color: colors.muted,
    fontSize: 18,
    lineHeight: 25,
    letterSpacing: -0.2,
    textAlign: 'center',
    fontWeight: '500',
  },
  pillsRow: {
    marginTop: 54,
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 14,
  },
  composerWrap: {
    position: 'absolute',
    left: 24,
    right: 24,
    bottom: 50,
  },
});
