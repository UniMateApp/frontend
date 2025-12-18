/**
 * Immediate location-based notification service
 * Checks if user is within each event's location radius and sends notifications immediately
 * 
 * Flow:
 * 1. Get user's live GPS location once
 * 2. For each event with coordinates (latitude/longitude):
 *    - Calculate distance between user location and event location
 *    - If within NOTIFICATION_RADIUS_KM and event is starting soon, send notification
 * 3. Track notified events to prevent duplicate notifications
 */

import { NOTIFICATION_RADIUS_KM, REMINDER_TIME_BEFORE_EVENT_MINUTES } from '@/constants/campus';
import { Event } from '@/services/selectiveWishlist';
import { calculateHaversineDistance } from '@/utils/distance';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Location from 'expo-location';
import * as Notifications from 'expo-notifications';

const NOTIFIED_EVENTS_KEY = '@notified_events';

interface NotifiedEvent {
  eventId: string;
  notifiedAt: number;
}

/**
 * Get list of events that have already been notified
 */
async function getNotifiedEvents(): Promise<NotifiedEvent[]> {
  try {
    const data = await AsyncStorage.getItem(NOTIFIED_EVENTS_KEY);
    if (data) {
      return JSON.parse(data);
    }
  } catch (error) {
    console.error('[ImmediateNotifier] Error getting notified events:', error);
  }
  return [];
}

/**
 * Save notified event to storage
 */
async function markEventAsNotified(eventId: string): Promise<void> {
  try {
    const notified = await getNotifiedEvents();
    const newNotified: NotifiedEvent = {
      eventId,
      notifiedAt: Date.now(),
    };
    await AsyncStorage.setItem(NOTIFIED_EVENTS_KEY, JSON.stringify([...notified, newNotified]));
    console.log('[ImmediateNotifier] ✅ Marked event as notified:', eventId);
  } catch (error) {
    console.error('[ImmediateNotifier] Error marking event as notified:', error);
  }
}

/**
 * Check if event was already notified in the last 24 hours
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
export async function cleanupOldNotifications(): Promise<void> {
  try {
    const notified = await getNotifiedEvents();
    const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
    const recent = notified.filter((n) => n.notifiedAt > sevenDaysAgo);
    
    if (recent.length < notified.length) {
      await AsyncStorage.setItem(NOTIFIED_EVENTS_KEY, JSON.stringify(recent));
      console.log(`[ImmediateNotifier] Cleaned up ${notified.length - recent.length} old notifications`);
    }
  } catch (error) {
    console.error('[ImmediateNotifier] Error cleaning up old notifications:', error);
  }
}

/**
 * Get user's current location
 */
async function getUserLocation(): Promise<{ latitude: number; longitude: number } | null> {
  try {
    console.log('[ImmediateNotifier] 📍 Getting user location...');
    
    // Check if location services are enabled
    const isEnabled = await Location.hasServicesEnabledAsync();
    if (!isEnabled) {
      console.warn('[ImmediateNotifier] ⚠️ Location services are disabled on device');
      return null;
    }

    // Check if location permission is granted
    const { status } = await Location.getForegroundPermissionsAsync();
    if (status !== 'granted') {
      console.warn('[ImmediateNotifier] ⚠️ Location permission not granted');
      return null;
    }

    // Get current location with timeout
    const location = await Promise.race([
      Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
        mayShowUserSettingsDialog: true,
      }),
      new Promise<never>((_, reject) => 
        setTimeout(() => reject(new Error('Location request timeout')), 10000)
      )
    ]);

    const userLat = location.coords.latitude;
    const userLng = location.coords.longitude;

    console.log('[ImmediateNotifier] User location:', { lat: userLat, lng: userLng });

    return { latitude: userLat, longitude: userLng };
  } catch (error: any) {
    if (error.message === 'Location request timeout') {
      console.warn('[ImmediateNotifier] ⚠️ Location request timed out - location services may be slow or unavailable');
    } else if (error.message?.includes('location services')) {
      console.warn('[ImmediateNotifier] ⚠️ Location services disabled:', error.message);
      console.log('[ImmediateNotifier] 💡 Enable location in: Settings → Location → Turn on');
    } else {
      console.warn('[ImmediateNotifier] ⚠️ Error checking user location:', error.message || error);
    }
    return null;
  }
}

/**
 * Check if user is within radius of a specific event location
 */
function isUserWithinEventRadius(
  userLocation: { latitude: number; longitude: number },
  eventLatitude: number,
  eventLongitude: number
): { withinRadius: boolean; distance: number } {
  const distance = calculateHaversineDistance(
    userLocation.latitude,
    userLocation.longitude,
    eventLatitude,
    eventLongitude
  );

  const withinRadius = distance <= NOTIFICATION_RADIUS_KM;
  
  return { withinRadius, distance };
}

/**
 * Check if event is starting soon (within reminder time window)
 */
function isEventStartingSoon(eventStartTime: string): boolean {
  try {
    const eventDate = new Date(eventStartTime);
    if (isNaN(eventDate.getTime())) {
      return false;
    }

    const now = new Date();
    const timeDiffMinutes = (eventDate.getTime() - now.getTime()) / (1000 * 60);

    // Event should start within the reminder time window (e.g., within next 2 minutes for testing)
    // and not have started yet
    const isInWindow = timeDiffMinutes > 0 && timeDiffMinutes <= REMINDER_TIME_BEFORE_EVENT_MINUTES;
    
    if (isInWindow) {
      console.log(`[ImmediateNotifier] Event starting in ${timeDiffMinutes.toFixed(1)} minutes`);
    }

    return isInWindow;
  } catch (error) {
    console.error('[ImmediateNotifier] Error checking event time:', error);
    return false;
  }
}

