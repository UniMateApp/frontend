import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { FontAwesome } from '@expo/vector-icons';
import { useLocalSearchParams } from 'expo-router';
import { Image, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

export default function EventDetailsScreen() {
  const { id } = useLocalSearchParams();
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];

  // TODO: Fetch event details using the id
  const event = {
    title: 'Tech Workshop: Mobile App Development',
    organizer: 'Computing Society',
    date: 'Oct 20, 2025',
    time: '2:00 PM - 5:00 PM',
    location: 'Lab Complex',
    description: 'Join us for an exciting workshop on mobile app development using React Native. Learn from industry experts and get hands-on experience building your first mobile app.',
    capacity: '50 seats',
    imageUrl: require('../../assets/images/icon.png'),
  };

  return (
    <ScrollView style={[styles.container, { backgroundColor: colors.background }]}>
    <Image
        source={{ uri: event.imageUrl ? String(event.imageUrl) : 'https://example.com/default.png' }}
        style={styles.image}
        />      
      <View style={styles.content}>
        <Text style={[styles.title, { color: colors.text }]}>{event.title}</Text>
        <Text style={[styles.organizer, { color: colors.textSecondary }]}>
          {event.organizer}
        </Text>

        <View style={styles.infoSection}>
          <View style={styles.infoItem}>
            <FontAwesome name="calendar" size={16} color={colors.icon} />
            <Text style={[styles.infoText, { color: colors.text }]}>
              {event.date}
            </Text>
          </View>
          <View style={styles.infoItem}>
            <FontAwesome name="clock-o" size={16} color={colors.icon} />
            <Text style={[styles.infoText, { color: colors.text }]}>
              {event.time}
            </Text>
          </View>
          <View style={styles.infoItem}>
            <FontAwesome name="map-marker" size={16} color={colors.icon} />
            <Text style={[styles.infoText, { color: colors.text }]}>
              {event.location}
            </Text>
          </View>
          <View style={styles.infoItem}>
            <FontAwesome name="users" size={16} color={colors.icon} />
            <Text style={[styles.infoText, { color: colors.text }]}>
              {event.capacity}
            </Text>
          </View>
        </View>

        <View style={styles.descriptionSection}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>
            About the Event
          </Text>
          <Text style={[styles.description, { color: colors.text }]}>
            {event.description}
          </Text>
        </View>

        <View style={styles.actions}>
          <TouchableOpacity
            style={[styles.button, { backgroundColor: colors.primary }]}
            onPress={() => {/* TODO: Add to wishlist */}}>
            <FontAwesome name="bookmark" size={20} color="#fff" style={styles.buttonIcon} />
            <Text style={styles.buttonText}>Add to Wishlist</Text>
          </TouchableOpacity>
          
          <TouchableOpacity
            style={[styles.button, { backgroundColor: colors.secondary }]}
            onPress={() => {/* TODO: Share event */}}>
            <FontAwesome name="share" size={20} color="#fff" style={styles.buttonIcon} />
            <Text style={styles.buttonText}>Share Event</Text>
          </TouchableOpacity>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  image: {
    width: '100%',
    height: 250,
  },
  content: {
    padding: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: '600',
    marginBottom: 8,
  },
  organizer: {
    fontSize: 16,
    marginBottom: 24,
  },
  infoSection: {
    marginBottom: 24,
  },
  infoItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  infoText: {
    fontSize: 16,
    marginLeft: 12,
  },
  descriptionSection: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 8,
  },
  description: {
    fontSize: 16,
    lineHeight: 24,
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  button: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    borderRadius: 12,
    marginHorizontal: 8,
  },
  buttonIcon: {
    marginRight: 8,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});