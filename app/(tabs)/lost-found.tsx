import { SearchBar } from '@/components/search-bar';
import { useUser } from '@/contexts/UserContext';
import { supabase } from '@/services/supabase';
import { useRouter } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import LostFoundItemCard from '../../components/lost-found-item-card';
import LostFoundModal from '../../components/lost-found-modal';
import { Colors } from '../../constants/theme';
import { useColorScheme } from '../../hooks/use-color-scheme';
import { createLostFound, resolveLostFoundItem } from '../../services/lostFound';
import {
  addLostFoundToWishlist,
  getLostFoundWithWishlistStatus,
  removeItemFromWishlist
} from '../../services/selectiveWishlist';

type Post = {
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
  isInWishlist?: boolean;
};

// ========================================
// LOST AND FOUND FEATURE - MAIN SCREEN
// ========================================
// This component manages the Lost & Found feature where users can:
// 1. View all lost/found items posted by the community
// 2. Post new lost/found items with photos and location
// 3. Filter items (All vs My Posts)
// 4. Add items to wishlist for tracking
// 5. Mark items as resolved when found/returned
// ========================================

export default function LostFoundScreen() {
  // STEP 1: INITIALIZATION - Setup state and UI controls
  const [modalVisible, setModalVisible] = useState(false); // Controls the create post modal visibility
  const [posts, setPosts] = useState<Post[]>([]); // Array of all lost/found posts with wishlist status
  const [loading, setLoading] = useState(false); // Loading state while fetching posts
  const [filterMode, setFilterMode] = useState<'all' | 'mine'>('all'); // Filter: show all posts or only user's posts
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const router = useRouter();

  const { user } = useUser(); // Current logged-in user

  const open = () => setModalVisible(true); // Open create post modal
  const close = () => setModalVisible(false); // Close create post modal

  // STEP 2: LOAD POSTS - Fetch all lost/found items with wishlist status
  /** Fetch posts with wishlist status from database */
  const loadPosts = useCallback(async () => {
    setLoading(true);
    try {
      // This service function joins lost_found table with wishlist table
      // to get all posts and check if each is in current user's wishlist
      const data = await getLostFoundWithWishlistStatus();
      setPosts(data); // Update state with posts including isInWishlist flag
    } catch (err: any) {
      console.error('Failed to load posts', err);
      Alert.alert('Error', err.message || 'Failed to load posts');
    } finally {
      setLoading(false);
    }
  }, []);

  // STEP 3: REALTIME UPDATES - Load posts initially and subscribe to changes
  useEffect(() => {
    loadPosts(); // Initial load of all posts
    
    // STEP 3A: REALTIME SUBSCRIPTION - Listen for wishlist changes
    // When any user adds/removes items from wishlist, reload all posts
    // This ensures the heart icons update in real-time across users
    const setupSubscription = async () => {
      const client = await supabase();
      const subscription = client
        .channel('lost_found_wishlist_changes') // Unique channel name
        .on('postgres_changes', 
          { event: '*', schema: 'public', table: 'selective_wishlist' }, // Listen to all changes
          () => {
            loadPosts(); // Reload posts when wishlist changes
          }
        )
        .subscribe(); // Start listening

      return () => {
        subscription.unsubscribe(); // Cleanup function
      };
    };

    const cleanup = setupSubscription();
    
    // Cleanup on unmount
    return () => {
      cleanup.then(fn => fn?.());
    };
  }, [loadPosts]);

  // STEP 4: CREATE POST - Handle new lost/found item submission
  /** Add post - Called when user submits the modal form */
  const handleAdd = async (post: any) => {
    try {
      // STEP 4A: DATABASE INSERT - Map UI fields to database schema
      // The database uses different field names (kind vs type, title vs item_name, etc.)
      const created = await createLostFound({
        kind: post.type.toLowerCase(), // Database uses 'kind' field for 'lost' or 'found'
        title: post.title, // Database uses 'title' field instead of 'item_name'
        description: post.description,
        contact: post.contact, // Database uses 'contact' field instead of 'contact_info'
        image_url: post.image_url, // Image URL from Supabase Storage (already uploaded)
        resolved: false, // Database uses 'resolved' field instead of 'is_resolved'
        location: post.location, // Location as "latitude,longitude" string
      });
      
      // STEP 4B: FIELD MAPPING - Convert database response back to UI format
      // Map database fields to expected interface fields for UI consistency
      const mappedPost: Post = {
        id: created.id,
        item_name: created.title, // Map 'title' to 'item_name'
        description: created.description,
        type: created.kind, // Map 'kind' to 'type'
        location: created.location,
        contact_info: created.contact, // Map 'contact' to 'contact_info'
        image_url: created.image_url,
        created_by: created.created_by,
        created_at: created.created_at,
        updated_at: created.created_at, // Use created_at for updated_at
        is_resolved: created.resolved, // Map 'resolved' to 'is_resolved'
        isInWishlist: false // New posts are not in wishlist by default
      };
      
      // STEP 4C: UPDATE UI - Add new post to the top of the list
      setPosts(prev => [mappedPost, ...prev]);
      Alert.alert('Success', 'Post added successfully!');
    } catch (err: any) {
      console.error('Failed to add post', err);
      Alert.alert('Error', err.message || 'Could not add post');
    } finally {
      close(); // Close the modal
    }
  };

  // STEP 5: RESOLVE POST - Mark item as found/returned
  /** Resolve post - Updates the database to mark item as resolved */
  const handleResolve = async (id: string) => {
    try {
      await resolveLostFoundItem(String(id)); // Update 'resolved' field to true in database
      // Update local state to reflect the change (item will be filtered out from display)
      setPosts(prev => prev.map(p => (p.id === id ? { ...p, is_resolved: true } : p)));
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Could not mark as resolved');
    }
  };

  // NOTE: Deletion is handled via marking as resolved; no separate hard delete functionality

  // STEP 6: WISHLIST MANAGEMENT - Add/Remove items from user's wishlist
  /** Toggle wishlist for lost-found item */
  const handleWishlistToggle = async (id: string, isInWishlist: boolean) => {
    try {
      if (isInWishlist) {
        // Remove from wishlist: Delete row from 'selective_wishlist' table
        await removeItemFromWishlist('lost_found', id);
        setPosts(prev => prev.map(p => (p.id.toString() === id ? { ...p, isInWishlist: false } : p)));
      } else {
        // Add to wishlist: Insert row into 'selective_wishlist' table
        await addLostFoundToWishlist(id);
        setPosts(prev => prev.map(p => (p.id.toString() === id ? { ...p, isInWishlist: true } : p)));
      }
    } catch (error: any) {
      // Cross-platform error handling (web vs native)
      const message = error.message || 'Failed to update wishlist';
      if (typeof window !== 'undefined') {
        window.alert(message);
      } else {
        Alert.alert('Error', message);
      }
    }
  };

  // STEP 7: NAVIGATION - Navigate to detail view
  /** Navigate to item details - Opens the detail screen for a specific lost/found item */
  const handleItemPress = (id: string) => {
    router.push({ pathname: '/lost-found/[id]', params: { id } }); // Dynamic route with item ID
  };

  // STEP 8: FILTERING - Apply filters to display appropriate posts
  // Only show posts that are not resolved (resolved = soft deleted)
  // Additionally filter by ownership if "My Posts" mode is active
  const data = useMemo(() => {
    const base = posts.filter(p => !p.is_resolved); // Hide resolved items
    if (filterMode === 'mine' && user?.id) {
      // Filter to show only posts created by current user
      return base.filter(p => String(p.created_by) === String(user.id));
    }
    return base; // Show all unresolved posts
  }, [posts, filterMode, user]);

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <SearchBar onSearch={() => {}} />

      <View style={styles.headerRow}>
        <Text style={[styles.title, { color: colors.text }]}>Lost & Found</Text>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <View style={styles.segmentedWrapper}>
            <TouchableOpacity
              onPress={() => setFilterMode('all')}
              style={[styles.segmentButton, filterMode === 'all' ? { backgroundColor: colors.primary } : { borderColor: colors.cardBorder }]}
            >
              <Text style={{ color: filterMode === 'all' ? '#fff' : colors.primary, fontWeight: '700' }}>All</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => setFilterMode('mine')}
              disabled={!user}
              style={[styles.segmentButton, filterMode === 'mine' ? { backgroundColor: colors.primary } : { borderColor: colors.cardBorder }, !user ? { opacity: 0.5 } : null]}
            >
              <Text style={{ color: filterMode === 'mine' ? '#fff' : colors.primary, fontWeight: '700' }}>My Posts</Text>
            </TouchableOpacity>
          </View>
          <TouchableOpacity onPress={open} style={[styles.addButton, { borderColor: colors.cardBorder, marginLeft: 8 }]}>
            <Text style={{ color: colors.primary, fontWeight: '700' }}>+ Add Post</Text>
          </TouchableOpacity>
        </View>
      </View>

      {loading && <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: 20 }} />}

      <FlatList
        data={data}
        keyExtractor={i => String(i.id)}
        renderItem={({ item }) => (
          <LostFoundItemCard 
            item={item} 
            isInWishlist={item.isInWishlist || false}
            onResolve={handleResolve}
            onWishlistToggle={handleWishlistToggle}
            onPress={() => handleItemPress(String(item.id))}
          />
        )}
        contentContainerStyle={{ paddingBottom: 60 }}
        ListEmptyComponent={() => (
          <View style={styles.empty}>
            <Text style={{ color: colors.textSecondary }}>No posts yet. Be the first to add.</Text>
          </View>
        )}
      />

      <LostFoundModal visible={modalVisible} onClose={close} onSubmit={handleAdd} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  title: { fontSize: 20, fontWeight: '700' },
  addButton: { borderWidth: 1, paddingVertical: 8, paddingHorizontal: 12, borderRadius: 8 },
  myPostsButton: { borderWidth: 1, paddingVertical: 8, paddingHorizontal: 12, borderRadius: 8 },
  segmentedWrapper: { flexDirection: 'row', borderRadius: 8, overflow: 'hidden', borderWidth: 1 },
  segmentButton: { paddingVertical: 8, paddingHorizontal: 12 },
  empty: { padding: 24, alignItems: 'center' },
  card: { marginHorizontal: 16, marginVertical: 8, padding: 12, borderRadius: 10, borderWidth: 1 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  cardTitle: { fontSize: 16, fontWeight: '700' },
  typePill: { paddingVertical: 4, paddingHorizontal: 8, borderRadius: 12, overflow: 'hidden' },
  cardDesc: { marginBottom: 8 },
  cardFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  resolveButton: { paddingVertical: 6, paddingHorizontal: 10, borderRadius: 8 },
});
