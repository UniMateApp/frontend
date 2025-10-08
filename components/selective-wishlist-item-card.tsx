import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { WishlistItem } from '@/services/selectiveWishlist';
import { FontAwesome } from '@expo/vector-icons';
import { router } from 'expo-router';
import React from 'react';
import {
    Alert,
    Image,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';

interface SelectiveWishlistItemCardProps {
  item: WishlistItem;
  onRemove: (wishlistItemId: string) => Promise<void>;
}

export default function SelectiveWishlistItemCard({
  item,
  onRemove,
}: SelectiveWishlistItemCardProps) {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];

  const handleRemove = () => {
    const isWeb = typeof window !== 'undefined' && (window as any).document != null;
    
    if (isWeb) {
      const confirmed = window.confirm(`Remove "${item.item_name}" from your wishlist?`);
      if (confirmed) {
        onRemove(item.id).catch((error) => {
          window.alert('Failed to remove item. Please try again.');
        });
      }
    } else {
      Alert.alert(
        'Remove Item',
        `Remove "${item.item_name}" from your wishlist?`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Remove',
            style: 'destructive',
            onPress: () => {
              onRemove(item.id).catch((error) => {
                Alert.alert('Error', 'Failed to remove item. Please try again.');
              });
            },
          },
        ]
      );
    }
  };

  const handleItemPress = () => {
    if (item.item_type === 'event') {
      router.push({
        pathname: '/event/[id]',
        params: { id: item.item_id }
      });
    } else if (item.item_type === 'lost_found') {
      // Navigate to lost-and-found detail page if it exists
      // For now, we'll just show an alert
      const isWeb = typeof window !== 'undefined' && (window as any).document != null;
      if (isWeb) {
        window.alert(`This is a ${item.item_type.replace('_', ' ')} item: ${item.item_name}`);
      } else {
        Alert.alert('Lost & Found Item', `${item.item_name}\n\n${item.item_description || 'No description available'}`);
      }
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const getItemTypeBadge = () => {
    const badgeStyle = item.item_type === 'event' 
      ? { backgroundColor: colors.primary }
      : { backgroundColor: '#ff9500' };
    
    const badgeText = item.item_type === 'event' ? 'Event' : 'Lost & Found';
    
    return (
      <View style={[styles.badge, badgeStyle]}>
        <Text style={styles.badgeText}>{badgeText}</Text>
      </View>
    );
  };

  return (
    <TouchableOpacity 
      style={[styles.container, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}
      onPress={handleItemPress}
      activeOpacity={0.7}>
      
      {item.item_image_url && (
        <Image
          source={{ uri: item.item_image_url }}
          style={styles.image}
          resizeMode="cover"
        />
      )}
      
      <View style={styles.content}>
        <View style={styles.header}>
          <View style={styles.titleContainer}>
            {getItemTypeBadge()}
            <Text style={[styles.title, { color: colors.text }]} numberOfLines={2}>
              {item.item_name}
            </Text>
            <Text style={[styles.date, { color: colors.textSecondary }]}>
              Added {formatDate(item.added_at)}
            </Text>
          </View>
          
          <TouchableOpacity
            onPress={handleRemove}
            style={[styles.removeButton, { backgroundColor: '#ff4444' }]}>
            <FontAwesome name="trash" size={16} color="#fff" />
          </TouchableOpacity>
        </View>
        
        {item.item_description && (
          <Text style={[styles.description, { color: colors.textSecondary }]} numberOfLines={3}>
            {item.item_description}
          </Text>
        )}
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 16,
    overflow: 'hidden',
  },
  image: {
    width: '100%',
    height: 160,
  },
  content: {
    padding: 16,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  titleContainer: {
    flex: 1,
    marginRight: 12,
  },
  badge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    marginBottom: 8,
  },
  badgeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 4,
  },
  date: {
    fontSize: 12,
  },
  removeButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  description: {
    fontSize: 14,
    lineHeight: 20,
  },
});