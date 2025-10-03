import AddEventModal from '@/components/add-event-modal';
import { EventCard } from '@/components/event-card';
import { SearchBar } from '@/components/search-bar';
import { sampleEvents } from '@/constants/sample-events';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

export default function EventsScreen() {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const [query, setQuery] = useState('');
  const [bookmarks, setBookmarks] = useState<Record<string, boolean>>({});
  const [eventsState, setEventsState] = useState(sampleEvents);
  const [showAdd, setShowAdd] = useState(false);

  const events = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return eventsState;
    return eventsState.filter(e => (e.title + ' ' + e.organizer + ' ' + e.location).toLowerCase().includes(q));
  }, [query, eventsState]);

  const handleSearch = (text: string) => {
    setQuery(text);
  };

  const handleEventPress = (eventId: string) => {
    router.push({ pathname: '/event/[id]', params: { id: eventId } });
  };

  const handleBookmark = (eventId: string) => {
    setBookmarks(prev => ({ ...prev, [eventId]: !prev[eventId] }));
  };

  const handleAddEvent = (ev: any) => {
    setEventsState(prev => [ev, ...prev]);
  };

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.background }]}
      contentContainerStyle={styles.content}>
      <View style={styles.headerRow}>
        <View>
          <Text style={[styles.title, { color: colors.text }]}>Events</Text>
          <Text style={{ color: colors.textSecondary }}>{eventsState.length} events available</Text>
        </View>

        <TouchableOpacity style={[styles.addButton, { backgroundColor: colors.primary }]} onPress={() => setShowAdd(true)}>
          <Text style={{ color: '#fff', fontWeight: '700' }}>+ Add Event</Text>
        </TouchableOpacity>
      </View>

      <SearchBar onSearch={handleSearch} />

      {events.map(e => (
        <EventCard
          key={e.id}
          title={e.title}
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
  headerRow: {
    paddingHorizontal: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
  },
  addButton: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
  },
});