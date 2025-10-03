import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import React, { useState } from 'react';
import { Modal, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';

type Props = {
  visible: boolean;
  onClose: () => void;
  onSubmit: (post: any) => void;
};

export default function LostFoundModal({ visible, onClose, onSubmit }: Props) {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];

  const [type, setType] = useState<'Lost' | 'Found'>('Lost');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [contact, setContact] = useState('');

  const submit = () => {
    if (!title.trim()) return;
    const post = {
      id: String(Date.now()),
      type,
      title: title.trim(),
      description,
      contact,
      createdAt: new Date().toISOString(),
      resolved: false,
    };
    onSubmit(post);
    // reset
    setType('Lost');
    setTitle('');
    setDescription('');
    setContact('');
    onClose();
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={[styles.backdrop, { backgroundColor: 'rgba(0,0,0,0.4)' }]}>
        <View style={[styles.sheet, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}> 
          <Text style={[styles.heading, { color: colors.text }]}>New {type} Post</Text>

          <View style={styles.typeRow}>
            <TouchableOpacity style={[styles.typeButton, type === 'Lost' ? { borderColor: colors.primary } : { borderColor: colors.cardBorder }]} onPress={() => setType('Lost')}>
              <Text style={{ color: colors.text }}>Lost</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.typeButton, type === 'Found' ? { borderColor: colors.primary } : { borderColor: colors.cardBorder }]} onPress={() => setType('Found')}>
              <Text style={{ color: colors.text }}>Found</Text>
            </TouchableOpacity>
          </View>

          <TextInput placeholder="Title" placeholderTextColor={colors.textSecondary} value={title} onChangeText={setTitle} style={[styles.input, { color: colors.text, borderColor: colors.cardBorder }]} />
          <TextInput placeholder="Description" placeholderTextColor={colors.textSecondary} value={description} onChangeText={setDescription} style={[styles.inputMultiline, { color: colors.text, borderColor: colors.cardBorder }]} multiline numberOfLines={4} />
          <TextInput placeholder="Contact (email or phone)" placeholderTextColor={colors.textSecondary} value={contact} onChangeText={setContact} style={[styles.input, { color: colors.text, borderColor: colors.cardBorder }]} />

          <View style={styles.actionsRow}>
            <TouchableOpacity style={[styles.button, { backgroundColor: colors.cardBorder }]} onPress={onClose}>
              <Text style={{ color: colors.text }}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.button, { backgroundColor: colors.primary }]} onPress={submit}>
              <Text style={{ color: '#fff' }}>Post</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: 'flex-end' },
  sheet: { maxHeight: '85%', borderTopLeftRadius: 12, borderTopRightRadius: 12, borderWidth: 1, padding: 16 },
  heading: { fontSize: 18, fontWeight: '700', marginBottom: 12 },
  typeRow: { flexDirection: 'row', marginBottom: 12 },
  typeButton: { borderWidth: 1, paddingVertical: 8, paddingHorizontal: 12, borderRadius: 8, marginRight: 8 },
  input: { borderWidth: 1, borderRadius: 8, padding: 10, marginBottom: 10 },
  inputMultiline: { borderWidth: 1, borderRadius: 8, padding: 10, marginBottom: 10, minHeight: 80 },
  actionsRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 8 },
  button: { paddingVertical: 12, paddingHorizontal: 16, borderRadius: 8 },
});
