import AddEventModal from '@/components/add-event-modal';
import { EventCard } from '@/components/event-card';
import { SearchBar } from '@/components/search-bar';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { createEvent as apiCreateEvent, deleteEvent as apiDeleteEvent, listEvents as apiListEvents } from '@/services/events';
import {
    Event,
    addEventToWishlist,
    getEventsWithWishlistStatus,
    removeItemFromWishlist,
} from '@/services/selectiveWishlist';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

export default function EventsScreen() {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const [query, setQuery] = useState('');
  const [eventsWithWishlist, setEventsWithWishlist] = useState<(Event & { isInWishlist: boolean })[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const hasFocusedOnce = useRef(false);

  const events = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return eventsWithWishlist;
    return eventsWithWishlist.filter((e: Event & { isInWishlist: boolean }) => 
      (e.title + ' ' + (e.organizer || '') + ' ' + (e.location || '')).toLowerCase().includes(q)
    );
  }, [query, eventsWithWishlist]);

  const handleSearch = (text: string) => {
    setQuery(text);
  };

  const handleEventPress = (eventId: string) => {
    router.push({ pathname: '/event/[id]', params: { id: eventId } });
  };

  const handleWishlistToggle = async (eventId: string, isCurrentlyInWishlist: boolean) => {
    try {
      if (isCurrentlyInWishlist) {
        await removeItemFromWishlist('event', eventId);
      } else {
        await addEventToWishlist(eventId);
      }
      
      // Update local state immediately
      setEventsWithWishlist(prev => 
        prev.map(event => 
          event.id === eventId 
            ? { ...event, isInWishlist: !isCurrentlyInWishlist }
            : event
        )
      );
    } catch (error: any) {
      console.error('Error toggling wishlist:', error);
      const isWeb = typeof window !== 'undefined' && (window as any).document != null;
      if (isWeb) {
        window.alert(error.message || 'Failed to update wishlist');
      } else {
        Alert.alert('Error', error.message || 'Failed to update wishlist');
      }
    }
  };

  const handleDeleteEvent = (eventId: string, eventTitle: string) => {
    Alert.alert(
      'Delete Event',
      `Are you sure you want to delete "${eventTitle}"? This action cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await apiDeleteEvent(eventId);
              Alert.alert('Success', 'Event deleted successfully!');
              // Remove from local state immediately for better UX
              setEventsWithWishlist(prev => prev.filter(e => e.id !== eventId));
              // Also refresh from server to ensure consistency
              await loadEvents();
            } catch (err: any) {
              console.error('Failed to delete event:', err);
              Alert.alert('Error', err?.message || 'Failed to delete event');
            }
          },
        },
      ]
    );
  };

  const loadEvents = useCallback(
    async ({ showLoader = false, shouldUpdate }: { showLoader?: boolean; shouldUpdate?: () => boolean } = {}) => {
      if (showLoader) {
        setLoading(true);
        setError(null);
      }

      try {
        const eventsWithWishlistStatus = await getEventsWithWishlistStatus();
        if (!shouldUpdate || shouldUpdate()) {
          setEventsWithWishlist(eventsWithWishlistStatus);
        }
      } catch (err: any) {
        if (!shouldUpdate || shouldUpdate()) {
          if (showLoader) {
            console.error('Failed to load events with wishlist status', err);
            setError(err?.message || String(err));
            // Fallback to basic events without wishlist status
            try {
              const basicEvents = await apiListEvents();
              if (Array.isArray(basicEvents)) {
                setEventsWithWishlist(basicEvents.map(event => ({ ...event, isInWishlist: false })));
              }
            } catch (fallbackErr) {
              console.error('Fallback also failed', fallbackErr);
            }
          } else {
            console.warn('Reload failed', err);
          }
        }
      } finally {
        if (showLoader && (!shouldUpdate || shouldUpdate())) {
          setLoading(false);
        }
      }
    },
    []
  );


  const handleAddEvent = (ev: any) => {
    (async () => {
      try {
        // Convert price to number: "Free" -> 0, parse numeric strings, default to null
        let priceValue: number | null = null;
        if (ev.price) {
          const lower = String(ev.price).toLowerCase().trim();
          if (lower === 'free' || lower === 'free admission') {
            priceValue = 0;
          } else {
            const parsed = parseFloat(String(ev.price));
            priceValue = isNaN(parsed) ? null : parsed;
          }
        }

        const created = await apiCreateEvent({
          title: ev.title,
          description: ev.description,
          category: ev.category,
          organizer: ev.organizer,
          start_at: ev.date,
          location: ev.location,
          price: priceValue,
          image_url: typeof ev.image === 'string' ? ev.image : null,
        });

        if (created) {
          alert('Event added successfully! ID = ' + created.id);
          await loadEvents(); // Fetch the latest events from DB
        } else {
          console.warn('API did not return the created event object.');
          alert('Event added locally, but API did not return a record.');
        }
      } catch (err: any) {
        console.error('Create event failed:', err);
        alert('Failed to add event: ' + (err?.message || String(err)));
      }
    })();
  };

  // Fetch events from Supabase on mount
  useEffect(() => {
    let active = true;
    loadEvents({ showLoader: true, shouldUpdate: () => active });
    return () => {
      active = false;
    };
  }, [loadEvents]);

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
      <View style={styles.headerRow}>
        <View>
          <Text style={[styles.title, { color: colors.text }]}>Events</Text>
          <Text style={{ color: colors.textSecondary }}>{eventsWithWishlist.length} events available</Text>
        </View>

        <TouchableOpacity style={[styles.addButton, { backgroundColor: colors.primary }]} onPress={() => setShowAdd(true)}>
          <Text style={{ color: '#fff', fontWeight: '700' }}>+ Add Event</Text>
        </TouchableOpacity>
      </View>

      <SearchBar onSearch={handleSearch} />

      {events.map((e: Event & { isInWishlist: boolean }) => (
        <EventCard
          key={e.id}
          title={e.title}
          organizer={e.organizer || 'Unknown Organizer'}
          date={e.start_at ? new Date(e.start_at).toLocaleDateString() : 'Date TBD'}
          location={e.location || 'Location TBD'}
          imageUrl={e.image_url}
          onPress={() => handleEventPress(e.id)}
          onBookmark={() => handleWishlistToggle(e.id, e.isInWishlist)}
          isBookmarked={e.isInWishlist}
          onLongPress={() => {
            Alert.alert(
              'Event Actions',
              `What would you like to do with "${e.title}"?`,
              [
                { text: 'View Details', onPress: () => handleEventPress(e.id) },
                { text: 'Delete Event', style: 'destructive', onPress: () => handleDeleteEvent(e.id, e.title) },
                { text: 'Cancel', style: 'cancel' },
              ]
            );
          }}
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
