import Ionicons from '@expo/vector-icons/Ionicons';
import { useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors } from '../theme';

type ActivityTab = 'all' | 'updates' | 'messages';

type AurenActivityScreenProps = {
  onClose: () => void;
};

const TABS: { id: ActivityTab; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'updates', label: 'Updates' },
  { id: 'messages', label: 'Messages' },
];

const serifFont = Platform.select({
  ios: 'Georgia',
  android: 'serif',
  default: 'serif',
});

export function AurenActivityScreen({ onClose }: AurenActivityScreenProps) {
  const [activeTab, setActiveTab] = useState<ActivityTab>('all');
  const [filterActive, setFilterActive] = useState(false);

  return (
    <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <Pressable
          onPress={onClose}
          hitSlop={18}
          style={({ pressed }) => [styles.headerButton, styles.backButton, pressed && styles.pressed]}
          accessibilityRole="button"
          accessibilityLabel="Back"
        >
          <Ionicons name="arrow-back" size={30} color="#343743" />
        </Pressable>

        <Text style={styles.title}>Activity</Text>

        <Pressable
          onPress={() => setFilterActive((current) => !current)}
          hitSlop={18}
          style={({ pressed }) => [styles.headerButton, styles.filterButton, filterActive && styles.filterButtonActive, pressed && styles.pressed]}
          accessibilityRole="button"
          accessibilityLabel="Filter activity"
        >
          <Ionicons name="options-outline" size={29} color="#343743" />
        </Pressable>
      </View>

      <View style={styles.tabsWrap}>
        {TABS.map((tab) => {
          const selected = activeTab === tab.id;
          return (
            <Pressable
              key={tab.id}
              onPress={() => setActiveTab(tab.id)}
              style={({ pressed }) => [styles.tab, selected && styles.tabActive, pressed && styles.tabPressed]}
              accessibilityRole="button"
              accessibilityLabel={`Show ${tab.label}`}
            >
              <Text style={[styles.tabText, selected && styles.tabTextActive]}>{tab.label}</Text>
            </Pressable>
          );
        })}
      </View>

      <View style={styles.blankContent} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 80,
    elevation: 80,
    backgroundColor: colors.background,
  },
  header: {
    height: 108,
    paddingHorizontal: 30,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerButton: {
    position: 'absolute',
    top: 48,
    width: 52,
    height: 52,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backButton: {
    left: 22,
  },
  filterButton: {
    right: 22,
  },
  filterButtonActive: {
    opacity: 0.72,
  },
  title: {
    color: colors.text,
    fontFamily: serifFont,
    fontSize: 29,
    lineHeight: 36,
    letterSpacing: -0.75,
  },
  tabsWrap: {
    alignSelf: 'center',
    width: 278,
    height: 43,
    marginTop: 3,
    borderRadius: 999,
    padding: 3,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(227,226,226,0.72)',
    borderWidth: 1,
    borderColor: 'rgba(17,24,39,0.035)',
  },
  tab: {
    flex: 1,
    height: 37,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabActive: {
    backgroundColor: 'rgba(255,255,255,0.86)',
    shadowColor: '#111827',
    shadowOpacity: 0.055,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  tabPressed: {
    opacity: 0.7,
  },
  tabText: {
    color: '#4d505b',
    fontSize: 14.5,
    lineHeight: 18,
    fontWeight: '510',
    letterSpacing: -0.13,
  },
  tabTextActive: {
    color: '#111113',
    fontWeight: '560',
  },
  blankContent: {
    flex: 1,
  },
  pressed: {
    opacity: 0.58,
    transform: [{ scale: 0.985 }],
  },
});
