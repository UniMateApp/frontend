import { Colors } from '@/constants/theme';
import { useUser } from '@/contexts/UserContext';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { getPlaceNameFromLatLng } from '@/services/geocode';
import { FontAwesome } from '@expo/vector-icons';
import React, { useEffect, useState } from 'react';
import { Alert, Image, ImageSourcePropType, Linking, Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

interface EventCardProps {
  id?: string;
  title: string;
  category?: string;
  organizer: string;
  date: string;
  time?: string;
  location: string;
  locationName?: string;
  latitude?: number;
  longitude?: number;
  description?: string;
  registrationDeadline?: string;
  price?: string;
  /** Accept either a remote uri string or a local require(...) resource */
  imageUrl?: ImageSourcePropType | string | number;
  onPress: () => void;
  onBookmark: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
  onShare?: () => void;
  onLongPress?: () => void;
  isBookmarked?: boolean;
  createdBy?: string;
}

// Default image for events
const DEFAULT_EVENT_IMAGE = require('@/assets/images/icon.png');

export function EventCard({
  id,
  title,
  category,
  organizer,
  date,
  time,
  location,
  locationName,
  latitude,
  longitude,
  description,
  registrationDeadline,
  price,
  imageUrl,
  onPress,
  onBookmark,
  onEdit,
  onDelete,
  onShare,
  onLongPress,
  isBookmarked,
  createdBy,
}: EventCardProps) {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const { user } = useUser();
  const [showFullDescription, setShowFullDescription] = useState(false);
  const [geocodedLocation, setGeocodedLocation] = useState<string | null>(null);
  
  const isOwner = Boolean(user && createdBy && String(user.id) === String(createdBy));

  // Fetch location name from coordinates if available
  useEffect(() => {
    const fetchLocationName = async () => {
      if (latitude && longitude && !locationName) {
        const placeName = await getPlaceNameFromLatLng(latitude, longitude);
        if (placeName) {
          setGeocodedLocation(placeName);
        }
      }
    };
    fetchLocationName();
  }, [latitude, longitude, locationName]);

  const resolveImageSource = (): ImageSourcePropType => {
    if (imageUrl) {
      if (typeof imageUrl === 'number') return imageUrl as number;
      if (typeof imageUrl === 'object') return imageUrl as ImageSourcePropType;
      const src = String(imageUrl);
      return { uri: src };
    }
    return DEFAULT_EVENT_IMAGE;
  };

  const source = resolveImageSource();
  
  const getDisplayDescription = () => {
    if (!description) return '';
    if (showFullDescription || description.length <= 100) {
      return description;
    }
    return description.substring(0, 100) + '...';
  };

  const shouldShowReadMore = () => {
    return description && description.length > 100;
  };

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: colors.card,
          borderColor: colors.cardBorder,
          shadowColor: colors.shadow,
        },
      ]}
    >
      <TouchableOpacity activeOpacity={0.95} onPress={onPress} onLongPress={onLongPress}>
        {/* Image section */}
        <View style={styles.imageContainer}>
          <Image source={source} style={styles.image} resizeMode="cover" />
          {category && (
            <View style={[styles.categoryBadge, { backgroundColor: colors.primary }]}>
              <Text style={styles.categoryText}>{category}</Text>
            </View>
          )}
        </View>

        <View style={styles.content}>
          {/* Header with title and heart icon */}
          <View style={styles.header}>
            <Text style={[styles.title, { color: colors.text }]} numberOfLines={2}>
              {title}
            </Text>
            
            <TouchableOpacity
              onPress={onBookmark}
              style={[
                styles.heartButton,
                { 
                  backgroundColor: isBookmarked ? colors.primary : 'transparent',
                }
              ]}
              accessibilityLabel={isBookmarked ? 'Remove from wishlist' : 'Add to wishlist'}
              activeOpacity={0.8}>
              <FontAwesome 
                name={isBookmarked ? 'heart' : 'heart-o'} 
                size={20} 
                color={isBookmarked ? '#fff' : colors.primary} 
              />
            </TouchableOpacity>
          </View>

          <Text style={[styles.organizer, { color: colors.textSecondary }]}>by {organizer}</Text>

          {/* Description with read more/less */}
          {description && (
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
                {date}{time ? ` • ${time}` : ''}
              </Text>
            </View>

            <View style={styles.metaItem}>
              <FontAwesome name="map-marker" size={12} color={colors.icon} />
              <Text style={[styles.metaText, { color: colors.textSecondary }]} numberOfLines={1}>
                {locationName || geocodedLocation || location || 'Location TBD'}
              </Text>
            </View>
          </View>

          {/* Price display */}
          {price && (
            <View style={styles.metaRowSecondary}>
              <View style={[styles.pricePill, { borderColor: colors.cardBorder }]}>
                <Text style={[styles.priceText, { color: colors.text }]}>{price}</Text>
              </View>
            </View>
          )}

          {/* Action buttons */}
          <View style={styles.actionsRow}>
            {isOwner && (
              <>
                <TouchableOpacity
                  style={[styles.actionButton, { borderColor: colors.cardBorder }]}
                  onPress={onEdit}
                  activeOpacity={0.8}
                >
                  <FontAwesome name="edit" size={14} color={colors.primary} style={styles.buttonIcon} />
                  <Text style={[styles.actionButtonText, { color: colors.primary }]}>Edit</Text>
                </TouchableOpacity>
                
                <TouchableOpacity
                  style={[styles.actionButton, { borderColor: '#e74c3c' }]}
                  onPress={onDelete}
                  activeOpacity={0.8}
                >
                  <FontAwesome name="trash-o" size={14} color="#e74c3c" style={styles.buttonIcon} />
                  <Text style={[styles.actionButtonText, { color: '#e74c3c' }]}>Delete</Text>
                </TouchableOpacity>
              </>
            )}
            
            {!isOwner && (
              <TouchableOpacity
                style={[styles.actionButton, { backgroundColor: colors.primary }]}
                onPress={async () => {
                  const lat = latitude;
                  const lng = longitude;
                  const locName = locationName || location;
                  const label = title || 'Event Location';

                  if (!lat && !lng && !locName) {
                    const message = 'Event location is not available.';
                    if (Platform.OS === 'web') {
                      window.alert(message);
                    } else {
                      Alert.alert('Location Unavailable', message);
                    }
                    return;
                  }

                  try {
                    if (Platform.OS === 'ios') {
                      let url;
                      if (lat && lng) {
                        url = `maps://app?daddr=${lat},${lng}&q=${encodeURIComponent(label)}`;
                      } else {
                        url = `maps://app?q=${encodeURIComponent(locName || label)}`;
                      }
                      const canOpen = await Linking.canOpenURL(url);
                      if (canOpen) {
                        await Linking.openURL(url);
                      } else {
                        if (lat && lng) {
                          await Linking.openURL(`https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`);
                        } else {
                          await Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(locName || label)}`);
                        }
                      }
                    } else if (Platform.OS === 'android') {
                      let url;
                      if (lat && lng) {
                        url = `google.navigation:q=${lat},${lng}`;
                      } else {
                        url = `geo:0,0?q=${encodeURIComponent(locName || label)}`;
                      }
                      const canOpen = await Linking.canOpenURL(url);
                      if (canOpen) {
                        await Linking.openURL(url);
                      } else {
                        if (lat && lng) {
                          await Linking.openURL(`https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`);
                        } else {
                          await Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(locName || label)}`);
                        }
                      }
                    } else {
                      if (lat && lng) {
                        window.open(`https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`, '_blank');
                      } else {
                        window.open(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(locName || label)}`, '_blank');
                      }
                    }
                  } catch (error) {
                    console.error('Error opening directions:', error);
                  }
                }}
                activeOpacity={0.8}
              >
                <FontAwesome name="location-arrow" size={14} color="#fff" style={styles.buttonIcon} />
                <Text style={[styles.actionButtonText, { color: '#fff' }]}>Directions</Text>
              </TouchableOpacity>
            )}
            
            <TouchableOpacity 
              style={[styles.shareButton, { borderColor: colors.cardBorder }]} 
              onPress={onShare}
              activeOpacity={0.8}
            >
              <FontAwesome name="share-alt" size={14} color={colors.primary} style={styles.buttonIcon} />
              <Text style={[styles.shareButtonText, { color: colors.primary }]}>Share</Text>
            </TouchableOpacity>
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
    marginBottom: 6,
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    lineHeight: 24,
    flex: 1,
    marginRight: 12,
  },
  categoryBadge: {
    position: 'absolute',
    left: 12,
    top: 12,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  categoryText: {
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
  organizer: {
    fontSize: 14,
    marginBottom: 8,
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
  metaRowSecondary: {
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  smallMeta: {
    fontSize: 12,
  },
  participantsBadge: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  pricePill: {
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  priceText: {
    fontSize: 12,
    fontWeight: '600',
  },
  actionsRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 4,
  },
  participateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 6,
    flex: 1,
    justifyContent: 'center',
  },
  participateButtonText: {
    fontSize: 12,
    fontWeight: '600',
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 6,
    borderWidth: 1,
    flex: 1,
    justifyContent: 'center',
  },
  actionButtonText: {
    fontSize: 12,
    fontWeight: '600',
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
  buttonIcon: {
    marginRight: 4,
  },
});