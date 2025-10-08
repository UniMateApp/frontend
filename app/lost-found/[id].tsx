import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { deleteLostFoundItem, getLostFoundItemById, resolveLostFoundItem } from '@/services/lostFound';
import { addLostFoundToWishlist, isLostFoundInWishlist, removeItemFromWishlist } from '@/services/selectiveWishlist';
import { FontAwesome } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useLayoutEffect, useState } from 'react';
import { ActivityIndicator, Alert, Image, Platform, ScrollView, Share, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

// Default image for lost and found items
const DEFAULT_LOST_FOUND_IMAGE = require('@/assets/images/icon.png');

export default function LostFoundDetailsScreen() {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const navigation = useNavigation();
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  
  const [item, setItem] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [updating, setUpdating] = useState(false);
  const [isInWishlist, setIsInWishlist] = useState(false);
  const [wishlistLoading, setWishlistLoading] = useState(false);
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);

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
        console.warn('Could not check wishlist status:', wishlistErr);
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
      console.error('Error toggling wishlist:', error);
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

  const handleResolve = async () => {
    Alert.alert(
      'Mark as Resolved',
      'Are you sure you want to mark this item as resolved?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Resolve',
          style: 'default',
          onPress: async () => {
            try {
              setUpdating(true);
              await resolveLostFoundItem(String(id));
              await fetchItem(); // Refresh the item
            } catch (error: any) {
              console.error('Error resolving item:', error);
              Alert.alert('Error', error.message || 'Failed to resolve item');
            } finally {
              setUpdating(false);
            }
          },
        },
      ]
    );
  };

  const handleDelete = async () => {
    Alert.alert(
      'Delete Item',
      'Are you sure you want to delete this item? This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              setUpdating(true);
              await deleteLostFoundItem(String(id));
              router.back();
            } catch (error: any) {
              console.error('Error deleting item:', error);
              Alert.alert('Error', error.message || 'Failed to delete item');
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
    <ScrollView style={[styles.container, { backgroundColor: colors.background }]} showsVerticalScrollIndicator={false}>
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
                {item.location}
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

        {/* Actions */}
        <View style={styles.actionsSection}>
          <TouchableOpacity 
            style={[styles.shareButton, { borderColor: colors.cardBorder }]} 
            onPress={handleShare}
          >
            <FontAwesome name="share-alt" size={16} color={colors.primary} />
            <Text style={[styles.shareText, { color: colors.primary }]}>Share</Text>
          </TouchableOpacity>

          {!item.is_resolved && (
            <TouchableOpacity 
              style={[styles.resolveButton, { borderColor: colors.primary }]} 
              onPress={handleResolve}
              disabled={updating}
            >
              {updating ? (
                <ActivityIndicator size="small" color={colors.primary} />
              ) : (
                <>
                  <FontAwesome name="check" size={16} color={colors.primary} />
                  <Text style={[styles.resolveButtonText, { color: colors.primary }]}>Resolve</Text>
                </>
              )}
            </TouchableOpacity>
          )}

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
                <Text style={[styles.deleteButtonText, { color: '#e74c3c' }]}>Delete</Text>
              </>
            )}
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