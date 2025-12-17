import EditEventModal from '@/components/edit-event-modal';
import { Colors } from '@/constants/theme';
import { useUser } from '@/contexts/UserContext';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { deleteEvent, getEventById, updateEvent } from '@/services/events';
import { getPlaceNameFromLatLng } from '@/services/geocode';
import { addEventToWishlist, isEventInWishlist, removeItemFromWishlist } from '@/services/selectiveWishlist';
import { FontAwesome } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Image, Linking, Platform, ScrollView, Share, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

export default function EventDetailsScreen() {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const { user } = useUser();
  
  const [event, setEvent] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [isInWishlist, setIsInWishlist] = useState(false);
  const [wishlistLoading, setWishlistLoading] = useState(false);
  const [geocodedLocation, setGeocodedLocation] = useState<string | null>(null);

  // Check if current user is the event owner
  const isOwner = Boolean(user && event?.created_by && String(user.id) === String(event.created_by));

  const fetchEvent = async () => {
    try {
      setLoading(true);
      setError(null);
      const eventData = await getEventById(String(id));
      setEvent(eventData);
      
      // Fetch location name from coordinates if available
      if (eventData?.latitude && eventData?.longitude && !eventData?.location_name) {
        const placeName = await getPlaceNameFromLatLng(eventData.latitude, eventData.longitude);
        if (placeName) {
          setGeocodedLocation(placeName);
        }
      }
      
      // Check if event is in wishlist
      try {
        const wishlistStatus = await isEventInWishlist(String(id));
        setIsInWishlist(wishlistStatus);
      } catch (wishlistErr) {
        console.warn('Could not check wishlist status:', wishlistErr);
        setIsInWishlist(false);
      }
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

  const handleWishlistToggle = async () => {
    if (!id) return;
    
    try {
      setWishlistLoading(true);
      
      if (isInWishlist) {
        await removeItemFromWishlist('event', String(id));
        setIsInWishlist(false);
        
        if (Platform.OS === 'web') {
          window.alert('Removed from wishlist!');
        } else {
          Alert.alert('Success', 'Removed from wishlist!');
        }
      } else {
        await addEventToWishlist(String(id));
        setIsInWishlist(true);
        
        if (Platform.OS === 'web') {
          window.alert('Added to wishlist!');
        } else {
          Alert.alert('Success', 'Added to wishlist!');
        }
      }
    } catch (error: any) {
      console.error('Error toggling wishlist:', error);
      const message = error.message || 'Failed to update wishlist';
      
      if (Platform.OS === 'web') {
        window.alert(`Error: ${message}`);
      } else {
        Alert.alert('Error', message);
      }
    } finally {
      setWishlistLoading(false);
    }
  };

  const handleShare = async () => {
    if (!event) return;
    
    try {
      const shareContent = {
        title: event.title || 'Check out this event!',
        message: `${event.title || 'Event'} by ${event.organizer || 'Unknown'}\n\n${event.description || 'No description available.'}\n\nDate: ${formatDate(event.start_at)}\nTime: ${formatTime(event.start_at)}\nLocation: ${event.location || 'TBD'}`,
        url: Platform.OS === 'web' ? window.location.href : undefined,
      };

      if (Platform.OS === 'web') {
        if (navigator.share) {
          await navigator.share(shareContent);
        } else {
          // Fallback for web browsers without native share
          await navigator.clipboard.writeText(shareContent.message);
          window.alert('Event details copied to clipboard!');
        }
      } else {
        await Share.share(shareContent);
      }
    } catch (error: any) {
      console.error('Error sharing:', error);
      if (error.name !== 'AbortError') { // User cancelled sharing
        const message = 'Failed to share event';
        if (Platform.OS === 'web') {
          window.alert(`Error: ${message}`);
        } else {
          Alert.alert('Error', message);
        }
      }
    }
  };

  const handleRSVP = () => {
    if (Platform.OS === 'web') {
      window.alert('RSVP functionality coming soon!');
    } else {
      Alert.alert('RSVP', 'RSVP functionality coming soon!');
    }
  };

  const handleDirections = async () => {
    // Try to get coordinates first, otherwise fallback to location name/address
    const latitude = event?.latitude;
    const longitude = event?.longitude;
    const locationName = event?.location_name || event?.location;
    const label = event?.title || 'Event Location';

    // If no coordinates and no location name, show error
    if (!latitude && !longitude && !locationName) {
      const message = 'Event location is not available. Please contact the organizer.';
      if (Platform.OS === 'web') {
        window.alert(message);
      } else {
        Alert.alert('Location Unavailable', message);
      }
      return;
    }

    try {
      if (Platform.OS === 'ios') {
        // iOS: Open Apple Maps
        let url;
        if (latitude && longitude) {
          // Use coordinates if available
          url = `maps://app?daddr=${latitude},${longitude}&q=${encodeURIComponent(label)}`;
        } else {
          // Use location name/address as search query
          url = `maps://app?q=${encodeURIComponent(locationName || label)}`;
        }
        
        const canOpen = await Linking.canOpenURL(url);
        if (canOpen) {
          await Linking.openURL(url);
        } else {
          // Fallback to Google Maps web
          if (latitude && longitude) {
            await Linking.openURL(`https://www.google.com/maps/dir/?api=1&destination=${latitude},${longitude}`);
          } else {
            await Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(locationName || label)}`);
          }
        }
      } else if (Platform.OS === 'android') {
        // Android: Open Google Maps
        let url;
        if (latitude && longitude) {
          // Use coordinates for navigation
          url = `google.navigation:q=${latitude},${longitude}`;
        } else {
          // Use location name for search
          url = `geo:0,0?q=${encodeURIComponent(locationName || label)}`;
        }
        
        const canOpen = await Linking.canOpenURL(url);
        if (canOpen) {
          await Linking.openURL(url);
        } else {
          // Fallback to Google Maps web
          if (latitude && longitude) {
            await Linking.openURL(`https://www.google.com/maps/dir/?api=1&destination=${latitude},${longitude}`);
          } else {
            await Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(locationName || label)}`);
          }
        }
      } else {
        // Web: Open Google Maps in new tab
        if (latitude && longitude) {
          window.open(`https://www.google.com/maps/dir/?api=1&destination=${latitude},${longitude}`, '_blank');
        } else {
          window.open(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(locationName || label)}`, '_blank');
        }
      }
    } catch (error) {
      console.error('Error opening directions:', error);
      const message = 'Failed to open directions. Please try again.';
      if (Platform.OS === 'web') {
        window.alert(message);
      } else {
        Alert.alert('Error', message);
      }
    }
  };

  const handleDeleteEvent = async () => {
    console.log('=== DELETE BUTTON PRESSED ===');
    console.log('Event ID:', id);

    if (!id) {
      if (Platform.OS === 'web') {
        window.alert('Error: Event ID is missing');
      } else {
        Alert.alert('Error', 'Event ID is missing');
      }
      return;
    }

    console.log('Updating state:', updating);
    console.log('Delete button clicked, event ID:', id);

    // 🧩 For Web (Alert is not supported natively)
    if (Platform.OS === 'web') {
      const confirmed = window.confirm('Are you sure you want to delete this event? This action cannot be undone.');
      if (!confirmed) {
        console.log('User cancelled deletion');
        return;
      }

      try {
        console.log('Attempting to delete event with ID:', id);
        setUpdating(true);

        await deleteEvent(String(id));
        console.log('Event deleted successfully (Supabase)');

        window.alert('Event deleted successfully!');
        console.log('Navigating back to events list');
        router.dismissTo('/(tabs)/events');
      } catch (err) {
        console.error('Failed to delete event:', err);
        const msg = err || 'Failed to delete event';
        window.alert(`Error: ${msg}`);
      } finally {
        setUpdating(false);
      }
      return; // stop here for web
    }

    // 📱 For Mobile (Android / iOS)
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
    <ScrollView style={[styles.container, { backgroundColor: colors.background }]} contentContainerStyle={{ paddingBottom: 40 }}>
      <View style={styles.imageContainer}>
        <Image
          source={event.image_url ? { uri: event.image_url } : require('../../assets/images/icon.png')}
          style={styles.image}
        />
        {/* Wishlist Heart Icon */}
        <TouchableOpacity 
          onPress={handleWishlistToggle}
          style={[styles.wishlistButton, { backgroundColor: colors.card, opacity: wishlistLoading ? 0.6 : 1 }]}
          disabled={wishlistLoading}
        >
          {wishlistLoading ? (
            <ActivityIndicator size="small" color={colors.primary} />
          ) : (
            <FontAwesome 
              name={isInWishlist ? 'heart' : 'heart-o'} 
              size={24} 
              color={isInWishlist ? colors.primary : colors.icon} 
            />
          )}
        </TouchableOpacity>
      </View>
      
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
              {event.location_name || geocodedLocation || event.location || 'TBD'}
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

        {/* Primary Action Buttons */}
        <View style={styles.primaryActions}>
          <TouchableOpacity
            style={[styles.primaryButton, styles.rsvpButton, { backgroundColor: colors.primary }]}
            onPress={handleRSVP}
            activeOpacity={0.8}
          >
            <FontAwesome name="calendar-check-o" size={20} color="#fff" style={styles.buttonIcon} />
            <Text style={styles.primaryButtonText}>RSVP for Event</Text>
          </TouchableOpacity>
          
          <TouchableOpacity
            style={[styles.primaryButton, styles.shareButton, { borderColor: colors.primary }]}
            onPress={handleShare}
            activeOpacity={0.8}
          >
            <FontAwesome name="share-alt" size={20} color={colors.primary} style={styles.buttonIcon} />
            <Text style={[styles.primaryButtonText, { color: colors.primary }]}>Share Event</Text>
          </TouchableOpacity>
        </View>

        {/* Directions Button - Only visible to non-owners */}
        {!isOwner && (
          <View style={styles.directionsContainer}>
            <TouchableOpacity
              style={[styles.directionsButton, { backgroundColor: colors.primary }]}
              onPress={handleDirections}
              activeOpacity={0.8}
            >
              <FontAwesome name="map-marker" size={20} color="#fff" style={styles.buttonIcon} />
              <Text style={styles.directionsButtonText}>Get Directions</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Admin Actions - Only visible to event owner */}
        {isOwner && (
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
        )}
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
  imageContainer: {
    position: 'relative',
  },
  image: {
    width: '100%',
    height: 250,
  },
  wishlistButton: {
    position: 'absolute',
    right: 16,
    top: 16,
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 3,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
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
  primaryActions: {
    marginBottom: 24,
    gap: 12,
  },
  primaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    borderRadius: 12,
  },
  rsvpButton: {
    // backgroundColor is set dynamically
  },
  shareButton: {
    backgroundColor: 'transparent',
    borderWidth: 2,
  },
  primaryButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  directionsContainer: {
    marginBottom: 24,
  },
  directionsButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    borderRadius: 12,
  },
  directionsButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
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