import { Colors } from '@/constants/theme';
import { useUser } from '@/contexts/UserContext';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { FontAwesome } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Linking from 'expo-linking';
import React, { useEffect, useState } from 'react';
import { Alert, Image, ImageSourcePropType, Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

interface LostFoundItemProps {
  item: {
    id: string;
    item_name: string;
    description?: string;
    type?: 'lost' | 'found';
    kind?: 'lost' | 'found'; // Alternative field name
    location?: string;
    contact_info?: string;
    image_url?: string;
    images?: string[]; // Array of image URLs
    created_by?: string;
    created_at: string;
    updated_at: string;
    is_resolved?: boolean;
  };
  onResolve: (id: string) => void;
  onWishlistToggle: (id: string, isInWishlist: boolean) => Promise<void>;
  onPress?: () => void; // For opening detailed view
  isInWishlist: boolean;
}

// Default image for lost and found items
const DEFAULT_LOST_FOUND_IMAGE = require('@/assets/images/icon.png');

export default function LostFoundItemCard({
  item,
  onResolve,
  onWishlistToggle,
  onPress,
  isInWishlist,
}: LostFoundItemProps) {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const [showFullDescription, setShowFullDescription] = useState(false);
  const { user } = useUser();
  const isOwner = Boolean(user && item.created_by && String(user.id) === String(item.created_by));

  const handleWishlistToggle = async () => {
    try {
      await onWishlistToggle(String(item.id), isInWishlist);
    } catch (error: any) {
      console.error('Error toggling wishlist:', error);
      const isWeb = typeof window !== 'undefined' && (window as any).document != null;
      if (isWeb) {
        window.alert(error.message || 'Failed to update wishlist');
      } else {
        Alert.alert('Error', error.message || 'Failed to update wishlist');
      }
    }
  };

  const resolveImageSource = (): ImageSourcePropType => {
    if (item.image_url) {
      return { uri: item.image_url };
    }
    // Use default icon image for all cases
    return DEFAULT_LOST_FOUND_IMAGE;
  };

  const parseLatLng = (loc?: string) => {
    if (!loc) return null;
    const parts = String(loc).split(',').map(s => s.trim());
    if (parts.length < 2) return null;
    const lat = Number(parts[0]);
    const lng = Number(parts[1]);
    if (Number.isFinite(lat) && Number.isFinite(lng)) return { latitude: lat, longitude: lng };
    return null;
  };

  // Reverse geocoding: use a small in-memory cache plus AsyncStorage so results persist
  const geocodeCache = (global as any).__UM_GeocodeCache ||= new Map<string, string | null>();
  const [placeName, setPlaceName] = useState<string | null>(null);
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
          // stored value not JSON - fall back
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

  useEffect(() => {
    let mounted = true;
    const coords = parseLatLng(item.location);
    if (!coords) return;
    const key = `${coords.latitude},${coords.longitude}`;

    (async () => {
      const cached = await getCachedPlaceAsync(key);
      if (cached !== null) {
        if (mounted) setPlaceName(cached);
        return;
      }

      const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${coords.latitude}&lon=${coords.longitude}&accept-language=en`;
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
  }, [item.location]);

  const handleGetDirections = async () => {
    if (isOwner) return;
    const dest = parseLatLng(item.location);
    if (!dest) {
      Alert.alert('Location not available', 'This post does not have a valid location.');
      return;
    }

    // Open directions using destination only; the maps app will use current location as origin.
    const destStr = `${dest.latitude},${dest.longitude}`;
    const iosUrl = `http://maps.apple.com/?daddr=${destStr}`;
    const googleUrl = `https://www.google.com/maps/dir/?api=1&destination=${destStr}&travelmode=driving`;
    const url = (Platform.OS === 'ios') ? iosUrl : googleUrl;

    try {
      await Linking.openURL(url);
    } catch (err) {
      try {
        await Linking.openURL(googleUrl);
      } catch (e) {
        Alert.alert('Could not open maps', 'Unable to open maps on this device.');
      }
    }
  };

  const getDisplayDescription = () => {
    if (!item.description) return '';
    if (showFullDescription || item.description.length <= 100) {
      return item.description;
    }
    return item.description.substring(0, 100) + '...';
  };

  const shouldShowReadMore = () => {
    return item.description && item.description.length > 100;
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.card, borderColor: colors.cardBorder, shadowColor: colors.shadow }]}>
      <TouchableOpacity activeOpacity={0.95} onPress={onPress}>
        {/* Image section */}
        <View style={styles.imageContainer}>
          <Image 
            source={resolveImageSource()} 
            style={styles.image} 
            resizeMode="cover" 
          />
          <View style={[styles.typeBadge, {
            backgroundColor: (item.type || item.kind) === 'lost' ? '#d9534f' : '#5cb85c',
          }]}>
            <Text style={styles.typeBadgeText}>
              {(item.type || item.kind) === 'lost' ? 'Lost' : 'Found'}
            </Text>
          </View>
        </View>

        <View style={styles.content}>
          {/* Header with title and heart icon */}
          <View style={styles.header}>
            <Text style={[styles.title, { color: colors.text }]} numberOfLines={2}>
              {item.item_name}
            </Text>
            
            <TouchableOpacity
              onPress={handleWishlistToggle}
              style={[
                styles.heartButton,
                { 
                  backgroundColor: isInWishlist ? colors.primary : 'transparent',
                }
              ]}
              accessibilityLabel={isInWishlist ? 'Remove from wishlist' : 'Add to wishlist'}
              activeOpacity={0.8}>
              <FontAwesome 
                name={isInWishlist ? 'heart' : 'heart-o'} 
                size={20} 
                color={isInWishlist ? '#fff' : colors.primary} 
              />
            </TouchableOpacity>
          </View>

          {/* Description with read more/less */}
          {item.description && (
            <View style={styles.descriptionContainer}>
              <Text style={[styles.description, { color: colors.textSecondary }]}>
                {getDisplayDescription()}
              </Text>
              {shouldShowReadMore() && (
                <TouchableOpacity 
                  onPress={() => setShowFullDescription(!showFullDescription)}
                  style={styles.readMoreButton}
                >
                  <Text style={[styles.readMoreText, { color: colors.primary }]}>
                    {showFullDescription ? 'Read Less' : 'Read More'}
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          )}

          {/* Meta information */}
          <View style={styles.metaRow}>
            <View style={styles.metaItem}>
              <FontAwesome name="calendar" size={12} color={colors.icon} />
              <Text style={[styles.metaText, { color: colors.textSecondary }]}>
                {new Date(item.created_at).toLocaleDateString()}
              </Text>
            </View>
            
            {item.location && (
              <View style={styles.metaItem}>
                <FontAwesome name="map-marker" size={12} color={colors.icon} />
                <Text style={[styles.metaText, { color: colors.textSecondary }]}>
                  {placeName ? `near ${placeName}` : item.location}
                </Text>
              </View>
            )}
          </View>

          {/* Contact info if available */}
          {item.contact_info && (
            <View style={styles.contactRow}>
              <FontAwesome name="phone" size={12} color={colors.icon} />
              <Text style={[styles.contactText, { color: colors.textSecondary }]}>
                {item.contact_info}
              </Text>
            </View>
          )}

          {/* Status indicator */}
          {/* {item.is_resolved && (
            <View style={styles.resolvedBanner}>
              <FontAwesome name="check-circle" size={16} color="#5cb85c" />
              <Text style={[styles.resolvedText, { color: '#5cb85c' }]}>Resolved</Text>
            </View>
          )} */}

          {/* Action buttons */}
          <View style={styles.actionsRow}>
            <TouchableOpacity 
              style={[styles.shareButton, { borderColor: colors.cardBorder }]} 
              onPress={onPress}
              activeOpacity={0.8}>
              <FontAwesome name="eye" size={14} color={colors.primary} style={styles.buttonIcon} />
              <Text style={[styles.shareButtonText, { color: colors.primary }]}>Details</Text>
            </TouchableOpacity>
            {!isOwner && item.location && (
              <TouchableOpacity
                style={[styles.resolveButton, { borderColor: colors.cardBorder }]}
                onPress={handleGetDirections}
                activeOpacity={0.8}
              >
                <FontAwesome name="location-arrow" size={14} color={colors.primary} style={styles.buttonIcon} />
                <Text style={[styles.resolveButtonText, { color: colors.primary }]}>Directions</Text>
              </TouchableOpacity>
            )}
            
              {/* Single-delete button: visually Delete but marks item as resolved in DB */}
              {/* Only the creator of the post may mark it resolved. Hide the button for others. */}
              {!item.is_resolved && isOwner && (
                <TouchableOpacity
                  style={[styles.deleteButton, { borderColor: '#e74c3c' }]}
                  onPress={() =>
                    Alert.alert('Mark as Resolved', 'This will mark the item as resolved (it will be hidden). Continue?', [
                      { text: 'Cancel', style: 'cancel' },
                      { text: 'Mark Resolved', style: 'destructive', onPress: () => onResolve(item.id) },
                    ])
                  }
                  activeOpacity={0.8}>
                  <FontAwesome name="trash-o" size={14} color="#e74c3c" style={styles.buttonIcon} />
                  <Text style={[styles.deleteButtonText, { color: '#e74c3c' }]}>Mark Resolved</Text>
                </TouchableOpacity>
              )}
          </View>
        </View>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginHorizontal: 16,
    marginVertical: 8,
    borderRadius: 16,
    borderWidth: 1,
    overflow: 'hidden',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,  
    shadowRadius: 8,
    elevation: 3,
  },
  imageContainer: {
    position: 'relative',
  },
  image: {
    height: 160,
    width: '100%',
  },
  content: {
    padding: 16,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  titleSection: {
    flex: 1,
    marginRight: 12,
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    lineHeight: 24,
    marginBottom: 6,
  },
  typeBadge: {
    position: 'absolute',
    left: 12,
    top: 12,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  typeBadgeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  heartButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'transparent',
  },
  descriptionContainer: {
    marginBottom: 12,
  },
  description: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 4,
  },
  readMoreButton: {
    alignSelf: 'flex-start',
  },
  readMoreText: {
    fontSize: 14,
    fontWeight: '600',
  },
  metaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 8,
    gap: 16,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  metaText: {
    fontSize: 12,
  },
  contactRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 12,
  },
  contactText: {
    fontSize: 14,
  },
  resolvedBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 12,
    padding: 8,
    backgroundColor: '#f0f9f0',
    borderRadius: 8,
    borderLeftWidth: 3,
    borderLeftColor: '#5cb85c',
  },
  resolvedText: {
    fontSize: 14,
    fontWeight: '600',
  },
  actionsRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 16,
  },
  shareButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 6,
    borderWidth: 1,
    flex: 1,
    justifyContent: 'center',
  },
  shareButtonText: {
    fontSize: 12,
    fontWeight: '600',
  },
  resolveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 6,
    borderWidth: 1,
    flex: 1,
    justifyContent: 'center',
  },
  resolveButtonText: {
    fontSize: 12,
    fontWeight: '600',
  },
  deleteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 6,
    borderWidth: 1,
    flex: 1,
    justifyContent: 'center',
  },
  deleteButtonText: {
    fontSize: 12,
    fontWeight: '600',
  },
  buttonIcon: {
    marginRight: 4,
  },
});