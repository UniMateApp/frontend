/**
 * ===============================================================================
 * EVENT SCHEDULER HOOK - AUTOMATIC LOCATION-AWARE NOTIFICATIONS
 * ===============================================================================
 * 
 * PURPOSE:
 * React hook that automatically monitors the events list and triggers location
 * checks when events change. Acts as the ORCHESTRATOR for the notification system.
 * 
 * HOW IT WORKS (3-PHASE SYSTEM):
 * ────────────────────────────────────────────────────────────────────────────
 * 
 * PHASE 1: INITIALIZATION (On Mount)
 * ──────────────────────────────────
 * 1. Configure notification handler (how notifications appear in foreground)
 * 2. Check existing permissions:
 *    - Notification permission (granted/denied)
 *    - Location permission (foreground)
 *    - Background location permission (optional, Android only)
 * 3. Set isReady flag to true when both permissions granted
 * 4. Store permission states in local state for UI display
 * 
 * PHASE 2: PERMISSION REQUEST (When User Clicks "Enable Notifications")
 * ─────────────────────────────────────────────────────────────────────
 * 1. Request notification permission:
 *    - Show system dialog: "Allow UniMate to send notifications?"
 *    - Create Android notification channel with HIGH importance
 *    - Enable sound, vibration, badge
 * 2. Request location permission:
 *    - Show system dialog: "Allow UniMate to access your location?"
 *    - Request foreground location (ACCESS_FINE_LOCATION)
 *    - Optionally request background location (Android)
 * 3. Update isReady flag based on results
 * 
 * PHASE 3: AUTOMATIC EVENT MONITORING (Continuous)
 * ────────────────────────────────────────────────
 * 1. Watch events array for changes using useEffect
 * 2. Compare current event IDs with last scheduled event IDs
 * 3. If events changed (new event added, event deleted, etc.):
 *    a) Filter upcoming events (start_at > now)
 *    b) Cache events to AsyncStorage for background task
 *    c) Call checkAndNotifyEvents() from immediateNotifier
 *    d) Get user location → Calculate distances → Send notifications
 * 4. Update lastScheduledEvents ref to prevent duplicate checks
 * 
 * KEY FEATURES:
 * ────────────────────────────────────────────────────────────────────────────
 * ✓ Auto-triggers when events list changes (reactive)
 * ✓ Prevents duplicate location checks using ref comparison
 * ✓ Caches events for background task (when app is closed)
 * ✓ Exposes permission states for UI indicators
 * ✓ Provides manual scheduleEvents() function for testing
 * ✓ Logs all operations to console for debugging
 * 
 * USAGE EXAMPLE:
 * ────────────────────────────────────────────────────────────────────────────
 * ```tsx
 * const { isReady, hasNotificationPermission, hasLocationPermission, requestPermissions } = 
 *   useEventScheduler(eventsWithWishlist, {
 *     enabled: true,        // Enable the scheduler
 *     autoSchedule: true,   // Auto-check when events change
 *   });
 * 
 * // Show permission banner if not ready
 * if (!isReady) {
 *   return <Button onPress={requestPermissions}>Enable Notifications</Button>;
 * }
 * ```
 * 
 * RETURNED VALUES:
 * ────────────────────────────────────────────────────────────────────────────
 * - isReady: boolean → true when both permissions granted
 * - hasNotificationPermission: boolean → notification permission status
 * - hasLocationPermission: boolean → location permission status
 * - scheduleEvents: (events) => Promise<void> → manual trigger function
 * - requestPermissions: () => Promise<void> → request all permissions
 * 
 * DEPENDENCIES:
 * ────────────────────────────────────────────────────────────────────────────
 * - backgroundScheduler.ts: Permission requests, notification config
 * - immediateNotifier.ts: Location checking and notification sending
 * - backgroundTaskService.ts: Event caching for background task
 * ===============================================================================
 */

// ────────────────────────────────────────────────────────────────────────────
// IMPORTS: External dependencies and service modules
// ────────────────────────────────────────────────────────────────────────────

// Notification configuration and permission handling from backgroundScheduler
import {
  configureNotificationHandler,
  requestNotificationPermissions,
} from '@/services/backgroundScheduler';

