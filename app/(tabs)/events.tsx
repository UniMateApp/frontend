/**
 * ===============================================================================
 * EVENTS SCREEN - EVENT LISTING WITH LOCATION-AWARE NOTIFICATIONS
 * ===============================================================================
 * 
 * FILE: app/(tabs)/events.tsx
 * 
 * PURPOSE:
 * Main events listing screen with the following features:
 * - Display all university events with search and filtering
 * - Create new events via AddEventModal
 * - Delete events with confirmation
 * - Wishlist (bookmark) events for quick access
 * - Share events via native share sheet
 * - **Location-aware notifications** (main feature)
 * 
 * LOCATION-AWARE NOTIFICATION FLOW:
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 * 1. useEventScheduler hook monitors eventsWithWishlist array
 * 2. When events change (new event added, event deleted, etc.):
 *    a) Caches events to AsyncStorage for background task
 *    b) Calls checkAndNotifyEvents() from immediateNotifier.ts
 *    c) Gets user's GPS location once
 *    d) For each event starting within 2 minutes:
 *       - Calculate distance from user to event location (Haversine formula)
 *       - If distance ≤ 8km: Send notification
 *       - If distance > 8km: Skip notification
 * 3. Background task (when app is closed):
 *    - Runs every minute via expo-background-fetch
 *    - Checks cached events for any starting in 2 minutes
 *    - Sends notifications (without location checking)
 * 
 * STATE:
 * - eventsWithWishlist: All events with isInWishlist flag for current user
 * - query: Search query for filtering events
 * - showAdd: Controls AddEventModal visibility
 * - isBackgroundTaskActive: Background task registration status
 * 
 * KEY INTEGRATIONS:
 * - useEventScheduler: Auto-triggers location checks when events change
 * - backgroundTaskService: Runs every minute when app is closed
 * - immediateNotifier: Real-time location checking and notification sending
 * - getEventsWithWishlistStatus: Fetches events with LEFT JOIN on selective_wishlist
 * ===============================================================================
 */

// UI Components
import AddEventModal from '@/components/add-event-modal'; // Modal for creating new events
import { EventCard } from '@/components/event-card'; // Card component to display each event
import { SearchBar } from '@/components/search-bar'; // Search input for filtering events

// Theming and Context
import { Colors } from '@/constants/theme'; // Light/dark theme colors
import { useUser } from '@/contexts/UserContext'; // Access current user info
import { useColorScheme } from '@/hooks/use-color-scheme'; // Detect light/dark mode

// Location-Aware Notification System
import { useEventScheduler } from '@/hooks/useEventScheduler'; // Auto-triggers location checks when events change
import { isBackgroundTaskRegistered, registerBackgroundTask } from '@/services/backgroundTaskService'; // Background task that runs when app is closed

// Event CRUD Operations
import {
  createEvent as apiCreateEvent, // Insert new event into database
  deleteEvent as apiDeleteEvent, // Delete event from database (also removes from wishlists)
  listEvents as apiListEvents, // Fetch all events from database
} from '@/services/events';

// Notification Testing Functions
import { forceCheckLocation, sendTestNotification } from '@/services/immediateNotifier'; // Manual location check and test notification

// Wishlist Operations
import {
  Event, // Event type definition
  addEventToWishlist, // Add event to user's wishlist
  getEventsWithWishlistStatus, // Fetch events with isInWishlist flag for current user
  removeItemFromWishlist, // Remove event from user's wishlist
} from '@/services/selectiveWishlist';

// External Libraries
import * as Location from 'expo-location'; // GPS location access
import { router, useFocusEffect } from 'expo-router'; // Navigation and screen focus detection
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'; // React hooks
import { Alert, Platform, ScrollView, Share, StyleSheet, Text, TouchableOpacity, View } from 'react-native'; // React Native UI components

/**
 * EventsScreen Component
 * Main screen for displaying all events with wishlist status and location-aware notifications
 */
