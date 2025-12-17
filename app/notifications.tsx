import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { getNotificationsForCurrentUser, markAllNotificationsReadForCurrentUser, markNotificationRead, subscribeToNotifications } from '@/services/notifications';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, DeviceEventEmitter, FlatList, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

export default function NotificationsScreen() {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const [notifications, setNotifications] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const data = await getNotificationsForCurrentUser();
      setNotifications(data ?? []);
    } catch (err: any) {
      console.error('Failed to load notifications', err);
      Alert.alert('Error', err.message || 'Failed to load notifications');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();

    let channel: any = null;
    (async () => {
      try {
        channel = await subscribeToNotifications((payload) => {
          // payload records are nested depending on event type
          const ev = payload?.eventType || payload?.event || null;
          const newRecord = payload?.record ?? payload?.new ?? null;
          if (newRecord) {
            // Only add if recipient matches and it's not already in list
            setNotifications(prev => {
              if (prev.some(n => String(n.id) === String(newRecord.id))) return prev;
              return [newRecord, ...prev];
            });
          }
        });
      } catch (e) {
        console.warn('Could not subscribe to notifications realtime', e);
      }
    })();

    return () => {
      try {
        if (channel && channel.unsubscribe) channel.unsubscribe();
      } catch (_) {}
    };
  }, []);

  const handlePress = async (item: any) => {
    try {
      // show details and mark as read if unread
      Alert.alert(item.title || 'Notification', item.message || '');
      if (!item.read) {
        await markNotificationRead(item.id);
        setNotifications(prev => prev.map(n => (n.id === item.id ? { ...n, read: true } : n)));
      }
    } catch (err: any) {
      console.error('Failed to mark notification read', err);
    }
  };

  const handleMarkAllRead = async () => {
    try {
      await markAllNotificationsReadForCurrentUser();
      setNotifications(prev => prev.map(n => ({ ...n, read: true })));
      // emit a platform-wide event so other components (header/badges) can update immediately
      try { DeviceEventEmitter.emit('notifications:markAllRead'); } catch (_) {}
    } catch (err: any) {
      console.error('Failed to mark all read', err);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}> 
      <View style={styles.headerRow}>
        <Text style={[styles.title, { color: colors.text }]}>Notifications</Text>
        <TouchableOpacity onPress={handleMarkAllRead} style={{ padding: 8 }}>
          <Text style={{ color: colors.primary }}>Mark all read</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: 20 }} />
      ) : (
        <FlatList
          data={notifications}
          keyExtractor={i => String(i.id)}
          contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
          ListEmptyComponent={() => (
            <View style={styles.empty}>
              <Text style={{ color: colors.textSecondary }}>No notifications.</Text>
            </View>
          )}
          renderItem={({ item }) => (
            <TouchableOpacity onPress={() => handlePress(item)} style={[styles.row, { borderColor: colors.cardBorder, backgroundColor: item.read ? colors.card : colors.background }]}> 
              <View style={{ flex: 1 }}>
                <Text style={[styles.rowTitle, { color: colors.text }]}>{item.title}</Text>
                {item.message ? <Text style={{ color: colors.textSecondary, marginTop: 4 }}>{item.message}</Text> : null}
                <Text style={{ color: colors.textSecondary, marginTop: 6, fontSize: 12 }}>{new Date(item.created_at).toLocaleString()}</Text>
              </View>
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
