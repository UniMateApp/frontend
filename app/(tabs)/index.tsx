
import AddEventModal from '@/components/add-event-modal';
import { EventCard } from '@/components/event-card';
import { SearchBar } from '@/components/search-bar';
import { sampleEvents } from '@/constants/sample-events';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

export default function HomeScreen() {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const [query, setQuery] = useState('');
  const [bookmarks, setBookmarks] = useState<Record<string, boolean>>({});
  const [activeCategory, setActiveCategory] = useState<string>('All');

  const categories = ['All', 'Technology', 'Cultural', 'Career', 'Sports'];

  const [eventsState, setEventsState] = useState(sampleEvents);

  const events = useMemo(() => {
    const q = query.trim().toLowerCase();
    let list = eventsState;
    if (activeCategory !== 'All') {
      list = list.filter(e => (e.category || '').toLowerCase() === activeCategory.toLowerCase());
    }
    if (!q) return list;
    return list.filter(e => (e.title + ' ' + e.organizer + ' ' + e.location).toLowerCase().includes(q));
  }, [query]);

  const handleSearch = (text: string) => {
    setQuery(text);
  };

  const handleEventPress = (eventId: string) => {
    router.push({ pathname: '/event/[id]', params: { id: eventId } });
  };

  const handleBookmark = (eventId: string) => {
    setBookmarks(prev => ({ ...prev, [eventId]: !prev[eventId] }));
  };

  const [showAdd, setShowAdd] = useState(false);

  const handleAddEvent = (ev: any) => {
    setEventsState(prev => [ev, ...prev]);
  };

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.background }]}
      contentContainerStyle={styles.content}>
      <View style={styles.headerSection}>
        <SearchBar onSearch={handleSearch} />

        <View style={styles.chipsRow}>
          {categories.map(cat => (
            <TouchableOpacity key={cat} style={[styles.chip, activeCategory === cat ? { borderColor: colors.primary, backgroundColor: colors.card } : { borderColor: colors.cardBorder }]} onPress={() => setActiveCategory(cat)}>
              <Text style={[styles.chipText, { color: activeCategory === cat ? colors.primary : colors.text }]}>{cat}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      <Text style={[styles.sectionTitle, { color: colors.text }]}>Upcoming Events</Text>

      {events.map(e => (
        <EventCard
          key={e.id}
          title={e.title}
          category={e.category}
          organizer={e.organizer}
          date={e.date}
          location={e.location}
          imageUrl={e.image}
          onPress={() => handleEventPress(e.id)}
          onBookmark={() => handleBookmark(e.id)}
          isBookmarked={!!bookmarks[e.id]}
        />
      ))}

      <AddEventModal visible={showAdd} onClose={() => setShowAdd(false)} onAdd={handleAddEvent} />

      <TouchableOpacity style={[styles.fab, { backgroundColor: colors.primary }]} onPress={() => setShowAdd(true)}>
        <Text style={styles.fabText}>+</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    paddingVertical: 16,
  },
  headerSection: {
    paddingHorizontal: 16,
  },
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
  chipText: {
    fontSize: 12,
    fontWeight: '600',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginHorizontal: 16,
    marginBottom: 8,
  },
  fab: {
    position: 'absolute',
    right: 20,
    bottom: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 6,
  },
  fabText: {
    color: '#fff',
    fontSize: 28,
    lineHeight: 28,
  },
});
