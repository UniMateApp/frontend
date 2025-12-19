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

import {
  configureNotificationHandler,
  requestNotificationPermissions,
} from '@/services/backgroundScheduler';
import { cacheEventsForBackground } from '@/services/backgroundTaskService';
import { checkAndNotifyEvents } from '@/services/immediateNotifier';
import { Event } from '@/services/selectiveWishlist';
import * as Location from 'expo-location';
import { useEffect, useRef, useState } from 'react';

interface UseEventSchedulerOptions {
  enabled?: boolean;
  autoSchedule?: boolean;
}

interface UseEventSchedulerResult {
  isReady: boolean;
  hasNotificationPermission: boolean;
  hasLocationPermission: boolean;
  scheduleEvents: (events: Event[]) => Promise<void>;
  requestPermissions: () => Promise<void>;
}

/**
 * Hook to manage automatic event reminder scheduling
 */
export function useEventScheduler(
  events: Event[],
  options: UseEventSchedulerOptions = {}
): UseEventSchedulerResult {
  const { enabled = true, autoSchedule = true } = options;

  const [isReady, setIsReady] = useState(false);
  const [hasNotificationPermission, setHasNotificationPermission] = useState(false);
  const [hasLocationPermission, setHasLocationPermission] = useState(false);
  
  const isInitialized = useRef(false);
  const lastScheduledEvents = useRef<Set<string>>(new Set());

  /**
   * Request all necessary permissions
   */
  const requestPermissions = async (): Promise<void> => {
    try {
      console.log('[EventScheduler] Requesting permissions...');
      
      // Request notification permissions
      const notificationGranted = await requestNotificationPermissions();
      console.log('[EventScheduler] Notification permission:', notificationGranted);
      setHasNotificationPermission(notificationGranted);

      // Request location permissions (foreground)
      const { status: foregroundStatus } = await Location.requestForegroundPermissionsAsync();
      const locationGranted = foregroundStatus === 'granted';
      console.log('[EventScheduler] Location permission:', locationGranted);
      setHasLocationPermission(locationGranted);

      // Optionally request background location (Android)
      if (locationGranted) {
        try {
          const { status: bgStatus } = await Location.requestBackgroundPermissionsAsync();
          console.log('[EventScheduler] Background location permission:', bgStatus);
        } catch (error) {
          console.log('[EventScheduler] Background location not available:', error);
        }
      }

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
   * Initialize the scheduler
   */
  const initialize = async (): Promise<void> => {
    if (isInitialized.current || !enabled) {
      console.log('[EventScheduler] Already initialized or disabled');
      return;
    }

    try {
      console.log('[EventScheduler] 🚀 Initializing event scheduler...');
      
      // Configure notification handler
      configureNotificationHandler();

      // Check existing permissions
      const notificationPerms = await requestNotificationPermissions();
      const { status: locationStatus } = await Location.getForegroundPermissionsAsync();
      
      console.log('[EventScheduler] Checked permissions:', {
        notifications: notificationPerms,
        location: locationStatus,
      });
      
      setHasNotificationPermission(notificationPerms);
      setHasLocationPermission(locationStatus === 'granted');

      if (notificationPerms && locationStatus === 'granted') {
        setIsReady(true);
        console.log('[EventScheduler] ✅ Scheduler initialized and ready');
      } else {
        console.log('[EventScheduler] ⚠️ Scheduler initialized but permissions missing');
      }

      isInitialized.current = true;
    } catch (error) {
      console.error('[EventScheduler] ❌ Error initializing:', error);
    }
  };

  /**
   * Check location and send immediate notifications for events
   */
  const scheduleEvents = async (eventsToSchedule: Event[]): Promise<void> => {
    if (!isReady) {
      console.warn('[EventScheduler]  Scheduler not ready. Permissions may not be granted.');
      return;
    }

    try {
      console.log(`[EventScheduler] Checking location and notifying for ${eventsToSchedule.length} events...`);
      
      // Filter events that have a start time and are in the future
      const now = new Date();
      const upcomingEvents = eventsToSchedule.filter((event) => {
        if (!event.start_at) return false;
        const eventDate = new Date(event.start_at);
        return eventDate > now;
      });

      console.log(`[EventScheduler] Found ${upcomingEvents.length} upcoming events`);

      // Cache events for background task (only events with start_at)
      await cacheEventsForBackground(
        upcomingEvents
          .filter((e) => e.start_at)
          .map((e) => ({
            id: e.id,
            title: e.title,
            location: e.location || '',
            latitude: e.latitude,
            longitude: e.longitude,
            location_name: e.location_name,
            start_at: e.start_at!,
          }))
      );

      // Check location and send immediate notifications
      await checkAndNotifyEvents(upcomingEvents);

      // Update tracking
      lastScheduledEvents.current = new Set(upcomingEvents.map((e) => e.id));
      
      console.log('[EventScheduler] ✅ Location check complete');
    } catch (error) {
      console.error('[EventScheduler] ❌ Error checking events:', error);
    }
  };

  /**
   * Initialize on mount
   */
  useEffect(() => {
    initialize();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled]);

  /**
   * Auto-check location and notify when events change
   */
  useEffect(() => {
    if (!autoSchedule || !isReady || events.length === 0) {
      return;
    }

    // Check if events have changed
    const currentEventIds = new Set(events.map((e) => e.id));
    const hasChanged =
      currentEventIds.size !== lastScheduledEvents.current.size ||
      [...currentEventIds].some((id) => !lastScheduledEvents.current.has(id));

    if (hasChanged) {
      console.log('[EventScheduler] Events changed, checking location and notifying...');
      scheduleEvents(events);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [events, isReady, autoSchedule]);



  return {
    isReady,
    hasNotificationPermission,
    hasLocationPermission,
    scheduleEvents,
    requestPermissions,
  };
}

/**
 * Standalone function to check permissions status
 */
export async function checkEventSchedulerPermissions(): Promise<{
  notifications: boolean;
  location: boolean;
  backgroundLocation: boolean;
}> {
  try {
    const notificationsGranted = await requestNotificationPermissions();
    const { status: locationStatus } = await Location.getForegroundPermissionsAsync();
    const { status: backgroundStatus } = await Location.getBackgroundPermissionsAsync();

    return {
      notifications: notificationsGranted,
      location: locationStatus === 'granted',
      backgroundLocation: backgroundStatus === 'granted',
    };
  } catch (error) {
    console.error('Error checking permissions:', error);
    return {
      notifications: false,
      location: false,
      backgroundLocation: false,
    };
  }
}
