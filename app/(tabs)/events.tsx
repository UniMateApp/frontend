import AddEventModal from '@/components/add-event-modal';
import { EventCard } from '@/components/event-card';
import { SearchBar } from '@/components/search-bar';
import { Colors } from '@/constants/theme';
import { useUser } from '@/contexts/UserContext';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useEventScheduler } from '@/hooks/useEventScheduler';
import { isBackgroundTaskRegistered, registerBackgroundTask } from '@/services/backgroundTaskService';
import { 
  createEvent as apiCreateEvent, 
  deleteEvent as apiDeleteEvent, 
  listEvents as apiListEvents,
} from '@/services/events';
import { forceCheckLocation, sendTestNotification } from '@/services/immediateNotifier';
import {
    Event,
    addEventToWishlist,
    getEventsWithWishlistStatus,
    removeItemFromWishlist,
} from '@/services/selectiveWishlist';
import * as Location from 'expo-location';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Platform, ScrollView, Share, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

export default function EventsScreen() {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const { user } = useUser();
  const [query, setQuery] = useState('');
  const [eventsWithWishlist, setEventsWithWishlist] = useState<(Event & { isInWishlist: boolean })[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const hasFocusedOnce = useRef(false);
  const hasRequestedPermissions = useRef(false);
  const [isBackgroundTaskActive, setIsBackgroundTaskActive] = useState(false);

  // Initialize location-based event reminders
  const {
    isReady: isSchedulerReady,
    hasNotificationPermission,
    hasLocationPermission,
    requestPermissions,
  } = useEventScheduler(eventsWithWishlist, {
    enabled: true,
    autoSchedule: true, // Automatically schedule reminders when events change
  });

  // Request permissions on first load (only once)
  useEffect(() => {
    if (
      !hasRequestedPermissions.current &&
      (!hasNotificationPermission || !hasLocationPermission)
    ) {
      hasRequestedPermissions.current = true;
      requestPermissions();
    }
  }, [hasNotificationPermission, hasLocationPermission, requestPermissions]);

  // Check background task status
  useEffect(() => {
    const checkBackgroundTask = async () => {
      const isRegistered = await isBackgroundTaskRegistered();
      setIsBackgroundTaskActive(isRegistered);
    };
    checkBackgroundTask();
  }, []);

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

  const handleShare = async (event: Event & { isInWishlist: boolean }) => {
    try {
      const formatDate = (dateStr: string) => {
        if (!dateStr) return 'TBD';
        const date = new Date(dateStr);
        return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
      };

      const formatTime = (dateStr: string) => {
        if (!dateStr) return 'TBD';
        const date = new Date(dateStr);
        return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
      };

      const shareContent = {
        title: event.title || 'Check out this event!',
        message: `🎉 ${event.title || 'Event'} by ${event.organizer || 'Unknown'}\n\n${event.description || 'Join us for an exciting event!'}\n\n📅 Date: ${formatDate(event.start_at || '')}\n⏰ Time: ${formatTime(event.start_at || '')}\n📍 Location: ${event.location || 'TBD'}\n\n#UniMateEvent`,
        url: Platform.OS === 'web' ? window.location.href : undefined,
      };

      if (Platform.OS === 'web') {
        if (navigator.share) {
          await navigator.share(shareContent);
        } else {
          // Fallback for web browsers without native share
          await navigator.clipboard.writeText(shareContent.message);
          window.alert('Event details copied to clipboard!');
        }
      } else {
        await Share.share(shareContent);
      }
    } catch (error: any) {
      console.error('Error sharing:', error);
      if (error.name !== 'AbortError') { // User cancelled sharing
        const message = 'Failed to share event';
        if (Platform.OS === 'web') {
          window.alert(`Error: ${message}`);
        } else {
          Alert.alert('Error', message);
        }
      }
    }
  };

  const handleRSVP = (event: Event & { isInWishlist: boolean }) => {
    if (Platform.OS === 'web') {
      window.alert(`RSVP for "${event.title}" - Feature coming soon!`);
    } else {
      Alert.alert('RSVP', `RSVP for "${event.title}" - Feature coming soon!`);
    }
  };

  // Test notification functions
  const handleTestNotification = async () => {
    try {
      await sendTestNotification();
      Alert.alert('Success', 'Test notification sent! Check your notification tray.');
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to send test notification');
    }
  };

  const handleCheckLocation = async () => {
    try {
      // First check if location services are enabled (if available)
      try {
        const isEnabled = await Location.hasServicesEnabledAsync();
        if (!isEnabled) {
          Alert.alert(
            'Location Services Disabled',
            'Please enable location services in your device settings:\n\nSettings → Location → Turn on',
            [{ text: 'OK' }]
          );
          return;
        }
      } catch {
        // hasServicesEnabledAsync might not be available, continue anyway
        console.log('[Events] Location services check not available');
      }

      const { withinRadius, distance } = await forceCheckLocation();
      Alert.alert(
        'Location Check',
        withinRadius
          ? `✅ You are within campus radius!\nDistance: ${distance?.toFixed(2)} km`
          : `⚠️ You are outside campus radius.\nDistance: ${distance?.toFixed(2)} km`
      );
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to check location');
    }
  };

  const handleToggleBackgroundTask = async () => {
    try {
      if (isBackgroundTaskActive) {
        Alert.alert('Info', 'Background task is already running. It checks events every minute.');
      } else {
        await registerBackgroundTask();
        setIsBackgroundTaskActive(true);
        Alert.alert('Success', 'Background task started! Notifications will work even when app is closed.');
      }
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to start background task');
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


  const handleAddEvent = async (ev: any) => {
    try {
      const created = await apiCreateEvent(ev);

      if (created) {
        Alert.alert('Success', 'Event created successfully!');
        await loadEvents();
      }
    } catch (err: any) {
      console.error('Create event failed:', err);
      Alert.alert('Error', err?.message || 'Failed to create event');
    }
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

      {/* Test notification buttons - Only show in development */}
      {__DEV__ && (
        <View style={styles.testButtons}>
          <Text style={[styles.testTitle, { color: colors.textSecondary }]}>🧪 Test Notifications:</Text>
          <View style={styles.testButtonRow}>
            <TouchableOpacity
              style={[styles.testButton, { backgroundColor: colors.primary }]}
              onPress={handleTestNotification}>
              <Text style={styles.testButtonText}>📨 Test</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.testButton, { backgroundColor: colors.primary }]}
              onPress={handleCheckLocation}>
              <Text style={styles.testButtonText}>📍 Location</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.testButton, { backgroundColor: colors.primary }]}
              onPress={requestPermissions}>
              <Text style={styles.testButtonText}>🔐 Perms</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.testButton, { backgroundColor: isBackgroundTaskActive ? '#4CAF50' : colors.primary }]}
              onPress={handleToggleBackgroundTask}>
              <Text style={styles.testButtonText}>🔄 BG Task</Text>
            </TouchableOpacity>
          </View>
          <Text style={[styles.statusText, { color: colors.textSecondary }]}>
            Perms: {hasNotificationPermission ? '✅' : '❌'} Notif | {hasLocationPermission ? '✅' : '❌'} Location | BG: {isBackgroundTaskActive ? '✅' : '❌'}
          </Text>
        </View>
      )}

      <SearchBar onSearch={handleSearch} />

      {events.map((e: Event & { isInWishlist: boolean }) => (
        <EventCard
          key={e.id}
          title={e.title}
          organizer={e.organizer || 'Unknown Organizer'}
          date={e.start_at ? new Date(e.start_at).toLocaleDateString() : 'Date TBD'}
          location={e.location || 'Location TBD'}
          locationName={e.location_name}
          latitude={e.latitude}
          longitude={e.longitude}
          imageUrl={e.image_url}
          price={e.price !== null ? (e.price === 0 ? 'Free' : `LKR ${e.price.toFixed(2)}`) : undefined}
          category={e.category}
          createdBy={e.created_by}
          onPress={() => handleEventPress(e.id)}
          onBookmark={() => handleWishlistToggle(e.id, e.isInWishlist)}
          isBookmarked={e.isInWishlist}
          onShare={() => handleShare(e)}
          onEdit={() => {
            Alert.alert('Edit Event', 'Edit functionality coming soon');
          }}
          onDelete={() => handleDeleteEvent(e.id, e.title)}
          onLongPress={() => {
            Alert.alert(
              'Event Actions',
              `What would you like to do with "${e.title}"?`,
              [
                { text: 'View Details', onPress: () => handleEventPress(e.id) },
                { text: 'Share Event', onPress: () => handleShare(e) },
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
    paddingBottom: 90,
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
  testButtons: {
    paddingHorizontal: 16,
    marginBottom: 16,
    padding: 12,
    borderRadius: 8,
    backgroundColor: 'rgba(0, 123, 255, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(0, 123, 255, 0.3)',
  },
  testTitle: {
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 8,
  },
  testButtonRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 8,
  },
  testButton: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 6,
    alignItems: 'center',
  },
  testButtonText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '600',
  },
  statusText: {
    fontSize: 10,
    marginTop: 4,
  },
});
