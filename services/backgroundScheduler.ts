/**
 * Background scheduler service for managing event reminder notifications
 * Handles scheduling and canceling background tasks for event reminders
 */

import { REMINDER_TIME_BEFORE_EVENT_MINUTES } from '@/constants/campus';
import { Event } from '@/services/selectiveWishlist';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

// Storage key for scheduled notifications
const SCHEDULED_NOTIFICATIONS_KEY = '@scheduled_notifications';

interface ScheduledNotification {
  eventId: string;
  notificationId: string;
  scheduledTime: number;
  eventTitle: string;
}

/**
 * Configure notification handler
 * This determines how notifications are displayed when app is in foreground
 */
export function configureNotificationHandler(): void {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: true,
      shouldShowBanner: true,
      shouldShowList: true,
    }),
  });
}

/**
 * Request notification permissions
 */
export async function requestNotificationPermissions(): Promise<boolean> {
  try {
    console.log('[Scheduler] Checking notification permissions...');
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== 'granted') {
      console.log('[Scheduler] Requesting notification permissions...');
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== 'granted') {
      console.warn('[Scheduler] ⚠️ Notification permission not granted:', finalStatus);
      return false;
    }
    
    console.log('[Scheduler] ✅ Notification permission granted');

    // Android specific channel configuration
    if (Platform.OS === 'android') {
      console.log('[Scheduler] Setting up Android notification channel...');
      await Notifications.setNotificationChannelAsync('event-reminders', {
        name: 'Event Reminders',
        importance: Notifications.AndroidImportance.HIGH,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#FF231F7C',
        sound: 'default',
        enableVibrate: true,
        showBadge: true,
      });
      console.log('[Scheduler] ✅ Android notification channel created');
    }

    return true;
  } catch (error) {
    console.error('Error requesting notification permissions:', error);
    return false;
  }
}

/**
 * Get all scheduled notifications from storage
 */
async function getScheduledNotifications(): Promise<ScheduledNotification[]> {
  try {
    const data = await AsyncStorage.getItem(SCHEDULED_NOTIFICATIONS_KEY);
    if (data) {
      return JSON.parse(data);
    }
  } catch (error) {
    console.error('Error getting scheduled notifications:', error);
  }
  return [];
}

/**
 * Save scheduled notifications to storage
 */
async function saveScheduledNotifications(notifications: ScheduledNotification[]): Promise<void> {
  try {
    await AsyncStorage.setItem(SCHEDULED_NOTIFICATIONS_KEY, JSON.stringify(notifications));
  } catch (error) {
    console.error('Error saving scheduled notifications:', error);
  }
}

/**
 * Calculate the trigger time for a notification (1 hour before event)
 */
function calculateTriggerTime(eventStartTime: string): number | null {
  try {
    const eventDate = new Date(eventStartTime);
    if (isNaN(eventDate.getTime())) {
      console.warn('Invalid event date:', eventStartTime);
      return null;
    }

    // Calculate reminder time before event (e.g., 2 minutes for testing)
    const reminderTime = new Date(eventDate.getTime() - REMINDER_TIME_BEFORE_EVENT_MINUTES * 60 * 1000);
    const now = new Date();

    // Only schedule if reminder time is in the future
    if (reminderTime <= now) {
      console.log('Event reminder time is in the past, skipping:', eventStartTime);
      return null;
    }

    return reminderTime.getTime();
  } catch (error) {
    console.error('Error calculating trigger time:', error);
    return null;
  }
}

/**
 * Schedule a notification for a specific event
 * Note: This uses a workaround since true background task scheduling with location
 * is complex in Expo. We schedule a notification trigger, and rely on the app
 * being opened or a foreground service to check location at the trigger time.
 */
