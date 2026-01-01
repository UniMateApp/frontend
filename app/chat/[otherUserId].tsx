import { Colors } from '@/constants/theme';
import { useUser } from '@/contexts/UserContext';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { getCurrentUser } from '@/services/auth';
import { LOCATION_PREFIX, fetchMessages, findOrCreateConversation, markMessagesRead, sendLocationMessage, sendMessage, subscribeToMessages, type Message } from '@/services/chat';
import { getProfile } from '@/services/profiles';
import { FontAwesome } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import * as Location from 'expo-location';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Keyboard, KeyboardAvoidingView, Linking, Platform, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

export default function ChatWithUserScreen() {
  // STEP 1: INITIALIZATION - Get route parameters and user context
  const { otherUserId } = useLocalSearchParams<{ otherUserId?: string }>(); // Extract the other user's ID from route params
  const { user } = useUser(); // Get current logged-in user from context
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const router = useRouter();
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();

  // STEP 2: STATE MANAGEMENT - Track conversation state, messages, and UI state
  const [conversationId, setConversationId] = useState<string | null>(null); // Stores the conversation ID once created/found
  const [messages, setMessages] = useState<Message[]>([]); // Array of all messages in the conversation
  const [draft, setDraft] = useState(''); // Current message being typed
  const [loading, setLoading] = useState(true); // Loading state while fetching initial data
  const [sending, setSending] = useState(false); // Sending state for new messages
  const [otherUserName, setOtherUserName] = useState(''); // Display name of the other user
  const [otherUserEmail, setOtherUserEmail] = useState(''); // Email of the other user
  const [currentUserEmail, setCurrentUserEmail] = useState(''); // Email of current user
  const unsubscribeRef = useRef<(() => Promise<void>) | null>(null); // Ref to store realtime subscription cleanup function
  const listRef = useRef<FlatList<Message>>(null); // Ref to FlatList for programmatic scrolling

  const isReady = useMemo(() => Boolean(user?.id && otherUserId), [user?.id, otherUserId]);
  const hasUnread = useMemo(
    () => messages.some(m => !m.is_read && m.sender_id !== user?.id),
    [messages, user?.id],
  );

  // STEP 3: LOAD OTHER USER'S PROFILE - Fetch profile info for display in chat header
  useEffect(() => {
    if (!otherUserId) return;
    (async () => {
      try {
        // Fetch the other user's profile from the database
        const profile = await getProfile(String(otherUserId));
        const fallback = `User ${String(otherUserId).slice(0, 6)}`;
        const name = profile?.full_name || fallback;
        const email = profile?.email || '';
        
        // Store profile information in state
        setOtherUserName(name);
        setOtherUserEmail(email);
        
        // Use email as title if available, otherwise use name
        const displayTitle = email || name;
        navigation.setOptions({ title: displayTitle }); // Update navigation header
      } catch {
        // Fallback if profile fetch fails
        const fallback = `User ${String(otherUserId).slice(0, 6)}`;
        setOtherUserName(fallback);
        navigation.setOptions({ title: fallback });
      }
    })();
  }, [navigation, otherUserId]);

  // STEP 4: LOAD CURRENT USER INFO - Get current user's email for message display
  useEffect(() => {
    (async () => {
      const authUser = await getCurrentUser();
      setCurrentUserEmail(authUser?.email || ''); // Store current user's email
    })();
    // Cleanup: Unsubscribe from realtime updates when component unmounts
    return () => {
      if (unsubscribeRef.current) {
        unsubscribeRef.current().catch(() => {}); // Call unsubscribe function to clean up Supabase subscription
      }
    };
  }, []);

  // STEP 5: MAIN CHAT LOADING FLOW - Find/create conversation, fetch messages, and subscribe to updates
  useEffect(() => {
    if (!isReady) {
      setLoading(false);
      return;
    }

    let cancelled = false; // Flag to prevent state updates if component unmounts during async operations
    setLoading(true);
    setMessages([]); // Clear any previous messages

    (async () => {
      try {
        // STEP 5A: FIND OR CREATE CONVERSATION
        // Check if a conversation exists between these two users, or create a new one
        const convo = await findOrCreateConversation(String(user!.id), String(otherUserId));
        if (cancelled) return; // Exit if component unmounted
        setConversationId(convo.id); // Store conversation ID for sending messages

        // STEP 5B: FETCH INITIAL MESSAGES
        // Load all existing messages in this conversation from the database
        const initial = await fetchMessages(convo.id);
        if (cancelled) return;
        setMessages(initial); // Populate the message list
        await markMessagesRead(convo.id, String(user!.id)); // Mark all messages as read

        // STEP 5C: SUBSCRIBE TO REALTIME UPDATES
        // Clean up any existing subscription
        if (unsubscribeRef.current) {
          await unsubscribeRef.current();
        }
        // Subscribe to new messages and message updates via Supabase realtime
        unsubscribeRef.current = subscribeToMessages(
          convo.id,
          // Callback for NEW messages (INSERT events)
          msg => {
            console.log('[Chat] New message in UI:', msg.id);
            setMessages(prev => [...prev, msg]); // Append new message to the list
            if (msg.sender_id !== user!.id) {
              markMessagesRead(convo.id, String(user!.id)).catch(() => {}); // Mark incoming messages as read
            }
          },
          // Callback for UPDATED messages (UPDATE events, e.g., read status changes)
          msg => {
            console.log('[Chat] Message updated in UI:', msg.id);
            setMessages(prev => prev.map(m => (m.id === msg.id ? msg : m))); // Replace updated message
          },
        );
      } catch (err: any) {
        console.error('Chat load failed', err);
        Alert.alert('Chat unavailable', err?.message || 'Could not start chat');
        router.back(); // Navigate back on error
      } finally {
        if (!cancelled) setLoading(false); // Hide loading indicator
      }
    })();

    // Cleanup function - set cancelled flag to prevent state updates after unmount
    return () => {
      cancelled = true;
    };
  }, [isReady, otherUserId, router, user]);

  useEffect(() => {
    if (!listRef.current || !messages.length) return;
    listRef.current.scrollToEnd({ animated: true });
  }, [messages]);

  useEffect(() => {
    const sub = Keyboard.addListener('keyboardDidShow', () => {
      listRef.current?.scrollToEnd({ animated: true });
    });
    const hideSub = Keyboard.addListener('keyboardDidHide', () => {
      listRef.current?.scrollToEnd({ animated: true });
    });
    return () => {
      sub.remove();
      hideSub.remove();
    };
  }, []);

  const handleSend = async () => {
    if (!conversationId || !user?.id) return;
    if (!draft.trim()) return;
    setSending(true);
    try {
      await sendMessage(conversationId, String(user.id), draft.trim());
      setDraft('');
    } catch (err: any) {
      Alert.alert('Send failed', err?.message || 'Could not send message');
    } finally {
      setSending(false);
    }
  };

  const handleSendLocation = async () => {
    if (!conversationId || !user?.id) return;
    
    // Show confirmation dialog before sending location
    Alert.alert(
      'Share Location',
      'Are you sure you want to share your current location with this user?',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Share',
          onPress: async () => {
            try {
              const { status } = await Location.requestForegroundPermissionsAsync();
              if (status !== 'granted') {
                Alert.alert('Permission needed', 'Location permission is required to share your location.');
                return;
              }
              const coords = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
              await sendLocationMessage(conversationId, String(user.id), {
                latitude: coords.coords.latitude,
                longitude: coords.coords.longitude,
              });
            } catch (err: any) {
              Alert.alert('Location failed', err?.message || 'Could not share location');
            }
          },
        },
      ],
      { cancelable: true }
    );
  };

  // STEP 6: MESSAGE PARSING - Parse location messages from text content
  // Location messages are stored with a special prefix: "[LOCATION]latitude,longitude"
  const parseLocation = (content: string) => {
    // Check if message content starts with location prefix
    if (!content.startsWith(LOCATION_PREFIX)) return null;
    
    // Extract coordinates by removing the prefix
    const raw = content.replace(LOCATION_PREFIX, '');
    const parts = raw.split(',').map(p => Number(p.trim())); // Split "lat,lng" and convert to numbers
    
    // Validate that we have exactly 2 valid numbers
    if (parts.length === 2 && Number.isFinite(parts[0]) && Number.isFinite(parts[1])) {
      return { latitude: parts[0], longitude: parts[1] };
    }
    return null; // Return null if not a valid location message
  };

  const openLocation = (lat: number, lng: number) => {
    const url = `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;
    Linking.openURL(url).catch(() => Alert.alert('Open failed', 'Could not open maps.'));
  };

  if (!otherUserId) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <Text style={{ color: colors.text }}>Missing user to chat with.</Text>
      </View>
    );
  }

  if (!user?.id) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <Text style={{ color: colors.text }}>Sign in to chat with the publisher.</Text>
      </View>
    );
  }

  if (loading) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  // STEP 7: MESSAGE RENDERING - Display each message with proper styling and parsing
  const renderItem = ({ item }: { item: Message }) => {
    // Determine if message was sent by current user (for styling)
    const isCurrentUser = item.sender_id === user.id;
    const timestampColor = isCurrentUser ? 'rgba(255,255,255,0.8)' : colors.textSecondary;
    const senderEmail = isCurrentUser ? currentUserEmail : otherUserEmail;
    
    // PARSE MESSAGE CONTENT: Check if this is a location message or regular text
    const loc = parseLocation(item.content);
    
    return (
      <View
        style={[
          styles.bubble,
          isCurrentUser ? styles.bubbleRight : styles.bubbleLeft, // Align right for current user, left for other
          isCurrentUser ? { backgroundColor: colors.primary } : { backgroundColor: colors.card },
        ]}
      >
        {/* Display sender's email above the message */}
        {senderEmail && (
          <Text style={[styles.senderEmail, { color: isCurrentUser ? 'rgba(255,255,255,0.85)' : colors.textSecondary }]}>
            {senderEmail}
          </Text>
        )}
        {/* CONDITIONAL RENDERING: Show location link or text message */}
        {loc ? (
          // If location message: Display as clickable location link
          <TouchableOpacity onPress={() => openLocation(loc.latitude, loc.longitude)}>
            <Text style={{ color: isCurrentUser ? '#fff' : colors.primary, fontWeight: '700' }}>
              Shared location
            </Text>
            <Text style={{ color: isCurrentUser ? '#fff' : colors.textSecondary }}>
              {loc.latitude.toFixed(5)}, {loc.longitude.toFixed(5)}
            </Text>
          </TouchableOpacity>
        ) : (
          // If regular message: Display text content
          <Text style={{ color: isCurrentUser ? '#fff' : colors.text }}>{item.content}</Text>
        )}
        {/* Display timestamp */}
        <Text style={[styles.timestamp, { color: timestampColor }]}>
          {new Date(item.sent_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </Text>
      </View>
    );
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['top']}>
      <KeyboardAvoidingView
        style={{ flex: 1, backgroundColor: colors.background }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 100 : 20}
      >
        <View style={[styles.headerRow, { borderBottomColor: colors.cardBorder }]}>        
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Text style={[styles.headerName, { color: colors.text }]} numberOfLines={1}>
              {otherUserEmail || otherUserName || `User ${String(otherUserId).slice(0, 6)}`}
            </Text>
            {hasUnread && <View style={[styles.unreadDot, { backgroundColor: colors.primary }]} />}
          </View>
        </View>

        <FlatList
          ref={listRef}
          data={messages}
          keyExtractor={m => m.id}
          renderItem={renderItem}
          contentContainerStyle={{ padding: 16, gap: 8, paddingBottom: 24 }}
        />

        <View style={[styles.inputRow, { 
          borderTopColor: colors.cardBorder, 
          paddingBottom: Math.max(insets.bottom, 8) + 16,
          paddingLeft: insets.left || 10,
          paddingRight: insets.right || 10,
          marginBottom: 0,
        }]}>
          <TouchableOpacity
            style={[styles.iconButton, { borderColor: colors.cardBorder }]}
            onPress={handleSendLocation}
          >
            <FontAwesome name="map-marker" size={18} color={colors.primary} />
          </TouchableOpacity>

          <TextInput
            style={[styles.input, { borderColor: colors.cardBorder, color: colors.text }]}
            placeholder="Message the publisher"
            placeholderTextColor={colors.textSecondary}
            value={draft}
            onChangeText={setDraft}
            multiline
          />
          <TouchableOpacity
            style={[styles.sendButton, { backgroundColor: draft.trim() ? colors.primary : colors.cardBorder }]}
            onPress={handleSend}
            disabled={!draft.trim() || sending}
          >
            {sending ? (
              <ActivityIndicator size="small" color={draft.trim() ? '#fff' : colors.textSecondary} />
            ) : (
              <FontAwesome name="send" size={18} color={draft.trim() ? '#fff' : colors.textSecondary} />
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  bubble: { maxWidth: '80%', padding: 10, borderRadius: 12 },
  bubbleLeft: { alignSelf: 'flex-start', borderTopLeftRadius: 4 },
  bubbleRight: { alignSelf: 'flex-end', borderTopRightRadius: 4 },
  senderEmail: { fontSize: 11, fontWeight: '600', marginBottom: 4, opacity: 0.9 },
  timestamp: { fontSize: 10, opacity: 0.7, marginTop: 4, textAlign: 'right', color: '#f5f5f5' },
  headerRow: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  headerName: { fontSize: 16, fontWeight: '700', maxWidth: 240 },
  unreadDot: { width: 10, height: 10, borderRadius: 5 },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    borderTopWidth: 1,
    gap: 8,
  },
  iconButton: {
    width: 40,
    height: 40,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  input: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    maxHeight: 120,
  },
  sendButton: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
