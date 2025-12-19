/**
 * ===============================================================================
 * IMMEDIATE LOCATION-AWARE NOTIFICATION SERVICE
 * ===============================================================================
 * 
 * PURPOSE:
 * This service implements REAL-TIME location checking to send notifications when:
 * - User is within 8km radius of an event location (NOTIFICATION_RADIUS_KM)
 * - Event is starting within the next 2 minutes (REMINDER_TIME_BEFORE_EVENT_MINUTES)
 * 
 * HOW IT WORKS (5-STEP FLOW):
 * ────────────────────────────────────────────────────────────────────────────
 * Step 1: GET USER LOCATION (Once)
 *   - Request GPS coordinates using expo-location
 *   - Check if location services are enabled
 *   - Verify location permissions are granted (foreground)
 *   - Get current position with balanced accuracy
 *   - Return: { latitude, longitude } or null if failed
 * 
 * Step 2: FILTER ELIGIBLE EVENTS
 *   - Skip events without start_at timestamp
 *   - Skip events without latitude/longitude coordinates
 *   - Skip events already notified in last 24 hours (prevent duplicates)
 *   - Skip events not starting within reminder time window (2 minutes)
 * 
 * Step 3: CALCULATE DISTANCE FOR EACH EVENT
 *   - Use Haversine formula to calculate distance between:
 *     → User location (from GPS)
 *     → Event location (from database: event.latitude, event.longitude)
 *   - Result: Distance in kilometers (e.g., 1.5 km)
 * 
 * Step 4: CHECK PROXIMITY THRESHOLD
 *   - Compare calculated distance with NOTIFICATION_RADIUS_KM (8km)
 *   - If distance ≤ 8km: User is within notification radius
 *   - If distance > 8km: User is too far, skip notification
 * 
 * Step 5: SEND NOTIFICATION
 *   - Only if user is within radius AND event is starting soon
 *   - Create notification with:
 *     → Title: "📍 Event Starting Soon!"
 *     → Body: Event title, location name, distance to event
 *     → Data: eventId, coordinates, time, distance
 *   - Mark event as notified (store in AsyncStorage with timestamp)
 *   - Prevent duplicate notifications for 24 hours
 * 
 * TRIGGERED BY:
 * ────────────────────────────────────────────────────────────────────────────
 * - useEventScheduler hook (when events list changes)
 * - Manual "Check Location" button in Events screen
 * - When user adds a new event to their wishlist
 * 
 * LOCATION PERMISSION REQUIREMENTS:
 * ────────────────────────────────────────────────────────────────────────────
 * - Foreground location permission (android.permission.ACCESS_FINE_LOCATION)
 * - Notification permission (expo-notifications)
 * - Location services enabled on device
 * 
 * STORAGE:
 * ────────────────────────────────────────────────────────────────────────────
 * AsyncStorage key: @notified_events
 * Format: Array of { eventId: string, notifiedAt: number }
 * Cleanup: Events older than 7 days are removed automatically
 * 
 * EXAMPLE SCENARIO:
 * ────────────────────────────────────────────────────────────────────────────
 * Event: "Tech Talk" at coordinates (6.7970, 79.8999), starts at 2:00 PM
 * User: At coordinates (6.7950, 79.8950), current time is 1:58 PM
 * 
 * 1. Get user location: (6.7950, 79.8950) 
 * 2. Calculate distance: 0.5 km 
 * 3. Check if within 8km radius: Yes (0.5 ≤ 8) 
 * 4. Check if starting soon: Yes (2 minutes away) 
 * 5. Send notification: "Tech Talk is starting soon at Main Hall! You're 0.50 km away." 
 * ===============================================================================
 */

// ============================================================================
// IMPORTS
// ============================================================================
import { NOTIFICATION_RADIUS_KM, REMINDER_TIME_BEFORE_EVENT_MINUTES } from '@/constants/campus'; // Configuration: 8km radius, 2 min before event
import { Event } from '@/services/selectiveWishlist'; // Event type definition with latitude/longitude
import { calculateHaversineDistance } from '@/utils/distance'; // GPS distance calculation (Haversine formula)
import AsyncStorage from '@react-native-async-storage/async-storage'; // Persistent storage for tracking notified events
import * as Location from 'expo-location'; // GPS location access (getCurrentPositionAsync, permissions)
import * as Notifications from 'expo-notifications'; // Push notification API (scheduleNotificationAsync)

