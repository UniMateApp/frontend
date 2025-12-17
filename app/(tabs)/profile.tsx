import { Colors } from '@/constants/theme';
import { useUser } from '@/contexts/UserContext';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { signOut } from '@/services/auth';
import { FontAwesome } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React from 'react';
import { ActivityIndicator, Alert, RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

interface SettingItemProps {
  icon: React.ComponentProps<typeof FontAwesome>['name'];
  title: string;
  onPress: () => void;
}

function SettingItem({ icon, title, onPress }: SettingItemProps) {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];

  return (
    <TouchableOpacity
      style={[styles.settingItem, { borderColor: colors.cardBorder }]}
      onPress={onPress}>
      <View style={styles.settingContent}>
        <FontAwesome name={icon} size={20} color={colors.icon} style={styles.settingIcon} />
        <Text style={[styles.settingText, { color: colors.text }]}>{title}</Text>
      </View>
      <FontAwesome name="chevron-right" size={16} color={colors.icon} />
    </TouchableOpacity>
  );
}

export default function ProfileScreen() {
  const router = useRouter();
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const { user, profile, loading, refreshProfile } = useUser();
  const [refreshing, setRefreshing] = React.useState(false);

  const onRefresh = React.useCallback(async () => {
    setRefreshing(true);
    try {
      await refreshProfile();
    } catch (error) {
      console.error('Failed to refresh profile:', error);
    }
    setRefreshing(false);
  }, [refreshProfile]);

  // Generate initials from full name or email
  const getInitials = (name?: string | null, email?: string) => {
    if (name) {
      return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
    }
    if (email) {
      return email.slice(0, 2).toUpperCase();
    }
    return 'U';
  };

  // Get display name
  const getDisplayName = () => {
    if (profile?.full_name) return profile.full_name;
    if (user?.user_metadata?.full_name) return user.user_metadata.full_name;
    if (user?.email) {
      const emailName = user.email.split('@')[0];
      return emailName.charAt(0).toUpperCase() + emailName.slice(1);
    }
    return 'User';
  };

  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background, justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={[styles.loadingText, { color: colors.textSecondary }]}>Loading profile...</Text>
      </View>
    );
  }

  const displayName = getDisplayName();
  const initials = getInitials(profile?.full_name || user?.user_metadata?.full_name, user?.email);

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.background }]}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={onRefresh}
          colors={[colors.primary]}
          tintColor={colors.primary}
        />
      }>
      <View style={[styles.header, { backgroundColor: colors.card }]}>
        <View style={[styles.avatarContainer, { backgroundColor: colors.primary }]}>
          <Text style={styles.avatarText}>{initials}</Text>
        </View>
        <Text style={[styles.name, { color: colors.text }]}>{displayName}</Text>
        <Text style={[styles.email, { color: colors.textSecondary }]}>
          {user?.email || 'No email'}
        </Text>
      </View>

      <View style={styles.section}>
        <SettingItem
          icon="edit"
          title="Edit Profile"
          onPress={() => {
            router.push('/edit-profile');
          }}
        />
        <SettingItem
          icon="bell"
          title="Notifications"
          onPress={() => {/* TODO */}}
        />
        <SettingItem
          icon="language"
          title="Language"
          onPress={() => {/* TODO */}}
        />
        <SettingItem
          icon="moon-o"
          title="Dark Mode"
          onPress={() => {/* TODO */}}
        />
        <SettingItem
          icon="lock"
          title="Privacy"
          onPress={() => {/* TODO */}}
        />
        <SettingItem
          icon="question-circle"
          title="Help"
          onPress={() => {/* TODO */}}
        />
        <SettingItem
          icon="sign-out"
          title="Sign Out"
          onPress={async () => {
            const isWeb = typeof window !== 'undefined' && (window as any).document != null
            if (isWeb) {
              const ok = window.confirm('Are you sure you want to sign out?')
              if (!ok) return
              try {
                await signOut()
              } catch (e) {
                window.alert('Sign out failed. Please try again.')
              }
            } else {
              Alert.alert('Sign out', 'Are you sure you want to sign out?', [
                { text: 'Cancel', style: 'cancel' },
                {
                  text: 'Sign Out',
                  style: 'destructive',
                  onPress: async () => {
                    try {
                      await signOut()
                    } catch (e) {
                      Alert.alert('Error', 'Sign out failed. Please try again.')
                    }
                  },
                },
              ])
            }
          }}
        />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    paddingVertical: 16,
    paddingBottom: 90,
  },
  header: {
    alignItems: 'center',
    padding: 24,
    marginHorizontal: 16,
    borderRadius: 16,
  },
  avatarContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  avatarText: {
    color: '#fff',
    fontSize: 32,
    fontWeight: '600',
  },
  name: {
    fontSize: 24,
    fontWeight: '600',
    marginBottom: 4,
  },
  email: {
    fontSize: 16,
  },
  section: {
    marginTop: 24,
    paddingHorizontal: 16,
  },
  settingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 16,
    borderBottomWidth: 1,
  },
  settingContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  settingIcon: {
    marginRight: 12,
    width: 24,
  },
  settingText: {
    fontSize: 16,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
  },
});