export async function scheduleEventReminder(event: Event): Promise<string | null> {
  try {
    console.log(`[Scheduler] 📌 Scheduling event: "${event.title}"`);
    
    if (!event.start_at) {
      console.warn(`[Scheduler] ⚠️ Event "${event.title}" has no start time, skipping`);
      return null;
    }

    // Check if already scheduled
    const scheduled = await getScheduledNotifications();
    const existing = scheduled.find((n) => n.eventId === event.id);
    if (existing) {
      console.log(`[Scheduler] Event "${event.title}" already scheduled`);
      return existing.notificationId;
    }

    // Calculate trigger time
    const triggerTime = calculateTriggerTime(event.start_at);
    if (!triggerTime) {
      console.log(`[Scheduler] ⚠️ Could not calculate trigger time for "${event.title}"`);
      return null;
    }

    const triggerDate = new Date(triggerTime);

    // Schedule the notification
    // Note: This is a simplified approach. In production, you might want to use
    // a more sophisticated background task scheduler or a backend service
    const notificationId = await Notifications.scheduleNotificationAsync({
      content: {
        title: '📍 Event Reminder',
        body: `"${event.title}" is starting in 1 hour at ${event.location || 'campus'}! Make sure you're on campus.`,
        data: {
          eventId: event.id,
          eventTitle: event.title,
          eventLocation: event.location,
          eventTime: event.start_at,
        },
        sound: true,
        priority: Notifications.AndroidNotificationPriority.HIGH,
        categoryIdentifier: 'event-reminder',
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: triggerDate,
      } as Notifications.DateTriggerInput,
    });

    // Save to storage
    const newScheduled: ScheduledNotification = {
      eventId: event.id,
      notificationId,
      scheduledTime: triggerTime,
      eventTitle: event.title,
    };

    await saveScheduledNotifications([...scheduled, newScheduled]);

    console.log(`[Scheduler] ✅ Scheduled reminder for "${event.title}"`);
    console.log(`[Scheduler]    Event time: ${new Date(event.start_at).toLocaleString()}`);
    console.log(`[Scheduler]    Reminder: ${triggerDate.toLocaleString()}`);
    console.log(`[Scheduler]    Notification ID: ${notificationId}`);
    return notificationId;
  } catch (error) {
    console.error(`[Scheduler] ❌ Error scheduling event "${event.title}":`, error);
    return null;
  }
}

/**
 * Schedule reminders for multiple events
 */
export async function scheduleMultipleEventReminders(events: Event[]): Promise<void> {
  try {
    console.log(`[Scheduler] 📦 Scheduling ${events.length} event reminders...`);
    const results = await Promise.allSettled(
      events.map((event) => scheduleEventReminder(event))
    );

    const successful = results.filter((r) => r.status === 'fulfilled').length;
    const failed = results.filter((r) => r.status === 'rejected');
    
    console.log(`[Scheduler] ✅ Scheduled ${successful} out of ${events.length} event reminders`);
    
    if (failed.length > 0) {
      console.warn(`[Scheduler] ⚠️ ${failed.length} events failed to schedule`);
      failed.forEach((result, index) => {
        if (result.status === 'rejected') {
          console.error(`[Scheduler]    Failed event ${index + 1}:`, result.reason);
        }
      });
    }
  } catch (error) {
    console.error('[Scheduler] ❌ Error scheduling multiple event reminders:', error);
  }
}

/**
 * Cancel a scheduled notification for an event
 */
export async function cancelEventReminder(eventId: string): Promise<void> {
  try {
    const scheduled = await getScheduledNotifications();
    const notification = scheduled.find((n) => n.eventId === eventId);

    if (notification) {
      await Notifications.cancelScheduledNotificationAsync(notification.notificationId);

      // Remove from storage
      const updated = scheduled.filter((n) => n.eventId !== eventId);
      await saveScheduledNotifications(updated);

      console.log(`Cancelled reminder for event: ${eventId}`);
    }
  } catch (error) {
    console.error('Error canceling event reminder:', error);
  }
}

/**
 * Cancel all scheduled notifications
 */
export async function cancelAllEventReminders(): Promise<void> {
  try {
    await Notifications.cancelAllScheduledNotificationsAsync();
    await AsyncStorage.removeItem(SCHEDULED_NOTIFICATIONS_KEY);
    console.log('Cancelled all event reminders');
  } catch (error) {
    console.error('Error canceling all event reminders:', error);
  }
}

/**
 * Clean up past scheduled notifications
 */
export async function cleanupPastReminders(): Promise<void> {
  try {
    const scheduled = await getScheduledNotifications();
    const now = Date.now();

    // Filter out past notifications
    const future = scheduled.filter((n) => n.scheduledTime > now);

    if (future.length < scheduled.length) {
      await saveScheduledNotifications(future);
      console.log(`Cleaned up ${scheduled.length - future.length} past reminders`);
    }
  } catch (error) {
    console.error('Error cleaning up past reminders:', error);
  }
}

/**
 * Get all currently scheduled notifications
 */
export async function getActiveReminders(): Promise<ScheduledNotification[]> {
  return await getScheduledNotifications();
}

/**
 * Sync notifications with current event list
 * Cancel notifications for events that no longer exist
 */
export async function syncNotificationsWithEvents(currentEvents: Event[]): Promise<void> {
  try {
    const scheduled = await getScheduledNotifications();
    const currentEventIds = new Set(currentEvents.map((e) => e.id));

    // Cancel notifications for events that no longer exist
    const toCancel = scheduled.filter((n) => !currentEventIds.has(n.eventId));

    for (const notification of toCancel) {
      await cancelEventReminder(notification.eventId);
    }

    if (toCancel.length > 0) {
      console.log(`Synced notifications: cancelled ${toCancel.length} outdated reminders`);
    }
  } catch (error) {
    console.error('Error syncing notifications with events:', error);
  }
}
