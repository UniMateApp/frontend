import { EventCard } from '@/components/event-card';
import { SearchBar } from '@/components/search-bar';
import { sampleEvents } from '@/constants/sample-events';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { listEvents as apiListEvents } from '@/services/events';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View, ActivityIndicator } from 'react-native';

export default function HomeScreen() {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];

  const [query, setQuery] = useState('');
  const [bookmarks, setBookmarks] = useState<Record<string, boolean>>({});
  const [activeCategory, setActiveCategory] = useState<string>('All');
  const [eventsState, setEventsState] = useState(sampleEvents);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const categories = ['All', 'Technology', 'Cultural', 'Career', 'Sports'];
  const hasFocusedOnce = useRef(false);

  /** Filter events by search + category */
  const events = useMemo(() => {
    const q = query.trim().toLowerCase();
    let list = eventsState;
    if (activeCategory !== 'All') {
      list = list.filter(e => (e.category || '').toLowerCase() === activeCategory.toLowerCase());
    }
    if (!q) return list;
    return list.filter(e =>
      (e.title + ' ' + e.organizer + ' ' + e.location).toLowerCase().includes(q)
    );
  }, [query, activeCategory, eventsState]);

  const handleSearch = (text: string) => setQuery(text);

  const handleEventPress = (eventId: string) => {
    router.push({ pathname: '/event/[id]', params: { id: eventId } });
  };

  const handleBookmark = (eventId: string) => {
    setBookmarks(prev => ({ ...prev, [eventId]: !prev[eventId] }));
  };

  /** Fetch events from Supabase */
  const loadEvents = useCallback(
    async ({ showLoader = false, shouldUpdate }: { showLoader?: boolean; shouldUpdate?: () => boolean } = {}) => {
      if (showLoader) {
        setLoading(true);
        setError(null);
      }

      try {
        const remote = await apiListEvents();
        if ((!shouldUpdate || shouldUpdate()) && Array.isArray(remote)) {
          setEventsState(remote as any);
        }
      } catch (err: any) {
        console.error('Failed to load events:', err);
        if (!shouldUpdate || shouldUpdate()) {
          setError(err?.message || 'Failed to load events');
          setEventsState(sampleEvents); // fallback
        }
      } finally {
        if (showLoader && (!shouldUpdate || shouldUpdate())) {
          setLoading(false);
        }
      }
    },
    []
  );

  /** Initial fetch */
  useEffect(() => {
    let active = true;
    loadEvents({ showLoader: true, shouldUpdate: () => active });
    return () => {
      active = false;
    };
  }, [loadEvents]);

  /** Refresh on refocus */
  useFocusEffect(
    useCallback(() => {
      if (!hasFocusedOnce.current) {
        hasFocusedOnce.current = true;
        return;
      }
      void loadEvents();
    }, [loadEvents])
  );

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.background }]}
      contentContainerStyle={styles.content}>
      <View style={styles.headerSection}>
        <SearchBar onSearch={handleSearch} />

        <View style={styles.chipsRow}>
          {categories.map(cat => (
            <TouchableOpacity
              key={cat}
              style={[
                styles.chip,
                activeCategory === cat
                  ? { borderColor: colors.primary, backgroundColor: colors.card }
                  : { borderColor: colors.cardBorder },
              ]}
              onPress={() => setActiveCategory(cat)}>
              <Text
                style={[
                  styles.chipText,
                  { color: activeCategory === cat ? colors.primary : colors.text },
                ]}>
                {cat}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      <Text style={[styles.sectionTitle, { color: colors.text }]}>Upcoming Events</Text>

      {loading && <ActivityIndicator size="large" color={colors.primary} style={{ marginVertical: 20 }} />}

      {error && (
        <Text style={{ color: 'red', marginHorizontal: 16, marginBottom: 12 }}>
          {error}
        </Text>
      )}

      {events.map(e => (
        <EventCard
          key={e.id}
          title={e.title}
          category={e.category}
          organizer={e.organizer}
          date={e.date}
          location={e.location}
          imageUrl={require('../../assets/images/icon.png')}  // 👈 fallback local image
          onPress={() => handleEventPress(e.id)}
          onBookmark={() => handleBookmark(e.id)}
          isBookmarked={!!bookmarks[e.id]}
        />
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { paddingVertical: 16 },
  headerSection: { paddingHorizontal: 16 },
  chipsRow: {
    flexDirection: 'row',
    marginTop: 8,
    marginBottom: 12,
    flexWrap: 'wrap',
  },
  chip: {
    borderWidth: 1,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 16,
    marginRight: 8,
    marginBottom: 8,
  },
  chipText: { fontSize: 12, fontWeight: '600' },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginHorizontal: 16,
    marginBottom: 8,
  },
});