// ============================================================================
// CONSTANTS AND TYPES
// ============================================================================
// AsyncStorage key for storing list of events that have been notified
// Used to prevent sending duplicate notifications for the same event
const NOTIFIED_EVENTS_KEY = '@notified_events';

/**
 * NotifiedEvent interface
 * Represents an event that has already had a notification sent
 * Stored in AsyncStorage to track notification history
 */
interface NotifiedEvent {
  eventId: string; // UUID of the event that was notified
  notifiedAt: number; // Timestamp (milliseconds since epoch) when notification was sent
}

// ============================================================================
// STORAGE FUNCTIONS - TRACK NOTIFIED EVENTS
// ============================================================================
/**
 * Get list of events that have already been notified
 * Reads from AsyncStorage to check which events already had notifications sent
 * Returns empty array if storage is empty or error occurs
 */
async function getNotifiedEvents(): Promise<NotifiedEvent[]> {
  try {
    // Read JSON string from AsyncStorage using key '@notified_events'
    const data = await AsyncStorage.getItem(NOTIFIED_EVENTS_KEY);
    if (data) {
      // Parse JSON string back to array of NotifiedEvent objects
      return JSON.parse(data);
    }
  } catch (error) {
    // Log error but don't crash - return empty array as fallback
    console.error('[ImmediateNotifier] Error getting notified events:', error);
  }
  return []; // Default: no events notified yet (or error occurred)
}

/**
 * Save notified event to storage
 * Adds event ID and current timestamp to the notified events list
 * Prevents duplicate notifications for the same event within 24 hours
 */
async function markEventAsNotified(eventId: string): Promise<void> {
  try {
    // Get existing list of notified events from AsyncStorage
    const notified = await getNotifiedEvents();
    
    // Create new entry with event ID and current timestamp
    const newNotified: NotifiedEvent = {
      eventId, // UUID of the event we just notified about
      notifiedAt: Date.now(), // Current time in milliseconds (e.g., 1703001234567)
    };
    
    // Append to existing array and save back to AsyncStorage as JSON string
    await AsyncStorage.setItem(NOTIFIED_EVENTS_KEY, JSON.stringify([...notified, newNotified]));
    console.log('[ImmediateNotifier]  Marked event as notified:', eventId);
  } catch (error) {
    // Log error but don't crash - notification was already sent
    console.error('[ImmediateNotifier] Error marking event as notified:', error);
  }
}

/**
 * Check if event was already notified in the last 24 hours
 * Prevents duplicate notifications for the same event
 * Returns true if notification was sent within last 24 hours
 */
async function wasRecentlyNotified(eventId: string): Promise<boolean> {
  // Get list of all notified events from storage
  const notified = await getNotifiedEvents();
  
  // Search for this specific event in the list
  const recent = notified.find(
    (n) => n.eventId === eventId && // Match event ID
           Date.now() - n.notifiedAt < 24 * 60 * 60 * 1000 // Within last 24 hours (in milliseconds)
  );
  
  // Convert to boolean: true if found (was recently notified), false if not found
  return !!recent;
}

/**
 * Clean up old notified events (older than 7 days)
 * Removes old entries from AsyncStorage to prevent unlimited growth
 * Called automatically before each notification check
 */
export async function cleanupOldNotifications(): Promise<void> {
  try {
    // Get current list of notified events
    const notified = await getNotifiedEvents();
    
    // Calculate timestamp for 7 days ago (in milliseconds)
    const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
    
    // Filter to keep only events notified within last 7 days
    const recent = notified.filter((n) => n.notifiedAt > sevenDaysAgo);
    
    // Only update storage if we actually removed something (avoid unnecessary writes)
    if (recent.length < notified.length) {
      // Save filtered list back to AsyncStorage
      await AsyncStorage.setItem(NOTIFIED_EVENTS_KEY, JSON.stringify(recent));
      console.log(`[ImmediateNotifier] Cleaned up ${notified.length - recent.length} old notifications`);
    }
  } catch (error) {
    // Log error but don't crash - cleanup is not critical
    console.error('[ImmediateNotifier] Error cleaning up old notifications:', error);
  }
}

// ============================================================================
// LOCATION FUNCTIONS - GPS COORDINATE RETRIEVAL
// ============================================================================
/**
 * Get user's current location using GPS
 * Returns coordinates or null if location cannot be obtained
 * Checks permissions and services before requesting location
 */
