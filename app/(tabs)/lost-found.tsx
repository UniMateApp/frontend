import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { FlatList, StyleSheet, Text, TouchableOpacity, View, Alert, ActivityIndicator } from 'react-native';
import LostFoundModal from '../../components/lost-found-modal';
import { SearchBar } from '../../components/search-bar';
import { Colors } from '../../constants/theme';
import { useColorScheme } from '../../hooks/use-color-scheme';
import { listLostFound, createLostFound, resolveLostFound, deleteLostFound } from '../../services/lostFound';

type Post = {
  id: number;
  kind: 'lost' | 'found';
  title: string;
  description?: string;
  contact?: string;
  created_at: string;
  resolved?: boolean;
};

function PostCard({ item, onResolve, onDelete }: { item: Post; onResolve: (id: number) => void; onDelete: (id: number) => void }) {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];

  return (
    <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
      <View style={styles.cardHeader}>
        <Text style={[styles.cardTitle, { color: colors.text }]}>{item.title}</Text>
        <Text
          style={[
            styles.typePill,
            {
              backgroundColor: item.kind === 'lost' ? '#d9534f' : '#5cb85c',
              color: '#fff',
            },
          ]}>
          {item.kind === 'lost' ? 'Lost' : 'Found'}
        </Text>
      </View>

      {item.description ? (
        <Text style={[styles.cardDesc, { color: colors.textSecondary }]}>{item.description}</Text>
      ) : null}

      <View style={styles.cardFooter}>
        <Text style={{ color: colors.textSecondary }}>
          {new Date(item.created_at).toLocaleString()}
        </Text>
        <View style={{ flexDirection: 'row' }}>
          {item.contact ? (
            <Text style={{ marginRight: 12, color: colors.textSecondary }}>
              {item.contact}
            </Text>
          ) : null}

          {!item.resolved ? (
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

export default function LostFoundScreen() {
  const [modalVisible, setModalVisible] = useState(false);
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(false);
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];

  const open = () => setModalVisible(true);
  const close = () => setModalVisible(false);

  /** Fetch posts */
  const loadPosts = useCallback(async () => {
    setLoading(true);
    try {
      const data = await listLostFound();
      setPosts(data as any);
    } catch (err: any) {
      console.error('Failed to load posts', err);
      Alert.alert('Error', err.message || 'Failed to load posts');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadPosts();
  }, [loadPosts]);

  /** Add post */
  const handleAdd = async (post: any) => {
    try {
      const created = await createLostFound({
        kind: post.type.toLowerCase(),
        title: post.title,
        description: post.description,
        contact: post.contact,
        resolved: false,
      });
      setPosts(prev => [created, ...prev]);
      Alert.alert('Success', 'Post added successfully!');
    } catch (err: any) {
      console.error('Failed to add post', err);
      Alert.alert('Error', err.message || 'Could not add post');
    } finally {
      close();
    }
  };

  /** Resolve post */
  const handleResolve = async (id: number) => {
    try {
      await resolveLostFound(id);
      setPosts(prev => prev.map(p => (p.id === id ? { ...p, resolved: true } : p)));
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Could not mark as resolved');
    }
  };

  /** Delete post */
  const handleDelete = async (id: number) => {
    try {
      await deleteLostFound(id);
      setPosts(prev => prev.filter(p => p.id !== id));
      Alert.alert('Deleted', 'Post deleted successfully!');
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Could not delete post');
    }
  };

  const data = useMemo(() => posts, [posts]);

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <SearchBar onSearch={() => {}} />

      <View style={styles.headerRow}>
        <Text style={[styles.title, { color: colors.text }]}>Lost & Found</Text>
        <TouchableOpacity onPress={open} style={[styles.addButton, { borderColor: colors.cardBorder }]}>
          <Text style={{ color: colors.primary, fontWeight: '700' }}>+ Add Post</Text>
        </TouchableOpacity>
      </View>

      {loading && <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: 20 }} />}

      <FlatList
        data={data}
        keyExtractor={i => String(i.id)}
        renderItem={({ item }) => (
          <PostCard item={item} onResolve={handleResolve} onDelete={handleDelete} />
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
  empty: { padding: 24, alignItems: 'center' },
  card: { marginHorizontal: 16, marginVertical: 8, padding: 12, borderRadius: 10, borderWidth: 1 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  cardTitle: { fontSize: 16, fontWeight: '700' },
  typePill: { paddingVertical: 4, paddingHorizontal: 8, borderRadius: 12, overflow: 'hidden' },
  cardDesc: { marginBottom: 8 },
  cardFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  resolveButton: { paddingVertical: 6, paddingHorizontal: 10, borderRadius: 8 },
});
