/**
 * ===============================================================================
 * BACKGROUND TASK SERVICE - PERIODIC EVENT CHECKING (APP CLOSED)
 * ===============================================================================
 * 
 * PURPOSE:
 * Runs EVERY MINUTE in the background (even when app is closed) to check if
 * any events are starting in 2 minutes and send notifications.
 * 
 * HOW IT WORKS (BACKGROUND EXECUTION):
 * ────────────────────────────────────────────────────────────────────────────
 * 
 * Step 1: REGISTRATION (registerBackgroundTask)
 *   - Uses expo-background-fetch to register periodic task
 *   - Task name: 'BACKGROUND_EVENT_CHECK_TASK'
 *   - Frequency: Every 60 seconds (minimumInterval: 60)
 *   - Settings:
 *     → stopOnTerminate: false (keep running after app closes)
 *     → startOnBoot: true (restart task after device reboot)
 *   - OS may adjust frequency to save battery (not guaranteed exact timing)
 * 
 * Step 2: TASK EXECUTION (runs every minute)
 *   a) Get cached events from AsyncStorage (@cached_events)
 *      - Events were cached by useEventScheduler when list changed
 *      - Contains: id, title, location, coordinates, start_at
 *   
 *   b) For each cached event:
 *      - Check if already notified in last 24 hours (skip if yes)
 *      - Check if event is starting in 2 minutes:
 *        → Calculate time difference: eventTime - currentTime
 *        → If between 1.5 and 2.5 minutes: eligible for notification
 *      - If eligible, send immediate notification
 *   
 *   c) Mark notified events in AsyncStorage (@background_notified_events)
 *      - Prevents duplicate notifications
 *      - Cleanup old notifications (> 7 days) automatically
 * 
 * Step 3: NOTIFICATION SENDING
 *   - Create notification with expo-notifications
 *   - Title: "📍 Event Starting Soon!"
 *   - Body: Event title, location name, "starting in 2 minutes"
 *   - Priority: HIGH (Android)
 *   - Sound: Enabled
 *   - Trigger: null (send immediately, don't schedule)
 * 
 * KEY FEATURES:
 * ────────────────────────────────────────────────────────────────────────────
 * ✅ Works when app is FULLY CLOSED (not just in background)
 * ✅ Survives device reboot (startOnBoot: true)
 * ✅ Minimal battery impact (checks cached data, no API calls)
 * ✅ No location checking (sends notification to all users)
 * ✅ Automatic cleanup of old notifications (> 7 days)
 * ✅ Prevents duplicate notifications (24-hour window)
 * 
 * LIMITATIONS:
 * ────────────────────────────────────────────────────────────────────────────
 * ❌ Does NOT check user location (sends to everyone)
 * ❌ Timing not guaranteed (OS may delay/batch for battery saving)
 * ❌ Requires events to be cached first (by foreground app)
 * ❌ Android may kill task if device is low on memory
 * ❌ iOS has stricter background execution limits
 * 
 * STORAGE:
 * ────────────────────────────────────────────────────────────────────────────
 * @cached_events: Array of event objects with start times
 * @background_notified_events: Array of { eventId, notifiedAt }
 * 
 * USAGE:
 * ────────────────────────────────────────────────────────────────────────────
 * ```tsx
 * // Register task when user enables background notifications
 * await registerBackgroundTask();
 * 
 * // Check if task is running
 * const isActive = await isBackgroundTaskRegistered();
 * 
 * // Unregister task
 * await unregisterBackgroundTask();
 * ```
 * 
 * PERMISSION REQUIREMENTS:
 * ────────────────────────────────────────────────────────────────────────────
 * - Notification permission (expo-notifications)
 * - Background execution permission (granted automatically on Android)
 * - Battery optimization exemption (user may need to configure manually)
 * 
 * DEBUGGING:
 * ────────────────────────────────────────────────────────────────────────────
 * All operations logged to console with [BackgroundTask] prefix:
 * - Task trigger times
 * - Events checked
 * - Notifications sent
 * - Errors and warnings
 * ===============================================================================
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import * as BackgroundFetch from 'expo-background-fetch';
import * as Notifications from 'expo-notifications';
import * as TaskManager from 'expo-task-manager';

export const BACKGROUND_EVENT_CHECK_TASK = 'BACKGROUND_EVENT_CHECK_TASK';
const REMINDER_TIME_BEFORE_EVENT_MINUTES = 2; // Send notification 2 minutes before event

const EVENTS_STORAGE_KEY = '@cached_events';
const NOTIFIED_EVENTS_KEY = '@background_notified_events';

interface CachedEvent {
  id: string;
  title: string;
  location: string;
  latitude?: number;
  longitude?: number;
  location_name?: string;
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
 * Check if event is starting in 2 minutes
 */
function isEventStartingIn2Minutes(eventStartTime: string): boolean {
  try {
    const eventDate = new Date(eventStartTime);
    if (isNaN(eventDate.getTime())) {
      return false;
    }

    const now = new Date();
    const timeDiffMinutes = (eventDate.getTime() - now.getTime()) / (1000 * 60);

    // Event should start within 2 minutes (between 1.5 and 2.5 minutes to allow for check frequency)
    return timeDiffMinutes > 1.5 && timeDiffMinutes <= 2.5;
  } catch (error) {
    return false;
  }
}

/**
 * Define the background task
 */
TaskManager.defineTask(BACKGROUND_EVENT_CHECK_TASK, async ({ error }: any) => {
  if (error) {
    console.error('[BackgroundTask] ❌ Task error:', error);
    return;
  }

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

      // Check if event is starting in 2 minutes
      if (isEventStartingIn2Minutes(event.start_at)) {
        console.log('[BackgroundTask] 📨 Sending notification for:', event.title);

        const locationName = event.location_name || event.location || 'the event location';

        // Send notification
        await Notifications.scheduleNotificationAsync({
          content: {
            title: '📍 Event Starting Soon!',
            body: `"${event.title}" is starting in 2 minutes at ${locationName}!`,
        data: {
              eventId: event.id,
              eventTitle: event.title,
              eventLocation: event.location,
              eventLocationName: event.location_name,
              eventTime: event.start_at,
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
 * Register the background task to run periodically using BackgroundFetch
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

    // Register background fetch task to run every minute
    await BackgroundFetch.registerTaskAsync(BACKGROUND_EVENT_CHECK_TASK, {
      minimumInterval: 60, // Run every 60 seconds (1 minute)
      stopOnTerminate: false,
      startOnBoot: true,
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
      await BackgroundFetch.unregisterTaskAsync(BACKGROUND_EVENT_CHECK_TASK);
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