async function getUserLocation(): Promise<{ latitude: number; longitude: number } | null> {
  try {
    console.log('[ImmediateNotifier]  Getting user location...');
    
    // STEP 1: Check if location services are enabled at OS level (GPS is turned on)
    const isEnabled = await Location.hasServicesEnabledAsync();
    if (!isEnabled) {
      console.warn('[ImmediateNotifier]  Location services are disabled on device');
      return null; // Cannot get location without GPS enabled
    }

    // STEP 2: Check if app has foreground location permission
    const { status } = await Location.getForegroundPermissionsAsync();
    if (status !== 'granted') {
      console.warn('[ImmediateNotifier]  Location permission not granted');
      return null; // User denied permission or hasn't been asked yet
    }

    // STEP 3: Get current GPS coordinates with 10-second timeout
    // Use Promise.race to prevent hanging if GPS is slow
    const location = await Promise.race([
      // Option 1: Get actual GPS location
      Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced, // Balance between accuracy and speed (not highest accuracy)
        mayShowUserSettingsDialog: true, // Allow showing settings dialog if location is off
      }),
      // Option 2: Timeout after 10 seconds
      new Promise<never>((_, reject) => 
        setTimeout(() => reject(new Error('Location request timeout')), 10000) // 10 seconds
      )
    ]);

    // STEP 4: Extract latitude and longitude from location object
    const userLat = location.coords.latitude; // e.g., 6.7970301
    const userLng = location.coords.longitude; // e.g., 79.8999734

    console.log('[ImmediateNotifier] User location:', { lat: userLat, lng: userLng });

    return { latitude: userLat, longitude: userLng }; // Return coordinates object
  } catch (error: any) {
    // Handle different types of errors with helpful messages
    if (error.message === 'Location request timeout') {
      console.warn('[ImmediateNotifier]  Location request timed out - location services may be slow or unavailable');
    } else if (error.message?.includes('location services')) {
      console.warn('[ImmediateNotifier]  Location services disabled:', error.message);
      console.log('[ImmediateNotifier]  Enable location in: Settings → Location → Turn on');
    } else {
      console.warn('[ImmediateNotifier]  Error checking user location:', error.message || error);
    }
    return null; // Return null on any error (no location available)
  }
}

// ============================================================================
// PROXIMITY CHECKING - DISTANCE CALCULATIONS
// ============================================================================
/**
 * Check if user is within notification radius of a specific event location
 * Uses Haversine formula to calculate accurate GPS distance
 * Returns both the boolean result and actual distance in kilometers
 */
function isUserWithinEventRadius(
  userLocation: { latitude: number; longitude: number }, // User's current GPS coordinates
  eventLatitude: number, // Event location latitude from database
  eventLongitude: number // Event location longitude from database
): { withinRadius: boolean; distance: number } {
  // Calculate straight-line distance between two GPS coordinates using Haversine formula
  // This accounts for Earth's curvature and returns distance in kilometers
  const distance = calculateHaversineDistance(
    userLocation.latitude, // User's latitude (e.g., 6.7950)
    userLocation.longitude, // User's longitude (e.g., 79.8950)
    eventLatitude, // Event's latitude (e.g., 6.7970)
    eventLongitude // Event's longitude (e.g., 79.8999)
  );

  // Check if distance is within notification radius (8km by default)
  const withinRadius = distance <= NOTIFICATION_RADIUS_KM; // true if ≤ 8km, false if > 8km
  
  // Return both the boolean result and actual distance for logging/display
  return { withinRadius, distance };
}

// ============================================================================
// TIME CHECKING - EVENT START TIME VALIDATION
// ============================================================================
/**
 * Check if event is starting soon (within reminder time window)
 * Returns true only if event starts within next 2 minutes (configurable)
 * Returns false if event already started or is too far in the future
 */
function isEventStartingSoon(eventStartTime: string): boolean {
  try {
    // Parse ISO timestamp string to Date object (e.g., "2025-12-19T14:00:00Z")
    const eventDate = new Date(eventStartTime);
    
    // Validate that parsing was successful (invalid dates return NaN)
    if (isNaN(eventDate.getTime())) {
      return false; // Invalid date string, skip this event
    }

    // Get current time
    const now = new Date();
    
    // Calculate time difference in minutes (positive = future, negative = past)
    const timeDiffMinutes = (eventDate.getTime() - now.getTime()) / (1000 * 60);

    // Check if event is within notification window:
    // - timeDiffMinutes > 0: Event hasn't started yet (future)
    // - timeDiffMinutes <= REMINDER_TIME_BEFORE_EVENT_MINUTES: Within notification window (≤ 2 min)
    const isInWindow = timeDiffMinutes > 0 && timeDiffMinutes <= REMINDER_TIME_BEFORE_EVENT_MINUTES;
    
    // Log if event is in window (for debugging)
    if (isInWindow) {
      console.log(`[ImmediateNotifier] Event starting in ${timeDiffMinutes.toFixed(1)} minutes`);
    }

    return isInWindow; // true if starting within next 2 minutes, false otherwise
  } catch (error) {
    // Handle any parsing errors gracefully
    console.error('[ImmediateNotifier] Error checking event time:', error);
    return false; // On error, don't send notification
  }
}

