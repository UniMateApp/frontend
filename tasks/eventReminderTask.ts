/**
 * ===============================================================================
 * EVENT REMINDER TASK - LOCATION-CHECKING BACKGROUND TASK (LEGACY)
 * ===============================================================================
 * 
 * STATUS: LEGACY / NOT CURRENTLY USED
 * This file represents an earlier approach to location-aware notifications.
 * The app now uses immediateNotifier.ts and backgroundTaskService.ts instead.
 * 
 * ORIGINAL PURPOSE:
 * ────────────────────────────────────────────────────────────────────────────
 * Run a background task 1 hour before each event to:
 * 1. Get user's GPS location
 * 2. Calculate distance to campus (CAMPUS_COORDINATES)
 * 3. Only send notification if user is within NOTIFICATION_RADIUS_KM
 * 
 * HOW IT WAS DESIGNED TO WORK:
 * ────────────────────────────────────────────────────────────────────────────
 * 
 * Step 1: TASK SCHEDULING
 *   - Schedule individual task for each event
 *   - Task triggered at: event.start_at - 1 hour
 *   - Task data includes: eventId, eventTitle, eventLocation, eventTime
 * 
 * Step 2: TASK EXECUTION (at trigger time)
 *   - Check if event already notified (skip if yes)
 *   - Request location permission
 *   - Get current GPS position using expo-location
 *   - Calculate distance to CAMPUS_COORDINATES using Haversine formula
 * 
 * Step 3: PROXIMITY CHECK
 *   - isWithinRadius(userLat, userLng, campusLat, campusLng, radiusKm)
 *   - If within radius: Send notification ✅
 *   - If outside radius: Skip notification, log to console ❌
 * 
 * Step 4: NOTIFICATION
 *   - Title: "📍 Event Reminder"
 *   - Body: Event title, location, "starting in 1 hour"
 *   - Mark event as notified (prevent duplicates)
 * 
 * WHY NOT USED:
 * ────────────────────────────────────────────────────────────────────────────
 * ❌ Scheduling individual tasks for each event is complex
 * ❌ Expo TaskManager has limitations with task scheduling
 * ❌ Background location access difficult to obtain (privacy concerns)
 * ❌ iOS severely restricts background location access
 * ❌ Task might not fire at exact scheduled time
 * 
 * CURRENT APPROACH (immediateNotifier.ts):
 * ────────────────────────────────────────────────────────────────────────────
 * ✅ Check location when user opens app (foreground)
 * ✅ Check location when events list changes
 * ✅ Simpler permission model (foreground location only)
 * ✅ More reliable execution
 * ✅ Better battery efficiency
 * 
 * STORAGE:
 * ────────────────────────────────────────────────────────────────────────────
 * AsyncStorage key: @notified_events
 * Format: Set of event IDs that have been notified
 * Purpose: Prevent sending same notification multiple times
 * 
 * FUNCTIONS:
 * ────────────────────────────────────────────────────────────────────────────
 * - isTaskRegistered(): Check if task is registered
 * - getNotifiedEvents(): Get set of notified event IDs
 * - markEventAsNotified(eventId): Add event to notified set
 * - cleanupNotifiedEvents(): Remove old entries (currently no-op)
 * ===============================================================================
 */

import { CAMPUS_COORDINATES, NOTIFICATION_RADIUS_KM } from '@/constants/campus';
import { isWithinRadius } from '@/utils/distance';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Location from 'expo-location';
import * as Notifications from 'expo-notifications';
import * as TaskManager from 'expo-task-manager';

export const EVENT_REMINDER_TASK = 'EVENT_REMINDER_TASK';

// Storage keys
const NOTIFIED_EVENTS_KEY = '@notified_events';

/**
 * Get list of already notified event IDs
 */
async function getNotifiedEvents(): Promise<Set<string>> {
  try {
    const data = await AsyncStorage.getItem(NOTIFIED_EVENTS_KEY);
    if (data) {
      return new Set(JSON.parse(data));
    }
  } catch (error) {
    console.error('Error getting notified events:', error);
  }
  return new Set();
}

/**
 * Mark an event as notified
 */
async function markEventAsNotified(eventId: string): Promise<void> {
  try {
    const notifiedEvents = await getNotifiedEvents();
    notifiedEvents.add(eventId);
    await AsyncStorage.setItem(NOTIFIED_EVENTS_KEY, JSON.stringify([...notifiedEvents]));
  } catch (error) {
    console.error('Error marking event as notified:', error);
  }
}

/**
 * Check if an event has already been notified
 */
async function isEventNotified(eventId: string): Promise<boolean> {
  const notifiedEvents = await getNotifiedEvents();
  return notifiedEvents.has(eventId);
}

/**
 * Clean up old notified events (older than 48 hours)
 */
export async function cleanupNotifiedEvents(): Promise<void> {
  try {
    // For now, we'll just keep all notified events
    // In a production app, you might want to clear old ones periodically
    console.log('Notified events cleanup triggered');
  } catch (error) {
    console.error('Error cleaning up notified events:', error);
  }
}

/**
 * Define the background task for event reminders
 */
TaskManager.defineTask(EVENT_REMINDER_TASK, async ({ data, error }) => {
  if (error) {
    console.error('Event reminder task error:', error);
    return;
  }

  try {
    console.log('Event reminder task triggered with data:', data);

    // Extract event data from the task payload
    const { eventId, eventTitle, eventLocation, eventTime } = (data as any) || {};

    if (!eventId || !eventTitle) {
      console.error('Invalid task data: missing eventId or eventTitle');
      return;
    }

    // Check if we've already notified for this event
    const alreadyNotified = await isEventNotified(eventId);
    if (alreadyNotified) {
      console.log(`Event ${eventId} already notified, skipping`);
      return;
    }

    // Request location permission (should already be granted)
    const { status } = await Location.getForegroundPermissionsAsync();
    if (status !== 'granted') {
      console.log('Location permission not granted, skipping notification');
      return;
    }

    // Get current location
    const location = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.Balanced,
    });

    const { latitude, longitude } = location.coords;

    // Check if user is within campus radius
    const withinRadius = isWithinRadius(
      latitude,
      longitude,
      CAMPUS_COORDINATES.latitude,
      CAMPUS_COORDINATES.longitude,
      NOTIFICATION_RADIUS_KM
    );

    console.log(`User location: ${latitude}, ${longitude}`);
    console.log(`Within radius: ${withinRadius}`);

    if (withinRadius) {
      // Send notification
      await Notifications.scheduleNotificationAsync({
        content: {
          title: '📍 Event Reminder',
          body: `"${eventTitle}" is starting in 1 hour at ${eventLocation || 'campus'}!`,
          data: { eventId, eventTitle, eventLocation },
          sound: true,
          priority: Notifications.AndroidNotificationPriority.HIGH,
        },
        trigger: null, // Send immediately
      });

      // Mark event as notified
      await markEventAsNotified(eventId);

      console.log(`Notification sent for event: ${eventTitle}`);
    } else {
      console.log(`User not within campus radius, skipping notification for: ${eventTitle}`);
    }
  } catch (error) {
    console.error('Error in event reminder task:', error);
  }
});

/**
 * Check if the task is registered
 */
export async function isTaskRegistered(): Promise<boolean> {
  const registeredTasks = await TaskManager.getRegisteredTasksAsync();
  return registeredTasks.some((task) => task.taskName === EVENT_REMINDER_TASK);
}
