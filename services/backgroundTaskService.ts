/**
 * Background task for periodic event checking
 * Runs every 1 minute to check if any events are starting soon and user is within campus
 */

import { CAMPUS_COORDINATES, NOTIFICATION_RADIUS_KM, REMINDER_TIME_BEFORE_EVENT_MINUTES } from '@/constants/campus';
import { calculateHaversineDistance } from '@/utils/distance';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Location from 'expo-location';
import * as Notifications from 'expo-notifications';
import * as TaskManager from 'expo-task-manager';
import { Platform } from 'react-native';

export const BACKGROUND_EVENT_CHECK_TASK = 'BACKGROUND_EVENT_CHECK_TASK';

const EVENTS_STORAGE_KEY = '@cached_events';
const NOTIFIED_EVENTS_KEY = '@background_notified_events';

interface CachedEvent {
  id: string;
  title: string;
  location: string;
  start_at: string;
}

interface NotifiedEvent {
  eventId: string;
  notifiedAt: number;
}

/**
 * Save events to AsyncStorage for background task access
 */
export async function cacheEventsForBackground(events: CachedEvent[]): Promise<void> {
  try {
    await AsyncStorage.setItem(EVENTS_STORAGE_KEY, JSON.stringify(events));
    console.log('[BackgroundTask] 💾 Cached', events.length, 'events for background checking');
  } catch (error) {
    console.error('[BackgroundTask] Error caching events:', error);
  }
}

/**
 * Get cached events from AsyncStorage
 */
async function getCachedEvents(): Promise<CachedEvent[]> {
  try {
    const data = await AsyncStorage.getItem(EVENTS_STORAGE_KEY);
    if (data) {
      return JSON.parse(data);
    }
  } catch (error) {
    console.error('[BackgroundTask] Error getting cached events:', error);
  }
  return [];
}

/**
 * Get list of notified events
 */
async function getNotifiedEvents(): Promise<NotifiedEvent[]> {
  try {
    const data = await AsyncStorage.getItem(NOTIFIED_EVENTS_KEY);
    if (data) {
      return JSON.parse(data);
    }
  } catch (error) {
    console.error('[BackgroundTask] Error getting notified events:', error);
  }
  return [];
}

/**
 * Mark event as notified
 */
async function markEventAsNotified(eventId: string): Promise<void> {
  try {
    const notified = await getNotifiedEvents();
    const newNotified: NotifiedEvent = {
      eventId,
      notifiedAt: Date.now(),
    };
    await AsyncStorage.setItem(NOTIFIED_EVENTS_KEY, JSON.stringify([...notified, newNotified]));
    console.log('[BackgroundTask] ✅ Marked event as notified:', eventId);
  } catch (error) {
    console.error('[BackgroundTask] Error marking event as notified:', error);
  }
}

/**
 * Check if event was recently notified (within 24 hours)
 */
async function wasRecentlyNotified(eventId: string): Promise<boolean> {
  const notified = await getNotifiedEvents();
  const recent = notified.find(
    (n) => n.eventId === eventId && Date.now() - n.notifiedAt < 24 * 60 * 60 * 1000
  );
  return !!recent;
}

/**
 * Clean up old notified events (older than 7 days)
 */
async function cleanupOldNotifications(): Promise<void> {
  try {
    const notified = await getNotifiedEvents();
    const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
    const recent = notified.filter((n) => n.notifiedAt > sevenDaysAgo);
    
    if (recent.length < notified.length) {
      await AsyncStorage.setItem(NOTIFIED_EVENTS_KEY, JSON.stringify(recent));
      console.log(`[BackgroundTask] Cleaned up ${notified.length - recent.length} old notifications`);
    }
  } catch (error) {
    console.error('[BackgroundTask] Error cleaning up old notifications:', error);
  }
}

/**
 * Check if event is starting soon
 */
function isEventStartingSoon(eventStartTime: string): boolean {
  try {
    const eventDate = new Date(eventStartTime);
    if (isNaN(eventDate.getTime())) {
      return false;
    }

    const now = new Date();
    const timeDiffMinutes = (eventDate.getTime() - now.getTime()) / (1000 * 60);

    // Event should start within the reminder time window and not have started yet
    return timeDiffMinutes > 0 && timeDiffMinutes <= REMINDER_TIME_BEFORE_EVENT_MINUTES;
  } catch (error) {
    return false;
  }
}

/**
 * Define the background task
 */
