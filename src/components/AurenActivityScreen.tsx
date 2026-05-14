import Ionicons from '@expo/vector-icons/Ionicons';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Platform, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../lib/supabase';
import { colors } from '../theme';

type ActivityTab = 'all' | 'updates' | 'messages';
type ActivityCategory = 'updates' | 'messages' | 'agent' | 'credits' | 'system';
type ActivityPriority = 'low' | 'normal' | 'high' | 'urgent';

type ActivityItem = {
  id: string;
  user_id: string;
  category: ActivityCategory;
  type: string;
  title: string;
  body: string | null;
  icon: string | null;
  action_label: string | null;
  action_route: string | null;
  metadata: Record<string, unknown> | null;
  priority: ActivityPriority;
  read_at: string | null;
  archived_at: string | null;
  created_at: string;
  updated_at: string;
};

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

function getSafeIconName(icon: string | null | undefined): keyof typeof Ionicons.glyphMap {
  const candidate = (icon ?? '').trim() as keyof typeof Ionicons.glyphMap;
  if (candidate && candidate in Ionicons.glyphMap) return candidate;
  return 'notifications-outline';
}

function formatActivityTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';

  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMinutes = Math.max(0, Math.floor(diffMs / 60000));

  if (diffMinutes < 1) return 'Just now';
  if (diffMinutes < 60) return `${diffMinutes} min ago`;

  const sameDay = date.toDateString() === now.toDateString();
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  const isYesterday = date.toDateString() === yesterday.toDateString();
  const hours = date.getHours().toString().padStart(2, '0');
  const minutes = date.getMinutes().toString().padStart(2, '0');

  if (sameDay) return `Today, ${hours}.${minutes}`;
  if (isYesterday) return `Yesterday, ${hours}.${minutes}`;

  return `${date.getDate()}.${date.getMonth() + 1}.${date.getFullYear()}`;
}

function itemMatchesTab(item: ActivityItem, tab: ActivityTab) {
  if (tab === 'all') return true;
  if (tab === 'messages') return item.category === 'messages';
  return item.category !== 'messages';
}

