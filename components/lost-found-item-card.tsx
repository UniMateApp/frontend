import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { FontAwesome } from '@expo/vector-icons';
import React from 'react';
import { Alert, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

interface LostFoundItemProps {
  item: {
    id: string;
    item_name: string;
    description?: string;
    type: 'lost' | 'found';
    location?: string;
    contact_info?: string;
    image_url?: string;
    created_by?: string;
    created_at: string;
    updated_at: string;
    is_resolved?: boolean;
  };
  onResolve: (id: string) => void;
  onDelete: (id: string) => void;
  onWishlistToggle: (id: string, isInWishlist: boolean) => Promise<void>;
  isInWishlist: boolean;
}

export default function LostFoundItemCard({
  item,
  onResolve,
  onDelete,
  onWishlistToggle,
  isInWishlist,
}: LostFoundItemProps) {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];

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

  return (
    <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
      <View style={styles.cardHeader}>
        <View style={styles.titleContainer}>
          <Text style={[styles.cardTitle, { color: colors.text }]}>{item.item_name}</Text>
          <Text
            style={[
              styles.typePill,
              {
                backgroundColor: item.type === 'lost' ? '#d9534f' : '#5cb85c',
                color: '#fff',
              },
            ]}>
            {item.type === 'lost' ? 'Lost' : 'Found'}
          </Text>
        </View>
        
        <TouchableOpacity
          onPress={handleWishlistToggle}
          style={[styles.wishlistButton, { backgroundColor: colors.card }]}
          accessibilityLabel={isInWishlist ? 'Remove from wishlist' : 'Add to wishlist'}>
          <FontAwesome 
            name={isInWishlist ? 'heart' : 'heart-o'} 
            size={18} 
            color={isInWishlist ? '#ff4444' : colors.icon} 
          />
        </TouchableOpacity>
      </View>

      {item.description ? (
        <Text style={[styles.cardDesc, { color: colors.textSecondary }]}>{item.description}</Text>
      ) : null}

      <View style={styles.cardFooter}>
        <Text style={{ color: colors.textSecondary }}>
          {new Date(item.created_at).toLocaleString()}
        </Text>
        <View style={{ flexDirection: 'row' }}>
          {item.contact_info ? (
            <Text style={{ marginRight: 12, color: colors.textSecondary }}>
              {item.contact_info}
            </Text>
          ) : null}

          {!item.is_resolved ? (
            <TouchableOpacity
              onPress={() => onResolve(item.id)}
              style={[styles.resolveButton, { backgroundColor: colors.primary }]}>
              <Text style={{ color: '#fff' }}>Mark resolved</Text>
            </TouchableOpacity>
          ) : (
            <Text style={{ color: colors.textSecondary }}>Resolved</Text>
          )}

          <TouchableOpacity
            onPress={() =>
              Alert.alert('Delete Post', 'Are you sure you want to delete this post?', [
                { text: 'Cancel', style: 'cancel' },
                { text: 'Delete', style: 'destructive', onPress: () => onDelete(item.id) },
              ])
            }>
            <Text style={{ color: 'red', marginLeft: 12 }}>Delete</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { 
    marginHorizontal: 16, 
    marginVertical: 8, 
    padding: 12, 
    borderRadius: 10, 
    borderWidth: 1 
  },
  cardHeader: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'flex-start', 
    marginBottom: 8 
  },
  titleContainer: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginRight: 12,
  },
  cardTitle: { 
    fontSize: 16, 
    fontWeight: '700',
    flex: 1,
    marginRight: 8,
  },
  typePill: { 
    paddingVertical: 4, 
    paddingHorizontal: 8, 
    borderRadius: 12, 
    overflow: 'hidden' 
  },
  wishlistButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
  },
  cardDesc: { 
    marginBottom: 8 
  },
  cardFooter: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'center' 
  },
  resolveButton: { 
    paddingVertical: 6, 
    paddingHorizontal: 10, 
    borderRadius: 8 
  },
});