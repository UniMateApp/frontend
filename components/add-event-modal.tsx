import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import React, { useState } from 'react';
import { Modal, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';

type Props = {
  visible: boolean;
  onClose: () => void;
  onAdd: (event: any) => void;
};

export default function AddEventModal({ visible, onClose, onAdd }: Props) {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];

  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('Technology');
  const [organizer, setOrganizer] = useState('');
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [location, setLocation] = useState('');
  const [description, setDescription] = useState('');
  const [price, setPrice] = useState('Free');

  const submit = () => {
    if (!title.trim()) return;
    const newEvent = {
      id: String(Date.now()),
      title: title.trim(),
      category,
      organizer: organizer || 'Organizer',
      date: date || new Date().toDateString(),
      time,
      location: location || 'TBD',
      description,
      attendees: { registered: 0 },
      registrationDeadline: '',
      price,
      image: require('../assets/images/icon.png'),
    };

    onAdd(newEvent);
    // reset and close
    setTitle('');
    setCategory('Technology');
    setOrganizer('');
    setDate('');
    setTime('');
    setLocation('');
    setDescription('');
    setPrice('Free');
    onClose();
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose} transparent>
      <View style={[styles.backdrop, { backgroundColor: 'rgba(0,0,0,0.4)' }]}>
        <View style={[styles.sheet, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}> 
          <ScrollView contentContainerStyle={styles.content}>
            <Text style={[styles.heading, { color: colors.text }]}>Add Event</Text>

            <TextInput placeholder="Title" placeholderTextColor={colors.textSecondary} value={title} onChangeText={setTitle} style={[styles.input, { color: colors.text, borderColor: colors.cardBorder }]} />
            <TextInput placeholder="Category" placeholderTextColor={colors.textSecondary} value={category} onChangeText={setCategory} style={[styles.input, { color: colors.text, borderColor: colors.cardBorder }]} />
            <TextInput placeholder="Organizer" placeholderTextColor={colors.textSecondary} value={organizer} onChangeText={setOrganizer} style={[styles.input, { color: colors.text, borderColor: colors.cardBorder }]} />
            <TextInput placeholder="Date" placeholderTextColor={colors.textSecondary} value={date} onChangeText={setDate} style={[styles.input, { color: colors.text, borderColor: colors.cardBorder }]} />
            <TextInput placeholder="Time" placeholderTextColor={colors.textSecondary} value={time} onChangeText={setTime} style={[styles.input, { color: colors.text, borderColor: colors.cardBorder }]} />
            <TextInput placeholder="Location" placeholderTextColor={colors.textSecondary} value={location} onChangeText={setLocation} style={[styles.input, { color: colors.text, borderColor: colors.cardBorder }]} />
            <TextInput placeholder="Price (Free/Paid)" placeholderTextColor={colors.textSecondary} value={price} onChangeText={setPrice} style={[styles.input, { color: colors.text, borderColor: colors.cardBorder }]} />
            <TextInput placeholder="Short description" placeholderTextColor={colors.textSecondary} value={description} onChangeText={setDescription} style={[styles.inputMultiline, { color: colors.text, borderColor: colors.cardBorder }]} multiline numberOfLines={3} />

            <View style={styles.actionsRow}>
              <TouchableOpacity style={[styles.button, { backgroundColor: colors.cardBorder }]} onPress={onClose}>
                <Text style={{ color: colors.text }}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.button, { backgroundColor: colors.primary }]} onPress={submit}>
                <Text style={{ color: '#fff' }}>Add Event</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: 'flex-end' },
  sheet: { maxHeight: '85%', borderTopLeftRadius: 12, borderTopRightRadius: 12, borderWidth: 1 },
  content: { padding: 16 },
  heading: { fontSize: 18, fontWeight: '700', marginBottom: 12 },
  input: { borderWidth: 1, borderRadius: 8, padding: 10, marginBottom: 10 },
  inputMultiline: { borderWidth: 1, borderRadius: 8, padding: 10, marginBottom: 10, minHeight: 80 },
  actionsRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 8 },
  button: { paddingVertical: 12, paddingHorizontal: 16, borderRadius: 8 },
});
