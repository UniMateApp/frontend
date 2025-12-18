import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { FontAwesome } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import { Animated, DeviceEventEmitter, Dimensions, Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { getTotalUnreadCount } from '@/services/chat';
import { useUser } from '@/contexts/UserContext';

export default function AppHeader() {
  const router = useRouter();
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const insets = useSafeAreaInsets();
  const topPadding = Math.min(insets.top, 10); // cap to keep consistent small gap across devices
  const { user } = useUser();

  const [unreadCount, setUnreadCount] = useState<number>(0);
  const [unreadMessageCount, setUnreadMessageCount] = useState<number>(0);
  const [toastVisible, setToastVisible] = useState(false);
  const [toastText, setToastText] = useState('');
  const translateY = useRef(new Animated.Value(-80)).current;

  useEffect(() => {
    let mounted = true;
    let channel: any = null;

    const init = async () => {
      try {
        const { getNotificationsForCurrentUser, subscribeToNotifications, markNotificationRead } = await import('@/services/notifications');
        const list = await getNotificationsForCurrentUser();
        const count = Array.isArray(list) ? list.filter((n: any) => !n.read).length : 0;
        if (mounted) setUnreadCount(count ?? 0);

        channel = await subscribeToNotifications(async (payload: any) => {
          // Always refresh unread count on any notification event (insert/update/delete)
          try {
            const updatedList = await getNotificationsForCurrentUser();
            const updated = Array.isArray(updatedList) ? updatedList.filter((n: any) => !n.read).length : 0;
            if (mounted) setUnreadCount(updated ?? 0);
          } catch (e) {
            console.warn('Failed to refresh notifications after realtime event', e);
          }

          // If this is a new unread record, show the toast once
          const newRecord = payload?.record ?? payload?.new ?? payload?.payload?.new ?? null;
          if (newRecord && !newRecord.read) {
            if (mounted) {
              setToastText(newRecord.title || newRecord.message || 'New notification');
              setToastVisible(true);
              Animated.sequence([
                Animated.timing(translateY, { toValue: 0, duration: 300, useNativeDriver: true }),
                Animated.delay(3500),
                Animated.timing(translateY, { toValue: -80, duration: 300, useNativeDriver: true }),
              ]).start(() => {
                if (mounted) setToastVisible(false);
              });
            }

            // mark read so it doesn't popup again
            try {
              await markNotificationRead(newRecord.id);
            } catch (e) {
              console.warn('Failed to mark notification read after toast', e);
            }
          }
        });
      } catch (err) {
        console.warn('AppHeader notification init failed', err);
      }
    };

    init();

    // listen for mark-all-read emitted from Notifications screen
    const markAllSub = DeviceEventEmitter.addListener('notifications:markAllRead', () => {
      try { setUnreadCount(0); } catch (_) {}
    });

    return () => {
      mounted = false;
      try { if (channel && channel.unsubscribe) channel.unsubscribe(); } catch (_) {}
      try { markAllSub.remove(); } catch (_) {}
    };
  }, [translateY]);

  // Fetch unread message count
  useEffect(() => {
    if (!user?.id) return;

    const fetchUnreadMessages = async () => {
      try {
        const count = await getTotalUnreadCount(user.id);
        setUnreadMessageCount(count);
      } catch (error) {
        console.warn('Error fetching unread message count:', error);
      }
    };

    fetchUnreadMessages();
    const interval = setInterval(fetchUnreadMessages, 10000);

    return () => clearInterval(interval);
  }, [user?.id]);

  const screenWidth = Dimensions.get('window').width;

  return (
    <SafeAreaView style={{ backgroundColor: colors.background, paddingTop: topPadding }}>
      <View style={[styles.container, { borderBottomColor: colors.cardBorder }]}>
        <View style={styles.left}>
          <Image source={require('../assets/images/unimate.png')} style={styles.logo} />
          <View>
            <Text style={[styles.title, { color: colors.text }]}>UniMate</Text>
            <Text style={[styles.subtitle, { color: colors.textSecondary }]}>Campus life, simplified</Text>
          </View>
        </View>

        <View style={styles.right}>
          <TouchableOpacity
            onPress={() => router.push({ pathname: '/chats' })}
            accessibilityLabel="Open chats"
            style={styles.iconButton}
          >
            <View style={{ width: 28, height: 28, alignItems: 'center', justifyContent: 'center' }}>
              <FontAwesome name="comments" size={20} color={colors.icon} />
              {unreadMessageCount > 0 && (
                <View style={[styles.badge, { backgroundColor: '#e02424' }]}>
                  <Text style={styles.badgeText}>{unreadMessageCount > 99 ? '99+' : String(unreadMessageCount)}</Text>
                </View>
              )}
            </View>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => router.push({ pathname: '/map' })}
            accessibilityLabel="Open map"
            style={styles.iconButton}
          >
            <FontAwesome name="map" size={20} color={colors.icon} />
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => router.push({ pathname: '/notifications' })}
            accessibilityLabel="Open notifications"
            style={styles.iconButton}
          >
            <View style={{ width: 28, height: 28, alignItems: 'center', justifyContent: 'center' }}>
              <FontAwesome name="bell" size={20} color={colors.icon} />
              {unreadCount > 0 && (
                <View style={[styles.badge, { backgroundColor: '#e02424' }]}>
                  <Text style={styles.badgeText}>{unreadCount > 99 ? '99+' : String(unreadCount)}</Text>
                </View>
              )}
              {/* {unreadCount > 0 && (
                <View style={styles.tickContainer}>
                  <FontAwesome name="check" size={10} color="#fff" />
                </View>
              )} */}
            </View>
          </TouchableOpacity>
        </View>
      </View>

      {/* Top toast popup */}
      <Animated.View style={[styles.toast, { transform: [{ translateY }], width: screenWidth - 32, backgroundColor: '#333' }]}> 
        <Text style={styles.toastText}>{toastText}</Text>
      </Animated.View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    height: 64,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  left: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  logo: {
    width: 44,
    height: 44,
    borderRadius: 10,
    marginRight: 12,
  },
  title: {
    fontSize: 18,
    fontWeight: '800',
  },
  subtitle: {
    fontSize: 12,
    marginTop: 2,
  },
  right: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconButton: {
    padding: 8,
    marginLeft: 8,
  },
  badge: {
    position: 'absolute',
    top: -6,
    right: -6,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  badgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '700',
  },
  tickContainer: {
    position: 'absolute',
    bottom: -4,
    right: -4,
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#22c55e',
    alignItems: 'center',
    justifyContent: 'center',
  },
  toast: {
    position: 'absolute',
    top: 8,
    left: 16,
    right: 16,
    zIndex: 9999,
    borderRadius: 8,
    padding: 12,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 6,
  },
  toastText: {
    color: '#fff',
    fontWeight: '600',
  },
});