// ============================================================================
// NOTIFICATION SENDING - PUSH NOTIFICATION CREATION
// ============================================================================
/**
 * Send immediate notification for an event
 * Creates and displays a push notification with event details
 * Notification appears immediately (trigger: null)
 */
async function sendNotificationForEvent(event: Event, distance: number): Promise<void> {
  try {
    console.log(`[ImmediateNotifier]  Sending notification for: "${event.title}"`);
    
    // Get human-readable location name (fallback chain)
    const locationName = event.location_name || // Prefer location_name (e.g., "Main Hall")
                        event.location || // Fallback to location (e.g., "6.7970,79.8999")
                        'the event location'; // Final fallback
    
    // Schedule notification using expo-notifications API
    await Notifications.scheduleNotificationAsync({
      content: {
        title: '📍 Event Starting Soon!', // Notification title (shown in notification tray)
        body: `"${event.title}" is starting soon at ${locationName}! You're ${distance.toFixed(2)} km away.`, // Main message
        
        // Additional data attached to notification (accessible when user taps notification)
        data: {
          eventId: event.id, // Can be used to navigate to event detail screen
          eventTitle: event.title,
          eventLocation: event.location,
          eventLocationName: event.location_name,
          eventTime: event.start_at,
          distance: distance, // User's distance from event (in km)
        },
        
        sound: true, // Play notification sound
        priority: Notifications.AndroidNotificationPriority.HIGH, // Android: Show as heads-up notification
        categoryIdentifier: 'event-reminder', // Category for notification grouping
      },
      trigger: null, // null = send immediately (not scheduled for future time)
    });

    console.log(`[ImmediateNotifier]  Notification sent for "${event.title}"`);
  } catch (error) {
    // Log error but don't crash - notification failure shouldn't break the app
    console.error('[ImmediateNotifier]  Error sending notification:', error);
  }
}

// ============================================================================
// MAIN NOTIFICATION CHECKER - TRIGGERED BY EVENT CHANGES
// ============================================================================
/**
 * Check all events and send notifications for eligible ones
 * This is the MAIN FUNCTION called when events list changes
 * 
 * CALLED BY:
 * - useEventScheduler hook (when eventsWithWishlist array changes)
 * - Manual "Check Location" button in Events screen
 * - When user adds new event to wishlist
 * 
 * FLOW:
 * 1. Get user's GPS location once
 * 2. Loop through all events
 * 3. For each event: Check eligibility (has coordinates, starting soon, not already notified)
 * 4. Calculate distance from user to event
 * 5. Send notification if within 8km radius
 */
