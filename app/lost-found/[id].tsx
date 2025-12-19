import { Colors } from '@/constants/theme';
import { useUser } from '@/contexts/UserContext';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { getLostFoundItemById, resolveLostFoundItem } from '@/services/lostFound';
import { addLostFoundToWishlist, isLostFoundInWishlist, removeItemFromWishlist } from '@/services/selectiveWishlist';
import { FontAwesome } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useNavigation } from '@react-navigation/native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useLayoutEffect, useState } from 'react';
import { ActivityIndicator, Alert, Image, Platform, ScrollView, Share, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import MapView, { Marker, PROVIDER_GOOGLE } from 'react-native-maps';

// Default image for lost and found items
const DEFAULT_LOST_FOUND_IMAGE = require('@/assets/images/icon.png');

// ========================================
// LOST AND FOUND DETAIL SCREEN
// ========================================
// This screen displays full details of a single lost/found item:
// 1. Load item details from database by ID
// 2. Display images in carousel
// 3. Show location on map with reverse geocoding (coordinates -> place name)
// 4. Allow owner to resolve/delete item
// 5. Allow users to add/remove from wishlist
// 6. Enable sharing and chatting with poster
// ========================================

export default function LostFoundDetailsScreen() {
  const { id } = useLocalSearchParams(); // Get item ID from route params
  const router = useRouter();
  const navigation = useNavigation();
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  
  // STEP 1: STATE MANAGEMENT
  const [item, setItem] = useState<any>(null); // The lost/found item data
  const [loading, setLoading] = useState(true); // Initial loading state
  const [error, setError] = useState<string | null>(null); // Error message if load fails
  const [updating, setUpdating] = useState(false); // Update operation in progress
  const [isInWishlist, setIsInWishlist] = useState(false); // Is this item in user's wishlist?
  const [wishlistLoading, setWishlistLoading] = useState(false); // Wishlist operation in progress
  const [selectedImageIndex, setSelectedImageIndex] = useState(0); // Current image in carousel
  const { user } = useUser(); // Current logged-in user
  const isOwner = Boolean(user && item && item.created_by && String(user.id) === String(item.created_by)); // Is current user the owner?
  const [placeName, setPlaceName] = useState<string | null>(null); // Human-readable place name from coordinates

  // simple shared cache for geocoding results + AsyncStorage persistence
  const geocodeCache = (global as any).__UM_GeocodeCache ||= new Map<string, string | null>();
  const ASYNC_PREFIX = 'um:geocode:';

  const getCachedPlaceAsync = async (key: string) => {
    try {
      if (geocodeCache.has(key)) return geocodeCache.get(key) ?? null;
      const raw = await AsyncStorage.getItem(ASYNC_PREFIX + key);
      if (raw != null) {
        try {
          const parsed = JSON.parse(raw);
          geocodeCache.set(key, parsed);
          return parsed;
        } catch (e) {
          geocodeCache.set(key, raw);
          return raw;
        }
      }
      return null;
    } catch (e) {
      console.warn('AsyncStorage read failed for geocode', e);
      return null;
    }
  };

  const setCachedPlaceAsync = async (key: string, value: string | null) => {
    try {
      geocodeCache.set(key, value);
      await AsyncStorage.setItem(ASYNC_PREFIX + key, JSON.stringify(value));
    } catch (e) {
      console.warn('AsyncStorage write failed for geocode', e);
    }
  };

  // reverse geocode when item is loaded
  useEffect(() => {
    let mounted = true;
    if (!item?.location) return;
    const parts = String(item.location).split(',').map((s: string) => s.trim());
    if (parts.length < 2) return;
    const lat = Number(parts[0]);
    const lon = Number(parts[1]);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) return;
    const key = `${lat},${lon}`;

    (async () => {
      const cached = await getCachedPlaceAsync(key);
      if (cached !== null) {
        if (mounted) setPlaceName(cached);
        return;
      }

      const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lon}&accept-language=en`;
      const headers: Record<string,string> = {
        'Content-Type': 'application/json',
        // Replace with your app/contact info in production
        'User-Agent': 'Uni_Mate/1.0 (+https://your-app.example)',
        'Referer': 'https://your-app.example'
      };

      let attempt = 0;
      const maxAttempts = 3;
      const backoff = (n: number) => new Promise(res => setTimeout(res, 200 * n));

      while (attempt < maxAttempts) {
        try {
          const res = await fetch(url, { headers });
          if (!res.ok) {
            attempt++;
            if (attempt >= maxAttempts) throw new Error(`Geocode request failed: ${res.status}`);
            await backoff(attempt);
            continue;
          }
          const data = await res.json();
          const name = data?.name || data?.display_name || null;
          await setCachedPlaceAsync(key, name);
          console.debug && console.debug(`Geocode success: ${key} -> ${name}`);
          if (mounted) setPlaceName(name);
          return;
        } catch (err) {
          attempt++;
          if (attempt >= maxAttempts) {
            console.warn('Reverse geocode failed', err);
            await setCachedPlaceAsync(key, null);
            console.debug && console.debug(`Geocode failed: ${key} -> null (${String(err)})`);
            if (mounted) setPlaceName(null);
            return;
          }
          await backoff(attempt);
        }
      }
    })();

    return () => { mounted = false; };
  }, [item?.location]);

  const fetchItem = async () => {
    try {
      setLoading(true);
      setError(null);
      const itemData = await getLostFoundItemById(String(id));
      setItem(itemData);
      
      // Check if item is in wishlist
      try {
        const wishlistStatus = await isLostFoundInWishlist(String(id));
        setIsInWishlist(wishlistStatus);
      } catch (wishlistErr) {
        setIsInWishlist(false);
      }
    } catch (err: any) {
      console.error('Failed to fetch lost-found item:', err);
      setError(err?.message || 'Failed to load item');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (id) {
      fetchItem();
    }
  }, [id]);

  // Set navigation header title based on item type
  useLayoutEffect(() => {
    if (item) {
      // Set the header title based on the item type (check both 'type' and 'kind' fields)
      const itemType = item.type || item.kind;
      const headerTitle = itemType === 'lost' ? 'Lost Item Details' : 'Found Item Details';
      navigation.setOptions({
        title: headerTitle,
      });
    }
  }, [item, navigation]);

  const handleWishlistToggle = async () => {
    try {
      setWishlistLoading(true);
      
      if (isInWishlist) {
        await removeItemFromWishlist('lost_found', String(id));
        setIsInWishlist(false);
      } else {
        await addLostFoundToWishlist(String(id));
        setIsInWishlist(true);
      }
    } catch (error: any) {
      const isWeb = typeof window !== 'undefined' && (window as any).document != null;
      const message = error.message || 'Failed to update wishlist';
      
      if (isWeb) {
        window.alert(message);
      } else {
        Alert.alert('Error', message);
      }
    } finally {
      setWishlistLoading(false);
    }
  };

  // Removed separate "Resolve" action: Delete will now mark item as resolved.

  const handleDelete = async () => {
    // Act like "resolve": mark the item as resolved (hidden) instead of permanently deleting
    Alert.alert(
      'Mark as Resolved',
      'This will mark the item as resolved (it will be hidden). Continue?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Mark Resolved',
          style: 'destructive',
          onPress: async () => {
            try {
              setUpdating(true);
              await resolveLostFoundItem(String(id));
              // After resolving, go back to the previous screen
              router.back();
            } catch (error: any) {
              console.error('Error marking item resolved:', error);
              Alert.alert('Error', error.message || 'Failed to mark item as resolved');
              setUpdating(false);
            }
          },
        },
      ]
    );
  };

  const handleShare = async () => {
    try {
      const shareContent = {
        message: `Check out this ${item.type} item: ${item.item_name}\n\n${item.description || ''}\n\nLocation: ${item.location || 'Not specified'}\n\nContact: ${item.contact_info || 'See app for details'}`,
        title: `${item.type === 'lost' ? 'Lost' : 'Found'}: ${item.item_name}`,
      };

      if (Platform.OS === 'web') {
        if (navigator.share) {
          await navigator.share({
            title: shareContent.title,
            text: shareContent.message,
          });
        } else {
          navigator.clipboard.writeText(shareContent.message);
          Alert.alert('Copied!', 'Item details copied to clipboard');
        }
      } else {
        await Share.share(shareContent);
      }
    } catch (error) {
      console.error('Error sharing:', error);
    }
  };

  const handleChatWithPublisher = () => {
    if (!item?.created_by) {
      Alert.alert('Unavailable', 'Publisher information is missing for this post.');
      return;
    }
    if (!user?.id) {
      Alert.alert('Sign in required', 'Please sign in to chat with the publisher.');
      return;
    }
    if (String(user.id) === String(item.created_by)) return;
    router.push({ pathname: '/chat/[otherUserId]', params: { otherUserId: String(item.created_by) } });
  };

  const getImages = () => {
    const images = [];
    
    // Add main image
    if (item?.image_url) {
      images.push({ uri: item.image_url });
    }
    
    // Add additional images
    if (item?.images && Array.isArray(item.images)) {
      item.images.forEach((imageUrl: string) => {
        if (imageUrl && imageUrl !== item.image_url) {
          images.push({ uri: imageUrl });
        }
      });
    }
    
    // If no custom images, use default icon image
    if (images.length === 0) {
      images.push(DEFAULT_LOST_FOUND_IMAGE);
    }
    
    return images;
  };

  if (loading) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={[styles.loadingText, { color: colors.textSecondary }]}>Loading item details...</Text>
      </View>
    );
  }

  if (error || !item) {
    return (
      <View style={[styles.errorContainer, { backgroundColor: colors.background }]}>
        <FontAwesome name="exclamation-circle" size={50} color={colors.textSecondary} />
        <Text style={[styles.errorText, { color: colors.text }]}>{error || 'Item not found'}</Text>
        <TouchableOpacity 
          style={[styles.retryButton, { backgroundColor: colors.primary }]} 
          onPress={fetchItem}
        >
          <Text style={styles.retryButtonText}>Try Again</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const images = getImages();

  return (
    <ScrollView style={[styles.container, { backgroundColor: colors.background }]} contentContainerStyle={{ paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
      {/* Image Gallery */}
      <View style={styles.imageContainer}>
        <Image 
          source={images[selectedImageIndex]} 
          style={styles.mainImage} 
          resizeMode="cover"
        />
        
        {/* Type Badge */}
        <View style={[styles.typeBadge, {
          backgroundColor: (item.type || item.kind) === 'lost' ? '#d9534f' : '#5cb85c',
        }]}>
          <Text style={styles.typeBadgeText}>
            {(item.type || item.kind) === 'lost' ? 'Lost' : 'Found'}
          </Text>
        </View>

        {/* Image Navigation */}
        {images.length > 1 && (
          <View style={styles.imageNavigation}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.thumbnailContainer}>
              {images.map((image, index) => (
                <TouchableOpacity
                  key={index}
                  onPress={() => setSelectedImageIndex(index)}
                  style={[
                    styles.thumbnail,
                    selectedImageIndex === index && styles.selectedThumbnail,
                  ]}
                >
                  <Image source={image} style={styles.thumbnailImage} resizeMode="cover" />
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        )}

        {/* Resolved Banner */}
        {item.is_resolved && (
          <View style={styles.resolvedOverlay}>
            <View style={styles.resolvedBanner}>
              <FontAwesome name="check-circle" size={24} color="#fff" />
              <Text style={styles.resolvedText}>RESOLVED</Text>
            </View>
          </View>
        )}
      </View>

      {/* Content */}
      <View style={styles.content}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.titleSection}>
            <Text style={[styles.title, { color: colors.text }]}>{item.item_name}</Text>
          </View>
          
          <TouchableOpacity
            onPress={handleWishlistToggle}
            disabled={wishlistLoading}
            style={[
              styles.heartButton,
              { 
                backgroundColor: isInWishlist ? colors.primary : 'transparent',
                borderColor: colors.primary,
              }
            ]}
            accessibilityLabel={isInWishlist ? 'Remove from wishlist' : 'Add to wishlist'}
          >
            {wishlistLoading ? (
              <ActivityIndicator size="small" color={isInWishlist ? '#fff' : colors.primary} />
            ) : (
              <FontAwesome 
                name={isInWishlist ? 'heart' : 'heart-o'} 
                size={20} 
                color={isInWishlist ? '#fff' : colors.primary} 
              />
            )}
          </TouchableOpacity>
        </View>

        {/* Description */}
        {item.description && (
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Description</Text>
            <Text style={[styles.description, { color: colors.textSecondary }]}>
              {item.description}
            </Text>
          </View>
        )}

        {/* Details */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Details</Text>
          
          <View style={styles.detailRow}>
            <FontAwesome name="calendar" size={16} color={colors.icon} />
            <Text style={[styles.detailLabel, { color: colors.textSecondary }]}>Posted on:</Text>
            <Text style={[styles.detailValue, { color: colors.text }]}>
              {new Date(item.created_at).toLocaleDateString()}
            </Text>
          </View>

          {item.location && (
            <View style={styles.detailRow}>
              <FontAwesome name="map-marker" size={16} color={colors.icon} />
              <Text style={[styles.detailLabel, { color: colors.textSecondary }]}>Location:</Text>
              <Text style={[styles.detailValue, { color: colors.text }]}>
                {placeName ? `near ${placeName}` : item.location}
              </Text>
            </View>
          )}

          {item.contact_info && (
            <View style={styles.detailRow}>
              <FontAwesome name="phone" size={16} color={colors.icon} />
              <Text style={[styles.detailLabel, { color: colors.textSecondary }]}>Contact:</Text>
              <Text style={[styles.detailValue, { color: colors.text }]}>
                {item.contact_info}
              </Text>
            </View>
          )}
        </View>

        {/* Map View Section */}
        {item.location && (() => {
          const parts = String(item.location).split(',').map((s: string) => s.trim());
          if (parts.length >= 2) {
            const lat = Number(parts[0]);
            const lon = Number(parts[1]);
            if (Number.isFinite(lat) && Number.isFinite(lon)) {
              return (
                <View style={styles.section}>
                  <Text style={[styles.sectionTitle, { color: colors.text }]}>Location on Map</Text>
                  <View style={styles.mapContainer}>
                    <MapView
                      provider={PROVIDER_GOOGLE}
                      style={styles.map}
                      initialRegion={{
                        latitude: lat,
                        longitude: lon,
                        latitudeDelta: 0.01,
                        longitudeDelta: 0.01,
                      }}
                      scrollEnabled={true}
                      zoomEnabled={true}
                      pitchEnabled={false}
                      rotateEnabled={false}
                    >
                      <Marker
                        coordinate={{ latitude: lat, longitude: lon }}
                        title={item.item_name}
                        description={placeName || 'Item location'}
                      />
                    </MapView>
                  </View>
                </View>
              );
            }
          }
          return null;
        })()}

        {/* Actions */}
        <View style={styles.actionsSection}>
          <TouchableOpacity 
            style={[styles.shareButton, { borderColor: colors.cardBorder }]} 
            onPress={handleShare}
          >
            <FontAwesome name="share-alt" size={16} color={colors.primary} />
            <Text style={[styles.shareText, { color: colors.primary }]}>Share</Text>
          </TouchableOpacity>

          {!isOwner && (
            <TouchableOpacity
              style={[styles.resolveButton, { borderColor: colors.cardBorder }]}
              onPress={handleChatWithPublisher}
            >
              <FontAwesome name="comments" size={16} color={colors.primary} />
              <Text style={[styles.resolveButtonText, { color: colors.primary }]}>Chat</Text>
            </TouchableOpacity>
          )}

          {/* Resolve action removed: Delete now marks item as resolved */}

          {/* Only the creator may mark the post resolved */}
          {isOwner && (
            <TouchableOpacity 
              style={[styles.deleteButton, { borderColor: '#e74c3c' }]} 
              onPress={handleDelete}
              disabled={updating}
            >
              {updating ? (
                <ActivityIndicator size="small" color="#e74c3c" />
              ) : (
                <>
                  <FontAwesome name="trash-o" size={16} color="#e74c3c" />
                  <Text style={[styles.deleteButtonText, { color: '#e74c3c' }]}>Mark Resolved</Text>
                </>
              )}
            </TouchableOpacity>
          )}
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  errorText: {
    fontSize: 18,
    textAlign: 'center',
    marginVertical: 12,
  },
  retryButton: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
    marginTop: 12,
  },
  retryButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  imageContainer: {
    position: 'relative',
  },
  mainImage: {
    width: '100%',
    height: 300,
  },
  typeBadge: {
    position: 'absolute',
    left: 16,
    top: 16,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  typeBadgeText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  imageNavigation: {
    position: 'absolute',
    bottom: 16,
    left: 0,
    right: 0,
  },
  thumbnailContainer: {
    paddingHorizontal: 16,
  },
  thumbnail: {
    width: 60,
    height: 60,
    borderRadius: 8,
    marginRight: 8,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  selectedThumbnail: {
    borderColor: '#fff',
  },
  thumbnailImage: {
    width: '100%',
    height: '100%',
    borderRadius: 6,
  },
  resolvedOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  resolvedBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#5cb85c',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 25,
    gap: 8,
  },
  resolvedText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
  },
  content: {
    padding: 20,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 20,
  },
  titleSection: {
    flex: 1,
    marginRight: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    lineHeight: 32,
  },
  heartButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 12,
  },
  description: {
    fontSize: 16,
    lineHeight: 24,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    gap: 8,
  },
  detailLabel: {
    fontSize: 14,
    minWidth: 80,
  },
  detailValue: {
    fontSize: 14,
    flex: 1,
    fontWeight: '500',
  },
  mapContainer: {
    height: 250,
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.1)',
  },
  map: {
    flex: 1,
  },
  actionsSection: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 20,
  },
  shareButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 6,
    borderWidth: 1,
    gap: 6,
  },
  shareText: {
    fontSize: 14,
    fontWeight: '600',
  },
  resolveButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 6,
    borderWidth: 1,
    gap: 6,
  },
  resolveButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
  deleteButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 6,
    borderWidth: 1,
    gap: 6,
  },
  deleteButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
});