export default function EventsScreen() {
  // ============================================================================
  // THEME AND USER CONTEXT
  // ============================================================================
  const colorScheme = useColorScheme(); // Get current theme (light/dark)
  const colors = Colors[colorScheme ?? 'light']; // Get theme colors (fallback to light if null)
  const { user } = useUser(); // Get current authenticated user from global context

  // ============================================================================
  // STATE MANAGEMENT
  // ============================================================================
  const [query, setQuery] = useState(''); // Search query text for filtering events
  const [eventsWithWishlist, setEventsWithWishlist] = useState<(Event & { isInWishlist: boolean })[]>([]); // All events with wishlist flag (true if user bookmarked)
  const [loading, setLoading] = useState(false); // Loading spinner state during data fetch
  const [error, setError] = useState<string | null>(null); // Error message from API calls
  const [showAdd, setShowAdd] = useState(false); // Controls visibility of Add Event modal
  const hasFocusedOnce = useRef(false); // Prevents double-loading on initial screen focus
  const hasRequestedPermissions = useRef(false); // Prevents multiple permission prompts
  const [isBackgroundTaskActive, setIsBackgroundTaskActive] = useState(false); // Whether background task is registered and running

  // ============================================================================
  // LOCATION-AWARE NOTIFICATION SCHEDULER
  // ============================================================================
  // Initialize the event scheduler hook that automatically:
  // 1. Requests notification and location permissions
  // 2. Monitors eventsWithWishlist array for changes
  // 3. When events change, triggers location check (immediateNotifier.ts)
  // 4. Sends notifications if user is within 8km of event and event starts in 2 min
  const {
    isReady: isSchedulerReady, // true when both permissions granted
    hasNotificationPermission, // Notification permission status
    hasLocationPermission, // Location permission status (foreground)
    requestPermissions, // Function to request all permissions at once
  } = useEventScheduler(eventsWithWishlist, {
    enabled: true, // Enable the scheduler
    autoSchedule: true, // Automatically trigger location checks when eventsWithWishlist changes
  });

  // ============================================================================
  // PERMISSION REQUEST (ONE-TIME ON MOUNT)
  // ============================================================================
  // Request notification and location permissions when screen first loads
  // This only runs once (controlled by hasRequestedPermissions ref)
  useEffect(() => {
    // Check if we haven't requested yet AND at least one permission is missing
    if (
      !hasRequestedPermissions.current && // Haven't requested before
      (!hasNotificationPermission || !hasLocationPermission) // At least one permission missing
    ) {
      hasRequestedPermissions.current = true; // Mark as requested (prevents duplicate prompts)
      requestPermissions(); // Show permission dialogs to user
    }
  }, [hasNotificationPermission, hasLocationPermission, requestPermissions]);

  // ============================================================================
  // BACKGROUND TASK STATUS CHECK
  // ============================================================================
  // Check if the background task is currently registered
  // Background task runs every minute (even when app is closed) to check for events starting in 2 minutes
  useEffect(() => {
    const checkBackgroundTask = async () => {
      // Query expo-task-manager to see if BACKGROUND_EVENT_CHECK_TASK is registered
      const isRegistered = await isBackgroundTaskRegistered();
      console.log('[Events] Background task registered:', isRegistered);
      setIsBackgroundTaskActive(isRegistered); // Update UI to show task status
    };
    checkBackgroundTask();
  }, []); // Run only once on mount

  // ============================================================================
  // EVENT FILTERING (MEMOIZED FOR PERFORMANCE)
  // ============================================================================
  // Filter events based on:
  // 1. Time filter: Only show events that started less than 4 hours ago (hide old events)
  // 2. Search filter: Match query against title, organizer, and location
  const events = useMemo(() => {
    const q = query.trim().toLowerCase(); // Normalize search query
    const now = new Date(); // Current time
    const fourHoursAgo = new Date(now.getTime() - 4 * 60 * 60 * 1000); // 4 hours ago (in milliseconds)
    
    // FILTER 1: Remove events that started more than 4 hours ago
    const activeEvents = eventsWithWishlist.filter((e: Event & { isInWishlist: boolean }) => {
      if (!e.start_at) return true; // Keep events without a start time (they're always "active")
      const eventStart = new Date(e.start_at); // Parse event start time
      return eventStart >= fourHoursAgo; // Only keep if event started within last 4 hours OR is in the future
    });
    
    // FILTER 2: Apply search query if present
    if (!q) return activeEvents; // No search query, return all active events
    return activeEvents.filter((e: Event & { isInWishlist: boolean }) => 
      // Combine title, organizer, and location into one searchable string
      (e.title + ' ' + (e.organizer || '') + ' ' + (e.location || '')).toLowerCase().includes(q)
    );
  }, [query, eventsWithWishlist]); // Recalculate when query or events change

  // ============================================================================
  // EVENT HANDLERS - SEARCH
  // ============================================================================
  /**
   * Handle search input changes
   * Updates query state which triggers events filtering in useMemo
   */
  const handleSearch = (text: string) => {
    setQuery(text); // Update search query state → triggers events filtering
  };

  // ============================================================================
  // EVENT HANDLERS - NAVIGATION
  // ============================================================================
  /**
   * Handle event card press
   * Navigate to event detail screen showing full description, map, and edit/delete options
   */
  const handleEventPress = (eventId: string) => {
    router.push({ pathname: '/event/[id]', params: { id: eventId } }); // Navigate to app/event/[id].tsx
  };

  // ============================================================================
  // EVENT HANDLERS - WISHLIST (BOOKMARK)
  // ============================================================================
  /**
   * Handle wishlist bookmark toggle
   * Adds/removes event from user's wishlist (selective_wishlist table)
   * Uses optimistic UI update (immediate state change before database confirms)
   */
  const handleWishlistToggle = async (eventId: string, isCurrentlyInWishlist: boolean) => {
    try {
      // Call appropriate service based on current state
      if (isCurrentlyInWishlist) {
        // Remove from wishlist: DELETE FROM selective_wishlist WHERE item_id = eventId
        await removeItemFromWishlist('event', eventId);
      } else {
        // Add to wishlist: INSERT INTO selective_wishlist (item_type, item_id, user_id)
        await addEventToWishlist(eventId);
      }
      
      // OPTIMISTIC UI UPDATE: Update local state immediately (don't wait for server refresh)
      setEventsWithWishlist(prev => 
        prev.map(event => 
          event.id === eventId 
            ? { ...event, isInWishlist: !isCurrentlyInWishlist } // Toggle bookmark flag
            : event // Keep other events unchanged
        )
      );
    } catch (error: any) {
      // Show error using platform-appropriate alert
      const isWeb = typeof window !== 'undefined' && (window as any).document != null;
      if (isWeb) {
        window.alert(error.message || 'Failed to update wishlist');
      } else {
        Alert.alert('Error', error.message || 'Failed to update wishlist');
      }
    }
  };

  // ============================================================================
  // EVENT HANDLERS - SHARE
  // ============================================================================
  /**
   * Handle event sharing
   * Uses native share sheet (mobile) or Web Share API / clipboard (web)
   * Formats event details into shareable text
   */
  const handleShare = async (event: Event & { isInWishlist: boolean }) => {
    try {
      // Helper: Format date as "Jan 15, 2025"
      const formatDate = (dateStr: string) => {
        if (!dateStr) return 'TBD'; // Handle missing date
        const date = new Date(dateStr);
        return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
      };

      // Helper: Format time as "2:30 PM"
      const formatTime = (dateStr: string) => {
        if (!dateStr) return 'TBD'; // Handle missing time
        const date = new Date(dateStr);
        return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
      };

      // Build shareable content with event details
      const shareContent = {
        title: event.title || 'Check out this event!',
        message: `🎉 ${event.title || 'Event'} by ${event.organizer || 'Unknown'}\n\n${event.description || 'Join us for an exciting event!'}\n\n📅 Date: ${formatDate(event.start_at || '')}\n⏰ Time: ${formatTime(event.start_at || '')}\n📍 Location: ${event.location || 'TBD'}\n\n#UniMateEvent`,
        url: Platform.OS === 'web' ? window.location.href : undefined, // Include page URL on web
      };

      // Platform-specific sharing
      if (Platform.OS === 'web') {
        // Web: Use Web Share API if available
        if (navigator.share) {
          await navigator.share(shareContent); // Native browser share dialog
        } else {
          // Fallback for browsers without Web Share API: Copy to clipboard
          await navigator.clipboard.writeText(shareContent.message);
          window.alert('Event details copied to clipboard!');
        }
      } else {
        // Mobile (iOS/Android): Use React Native Share API
        await Share.share(shareContent); // Shows native share sheet
      }
    } catch (error: any) {
      console.error('Error sharing:', error);
      if (error.name !== 'AbortError') { // User cancelled sharing (not an actual error)
        const message = 'Failed to share event';
        if (Platform.OS === 'web') {
          window.alert(`Error: ${message}`);
        } else {
          Alert.alert('Error', message);
        }
      }
    }
  };

  // ============================================================================
  // EVENT HANDLERS - RSVP (PLACEHOLDER)
  // ============================================================================
  /**
   * Handle RSVP button press
   * Currently a placeholder - RSVP functionality not yet implemented
   */
  const handleRSVP = (event: Event & { isInWishlist: boolean }) => {
    if (Platform.OS === 'web') {
      window.alert(`RSVP for "${event.title}" - Feature coming soon!`);
    } else {
      Alert.alert('RSVP', `RSVP for "${event.title}" - Feature coming soon!`);
    }
  };

  // ============================================================================
  // TESTING FUNCTIONS - NOTIFICATION SYSTEM
  // ============================================================================
  /**
   * Send test notification (for debugging)
   * Calls immediateNotifier.sendTestNotification() which sends a simple notification
   * without checking location or event criteria
   */
  const handleTestNotification = async () => {
    try {
      await sendTestNotification(); // Send "✅ Test Notification" immediately
      Alert.alert('Success', 'Test notification sent! Check your notification tray.');
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to send test notification');
    }
  };

  /**
   * Force location check (for debugging)
   * Gets user's current GPS coordinates and displays them
   * Uses forceCheckLocation() from immediateNotifier.ts
   */
  const handleCheckLocation = async () => {
    try {
      // First check if location services are enabled (if available)
      try {
        const isEnabled = await Location.hasServicesEnabledAsync(); // Check if GPS is turned on
        if (!isEnabled) {
          // GPS is disabled at OS level
          Alert.alert(
            'Location Services Disabled',
            'Please enable location services in your device settings:\n\nSettings → Location → Turn on',
            [{ text: 'OK' }]
          );
          return; // Don't proceed without GPS enabled
        }
      } catch {
        // hasServicesEnabledAsync might not be available on all platforms
        console.log('[Events] Location services check not available');
      }

      // Get current GPS coordinates using expo-location
      const result = await forceCheckLocation(); // Returns { userLocation: { latitude, longitude } | null }
      if (result.userLocation) {
        // Successfully got location
        Alert.alert(
          'Location Check',
          `📍 Current location: ${result.userLocation.latitude.toFixed(4)}, ${result.userLocation.longitude.toFixed(4)}`
        );
      } else {
        // Failed to get location (permissions denied, timeout, etc.)
        Alert.alert('Location Check', '❌ Unable to get current location');
      }
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to check location');
    }
  };

  /**
   * Toggle background task registration (for debugging)
   * Registers expo-background-fetch task that runs every minute
   * When app is closed, this task checks for events starting in 2 minutes and sends notifications
   */
  const handleToggleBackgroundTask = async () => {
    try {
      if (isBackgroundTaskActive) {
        // Task already registered
        Alert.alert('Info', 'Background task is already running. It checks events every minute.');
      } else {
        // Register the background task (BACKGROUND_EVENT_CHECK_TASK)
        await registerBackgroundTask(); // Registers with expo-background-fetch
        setIsBackgroundTaskActive(true); // Update UI
        Alert.alert('Success', 'Background task started! Notifications will work even when app is closed.');
      }
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to start background task');
    }
  };

  // ============================================================================
  // EVENT OPERATION 2: DELETE EVENT
  // ============================================================================
  /**
   * Handle event deletion with confirmation
   * FLOW:
   * 1. Show confirmation dialog
   * 2. Call apiDeleteEvent() which:
   *    - Deletes from selective_wishlist (all users' bookmarks)
   *    - Deletes from events table
   * 3. Optimistically update UI (remove from list)
   * 4. Refresh from server to ensure consistency
   */
  const handleDeleteEvent = (eventId: string, eventTitle: string) => {
    // STEP 1: SHOW CONFIRMATION DIALOG (destructive action needs confirmation)
    Alert.alert(
      'Delete Event', // Title
      `Are you sure you want to delete "${eventTitle}"? This action cannot be undone.`, // Message
      [
        { text: 'Cancel', style: 'cancel' }, // Cancel button (dismisses alert)
        {
          text: 'Delete',
          style: 'destructive', // Red color on iOS
          onPress: async () => {
            try {
              // STEP 2: CALL SERVICE TO DELETE FROM DATABASE
              // This also removes all wishlist entries for this event
              await apiDeleteEvent(eventId);
              Alert.alert('Success', 'Event deleted successfully!');
              
              // STEP 3: UPDATE LOCAL STATE - Optimistic UI update (immediate feedback)
              setEventsWithWishlist(prev => prev.filter(e => e.id !== eventId)); // Remove from list
              
              // STEP 4: REFRESH FROM SERVER - Ensure we have latest data
              await loadEvents();
            } catch (err: any) {
              console.error('Failed to delete event:', err);
              Alert.alert('Error', err?.message || 'Failed to delete event');
            }
          },
        },
      ]
    );
  };

  // ============================================================================
  // DATA LOADING - FETCH EVENTS FROM DATABASE
  // ============================================================================
  /**
   * Load all events with wishlist status for current user
   * 
   * QUERY:
   * SELECT events.*, (selective_wishlist.user_id IS NOT NULL) as isInWishlist
   * FROM events
   * LEFT JOIN selective_wishlist ON events.id = selective_wishlist.item_id AND selective_wishlist.user_id = currentUserId
   * 
   * Options:
   * - showLoader: Show loading spinner during fetch
   * - shouldUpdate: Function to check if component is still mounted (prevents state updates after unmount)
   */
  const loadEvents = useCallback(
    async ({ showLoader = false, shouldUpdate }: { showLoader?: boolean; shouldUpdate?: () => boolean } = {}) => {
      // Show loading state if requested
      if (showLoader) {
        setLoading(true);
        setError(null);
      }

      try {
        // Fetch events with wishlist status (LEFT JOIN with selective_wishlist table)
        const eventsWithWishlistStatus = await getEventsWithWishlistStatus();
        
        // Only update state if component is still mounted
        if (!shouldUpdate || shouldUpdate()) {
          setEventsWithWishlist(eventsWithWishlistStatus); // Update events list
        }
      } catch (err: any) {
        // Handle errors
        if (!shouldUpdate || shouldUpdate()) {
          if (showLoader) {
            setError(err?.message || String(err)); // Show error message
            // FALLBACK: Try to load events without wishlist status
            try {
              const basicEvents = await apiListEvents(); // Simple SELECT * FROM events
              if (Array.isArray(basicEvents)) {
                // Map to include isInWishlist: false for all events
                setEventsWithWishlist(basicEvents.map(event => ({ ...event, isInWishlist: false })));
              }
            } catch (fallbackErr) {
              console.error('Fallback also failed', fallbackErr);
            }
          } else {
            console.warn('Reload failed', err);
          }
        }
      } finally {
        // Hide loading state
        if (showLoader && (!shouldUpdate || shouldUpdate())) {
          setLoading(false);
        }
      }
    },
    [] // No dependencies - function never changes
  );


  // ============================================================================
  // EVENT OPERATION 1: ADD NEW EVENT
  // ============================================================================
  /**
   * Handle adding a new event
   * Called when user submits the Add Event modal
   * 
   * FLOW:
   * 1. User fills out form in AddEventModal (title, description, date, location, image)
   * 2. Modal calls this function with event data
   * 3. We call apiCreateEvent() which inserts into events table
   * 4. Reload events to show the new event in the list
   */
  const handleAddEvent = async (ev: any) => {
    try {
      // INSERT INTO events (title, description, organizer, start_at, location, ...)
      const created = await apiCreateEvent(ev);

      if (created) {
        Alert.alert('Success', 'Event created successfully!');
        // Reload events from database to include the new event
        await loadEvents();
      }
    } catch (err: any) {
      console.error('Create event failed:', err);
      Alert.alert('Error', err?.message || 'Failed to create event');
    }
  };

  // ============================================================================
  // INITIAL DATA LOAD (ON COMPONENT MOUNT)
  // ============================================================================
  // Fetch events when component first mounts
  // Uses cleanup function to prevent state updates after unmount
  useEffect(() => {
    let active = true; // Flag to track if component is still mounted
    loadEvents({ 
      showLoader: true, // Show loading spinner
      shouldUpdate: () => active // Only update state if component is still mounted
    });
    return () => {
      active = false; // Component unmounted, don't update state anymore
    };
  }, [loadEvents]);

  // ============================================================================
  // RELOAD ON SCREEN FOCUS
  // ============================================================================
  // Reload events when user navigates back to this screen
  // Skip the first focus (already loaded in useEffect above)
  useFocusEffect(
    useCallback(() => {
      if (!hasFocusedOnce.current) {
        // First time screen is focused (initial mount)
        hasFocusedOnce.current = true; // Mark as focused
        return; // Don't reload (already loaded in useEffect)
      }

      // User navigated back to this screen - reload to get latest data
      void loadEvents(); // Don't show loader (background refresh)
    }, [loadEvents])
  );

  // ============================================================================
  // RENDER UI
  // ============================================================================
  return (
    // Main scrollable container with theme-aware background
    <ScrollView
      style={[styles.container, { backgroundColor: colors.background }]}
      contentContainerStyle={styles.content}>
      
      {/* ========== HEADER SECTION ========== */}
      <View style={styles.headerRow}>
        {/* Left side: Title and event count */}
        <View>
          <Text style={[styles.title, { color: colors.text }]}>Events</Text>
          <Text style={{ color: colors.textSecondary }}>{events.length} events available</Text>
        </View>

        {/* Right side: Add Event button */}
        <TouchableOpacity 
          style={[styles.addButton, { backgroundColor: colors.primary }]} 
          onPress={() => setShowAdd(true)}> {/* Show AddEventModal */}
          <Text style={{ color: '#fff', fontWeight: '700' }}>+ Add Event</Text>
        </TouchableOpacity>
      </View>

      {/* Test notification buttons - Only show in development */}
      {/* {__DEV__ && (
        <View style={styles.testButtons}>
          <Text style={[styles.testTitle, { color: colors.textSecondary }]}>🧪 Test Notifications:</Text>
          <View style={styles.testButtonRow}>
            <TouchableOpacity
              style={[styles.testButton, { backgroundColor: colors.primary }]}
              onPress={handleTestNotification}>
              <Text style={styles.testButtonText}>📨 Test</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.testButton, { backgroundColor: colors.primary }]}
              onPress={handleCheckLocation}>
              <Text style={styles.testButtonText}>📍 Location</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.testButton, { backgroundColor: colors.primary }]}
              onPress={requestPermissions}>
              <Text style={styles.testButtonText}>🔐 Perms</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.testButton, { backgroundColor: isBackgroundTaskActive ? '#4CAF50' : colors.primary }]}
              onPress={handleToggleBackgroundTask}>
              <Text style={styles.testButtonText}>🔄 BG Task</Text>
            </TouchableOpacity>
          </View>
          <Text style={[styles.statusText, { color: colors.textSecondary }]}>
            Perms: {hasNotificationPermission ? '✅' : '❌'} Notif | {hasLocationPermission ? '✅' : '❌'} Location | BG: {isBackgroundTaskActive ? '✅' : '❌'}
          </Text>
        </View>
      )} */}

      {/* ========== SEARCH BAR ========== */}
      <SearchBar onSearch={handleSearch} /> {/* Calls handleSearch(text) on input change */}

      {/* ========== EVENT CARDS LIST ========== */}
      {/* Map through filtered events and render EventCard for each */}
      {events.map((e: Event & { isInWishlist: boolean }) => (
        <EventCard
          key={e.id} // Unique key for React list rendering
          // Event details
          title={e.title}
          organizer={e.organizer || 'Unknown Organizer'}
          date={e.start_at ? new Date(e.start_at).toLocaleDateString() : 'Date TBD'}
          location={e.location || 'Location TBD'} // Fallback if no location
          locationName={e.location_name} // Display name (e.g., "Main Hall")
          latitude={e.latitude} // For map marker
          longitude={e.longitude} // For map marker
          imageUrl={e.image_url} // Event image from Supabase Storage
          price={e.price !== null && e.price !== undefined ? (e.price === 0 ? 'Free' : `LKR ${e.price.toFixed(2)}`) : undefined}
          category={e.category} // Event category (e.g., "Academic", "Sports")
          createdBy={e.created_by} // User ID who created the event
          
          // Event actions
          onPress={() => handleEventPress(e.id)} // Navigate to detail screen
          onBookmark={() => handleWishlistToggle(e.id, e.isInWishlist)} // Toggle wishlist
          isBookmarked={e.isInWishlist} // Show filled/unfilled bookmark icon
          onShare={() => handleShare(e)} // Open share sheet
          onEdit={() => {
            Alert.alert('Edit Event', 'Edit functionality coming soon'); // TODO: Implement edit
          }}
          onDelete={() => handleDeleteEvent(e.id, e.title)} // Delete with confirmation
          
          // Long press action (shows action sheet)
          onLongPress={() => {
            Alert.alert(
              'Event Actions',
              `What would you like to do with "${e.title}"?`,
              [
                { text: 'View Details', onPress: () => handleEventPress(e.id) },
                { text: 'Share Event', onPress: () => handleShare(e) },
                { text: 'Delete Event', style: 'destructive', onPress: () => handleDeleteEvent(e.id, e.title) },
                { text: 'Cancel', style: 'cancel' },
              ]
            );
          }}
        />
      ))}

      {/* ========== ADD EVENT MODAL ========== */}
      {/* Modal for creating new events - shown when showAdd is true */}
      <AddEventModal 
        visible={showAdd} // Controls modal visibility
        onClose={() => setShowAdd(false)} // Hide modal when user cancels
        onAdd={handleAddEvent} // Called when user submits the form
      />
    </ScrollView>
  );
}

