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

export default function LostFoundScreen() {
  const [modalVisible, setModalVisible] = useState(false);
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(false);
  const [filterMode, setFilterMode] = useState<'all' | 'mine'>('all');
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const router = useRouter();

  const { user } = useUser();

  const open = () => setModalVisible(true);
  const close = () => setModalVisible(false);

  /** Fetch posts with wishlist status */
  const loadPosts = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getLostFoundWithWishlistStatus();
      setPosts(data);
    } catch (err: any) {
      console.error('Failed to load posts', err);
      Alert.alert('Error', err.message || 'Failed to load posts');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadPosts();
    
    // Subscribe to wishlist changes for real-time updates
    const setupSubscription = async () => {
      const client = await supabase();
      const subscription = client
        .channel('lost_found_wishlist_changes')
        .on('postgres_changes', 
          { event: '*', schema: 'public', table: 'selective_wishlist' },
          () => {
            loadPosts();
          }
        )
        .subscribe();

      return () => {
        subscription.unsubscribe();
      };
    };

    const cleanup = setupSubscription();
    
    return () => {
      cleanup.then(fn => fn?.());
    };
  }, [loadPosts]);

  /** Add post */
  const handleAdd = async (post: any) => {
    try {
      const created = await createLostFound({
        kind: post.type.toLowerCase(), // Database uses 'kind' field
        title: post.title, // Database uses 'title' field
        description: post.description,
        contact: post.contact, // Database uses 'contact' field
        image_url: post.image_url, // Image URL from Supabase Storage
        resolved: false, // Database uses 'resolved' field
        location: post.location, // Location as string
      });
      
      // Map database fields to expected interface fields
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
        isInWishlist: false
      };
      
      setPosts(prev => [mappedPost, ...prev]);
      Alert.alert('Success', 'Post added successfully!');
    } catch (err: any) {
      console.error('Failed to add post', err);
      Alert.alert('Error', err.message || 'Could not add post');
    } finally {
      close();
    }
  };

  /** Resolve post */
  const handleResolve = async (id: string) => {
    try {
      await resolveLostFoundItem(String(id));
      setPosts(prev => prev.map(p => (p.id === id ? { ...p, is_resolved: true } : p)));
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Could not mark as resolved');
    }
  };

  // Deletion handled via onResolve (mark resolved); no separate delete handler

  /** Toggle wishlist for lost-found item */
  const handleWishlistToggle = async (id: string, isInWishlist: boolean) => {
    try {
      if (isInWishlist) {
        await removeItemFromWishlist('lost_found', id);
        setPosts(prev => prev.map(p => (p.id.toString() === id ? { ...p, isInWishlist: false } : p)));
      } else {
        await addLostFoundToWishlist(id);
        setPosts(prev => prev.map(p => (p.id.toString() === id ? { ...p, isInWishlist: true } : p)));
      }
    } catch (error: any) {
      // Cross-platform error handling
      const message = error.message || 'Failed to update wishlist';
      if (typeof window !== 'undefined') {
        window.alert(message);
      } else {
        Alert.alert('Error', message);
      }
    }
  };

  /** Navigate to item details */
  const handleItemPress = (id: string) => {
    router.push({ pathname: '/lost-found/[id]', params: { id } });
  };

  // Only show posts that are not resolved so "deleted" (resolved) items are hidden
  const data = useMemo(() => {
    const base = posts.filter(p => !p.is_resolved);
    if (filterMode === 'mine' && user?.id) {
      return base.filter(p => String(p.created_by) === String(user.id));
    }
    return base;
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