// Background task utilities for caching events to AsyncStorage
import { cacheEventsForBackground } from '@/services/backgroundTaskService';

// Immediate notification service for location-based checks
import { checkAndNotifyEvents } from '@/services/immediateNotifier';

// Event type definition from selective wishlist service
import { Event } from '@/services/selectiveWishlist';

// Expo Location API for requesting and checking location permissions
import * as Location from 'expo-location';

// React hooks for state management, side effects, and persistent references
import { useEffect, useRef, useState } from 'react';

// ────────────────────────────────────────────────────────────────────────────
// TYPE DEFINITIONS
// ────────────────────────────────────────────────────────────────────────────

/**
 * Configuration options for the event scheduler hook
 */
interface UseEventSchedulerOptions {
  enabled?: boolean;       // Whether the scheduler should be active (default: true)
  autoSchedule?: boolean;  // Whether to automatically check when events change (default: true)
}

/**
 * Return value interface - exposes scheduler state and control functions
 */
interface UseEventSchedulerResult {
  isReady: boolean;                                    // True when both notification and location permissions are granted
  hasNotificationPermission: boolean;                   // Current notification permission status
  hasLocationPermission: boolean;                       // Current location permission status
  scheduleEvents: (events: Event[]) => Promise<void>;  // Manual function to trigger event checking
  requestPermissions: () => Promise<void>;              // Function to request all required permissions
}

/**
 * ============================================================================
 * MAIN HOOK: useEventScheduler
 * ============================================================================
 * Manages automatic event reminder scheduling with location-based notifications
 * 
 * @param events - Array of events to monitor and schedule notifications for
 * @param options - Configuration options (enabled, autoSchedule)
 * @returns Object with permission states and control functions
 */
