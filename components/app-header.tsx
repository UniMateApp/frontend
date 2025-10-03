import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { FontAwesome } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React from 'react';
import { Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

export default function AppHeader() {
  const router = useRouter();
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const insets = useSafeAreaInsets();
  const topPadding = Math.min(insets.top, 10); // cap to keep consistent small gap across devices
  return (
    <SafeAreaView style={{ backgroundColor: colors.background, paddingTop: topPadding }}>
      <View style={[styles.container, { borderBottomColor: colors.cardBorder }] }>
        <View style={styles.left}>
          <Image source={require('../assets/images/icon.png')} style={styles.logo} />
          <View>
            <Text style={[styles.title, { color: colors.text }]}>UniMate</Text>
            <Text style={[styles.subtitle, { color: colors.textSecondary }]}>Campus life, simplified</Text>
          </View>
        </View>

        <View style={styles.right}>
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
          <FontAwesome name="bell" size={20} color={colors.icon} />
        </TouchableOpacity>
        </View>
      </View>
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
});