TaskManager.defineTask(BACKGROUND_EVENT_CHECK_TASK, async () => {
  try {
    console.log('[BackgroundTask] 🔄 Background task triggered at', new Date().toLocaleTimeString());

    // Clean up old notifications
    await cleanupOldNotifications();

    // Get cached events
    const events = await getCachedEvents();
    if (events.length === 0) {
      console.log('[BackgroundTask] No cached events to check');
      return;
    }

    console.log('[BackgroundTask] Checking', events.length, 'events');

    // Check location permission
    const { status } = await Location.getForegroundPermissionsAsync();
    if (status !== 'granted') {
      console.log('[BackgroundTask] ⚠️ Location permission not granted');
      return;
    }

    // Get current location
    const location = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.Balanced,
    });

    const userLat = location.coords.latitude;
    const userLng = location.coords.longitude;

    // Calculate distance to campus
    const distance = calculateHaversineDistance(
      userLat,
      userLng,
      CAMPUS_COORDINATES.latitude,
      CAMPUS_COORDINATES.longitude
    );

    console.log('[BackgroundTask] User location:', { lat: userLat, lng: userLng });
    console.log('[BackgroundTask] Distance to campus:', distance.toFixed(2), 'km');

    // Check if within campus radius
    if (distance > NOTIFICATION_RADIUS_KM) {
      console.log('[BackgroundTask] ⚠️ User outside campus radius');
      return;
    }

    console.log('[BackgroundTask] ✅ User within campus radius!');

    // Check each event
    let notificationsSent = 0;
    for (const event of events) {
      if (!event.start_at) {
        continue;
      }

      // Skip if already notified
      if (await wasRecentlyNotified(event.id)) {
        continue;
      }

      // Check if event is starting soon
      if (isEventStartingSoon(event.start_at)) {
        console.log('[BackgroundTask] 📨 Sending notification for:', event.title);

        // Send notification
        await Notifications.scheduleNotificationAsync({
          content: {
            title: '📍 Event Starting Soon!',
            body: `"${event.title}" is starting soon at ${event.location || 'campus'}! You're ${distance.toFixed(2)} km away.`,
            data: {
              eventId: event.id,
              eventTitle: event.title,
              eventLocation: event.location,
              eventTime: event.start_at,
              distance: distance,
            },
            sound: true,
            priority: Notifications.AndroidNotificationPriority.HIGH,
            categoryIdentifier: 'event-reminder',
          },
          trigger: null, // Send immediately
        });

        await markEventAsNotified(event.id);
        notificationsSent++;
      }
    }

    if (notificationsSent > 0) {
      console.log('[BackgroundTask] 🎉 Sent', notificationsSent, 'notification(s)');
    } else {
      console.log('[BackgroundTask] No notifications sent (no eligible events)');
    }
  } catch (error) {
    console.error('[BackgroundTask] ❌ Error in background task:', error);
  }
});

/**
 * Register the background task to run periodically
 */
export async function registerBackgroundTask(): Promise<void> {
  try {
    console.log('[BackgroundTask] 🚀 Registering background task...');

    // Check if already registered
    const isRegistered = await TaskManager.isTaskRegisteredAsync(BACKGROUND_EVENT_CHECK_TASK);
    if (isRegistered) {
      console.log('[BackgroundTask] Task already registered');
      return;
    }

    // Request background location permission (Android only)
    if (Platform.OS === 'android') {
      const { status: foregroundStatus } = await Location.getForegroundPermissionsAsync();
      if (foregroundStatus === 'granted') {
        const { status: backgroundStatus } = await Location.requestBackgroundPermissionsAsync();
        if (backgroundStatus !== 'granted') {
          console.warn('[BackgroundTask] ⚠️ Background location permission not granted');
        }
      }
    }

    // Register background location task
    await Location.startLocationUpdatesAsync(BACKGROUND_EVENT_CHECK_TASK, {
      accuracy: Location.Accuracy.Balanced,
      timeInterval: 60000, // Check every 1 minute (60000ms)
      distanceInterval: 0, // Check even if user doesn't move
      foregroundService: {
        notificationTitle: 'Event Reminders Active',
        notificationBody: 'Checking for upcoming events near you',
        notificationColor: '#007AFF',
      },
      pausesUpdatesAutomatically: false,
      showsBackgroundLocationIndicator: true, // iOS only
    });

    console.log('[BackgroundTask] ✅ Background task registered successfully');
  } catch (error) {
    console.error('[BackgroundTask] ❌ Error registering background task:', error);
    throw error;
  }
}

/**
 * Unregister the background task
 */
export async function unregisterBackgroundTask(): Promise<void> {
  try {
    const isRegistered = await TaskManager.isTaskRegisteredAsync(BACKGROUND_EVENT_CHECK_TASK);
    if (isRegistered) {
      await Location.stopLocationUpdatesAsync(BACKGROUND_EVENT_CHECK_TASK);
      console.log('[BackgroundTask] Background task unregistered');
    }
  } catch (error) {
    console.error('[BackgroundTask] Error unregistering background task:', error);
  }
}

/**
 * Check if background task is registered
 */
export async function isBackgroundTaskRegistered(): Promise<boolean> {
  try {
    return await TaskManager.isTaskRegisteredAsync(BACKGROUND_EVENT_CHECK_TASK);
  } catch (error) {
    console.error('[BackgroundTask] Error checking task registration:', error);
    return false;
  }
}