/**
 * Send immediate notification for an event
 */
async function sendNotificationForEvent(event: Event, distance: number): Promise<void> {
  try {
    console.log(`[ImmediateNotifier]  Sending notification for: "${event.title}"`);
    
    const locationName = event.location_name || event.location || 'the event location';
    
    await Notifications.scheduleNotificationAsync({
      content: {
        title: '📍 Event Starting Soon!',
        body: `"${event.title}" is starting soon at ${locationName}! You're ${distance.toFixed(2)} km away.`,
        data: {
          eventId: event.id,
          eventTitle: event.title,
          eventLocation: event.location,
          eventLocationName: event.location_name,
          eventTime: event.start_at,
          distance: distance,
        },
        sound: true,
        priority: Notifications.AndroidNotificationPriority.HIGH,
        categoryIdentifier: 'event-reminder',
      },
      trigger: null, // Send immediately
    });

    console.log(`[ImmediateNotifier] ✅ Notification sent for "${event.title}"`);
  } catch (error) {
    console.error('[ImmediateNotifier] ❌ Error sending notification:', error);
  }
}

/**
 * Check all events and send notifications for eligible ones
 * This is called when user adds a new event or when events list changes
 */
export async function checkAndNotifyEvents(events: Event[]): Promise<void> {
  try {
    console.log(`[ImmediateNotifier] Checking ${events.length} events for notifications...`);

    // Clean up old notifications
    await cleanupOldNotifications();

    // 1. Get user's current location once
    const userLocation = await getUserLocation();
    
    if (!userLocation) {
      console.warn('[ImmediateNotifier] Could not get user location, skipping notifications');
      return;
    }

    // 2. Check each event against user's location by looping through each event
    let notificationsSent = 0;
    for (const event of events) {
      // Skip if no start time 
      if (!event.start_at) {
        console.log(`[ImmediateNotifier] Event "${event.title}" has no start time, skipping`);
        continue;
      }

      // Skip if event has no coordinates
      if (event.latitude === undefined || event.latitude === null || 
          event.longitude === undefined || event.longitude === null) {
        console.log(`[ImmediateNotifier] ⚠️ Event "${event.title}" has no location coordinates, skipping`);
        continue;
      }

      // Skip if already notified recently
      if (await wasRecentlyNotified(event.id)) {
        console.log(`[ImmediateNotifier] Event "${event.title}" was already notified, skipping`);
        continue;
      }

      // 3. Check if event is starting soon
      if (!isEventStartingSoon(event.start_at)) {
        const eventDate = new Date(event.start_at);
        const now = new Date();
        const timeDiffMinutes = (eventDate.getTime() - now.getTime()) / (1000 * 60);
        console.log(`[ImmediateNotifier] Event "${event.title}" not in notification window (starts in ${timeDiffMinutes.toFixed(1)} min)`);
        continue; // Not starting soon
      }

      // 4. Check if user is within radius of this event's location
      const { withinRadius, distance } = isUserWithinEventRadius(
        userLocation,
        event.latitude,
        event.longitude
      );

      console.log(`[ImmediateNotifier] Event "${event.title}" location:`, {
        lat: event.latitude,
        lng: event.longitude,
        locationName: event.location_name || event.location,
      });
      console.log(`[ImmediateNotifier] Distance to event: ${distance.toFixed(2)} km`);

      // 5. Only send notification if within 8km radius
      if (withinRadius) {
        console.log(`[ImmediateNotifier] User is within ${NOTIFICATION_RADIUS_KM} km of event "${event.title}"`);
        
        // Send notification
        await sendNotificationForEvent(event, distance);
        await markEventAsNotified(event.id);
        notificationsSent++;
      } else {
        console.log(`[ImmediateNotifier] User is outside ${NOTIFICATION_RADIUS_KM} km radius of event "${event.title}"`);
      }
    }

    if (notificationsSent > 0) {
      console.log(`[ImmediateNotifier] Sent ${notificationsSent} notification(s)`);
    } else {
      console.log('[ImmediateNotifier] No notifications sent (no eligible events)');
    }
  } catch (error) {
    console.error('[ImmediateNotifier] Error checking and notifying events:', error);
  }
}

/**
 * Test function to send an immediate notification
 */
export async function sendTestNotification(): Promise<void> {
  try {
    console.log('[ImmediateNotifier] Sending test notification...');
    
    await Notifications.scheduleNotificationAsync({
      content: {
        title: '✅ Test Notification',
        body: 'If you see this, notifications are working correctly!',
        sound: true,
        priority: Notifications.AndroidNotificationPriority.HIGH,
      },
      trigger: null, // Send immediately
    });

    console.log('[ImmediateNotifier] Test notification sent');
  } catch (error) {
    console.error('[ImmediateNotifier] Error sending test notification:', error);
    throw error;
  }
}

/**
 * Force check location and return user coordinates (for testing)
 */
export async function forceCheckLocation(): Promise<{ userLocation: { latitude: number; longitude: number } | null }> {
  const userLocation = await getUserLocation();
  return { userLocation };
}
