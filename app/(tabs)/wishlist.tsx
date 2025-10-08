import SelectiveWishlistItemCard from '@/components/selective-wishlist-item-card';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import {
  WishlistItem,
  getUserWishlistItems,
  removeFromWishlist,
  subscribeToWishlistChanges,
} from '@/services/selectiveWishlist';
import { FontAwesome } from '@expo/vector-icons';
import { router } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

export default function WishlistScreen() {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];

  const [wishlistItems, setWishlistItems] = useState<WishlistItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadWishlistItems = useCallback(async () => {
    try {
      const items = await getUserWishlistItems();
      setWishlistItems(items);
    } catch (error: any) {
      console.error('Error loading wishlist items:', error);
      const isWeb = typeof window !== 'undefined' && (window as any).document != null;
      if (isWeb) {
        window.alert('Failed to load wishlist items');
      } else {
        Alert.alert('Error', 'Failed to load wishlist items');
      }
    } finally {
      setLoading(false);
    }
  }, []);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadWishlistItems();
    setRefreshing(false);
  }, [loadWishlistItems]);

  const handleRemoveItem = async (wishlistItemId: string) => {
    try {
      await removeFromWishlist(wishlistItemId);
      // Remove the item from the local state immediately
      setWishlistItems(prev => prev.filter(item => item.id !== wishlistItemId));
    } catch (error: any) {
      console.error('Error removing wishlist item:', error);
      throw error; // Re-throw so the component can handle it
    }
  };

  const navigateToEvents = () => {
    router.push('/(tabs)/events');
  };

  const navigateToLostFound = () => {
    router.push('/(tabs)/lost-found');
  };

  useEffect(() => {
    loadWishlistItems();

    // Set up real-time subscription
    let unsubscribe: (() => void) | undefined;
    
    const setupSubscription = async () => {
      try {
        unsubscribe = await subscribeToWishlistChanges((payload) => {
          console.log('Wishlist change:', payload);
          // Refresh the list when changes occur
          loadWishlistItems();
        });
      } catch (error) {
        console.error('Error setting up wishlist subscription:', error);
      }
    };

    setupSubscription();

    return () => {
      if (unsubscribe) {
        unsubscribe();
      }
    };
  }, [loadWishlistItems]);

  if (loading) {
    return (
      <View style={[styles.container, styles.centered, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={[styles.loadingText, { color: colors.textSecondary }]}>
          Loading your wishlist...
        </Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
        }>
        
        {wishlistItems.length === 0 ? (
          <View style={styles.emptyState}>
            <FontAwesome name="heart-o" size={64} color={colors.textSecondary} />
            <Text style={[styles.emptyTitle, { color: colors.text }]}>
              Your Wishlist is Empty
            </Text>
            <Text style={[styles.emptySubtitle, { color: colors.textSecondary }]}>
              Add events and lost & found items to your wishlist by browsing our content
            </Text>
            
            <View style={styles.actionButtons}>
              <TouchableOpacity
                style={[styles.actionButton, { backgroundColor: colors.primary }]}
                onPress={navigateToEvents}>
                <FontAwesome name="calendar" size={20} color="#fff" />
                <Text style={styles.actionButtonText}>Browse Events</Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={[styles.actionButton, { backgroundColor: '#ff9500' }]}
                onPress={navigateToLostFound}>
                <FontAwesome name="search" size={20} color="#fff" />
                <Text style={styles.actionButtonText}>Browse Lost & Found</Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          <>
            <Text style={[styles.header, { color: colors.text }]}>
              My Wishlist ({wishlistItems.length} items)
            </Text>
            {wishlistItems.map((item) => (
              <SelectiveWishlistItemCard
                key={item.id}
                item={item}
                onRemove={handleRemoveItem}
              />
            ))}
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  centered: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
  },
  scrollView: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  header: {
    fontSize: 24,
    fontWeight: '600',
    marginBottom: 20,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
    paddingHorizontal: 20,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '600',
    marginTop: 16,
    marginBottom: 8,
    textAlign: 'center',
  },
  emptySubtitle: {
    fontSize: 16,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 32,
  },
  actionButtons: {
    flexDirection: 'column',
    gap: 16,
    alignItems: 'center',
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 16,
    borderRadius: 30,
    gap: 12,
    minWidth: 200,
    justifyContent: 'center',
  },
  actionButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});