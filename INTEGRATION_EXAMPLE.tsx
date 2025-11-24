/**
 * EXAMPLE INTEGRATION
 * This file shows how to integrate the location-based reminder system
 * into the events screen. Copy the relevant parts to your actual events screen.
 */

import { useEventScheduler } from '@/hooks/useEventScheduler';
import { listEvents } from '@/services/events';
import { Event } from '@/services/selectiveWishlist';
import { useEffect, useState } from 'react';
import { Alert, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

export default function EventsScreenExample() {
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(false);

  // Initialize the event scheduler
  const {
    isReady,
    hasNotificationPermission,
    hasLocationPermission,
    requestPermissions,
  } = useEventScheduler(events, {
    enabled: true,
    autoSchedule: true, // Automatically schedule when events change
  });

  /**
   * Request permissions on first load
   */
  useEffect(() => {
    // Check if we need to request permissions
    if (!hasNotificationPermission || !hasLocationPermission) {
      showPermissionDialog();
    }
  }, [hasNotificationPermission, hasLocationPermission]);

  /**
   * Show a dialog explaining why we need permissions
   */
  const showPermissionDialog = () => {
    Alert.alert(
      '🔔 Enable Event Reminders',
      'Get notified 1 hour before events when you\'re near campus!\n\nWe need permission to:\n• Send notifications\n• Check your location',
      [
        {
          text: 'Not Now',
          style: 'cancel',
        },
        {
          text: 'Enable',
          onPress: async () => {
            await requestPermissions();
            
            // Check if permissions were granted
            if (!hasNotificationPermission || !hasLocationPermission) {
              Alert.alert(
                'Permissions Required',
                'Please grant all permissions to enable event reminders. You can change this in Settings later.',
                [{ text: 'OK' }]
              );
            }
          },
        },
      ]
    );
  };

  /**
   * Fetch events from backend
   */
  const fetchEvents = async () => {
    setLoading(true);
    try {
      const data = await listEvents();
      setEvents(data || []);
      // Note: Notifications will be scheduled automatically by useEventScheduler
    } catch (error) {
      console.error('Error fetching events:', error);
      Alert.alert('Error', 'Failed to load events');
    } finally {
      setLoading(false);
    }
  };

  /**
   * Initial load
   */
  useEffect(() => {
    fetchEvents();
  }, []);

  return (
    <View style={styles.container}>
      {/* Permission Status Banner */}
      {!isReady && (
        <View style={styles.permissionBanner}>
          <Text style={styles.bannerText}>
            📍 Event reminders disabled
          </Text>
          <TouchableOpacity onPress={requestPermissions} style={styles.enableButton}>
            <Text style={styles.enableButtonText}>Enable</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Your existing events UI */}
      <View style={styles.content}>
        {/* ... your event list code ... */}
      </View>

      {/* Debug info (remove in production) */}
      {__DEV__ && (
        <View style={styles.debugPanel}>
          <Text style={styles.debugText}>
            Scheduler Ready: {isReady ? '✅' : '❌'}
          </Text>
          <Text style={styles.debugText}>
            Notifications: {hasNotificationPermission ? '✅' : '❌'}
          </Text>
          <Text style={styles.debugText}>
            Location: {hasLocationPermission ? '✅' : '❌'}
          </Text>
          <Text style={styles.debugText}>
            Events: {events.length}
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  permissionBanner: {
    backgroundColor: '#FFF3CD',
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: '#FFE69C',
  },
  bannerText: {
    fontSize: 14,
    color: '#856404',
    flex: 1,
  },
  enableButton: {
    backgroundColor: '#856404',
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 4,
  },
  enableButtonText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '600',
  },
  content: {
    flex: 1,
  },
  debugPanel: {
    position: 'absolute',
    bottom: 20,
    right: 20,
    backgroundColor: 'rgba(0,0,0,0.8)',
    padding: 12,
    borderRadius: 8,
  },
  debugText: {
    color: '#FFF',
    fontSize: 12,
    marginBottom: 4,
  },
});
