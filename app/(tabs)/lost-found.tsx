import React, { useMemo, useState } from 'react';
import { FlatList, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import LostFoundModal from '../../components/lost-found-modal';
import { SearchBar } from '../../components/search-bar';
import { Colors } from '../../constants/theme';
import { useColorScheme } from '../../hooks/use-color-scheme';

type Post = {
  id: string;
  type: 'Lost' | 'Found';
  title: string;
  description?: string;
  contact?: string;
  createdAt: string;
  resolved?: boolean;
};

function PostCard({ item, onResolve }: { item: Post; onResolve: (id: string) => void }) {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];

  return (
    <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}> 
      <View style={styles.cardHeader}>
        <Text style={[styles.cardTitle, { color: colors.text }]}>{item.title}</Text>
        <Text style={[styles.typePill, { color: item.type === 'Lost' ? '#fff' : '#fff', backgroundColor: item.type === 'Lost' ? '#d9534f' : '#5cb85c' }]}>{item.type}</Text>
      </View>
      {item.description ? <Text style={[styles.cardDesc, { color: colors.textSecondary }]}>{item.description}</Text> : null}
      <View style={styles.cardFooter}>
        <Text style={{ color: colors.textSecondary }}>{new Date(item.createdAt).toLocaleString()}</Text>
        <View style={{ flexDirection: 'row' }}>
          {item.contact ? <Text style={{ marginRight: 12, color: colors.textSecondary }}>{item.contact}</Text> : null}
          {!item.resolved ? (
            <TouchableOpacity onPress={() => onResolve(item.id)} style={[styles.resolveButton, { backgroundColor: colors.primary }]}> 
              <Text style={{ color: '#fff' }}>Mark resolved</Text>
            </TouchableOpacity>
          ) : (
            <Text style={{ color: colors.textSecondary }}>Resolved</Text>
          )}
        </View>
      </View>
    </View>
  );
}

export default function LostFoundScreen() {
  const [modalVisible, setModalVisible] = useState(false);
  const [posts, setPosts] = useState<Post[]>([]);
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];

  const open = () => setModalVisible(true);
  const close = () => setModalVisible(false);

  const handleAdd = (post: Post) => setPosts(prev => [post, ...prev]);

  const handleResolve = (id: string) => setPosts(prev => prev.map(p => (p.id === id ? { ...p, resolved: true } : p)));

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

      <FlatList data={data} keyExtractor={i => i.id} renderItem={({ item }) => <PostCard item={item} onResolve={handleResolve} />} contentContainerStyle={{ paddingBottom: 60 }} ListEmptyComponent={() => (
        <View style={styles.empty}><Text style={{ color: colors.textSecondary }}>No posts yet. Be the first to add.</Text></View>
      )} />

      <LostFoundModal visible={modalVisible} onClose={close} onSubmit={handleAdd} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12 },
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