export function AurenActivityScreen({ onClose }: AurenActivityScreenProps) {
  const [activeTab, setActiveTab] = useState<ActivityTab>('all');
  const [filterActive, setFilterActive] = useState(false);
  const [items, setItems] = useState<ActivityItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);

  const loadActivityItems = useCallback(async (showRefresh = false) => {
    if (showRefresh) setRefreshing(true);
    setLoadError(null);

    try {
      const { data: userData, error: userError } = await supabase.auth.getUser();
      if (userError) throw userError;

      const nextUserId = userData.user?.id ?? null;
      setUserId(nextUserId);

      if (!nextUserId) {
        setItems([]);
        return;
      }

      const { data, error } = await supabase
        .from('activity_items')
        .select('id,user_id,category,type,title,body,icon,action_label,action_route,metadata,priority,read_at,archived_at,created_at,updated_at')
        .eq('user_id', nextUserId)
        .is('archived_at', null)
        .order('created_at', { ascending: false })
        .limit(60);

      if (error) throw error;
      setItems((data ?? []) as ActivityItem[]);
    } catch {
      setLoadError('Activity could not load. Pull to refresh and try again.');
      setItems([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void loadActivityItems();
  }, [loadActivityItems]);

  const visibleItems = useMemo(() => {
    return items.filter((item) => itemMatchesTab(item, activeTab)).filter((item) => (filterActive ? item.read_at === null : true));
  }, [activeTab, filterActive, items]);

  async function markItemAsRead(item: ActivityItem) {
    if (item.read_at || !userId) return;

    const readAt = new Date().toISOString();
    setItems((current) => current.map((currentItem) => (currentItem.id === item.id ? { ...currentItem, read_at: readAt } : currentItem)));

    const { error } = await supabase
      .from('activity_items')
      .update({ read_at: readAt })
      .eq('id', item.id)
      .eq('user_id', userId);

    if (error) {
      setItems((current) => current.map((currentItem) => (currentItem.id === item.id ? { ...currentItem, read_at: item.read_at } : currentItem)));
    }
  }

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
          accessibilityLabel={filterActive ? 'Show all activity' : 'Show unread activity'}
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

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={visibleItems.length > 0 ? styles.content : styles.emptyContent}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => loadActivityItems(true)} tintColor="#8b8e99" />}
      >
        {visibleItems.length > 0 ? (
          visibleItems.map((item) => {
            const unread = item.read_at === null;
            return (
              <Pressable key={item.id} onPress={() => void markItemAsRead(item)} style={({ pressed }) => [styles.activityCard, pressed && styles.cardPressed]}>
                <View style={styles.iconCircle}>
                  <Ionicons name={getSafeIconName(item.icon)} size={23} color="#343743" />
                </View>

                <View style={styles.activityTextWrap}>
                  <View style={styles.activityTopRow}>
                    <Text style={styles.activityTitle} numberOfLines={1}>{item.title}</Text>
                    {unread ? <View style={styles.unreadDot} /> : null}
                  </View>
                  {item.body ? <Text style={styles.activityBody} numberOfLines={2}>{item.body}</Text> : null}
                  <Text style={styles.activityTime}>{formatActivityTime(item.created_at)}</Text>
                </View>

                {item.action_label ? (
                  <View style={styles.actionPill}>
                    <Text style={styles.actionPillText} numberOfLines={1}>{item.action_label}</Text>
                  </View>
                ) : (
                  <Ionicons name="chevron-forward" size={22} color="#a7a9b0" />
                )}
              </Pressable>
            );
          })
        ) : (
          <View style={styles.emptyState}>
            <View style={styles.emptyIconCircle}>
              <Ionicons name={loading ? 'sync-outline' : loadError ? 'alert-circle-outline' : 'notifications-outline'} size={24} color="#858891" />
            </View>
            <Text style={styles.emptyTitle}>{loading ? 'Loading activity' : loadError ? 'Could not load activity' : 'No activity yet'}</Text>
            <Text style={styles.emptyText}>{loadError ?? 'New updates, messages and AI alerts will appear here.'}</Text>
          </View>
        )}
      </ScrollView>
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
  scroll: {
    flex: 1,
    marginTop: 31,
  },
  content: {
    paddingHorizontal: 26,
    paddingBottom: 34,
    gap: 12,
  },
  emptyContent: {
    flexGrow: 1,
    paddingHorizontal: 26,
    paddingBottom: 64,
    alignItems: 'center',
    justifyContent: 'center',
  },
  activityCard: {
    minHeight: 98,
    borderRadius: 24,
    paddingHorizontal: 17,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.76)',
    borderWidth: 1,
    borderColor: 'rgba(17,24,39,0.045)',
    shadowColor: '#111827',
    shadowOpacity: 0.035,
    shadowRadius: 15,
    shadowOffset: { width: 0, height: 9 },
    elevation: 4,
  },
  cardPressed: {
    opacity: 0.74,
    transform: [{ scale: 0.993 }],
  },
  iconCircle: {
    width: 54,
    height: 54,
    borderRadius: 999,
    marginRight: 15,
    backgroundColor: '#f0eff3',
    alignItems: 'center',
    justifyContent: 'center',
  },
  activityTextWrap: {
    flex: 1,
    minWidth: 0,
  },
  activityTopRow: {
    minHeight: 24,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  activityTitle: {
    flex: 1,
    color: '#111113',
    fontFamily: serifFont,
    fontSize: 19,
    lineHeight: 24,
    letterSpacing: -0.34,
  },
  unreadDot: {
    width: 7,
    height: 7,
    borderRadius: 999,
    backgroundColor: '#111113',
  },
  activityBody: {
    marginTop: 2,
    color: '#737780',
    fontSize: 13.5,
    lineHeight: 18,
    letterSpacing: -0.08,
    fontWeight: '440',
  },
  activityTime: {
    marginTop: 7,
    color: '#989ba4',
    fontSize: 11.5,
    lineHeight: 15,
    letterSpacing: -0.04,
    fontWeight: '450',
  },
  actionPill: {
    maxWidth: 96,
    height: 34,
    borderRadius: 999,
    paddingHorizontal: 13,
    marginLeft: 10,
    borderWidth: 1,
    borderColor: 'rgba(17,24,39,0.075)',
    backgroundColor: 'rgba(255,255,255,0.62)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionPillText: {
    color: '#4d505b',
    fontSize: 12.5,
    lineHeight: 16,
    fontWeight: '520',
    letterSpacing: -0.08,
  },
  emptyState: {
    alignItems: 'center',
    maxWidth: 260,
  },
  emptyIconCircle: {
    width: 56,
    height: 56,
    borderRadius: 999,
    marginBottom: 16,
    backgroundColor: '#f0eff3',
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyTitle: {
    color: '#1d1d20',
    fontSize: 18,
    lineHeight: 23,
    fontWeight: '560',
    letterSpacing: -0.18,
    textAlign: 'center',
  },
  emptyText: {
    marginTop: 7,
    color: '#858891',
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '440',
    letterSpacing: -0.08,
    textAlign: 'center',
  },
  pressed: {
    opacity: 0.58,
    transform: [{ scale: 0.985 }],
  },
});
