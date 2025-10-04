import EditEventModal from '@/components/edit-event-modal';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { deleteEvent, getEventById, updateEvent } from '@/services/events';
import { FontAwesome } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Image, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

export default function EventDetailsScreen() {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  
  const [event, setEvent] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [updating, setUpdating] = useState(false);

  const fetchEvent = async () => {
    try {
      setLoading(true);
      setError(null);
      const eventData = await getEventById(String(id));
      setEvent(eventData);
    } catch (err: any) {
      console.error('Failed to fetch event:', err);
      setError(err?.message || 'Failed to load event');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (id) {
      fetchEvent();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const handleUpdateEvent = async (updatedData: any) => {
    try {
      setUpdating(true);
      await updateEvent(id, updatedData);
      Alert.alert('Success', 'Event updated successfully!');
      setShowEditModal(false);
      // Refresh event data
      await fetchEvent();
    } catch (err: any) {
      console.error('Failed to update event:', err);
      Alert.alert('Error', err?.message || 'Failed to update event');
    } finally {
      setUpdating(false);
    }
  };

  const handleDeleteEvent = async () => {
    console.log('Delete button clicked, event ID:', id);
    
    if (!id) {
      Alert.alert('Error', 'Event ID is missing');
      return;
    }

    Alert.alert(
      'Delete Event',
      'Are you sure you want to delete this event? This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              console.log('Attempting to delete event with ID:', id);
              setUpdating(true);
              
              await deleteEvent(String(id));
              console.log('Event deleted from Supabase');

              Alert.alert(
                'Success',
                'Event deleted successfully!',
                [
                  {
                    text: 'OK',
                    onPress: () => {
                      console.log('Navigating back to events list');
                      router.dismissTo('/(tabs)/events');
                    },
                  },
                ],
                { cancelable: false }
              );
            } catch (err: any) {
              console.error('Failed to delete event. Full error:', err);
              console.error('Error message:', err?.message);
              console.error('Error stack:', err?.stack);

              const errorMessage = err?.message || err?.toString() || 'Failed to delete event';
              Alert.alert('Error', `Could not delete event: ${errorMessage}`);
            } finally {
              setUpdating(false);
            }
          },
        },
      ]
    );
  };

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
            style={[styles.button, { backgroundColor: colors.primary, opacity: updating ? 0.6 : 1 }]}
            onPress={() => {
              console.log('Edit button pressed');
              setShowEditModal(true);
            }}
            disabled={updating}
            activeOpacity={0.7}>
            <FontAwesome name="edit" size={20} color="#fff" style={styles.buttonIcon} />
            <Text style={styles.buttonText}>{updating ? 'Updating...' : 'Edit Event'}</Text>
          </TouchableOpacity>
          
          <TouchableOpacity
            style={[styles.button, { backgroundColor: '#e74c3c', opacity: updating ? 0.6 : 1 }]}
            onPress={() => {
              console.log('=== DELETE BUTTON PRESSED ===');
              console.log('Event ID:', id);
              console.log('Updating state:', updating);
              handleDeleteEvent();
            }}
            disabled={updating}
            activeOpacity={0.7}
            testID="delete-button">
            <FontAwesome name="trash" size={20} color="#fff" style={styles.buttonIcon} />
            <Text style={styles.buttonText}>{updating ? 'Deleting...' : 'Delete'}</Text>
          </TouchableOpacity>
        </View>
      </View>

      <EditEventModal
        visible={showEditModal}
        onClose={() => setShowEditModal(false)}
        onUpdate={handleUpdateEvent}
        initialData={event}
      />
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
  deleteButton: {
    backgroundColor: '#e74c3c',
  },
});