// Import theme colors for light/dark mode support
import { Colors } from '@/constants/theme';
// Import hook to detect light/dark mode preference
import { useColorScheme } from '@/hooks/use-color-scheme';
// Import notification service functions:
// - getNotificationsForCurrentUser: Fetch all notifications from database
// - markAllNotificationsReadForCurrentUser: Mark all as read in bulk
// - markNotificationRead: Mark single notification as read
// - subscribeToNotifications: Real-time subscription for new notifications
import { getNotificationsForCurrentUser, markAllNotificationsReadForCurrentUser, markNotificationRead, subscribeToNotifications } from '@/services/notifications';
// Import router for navigation to chat screens from notifications
import { useRouter } from 'expo-router';
// Import React hooks for state management and lifecycle
import React, { useEffect, useState } from 'react';
// Import React Native UI components
// DeviceEventEmitter: Used to broadcast events across app (for badge updates)
import { ActivityIndicator, Alert, DeviceEventEmitter, FlatList, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

// NotificationsScreen: Displays all notifications for current user
// Supports real-time updates via Supabase subscriptions
// Allows marking notifications as read and navigating to related content
export default function NotificationsScreen() {
  // Detect current theme (light or dark mode)
  const colorScheme = useColorScheme();
  // Get theme-specific colors based on current mode
  const colors = Colors[colorScheme ?? 'light'];
  // Get router instance for navigation (e.g., to chat screens)
  const router = useRouter();
  // State: Array of notification objects from database
  const [notifications, setNotifications] = useState<any[]>([]);
  // State: Loading indicator while fetching notifications
  const [loading, setLoading] = useState(true);

  // Function: Load all notifications for current user from database
  // Fetches from Supabase notifications table filtered by recipient_id
  const load = async () => {
    // Show loading spinner while fetching
    setLoading(true);
    try {
      // Fetch notifications from database (ordered by created_at DESC)
      const data = await getNotificationsForCurrentUser();
      // Update state with fetched notifications (fallback to empty array if null)
      setNotifications(data ?? []);
    } catch (err: any) {
      // Log error to console for debugging
      console.error('Failed to load notifications', err);
      // Show error alert to user
      Alert.alert('Error', err.message || 'Failed to load notifications');
    } finally {
      // Hide loading spinner regardless of success/failure
      setLoading(false);
    }
  };

  // Effect: Load notifications on mount and set up real-time subscription
  // Empty dependency array [] means this runs only once when component mounts
  useEffect(() => {
    // Initial load of notifications from database
    load();

    // Variable to hold Supabase realtime channel for cleanup
    let channel: any = null;
    // IIFE (Immediately Invoked Function Expression) for async subscription setup
    (async () => {
      try {
        // Subscribe to real-time notifications updates from Supabase
        // Callback receives payload when new notification is inserted
        channel = await subscribeToNotifications((payload) => {
          // Extract event type from payload (varies based on Supabase version)
          const ev = payload?.eventType || payload?.event || null;
          // Extract new notification record from payload
          // Different Supabase versions use 'record' or 'new'
          const newRecord = payload?.record ?? payload?.new ?? null;
          if (newRecord) {
            // Add new notification to state (prepend to array for newest-first)
            // Only add if recipient matches and it's not already in list
            setNotifications(prev => {
              // Prevent duplicates: Check if notification ID already exists
              if (prev.some(n => String(n.id) === String(newRecord.id))) return prev;
              // Prepend new notification to beginning of array
              return [newRecord, ...prev];
            });
          }
        });
      } catch (e) {
        // Log warning if subscription fails (non-fatal error)
        console.warn('Could not subscribe to notifications realtime', e);
      }
    })();

    // Cleanup function: Unsubscribe when component unmounts
    return () => {
      try {
        // Unsubscribe from Supabase channel to prevent memory leaks
        if (channel && channel.unsubscribe) channel.unsubscribe();
      } catch (_) {}
    };
  }, []);

  // Function: Handle notification tap - mark as read and navigate/show details
  // Different notification types trigger different actions (e.g., chat vs event)
  const handlePress = async (item: any) => {
    try {
      // Step 1: Mark notification as read if it's unread
      if (!item.read) {
        // Update database to mark notification as read
        await markNotificationRead(item.id);
        // Update local state optimistically (immediate UI feedback)
        // Map over notifications array and update the read status for this item
        setNotifications(prev => prev.map(n => (n.id === item.id ? { ...n, read: true } : n)));
      }

      // Step 2: Handle different notification types with appropriate actions
      if (item.type === 'chat' && item.data?.sender_id) {
        // Chat notification: Navigate to chat screen with the sender
        // sender_id is stored in notification data JSON field
        router.push({ pathname: `/chat/${item.data.sender_id}` });
      } else {
        // Other notification types (events, lost-found, etc.): Show alert dialog
        // Display title and message in a simple alert
        Alert.alert(item.title || 'Notification', item.message || '');
      }
    } catch (err: any) {
      // Log error if marking read or navigation fails
      console.error('Failed to handle notification', err);
    }
  };

  // Function: Mark all notifications as read in bulk
  // Updates database and broadcasts event to update notification badges
  const handleMarkAllRead = async () => {
    try {
      // Update all notifications in database to read=true for current user
      await markAllNotificationsReadForCurrentUser();
      // Update local state optimistically: Map over all notifications and set read=true
      setNotifications(prev => prev.map(n => ({ ...n, read: true })));
      // Emit platform-wide event so other components can update immediately
      // This updates notification badges in header/tab bar without refetching
      try { DeviceEventEmitter.emit('notifications:markAllRead'); } catch (_) {}
    } catch (err: any) {
      // Log error if bulk update fails
      console.error('Failed to mark all read', err);
    }
  };

  // Render: Main UI with header, mark all read button, and notifications list
  return (
    // Main container with theme-aware background color
    <View style={[styles.container, { backgroundColor: colors.background }]}> 
      {/* Header row with title and "Mark all read" button */}
      <View style={styles.headerRow}>
        {/* Screen title */}
        <Text style={[styles.title, { color: colors.text }]}>Notifications</Text>
        {/* Button to mark all notifications as read at once */}
        <TouchableOpacity onPress={handleMarkAllRead} style={{ padding: 8 }}>
          <Text style={{ color: colors.primary }}>Mark all read</Text>
        </TouchableOpacity>
      </View>

      {/* Conditional rendering: Show spinner while loading, list when ready */}
      {loading ? (
        // Show loading spinner while fetching notifications from database
        <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: 20 }} />
      ) : (
        // FlatList: Efficient scrollable list for rendering notifications
        <FlatList
          data={notifications}  // Data source (all notifications for current user)
          keyExtractor={i => String(i.id)}  // Unique key for each notification
          contentContainerStyle={{ padding: 16, paddingBottom: 40 }}  // Padding around list
          // Empty state component shown when notifications array is empty
          ListEmptyComponent={() => (
            <View style={styles.empty}>
              <Text style={{ color: colors.textSecondary }}>No notifications.</Text>
            </View>
          )}
          // renderItem: How to render each notification in the list
          renderItem={({ item }) => (
            // Touchable card that handles tap to navigate or show details
            // Background changes based on read status (darker if unread)
            <TouchableOpacity onPress={() => handlePress(item)} style={[styles.row, { borderColor: colors.cardBorder, backgroundColor: item.read ? colors.card : colors.background }]}> 
              {/* Notification content: title, message, timestamp */}
              <View style={{ flex: 1 }}>
                {/* Notification title (bold) */}
                <Text style={[styles.rowTitle, { color: colors.text }]}>{item.title}</Text>
                {/* Optional message/body (only shown if exists) */}
                {item.message ? <Text style={{ color: colors.textSecondary, marginTop: 4 }}>{item.message}</Text> : null}
                {/* Timestamp showing when notification was created */}
                {/* created_at is ISO string, converted to localized date/time */}
                <Text style={{ color: colors.textSecondary, marginTop: 6, fontSize: 12 }}>{new Date(item.created_at).toLocaleString()}</Text>
              </View>
              {/* Unread indicator: Red dot shown only for unread notifications */}
              {!item.read && <View style={styles.unreadDot} />}
            </TouchableOpacity>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16 },
  title: { fontSize: 22, fontWeight: '700' },
  empty: { padding: 24, alignItems: 'center' },
  row: { borderWidth: 1, borderRadius: 10, padding: 12, marginBottom: 12, flexDirection: 'row', alignItems: 'center' },
  rowTitle: { fontSize: 16, fontWeight: '700' },
  unreadDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#e02424', marginLeft: 12 },
});
