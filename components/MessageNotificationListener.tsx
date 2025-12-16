import { useUser } from '@/contexts/UserContext';
import { subscribeToIncomingMessages } from '@/services/chat';
import * as Notifications from 'expo-notifications';
import { usePathname } from 'expo-router';
import { useEffect, useRef } from 'react';
import { AppState, AppStateStatus } from 'react-native';

// Listens for incoming messages (via Supabase Realtime) and triggers a local device notification
// when the user is not currently looking at the chat screen or the app is backgrounded.
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

        const isOnChatScreen = pathname?.startsWith('/chat');
        const isForeground = appState.current === 'active';

        // Only notify if user is not on chat or app is backgrounded
        if (!isOnChatScreen || !isForeground) {
          try {
            await Notifications.scheduleNotificationAsync({
              content: {
                title: 'New message',
                body: msg.content?.slice(0, 100) || 'You have a new message',
                data: { conversation_id: msg.conversation_id },
              },
              trigger: null,
            });
          } catch (err) {
            console.warn('Failed to present notification', err);
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
