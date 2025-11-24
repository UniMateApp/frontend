/**
 * Custom hook for automatically scheduling event reminders
 * Watches the event list and manages background notification scheduling
 */

import {
    cleanupPastReminders,
    configureNotificationHandler,
    requestNotificationPermissions,
    scheduleMultipleEventReminders,
    syncNotificationsWithEvents,
} from '@/services/backgroundScheduler';
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

      // Clean up old notifications
      await cleanupPastReminders();

      isInitialized.current = true;
    } catch (error) {
      console.error('[EventScheduler] ❌ Error initializing:', error);
    }
  };

  /**
   * Schedule reminders for a list of events
   */
  const scheduleEvents = async (eventsToSchedule: Event[]): Promise<void> => {
    if (!isReady) {
      console.warn('[EventScheduler] ⚠️ Scheduler not ready. Permissions may not be granted.');
      return;
    }

    try {
      console.log(`[EventScheduler] 📅 Scheduling reminders for ${eventsToSchedule.length} events...`);
      
      // Filter events that have a start time and are in the future
      const now = new Date();
      const upcomingEvents = eventsToSchedule.filter((event) => {
        if (!event.start_at) return false;
        const eventDate = new Date(event.start_at);
        return eventDate > now;
      });

      console.log(`[EventScheduler] Found ${upcomingEvents.length} upcoming events`);

      // Sync with current event list (cancel outdated notifications)
      await syncNotificationsWithEvents(upcomingEvents);

      // Schedule new reminders
      await scheduleMultipleEventReminders(upcomingEvents);

      // Update tracking
      lastScheduledEvents.current = new Set(upcomingEvents.map((e) => e.id));
      
      console.log('[EventScheduler] ✅ Scheduling complete');
    } catch (error) {
      console.error('[EventScheduler] ❌ Error scheduling events:', error);
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
   * Auto-schedule events when they change
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
      console.log('Events changed, rescheduling reminders...');
      scheduleEvents(events);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [events, isReady, autoSchedule]);

  /**
   * Clean up on unmount
   */
  useEffect(() => {
    return () => {
      // Optional: Cancel all reminders on unmount (usually not desired)
      // cancelAllEventReminders();
    };
  }, []);

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
