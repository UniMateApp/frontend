import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { getEventById } from '@/services/events';
import { FontAwesome } from '@expo/vector-icons';
import { useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Image, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

export default function EventDetailsScreen() {
  const { id } = useLocalSearchParams();
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  
  const [event, setEvent] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    
    const fetchEvent = async () => {
      try {
        setLoading(true);
        setError(null);
        const eventData = await getEventById(String(id));
        if (mounted) {
          setEvent(eventData);
        }
      } catch (err: any) {
        console.error('Failed to fetch event:', err);
        if (mounted) {
          setError(err?.message || 'Failed to load event');
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    if (id) {
      fetchEvent();
    }

    return () => {
      mounted = false;
    };
  }, [id]);

  if (loading) {
    return (
      <View style={[styles.container, styles.centerContent, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={[styles.loadingText, { color: colors.textSecondary }]}>Loading event...</Text>
      </View>
    );
  }

  if (error || !event) {
    return (
      <View style={[styles.container, styles.centerContent, { backgroundColor: colors.background }]}>
        <FontAwesome name="exclamation-circle" size={48} color={colors.textSecondary} />
        <Text style={[styles.errorText, { color: colors.text }]}>
          {error || 'Event not found'}
        </Text>
      </View>
    );
  }

  // Format date and time from database fields
  const formatDate = (dateStr: string) => {
    if (!dateStr) return 'TBD';
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  const formatTime = (dateStr: string) => {
    if (!dateStr) return 'TBD';
    const date = new Date(dateStr);
    return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
  };

  return (
    <ScrollView style={[styles.container, { backgroundColor: colors.background }]}>
      <Image
        source={event.image_url ? { uri: event.image_url } : require('../../assets/images/icon.png')}
        style={styles.image}
      />      
      <View style={styles.content}>
        <Text style={[styles.title, { color: colors.text }]}>{event.title || 'Untitled Event'}</Text>
        <Text style={[styles.organizer, { color: colors.textSecondary }]}>
          {event.organizer || 'Unknown Organizer'}
        </Text>

        <View style={styles.infoSection}>
          <View style={styles.infoItem}>
            <FontAwesome name="calendar" size={16} color={colors.icon} />
            <Text style={[styles.infoText, { color: colors.text }]}>
              {formatDate(event.start_at)}
            </Text>
          </View>
          <View style={styles.infoItem}>
            <FontAwesome name="clock-o" size={16} color={colors.icon} />
            <Text style={[styles.infoText, { color: colors.text }]}>
              {formatTime(event.start_at)}
            </Text>
          </View>
          <View style={styles.infoItem}>
            <FontAwesome name="map-marker" size={16} color={colors.icon} />
            <Text style={[styles.infoText, { color: colors.text }]}>
              {event.location || 'TBD'}
            </Text>
          </View>
          {event.price !== null && event.price !== undefined && (
            <View style={styles.infoItem}>
              <FontAwesome name="tag" size={16} color={colors.icon} />
              <Text style={[styles.infoText, { color: colors.text }]}>
                {event.price === 0 ? 'Free' : `$${event.price}`}
              </Text>
            </View>
          )}
          {event.category && (
            <View style={styles.infoItem}>
              <FontAwesome name="folder" size={16} color={colors.icon} />
              <Text style={[styles.infoText, { color: colors.text }]}>
                {event.category}
              </Text>
            </View>
          )}
        </View>

        <View style={styles.descriptionSection}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>
            About the Event
          </Text>
          <Text style={[styles.description, { color: colors.text }]}>
            {event.description || 'No description available.'}
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
  centerContent: {
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
  },
  errorText: {
    marginTop: 16,
    fontSize: 16,
    textAlign: 'center',
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