// ============================================================================
// STYLES
// ============================================================================
const styles = StyleSheet.create({
  container: {
    flex: 1, // Fill available space
  },
  content: {
    paddingVertical: 16, // Top and bottom padding
    paddingBottom: 90, // Extra bottom padding to avoid tab bar overlap
  },
  headerRow: {
    paddingHorizontal: 16, // Left and right padding
    flexDirection: 'row', // Horizontal layout
    justifyContent: 'space-between', // Space between title and button
    alignItems: 'center', // Vertically center items
    marginBottom: 12, // Space below header
  },
  title: {
    fontSize: 20,
    fontWeight: '700', // Bold
  },
  addButton: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8, // Rounded corners
  },
  // Test buttons (commented out in UI)
  testButtons: {
    paddingHorizontal: 16,
    marginBottom: 16,
    padding: 12,
    borderRadius: 8,
    backgroundColor: 'rgba(0, 123, 255, 0.1)', // Light blue background
    borderWidth: 1,
    borderColor: 'rgba(0, 123, 255, 0.3)', // Blue border
  },
  testTitle: {
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 8,
  },
  testButtonRow: {
    flexDirection: 'row', // Horizontal layout for test buttons
    gap: 8, // Space between buttons
    marginBottom: 8,
  },
  testButton: {
    flex: 1, // Equal width for all test buttons
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 6,
    alignItems: 'center', // Center text
  },
  testButtonText: {
    color: '#fff', // White text
    fontSize: 11,
    fontWeight: '600',
  },
  statusText: {
    fontSize: 10,
    marginTop: 4,
  },
});