export function useEventScheduler(
  events: Event[],
  options: UseEventSchedulerOptions = {}
): UseEventSchedulerResult {
  // ──────────────────────────────────────────────────────────────────────────
  // CONFIGURATION: Extract options with defaults
  // ──────────────────────────────────────────────────────────────────────────
  const { enabled = true, autoSchedule = true } = options;

  // ──────────────────────────────────────────────────────────────────────────
  // STATE: Permission tracking and scheduler readiness
  // ──────────────────────────────────────────────────────────────────────────
  
  // Master flag: true only when both notification AND location permissions granted
  const [isReady, setIsReady] = useState(false);
  
  // Individual permission states for UI display (e.g., showing which permission is missing)
  const [hasNotificationPermission, setHasNotificationPermission] = useState(false);
  const [hasLocationPermission, setHasLocationPermission] = useState(false);
  
  // ──────────────────────────────────────────────────────────────────────────
  // REFS: Persistent values that don't trigger re-renders
  // ──────────────────────────────────────────────────────────────────────────
  
  // Prevents duplicate initialization calls
  const isInitialized = useRef(false);
  
  // Tracks the last set of event IDs we processed to detect changes
  // Using Set for O(1) lookup performance when comparing event lists
  const lastScheduledEvents = useRef<Set<string>>(new Set());

  /**
   * ═══════════════════════════════════════════════════════════════════════
   * FUNCTION: requestPermissions
   * ═══════════════════════════════════════════════════════════════════════
   * Requests all necessary permissions from the user (notifications + location)
   * 
   * FLOW:
   * 1. Request notification permissions → Update state
   * 2. Request foreground location permissions → Update state
   * 3. Optionally request background location (Android only)
   * 4. Set isReady=true only if BOTH core permissions granted
   * 
   * Called when: User clicks "Enable Notifications" button in UI
   */
  const requestPermissions = async (): Promise<void> => {
    try {
      console.log('[EventScheduler] Requesting permissions...');
      
      // ──────────────────────────────────────────────────────────────────
      // STEP 1: Request notification permissions
      // ──────────────────────────────────────────────────────────────────
      // Shows system dialog: "Allow UniMate to send you notifications?"
      // Also creates Android notification channel with HIGH importance
      const notificationGranted = await requestNotificationPermissions();
      console.log('[EventScheduler] Notification permission:', notificationGranted);
      setHasNotificationPermission(notificationGranted);

      // ──────────────────────────────────────────────────────────────────
      // STEP 2: Request foreground location permissions
      // ──────────────────────────────────────────────────────────────────
      // Shows system dialog: "Allow UniMate to access your location?"
      // Required for: Getting user's current position to calculate distance to events
      const { status: foregroundStatus } = await Location.requestForegroundPermissionsAsync();
      const locationGranted = foregroundStatus === 'granted';
      console.log('[EventScheduler] Location permission:', locationGranted);
      setHasLocationPermission(locationGranted);

      // ──────────────────────────────────────────────────────────────────
      // STEP 3: Request background location (optional, Android only)
      // ──────────────────────────────────────────────────────────────────
      // Required for: Background task to check location when app is closed
      // Note: Only requested if foreground permission already granted
      if (locationGranted) {
        try {
          const { status: bgStatus } = await Location.requestBackgroundPermissionsAsync();
          console.log('[EventScheduler] Background location permission:', bgStatus);
        } catch (error) {
          // Background location may not be available on iOS or older Android versions
          console.log('[EventScheduler] Background location not available:', error);
        }
      }

      // ──────────────────────────────────────────────────────────────────
      // STEP 4: Update readiness state
      // ──────────────────────────────────────────────────────────────────
      // Scheduler is ready ONLY when both core permissions are granted
      if (notificationGranted && locationGranted) {
        setIsReady(true);
        console.log('[EventScheduler] ✅ All permissions granted, scheduler ready');
      } else {
        console.warn('[EventScheduler] ⚠️ Some permissions missing:', {
          notifications: notificationGranted,
          location: locationGranted,
        });
      }
    } catch (error) {
      console.error('[EventScheduler] ❌ Error requesting permissions:', error);
    }
  };

  /**
   * ═══════════════════════════════════════════════════════════════════════
   * FUNCTION: initialize
   * ═══════════════════════════════════════════════════════════════════════
   * One-time initialization when the hook first mounts
   * 
   * FLOW:
   * 1. Configure how notifications appear in foreground
   * 2. Check existing permission states (don't request, just check)
   * 3. Update state variables based on existing permissions
   * 4. Set isReady=true if permissions already granted
   * 
   * Called when: Component mounts (via useEffect)
   */
  const initialize = async (): Promise<void> => {
    // ────────────────────────────────────────────────────────────────────
    // GUARD: Prevent duplicate initialization
    // ────────────────────────────────────────────────────────────────────
    if (isInitialized.current || !enabled) {
      console.log('[EventScheduler] Already initialized or disabled');
      return;
    }

    try {
      console.log('[EventScheduler] 🚀 Initializing event scheduler...');
      
      // ──────────────────────────────────────────────────────────────────
      // STEP 1: Configure notification behavior
      // ──────────────────────────────────────────────────────────────────
      // Sets how notifications appear when app is in foreground
      // (By default, notifications are hidden when app is open)
      configureNotificationHandler();

      // ──────────────────────────────────────────────────────────────────
      // STEP 2: Check existing permissions (non-intrusive)
      // ──────────────────────────────────────────────────────────────────
      // This CHECKS but doesn't REQUEST - no system dialogs shown
      // Note: requestNotificationPermissions also checks if already granted
      const notificationPerms = await requestNotificationPermissions();
      const { status: locationStatus } = await Location.getForegroundPermissionsAsync();
      
      console.log('[EventScheduler] Checked permissions:', {
        notifications: notificationPerms,
        location: locationStatus,
      });
      
      // ──────────────────────────────────────────────────────────────────
      // STEP 3: Update state with current permission status
      // ──────────────────────────────────────────────────────────────────
      setHasNotificationPermission(notificationPerms);
      setHasLocationPermission(locationStatus === 'granted');

      // ──────────────────────────────────────────────────────────────────
      // STEP 4: Set readiness if permissions already exist
      // ──────────────────────────────────────────────────────────────────
      // This allows the scheduler to work immediately on subsequent app opens
      if (notificationPerms && locationStatus === 'granted') {
        setIsReady(true);
        console.log('[EventScheduler] ✅ Scheduler initialized and ready');
      } else {
        console.log('[EventScheduler] ⚠️ Scheduler initialized but permissions missing');
      }

      // ──────────────────────────────────────────────────────────────────
      // Mark as initialized to prevent duplicate runs
      // ──────────────────────────────────────────────────────────────────
      isInitialized.current = true;
    } catch (error) {
      console.error('[EventScheduler] ❌ Error initializing:', error);
    }
  };

  /**
   * ═══════════════════════════════════════════════════════════════════════
   * FUNCTION: scheduleEvents
   * ═══════════════════════════════════════════════════════════════════════
   * Core function that performs location checking and sends notifications
   * 
   * FLOW:
   * 1. Filter events to find upcoming ones (start_at > now)
   * 2. Cache events to AsyncStorage for background task
   * 3. Trigger immediate location check and notification sending
   * 4. Update tracking to prevent duplicate processing
   * 
   * Called when: 
   * - Events array changes (automatic)
   * - User manually calls this function
   * 
   * @param eventsToSchedule - Array of events to check and notify for
   */
  const scheduleEvents = async (eventsToSchedule: Event[]): Promise<void> => {
    // ────────────────────────────────────────────────────────────────────
    // GUARD: Don't run if permissions not granted
    // ────────────────────────────────────────────────────────────────────
    if (!isReady) {
      console.warn('[EventScheduler]  Scheduler not ready. Permissions may not be granted.');
      return;
    }

    try {
      console.log(`[EventScheduler] Checking location and notifying for ${eventsToSchedule.length} events...`);
      
      // ──────────────────────────────────────────────────────────────────
      // STEP 1: Filter for upcoming events only
      // ──────────────────────────────────────────────────────────────────
      // We only care about events that:
      // a) Have a start_at time defined
      // b) Haven't happened yet (start_at > now)
      const now = new Date();
      const upcomingEvents = eventsToSchedule.filter((event) => {
        if (!event.start_at) return false;  // Skip events without a start time
        const eventDate = new Date(event.start_at);
        return eventDate > now;             // Only future events
      });

      console.log(`[EventScheduler] Found ${upcomingEvents.length} upcoming events`);

      // ──────────────────────────────────────────────────────────────────
      // STEP 2: Cache events to AsyncStorage for background task
      // ──────────────────────────────────────────────────────────────────
      // This allows the background task to check events when app is closed
      // We transform events to a simpler format with only needed fields
      await cacheEventsForBackground(
        upcomingEvents
          .filter((e) => e.start_at)  // Double-check start_at exists
          .map((e) => ({
            id: e.id,
            title: e.title,
            location: e.location || '',
            latitude: e.latitude,
            longitude: e.longitude,
            location_name: e.location_name,
            start_at: e.start_at!,  // Non-null assertion safe due to filter
          }))
      );

      // ──────────────────────────────────────────────────────────────────
      // STEP 3: Trigger immediate notification check
      // ──────────────────────────────────────────────────────────────────
      // This function will:
      // - Get user's current location
      // - Calculate distance to each event
      // - Send notifications for nearby events
      await checkAndNotifyEvents(upcomingEvents);

      // ──────────────────────────────────────────────────────────────────
      // STEP 4: Update tracking to prevent re-processing same events
      // ──────────────────────────────────────────────────────────────────
      // Store current event IDs in a Set for efficient comparison next time
      lastScheduledEvents.current = new Set(upcomingEvents.map((e) => e.id));
      
      console.log('[EventScheduler] ✅ Location check complete');
    } catch (error) {
      console.error('[EventScheduler] ❌ Error checking events:', error);
    }
  };

  /**
   * ═══════════════════════════════════════════════════════════════════════
   * EFFECT: Initialization on mount
   * ═══════════════════════════════════════════════════════════════════════
   * Runs once when the component using this hook first mounts
   * Calls initialize() to set up the scheduler
   * 
   * Dependencies: [enabled]
   * - Only re-runs if the 'enabled' option changes
   */
  useEffect(() => {
    initialize();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled]);

  /**
   * ═══════════════════════════════════════════════════════════════════════
   * EFFECT: Auto-schedule when events change
   * ═══════════════════════════════════════════════════════════════════════
   * The CORE of the automatic scheduling system
   * 
   * TRIGGERS:
   * - When events array changes (new event added, event deleted, etc.)
   * - When isReady changes (permissions granted)
   * - When autoSchedule option changes
   * 
   * LOGIC:
   * 1. Guard against running if not ready or no events
   * 2. Compare current events with last processed events
   * 3. If events changed → trigger scheduleEvents()
   * 4. Prevents duplicate processing of same event list
   * 
   * This creates a reactive system where notifications are automatically
   * re-evaluated whenever the user's event list changes
   */
  useEffect(() => {
    // ────────────────────────────────────────────────────────────────────
    // GUARDS: Don't run if conditions not met
    // ────────────────────────────────────────────────────────────────────
    if (!autoSchedule || !isReady || events.length === 0) {
      return;
    }

    // ────────────────────────────────────────────────────────────────────
    // CHANGE DETECTION: Compare current events with last processed events
    // ────────────────────────────────────────────────────────────────────
    // Create a Set of current event IDs for efficient comparison
    const currentEventIds = new Set(events.map((e) => e.id));
    
    // Check if events changed by comparing:
    // 1. Size of sets (number of events changed)
    // 2. Event IDs (different events in the list)
    const hasChanged =
      currentEventIds.size !== lastScheduledEvents.current.size ||
      [...currentEventIds].some((id) => !lastScheduledEvents.current.has(id));

    // ────────────────────────────────────────────────────────────────────
    // TRIGGER: If events changed, re-check location and notify
    // ────────────────────────────────────────────────────────────────────
    if (hasChanged) {
      console.log('[EventScheduler] Events changed, checking location and notifying...');
      scheduleEvents(events);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [events, isReady, autoSchedule]);



  // ══════════════════════════════════════════════════════════════════════
  // RETURN: Expose state and functions to the consuming component
  // ══════════════════════════════════════════════════════════════════════
  return {
    isReady,                    // Ready to schedule (both permissions granted)
    hasNotificationPermission,  // Notification permission status (for UI)
    hasLocationPermission,      // Location permission status (for UI)
    scheduleEvents,             // Manual trigger function
    requestPermissions,         // Permission request function
  };
}

/**
 * ═════════════════════════════════════════════════════════════════════════
 * STANDALONE FUNCTION: checkEventSchedulerPermissions
 * ═════════════════════════════════════════════════════════════════════════
 * Utility function to check all permission statuses without side effects
 * 
 * PURPOSE:
 * - Can be called outside of React components
 * - Useful for debugging or checking permissions before initializing
 * - Returns all three permission states (notifications, location, background)
 * 
 * RETURNS:
 * - notifications: boolean (granted/denied)
 * - location: boolean (foreground permission)
 * - backgroundLocation: boolean (background permission - Android only)
 * 
 * USAGE:
 * ```ts
 * const perms = await checkEventSchedulerPermissions();
 * console.log('Notifications:', perms.notifications);
 * console.log('Location:', perms.location);
 * console.log('Background:', perms.backgroundLocation);
 * ```
 */
export async function checkEventSchedulerPermissions(): Promise<{
  notifications: boolean;
  location: boolean;
  backgroundLocation: boolean;
}> {
  try {
    // ────────────────────────────────────────────────────────────────────
    // Check notification permissions
    // ────────────────────────────────────────────────────────────────────
    const notificationsGranted = await requestNotificationPermissions();
    
    // ────────────────────────────────────────────────────────────────────
    // Check foreground location permissions
    // ────────────────────────────────────────────────────────────────────
    const { status: locationStatus } = await Location.getForegroundPermissionsAsync();
    
    // ────────────────────────────────────────────────────────────────────
    // Check background location permissions (Android only)
    // ────────────────────────────────────────────────────────────────────
    const { status: backgroundStatus } = await Location.getBackgroundPermissionsAsync();

    // ────────────────────────────────────────────────────────────────────
    // Return all permission states
    // ────────────────────────────────────────────────────────────────────
    return {
      notifications: notificationsGranted,
      location: locationStatus === 'granted',
      backgroundLocation: backgroundStatus === 'granted',
    };
  } catch (error) {
    // ────────────────────────────────────────────────────────────────────
    // On error, return all permissions as false
    // ────────────────────────────────────────────────────────────────────
    console.error('Error checking permissions:', error);
    return {
      notifications: false,
      location: false,
      backgroundLocation: false,
    };
  }
}
