import { useUser } from '@/contexts/UserContext';
import { subscribeToIncomingMessages } from '@/services/chat';
import { createNotification } from '@/services/notifications';
import { getProfile } from '@/services/profiles';
import * as Notifications from 'expo-notifications';
import { usePathname } from 'expo-router';
import { useEffect, useRef } from 'react';
import { AppState, AppStateStatus } from 'react-native';

// Listens for incoming messages (via Supabase Realtime) and triggers a local device notification
// when the user is not currently looking at the chat screen or the app is backgrounded.
// Also creates a notification in the database for the notification panel.
export default function MessageNotificationListener() {
  const { user } = useUser();
  const pathname = usePathname();
  const appState = useRef<AppStateStatus>(AppState.currentState);
  const unsubscribeRef = useRef<(() => Promise<void>) | null>(null);

  // Track app state
  useEffect(() => {
    const sub = AppState.addEventListener('change', nextState => {
      appState.current = nextState;
    });
    return () => sub.remove();
  }, []);

  // Subscribe to incoming messages for the signed-in user
  useEffect(() => {
    if (!user?.id) return;

    const setup = async () => {
      try {
        // Request notification permissions lazily
        await Notifications.requestPermissionsAsync();
      } catch (err) {
        // ignore permission errors; user may decline
        console.warn('Notification permission request failed', err);
      }

      unsubscribeRef.current = subscribeToIncomingMessages(String(user.id), async msg => {
        // Skip if user sent it
        if (String(msg.sender_id) === String(user.id)) return;

        // Check if user is currently viewing this specific chat
        const isOnThisChat = pathname === `/chat/${msg.sender_id}`;
        const isForeground = appState.current === 'active';

        // Only notify if user is not on this specific chat or app is backgrounded
        if (!isOnThisChat || !isForeground) {
          try {
            // Get sender's profile for notification
            let senderEmail = 'Someone';
            try {
              const senderProfile = await getProfile(String(msg.sender_id));
              senderEmail = senderProfile?.email || senderProfile?.full_name || `User ${String(msg.sender_id).slice(0, 6)}`;
            } catch (err) {
              console.warn('Failed to fetch sender profile', err);
            }

            // Create notification in database (for notification panel)
            await createNotification({
              recipient_id: user.id,
              title: 'New Message',
              message: `You have received a new message from ${senderEmail}`,
              type: 'chat',
              read: false,
              data: {
                sender_id: msg.sender_id,
                conversation_id: msg.conversation_id,
                message_id: msg.id,
              },
            });

            // Show local push notification
            await Notifications.scheduleNotificationAsync({
              content: {
                title: 'New Message',
                body: `${senderEmail}: ${msg.content?.slice(0, 100) || 'Sent you a message'}`,
                data: { 
                  sender_id: msg.sender_id,
                  conversation_id: msg.conversation_id,
                  type: 'chat',
                },
              },
              trigger: null,
            });
          } catch (err) {
            console.warn('Failed to create notification', err);
          }
        }
      });
    };

    setup();

    return () => {
      if (unsubscribeRef.current) {
        unsubscribeRef.current().catch(() => {});
        unsubscribeRef.current = null;
      }
    };
  }, [user?.id, pathname]);

  return null;
}

