import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { FontAwesome } from '@expo/vector-icons';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

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
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.background }]}
      contentContainerStyle={styles.content}>
      <View style={[styles.header, { backgroundColor: colors.card }]}>
        <View style={[styles.avatarContainer, { backgroundColor: colors.primary }]}>
          <Text style={styles.avatarText}>SD</Text>
        </View>
        <Text style={[styles.name, { color: colors.text }]}>Sahan Dilip</Text>
        <Text style={[styles.email, { color: colors.textSecondary }]}>
          sahan.d@eng.pdn.ac.lk
        </Text>
      </View>

      <View style={styles.section}>
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
          onPress={() => {/* TODO */}}
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
});