export async function checkAndNotifyEvents(events: Event[]): Promise<void> {
  try {
    console.log(`[ImmediateNotifier] Checking ${events.length} events for notifications...`);

    // STEP 0: Clean up old notification records (> 7 days) to prevent AsyncStorage bloat
    await cleanupOldNotifications();

    // STEP 1: Get user's current GPS location (one-time request)
    // This is the most expensive operation, so we do it once upfront
    const userLocation = await getUserLocation();
    
    // If location cannot be obtained (permissions denied, GPS off, etc.), abort
    if (!userLocation) {
      console.warn('[ImmediateNotifier] Could not get user location, skipping notifications');
      return; // Cannot send location-aware notifications without user location
    }

    // STEP 2: Loop through each event and check eligibility
    let notificationsSent = 0; // Counter for logging
    for (const event of events) {
      // ===== ELIGIBILITY CHECK 1: Event must have start time =====
      if (!event.start_at) {
        console.log(`[ImmediateNotifier] Event "${event.title}" has no start time, skipping`);
        continue; // Skip to next event
      }

      // ===== ELIGIBILITY CHECK 2: Event must have GPS coordinates =====
      if (event.latitude === undefined || event.latitude === null || 
          event.longitude === undefined || event.longitude === null) {
        console.log(`[ImmediateNotifier] ⚠️ Event "${event.title}" has no location coordinates, skipping`);
        continue; // Cannot calculate distance without coordinates
      }

      // ===== ELIGIBILITY CHECK 3: Event must not have been notified recently (within 24 hours) =====
      if (await wasRecentlyNotified(event.id)) {
        console.log(`[ImmediateNotifier] Event "${event.title}" was already notified, skipping`);
        continue; // Prevent duplicate notifications
      }

      // ===== ELIGIBILITY CHECK 4: Event must be starting within notification window (2 minutes) =====
      if (!isEventStartingSoon(event.start_at)) {
        // Calculate how far away the event is (for debugging)
        const eventDate = new Date(event.start_at);
        const now = new Date();
        const timeDiffMinutes = (eventDate.getTime() - now.getTime()) / (1000 * 60);
        console.log(`[ImmediateNotifier] Event "${event.title}" not in notification window (starts in ${timeDiffMinutes.toFixed(1)} min)`);
        continue; // Event is too far in the future or already started
      }

      // STEP 3: Calculate distance from user to event using Haversine formula
      const { withinRadius, distance } = isUserWithinEventRadius(
        userLocation, // User's GPS coordinates (from Step 1)
        event.latitude, // Event's latitude from database
        event.longitude // Event's longitude from database
      );

      // Log event location and calculated distance for debugging
      console.log(`[ImmediateNotifier] Event "${event.title}" location:`, {
        lat: event.latitude,
        lng: event.longitude,
        locationName: event.location_name || event.location,
      });
      console.log(`[ImmediateNotifier] Distance to event: ${distance.toFixed(2)} km`);

      // STEP 4: Send notification only if user is within 8km radius
      if (withinRadius) {
        console.log(`[ImmediateNotifier] User is within ${NOTIFICATION_RADIUS_KM} km of event "${event.title}"`);
        
        // Send push notification with event details and distance
        await sendNotificationForEvent(event, distance);
        
        // Mark event as notified to prevent duplicates
        await markEventAsNotified(event.id);
        
        notificationsSent++; // Increment counter
      } else {
        // User is too far away (> 8km), don't send notification
        console.log(`[ImmediateNotifier] User is outside ${NOTIFICATION_RADIUS_KM} km radius of event "${event.title}"`);
      }
    }

    // STEP 5: Log summary of notification check
    if (notificationsSent > 0) {
      console.log(`[ImmediateNotifier]  Sent ${notificationsSent} notification(s)`);
    } else {
      console.log('[ImmediateNotifier] ℹ No notifications sent (no eligible events)');
    }
  } catch (error) {
    // Catch any unexpected errors and log them (don't crash the app)
    console.error('[ImmediateNotifier]  Error checking and notifying events:', error);
  }
}

// ============================================================================
// TESTING UTILITIES - FOR DEBUGGING NOTIFICATION SYSTEM
// ============================================================================
/**
 * Test function to send an immediate notification
 * Used to verify that notifications are working correctly
 * Does NOT check location or event criteria - just sends a simple notification
 * 
 * USAGE: Called from "Test" button in Events screen (development mode)
 */
export async function sendTestNotification(): Promise<void> {
  try {
    console.log('[ImmediateNotifier] Sending test notification...');
    
    // Send simple notification immediately (no conditions checked)
    await Notifications.scheduleNotificationAsync({
      content: {
        title: ' Test Notification', // Simple title
        body: 'If you see this, notifications are working correctly!', // Confirmation message
        sound: true, // Play notification sound
        priority: Notifications.AndroidNotificationPriority.HIGH, // High priority (heads-up)
      },
      trigger: null, // null = send immediately (not scheduled)
    });

    console.log('[ImmediateNotifier]  Test notification sent');
  } catch (error) {
    // If test notification fails, throw error to show alert to user
    console.error('[ImmediateNotifier]  Error sending test notification:', error);
    throw error; // Re-throw to propagate error to caller
  }
}

/**
 * Force check location and return user coordinates (for testing)
 * Used by "Check Location" button to display user's current GPS coordinates
 * Does NOT send any notifications - just retrieves and returns location
 * 
 * USAGE: Called from "Location" button in Events screen (development mode)
 */
export async function forceCheckLocation(): Promise<{ userLocation: { latitude: number; longitude: number } | null }> {
  // Get user's current GPS location (same function used by main notification flow)
  const userLocation = await getUserLocation();
  
  // Return location wrapped in object (for consistency with other APIs)
  // userLocation will be null if location cannot be obtained
  return { userLocation };
}
