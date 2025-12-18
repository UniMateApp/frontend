import { Colors } from '@/constants/theme';
import { useUser } from '@/contexts/UserContext';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { getPlaceNameFromLatLng, parseLatLng } from '@/services/geocode';
import { FontAwesome } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { Alert, Image, ImageSourcePropType, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

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
  const router = useRouter();

  const handleWishlistToggle = async () => {
    try {
      await onWishlistToggle(String(item.id), isInWishlist);
    } catch (error: any) {
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

  const [placeName, setPlaceName] = useState<string | null>(null);
  const [loadingPlace, setLoadingPlace] = useState(true);

  useEffect(() => {
    let mounted = true;
    const coords = parseLatLng(item.location);
    if (!coords) {
      setLoadingPlace(false);
      return;
    }

    setLoadingPlace(true);
    (async () => {
      try {
        const name = await getPlaceNameFromLatLng(coords.latitude, coords.longitude);
        if (mounted) {
          setPlaceName(name);
          setLoadingPlace(false);
        }
      } catch (err) {
        console.warn('geocode: failed to resolve place name', err);
        if (mounted) {
          setPlaceName(null);
          setLoadingPlace(false);
        }
      }
    })();

    return () => { mounted = false; };
  }, [item.location]);

  const handleChatPress = () => {
    if (!item.created_by) {
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
                  {loadingPlace ? 'Loading location...' : placeName ? placeName : 'Location unavailable'}
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
            {!isOwner && (
              <TouchableOpacity
                style={[styles.resolveButton, { borderColor: colors.cardBorder }]}
                onPress={handleChatPress}
                activeOpacity={0.8}
              >
                <FontAwesome name="comments" size={14} color={colors.primary} style={styles.buttonIcon} />
                <Text style={[styles.resolveButtonText, { color: colors.primary }]}>Chat</Text>
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