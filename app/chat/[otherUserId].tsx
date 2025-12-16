import { Colors } from '@/constants/theme';
import { useUser } from '@/contexts/UserContext';
import { useColorScheme } from '@/hooks/use-color-scheme';
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
  const { otherUserId } = useLocalSearchParams<{ otherUserId?: string }>();
  const { user } = useUser();
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const router = useRouter();
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();

  const [conversationId, setConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [draft, setDraft] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [otherUserName, setOtherUserName] = useState('');
  const unsubscribeRef = useRef<(() => Promise<void>) | null>(null);
  const listRef = useRef<FlatList<Message>>(null);

  const isReady = useMemo(() => Boolean(user?.id && otherUserId), [user?.id, otherUserId]);
  const hasUnread = useMemo(
    () => messages.some(m => !m.is_read && m.sender_id !== user?.id),
    [messages, user?.id],
  );

  useEffect(() => {
    if (!otherUserId) return;
    (async () => {
      try {
        const profile = await getProfile(String(otherUserId));
        const fallback = `User ${String(otherUserId).slice(0, 6)}`;
        const name = profile?.full_name || fallback;
        setOtherUserName(name);
        navigation.setOptions({ title: name });
      } catch {
        const fallback = `User ${String(otherUserId).slice(0, 6)}`;
        setOtherUserName(fallback);
        navigation.setOptions({ title: fallback });
      }
    })();
  }, [navigation, otherUserId]);

  useEffect(() => {
    return () => {
      if (unsubscribeRef.current) {
        unsubscribeRef.current().catch(() => {});
      }
    };
  }, []);

  useEffect(() => {
    if (!isReady) {
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setMessages([]);

    (async () => {
      try {
        const convo = await findOrCreateConversation(String(user!.id), String(otherUserId));
        if (cancelled) return;
        setConversationId(convo.id);

        const initial = await fetchMessages(convo.id);
        if (cancelled) return;
        setMessages(initial);
        await markMessagesRead(convo.id, String(user!.id));

        if (unsubscribeRef.current) {
          await unsubscribeRef.current();
        }
        unsubscribeRef.current = subscribeToMessages(
          convo.id,
          msg => {
            setMessages(prev => [...prev, msg]);
            if (msg.sender_id !== user!.id) {
              markMessagesRead(convo.id, String(user!.id)).catch(() => {});
            }
          },
          msg => setMessages(prev => prev.map(m => (m.id === msg.id ? msg : m))),
        );
      } catch (err: any) {
        console.error('Chat load failed', err);
        Alert.alert('Chat unavailable', err?.message || 'Could not start chat');
        router.back();
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

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
  };

  const parseLocation = (content: string) => {
    if (!content.startsWith(LOCATION_PREFIX)) return null;
    const raw = content.replace(LOCATION_PREFIX, '');
    const parts = raw.split(',').map(p => Number(p.trim()));
    if (parts.length === 2 && Number.isFinite(parts[0]) && Number.isFinite(parts[1])) {
      return { latitude: parts[0], longitude: parts[1] };
    }
    return null;
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

  const renderItem = ({ item }: { item: Message }) => {
    const timestampColor = item.sender_id === user.id ? 'rgba(255,255,255,0.8)' : colors.textSecondary;
    const loc = parseLocation(item.content);
    return (
      <View
        style={[
          styles.bubble,
          item.sender_id === user.id ? styles.bubbleRight : styles.bubbleLeft,
          item.sender_id === user.id ? { backgroundColor: colors.primary } : { backgroundColor: colors.card },
        ]}
      >
        {loc ? (
          <TouchableOpacity onPress={() => openLocation(loc.latitude, loc.longitude)}>
            <Text style={{ color: item.sender_id === user.id ? '#fff' : colors.primary, fontWeight: '700' }}>
              Shared location
            </Text>
            <Text style={{ color: item.sender_id === user.id ? '#fff' : colors.textSecondary }}>
              {loc.latitude.toFixed(5)}, {loc.longitude.toFixed(5)}
            </Text>
          </TouchableOpacity>
        ) : (
          <Text style={{ color: item.sender_id === user.id ? '#fff' : colors.text }}>{item.content}</Text>
        )}
        <Text style={[styles.timestamp, { color: timestampColor }]}>
          {new Date(item.sent_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </Text>
      </View>
    );
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['bottom', 'left', 'right', 'top']}>
      <KeyboardAvoidingView
        style={[styles.container, { backgroundColor: colors.background }]}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={0}
      >
        <View style={[styles.headerRow, { borderBottomColor: colors.cardBorder }]}>        
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Text style={[styles.headerName, { color: colors.text }]} numberOfLines={1}>
              {otherUserName || `User ${String(otherUserId).slice(0, 6)}`}
            </Text>
            {hasUnread && <View style={[styles.unreadDot, { backgroundColor: colors.primary }]} />}
          </View>
        </View>

        <FlatList
          ref={listRef}
          data={messages}
          keyExtractor={m => m.id}
          renderItem={renderItem}
          contentContainerStyle={{ padding: 16, gap: 8, paddingBottom: 24 + insets.bottom }}
        />

        <View style={[styles.inputRow, { borderTopColor: colors.cardBorder, paddingBottom: (insets.bottom || 12) }]}>
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
