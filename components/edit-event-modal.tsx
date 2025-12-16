import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import React, { useEffect, useState } from 'react';
import { Alert, Modal, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';

type Props = {
  visible: boolean;
  onClose: () => void;
  onUpdate: (eventData: any) => void;
  initialData: any;
};

export default function EditEventModal({ visible, onClose, onUpdate, initialData }: Props) {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];

  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('');
  const [organizer, setOrganizer] = useState('');
  const [date, setDate] = useState('');
  const [location, setLocation] = useState('');
  const [description, setDescription] = useState('');
  const [price, setPrice] = useState('');

  // Populate form when modal opens with initial data
  useEffect(() => {
    if (visible && initialData) {
      setTitle(initialData.title || '');
      setCategory(initialData.category || '');
      setOrganizer(initialData.organizer || '');
      
      // Format date from database timestamp
      if (initialData.start_at) {
        const date = new Date(initialData.start_at);
        const formatted = date.toISOString().split('T')[0]; // YYYY-MM-DD
        setDate(formatted);
      } else {
        setDate('');
      }
      
      setLocation(initialData.location || '');
      setDescription(initialData.description || '');
      
      // Format price for display
      if (initialData.price === 0) {
        setPrice('Free');
      } else if (initialData.price !== null && initialData.price !== undefined) {
        setPrice(String(initialData.price));
      } else {
        setPrice('Free');
      }
    }
  }, [visible, initialData]);

  const submit = () => {
    if (!title.trim()) {
      Alert.alert('Validation Error', 'Title is required');
      return;
    }

    // Convert price to number
    let priceValue: number | null = null;
    if (price) {
      const lower = String(price).toLowerCase().trim();
      if (lower === 'free' || lower === 'free admission') {
        priceValue = 0;
      } else {
        const parsed = parseFloat(String(price));
        priceValue = isNaN(parsed) ? null : parsed;
      }
    }

    const updatedEvent = {
      title: title.trim(),
      category: category.trim() || null,
      organizer: organizer.trim() || null,
      start_at: date || null,
      location: location.trim() || null,
      description: description.trim() || null,
      price: priceValue,
    };

    onUpdate(updatedEvent);
  };

  const handleClose = () => {
    // Reset form on close
    setTitle('');
    setCategory('');
    setOrganizer('');
    setDate('');
    setLocation('');
    setDescription('');
    setPrice('');
    onClose();
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={handleClose} transparent>
      <View style={[styles.backdrop, { backgroundColor: 'rgba(0,0,0,0.5)' }]}>
        <View style={[styles.sheet, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}> 
          <ScrollView contentContainerStyle={styles.content}>
            <Text style={[styles.heading, { color: colors.text }]}>Edit Event</Text>

            <Text style={[styles.label, { color: colors.text }]}>Title *</Text>
            <TextInput 
              placeholder="Event Title" 
              placeholderTextColor={colors.textSecondary} 
              value={title} 
              onChangeText={setTitle} 
              style={[styles.input, { color: colors.text, borderColor: colors.cardBorder, backgroundColor: colors.background }]} 
            />

            <Text style={[styles.label, { color: colors.text }]}>Category</Text>
            <TextInput 
              placeholder="e.g., Technology, Sports, Arts" 
              placeholderTextColor={colors.textSecondary} 
              value={category} 
              onChangeText={setCategory} 
              style={[styles.input, { color: colors.text, borderColor: colors.cardBorder, backgroundColor: colors.background }]} 
            />

            <Text style={[styles.label, { color: colors.text }]}>Organizer</Text>
            <TextInput 
              placeholder="Organizer Name" 
              placeholderTextColor={colors.textSecondary} 
              value={organizer} 
              onChangeText={setOrganizer} 
              style={[styles.input, { color: colors.text, borderColor: colors.cardBorder, backgroundColor: colors.background }]} 
            />

            <Text style={[styles.label, { color: colors.text }]}>Date (YYYY-MM-DD)</Text>
            <TextInput 
              placeholder="2025-10-20" 
              placeholderTextColor={colors.textSecondary} 
              value={date} 
              onChangeText={setDate} 
              style={[styles.input, { color: colors.text, borderColor: colors.cardBorder, backgroundColor: colors.background }]} 
            />

            <Text style={[styles.label, { color: colors.text }]}>Location</Text>
            <TextInput 
              placeholder="Event Location" 
              placeholderTextColor={colors.textSecondary} 
              value={location} 
              onChangeText={setLocation} 
              style={[styles.input, { color: colors.text, borderColor: colors.cardBorder, backgroundColor: colors.background }]} 
            />

            <Text style={[styles.label, { color: colors.text }]}>Price</Text>
            <TextInput 
              placeholder="Free or numeric value (e.g., 25)" 
              placeholderTextColor={colors.textSecondary} 
              value={price} 
              onChangeText={setPrice} 
              style={[styles.input, { color: colors.text, borderColor: colors.cardBorder, backgroundColor: colors.background }]} 
            />

            <Text style={[styles.label, { color: colors.text }]}>Description</Text>
            <TextInput 
              placeholder="Event description" 
              placeholderTextColor={colors.textSecondary} 
              value={description} 
              onChangeText={setDescription} 
              style={[styles.inputMultiline, { color: colors.text, borderColor: colors.cardBorder, backgroundColor: colors.background }]} 
              multiline 
              numberOfLines={4} 
            />

            <View style={styles.actionsRow}>
              <TouchableOpacity style={[styles.button, styles.cancelButton, { backgroundColor: colors.cardBorder }]} onPress={handleClose}>
                <Text style={{ color: colors.text, fontWeight: '600' }}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.button, styles.submitButton, { backgroundColor: colors.primary }]} onPress={submit}>
                <Text style={{ color: '#fff', fontWeight: '600' }}>Update Event</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { 
    flex: 1, 
    justifyContent: 'flex-end' 
  },
  sheet: { 
    maxHeight: '90%', 
    borderTopLeftRadius: 16, 
    borderTopRightRadius: 16, 
    borderWidth: 1 
  },
  content: { 
    padding: 20 
  },
  heading: { 
    fontSize: 22, 
    fontWeight: '700', 
    marginBottom: 20 
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 6,
    marginTop: 8,
  },
  input: { 
    borderWidth: 1, 
    borderRadius: 8, 
    padding: 12, 
    marginBottom: 12,
    fontSize: 16,
  },
  inputMultiline: { 
    borderWidth: 1, 
    borderRadius: 8, 
    padding: 12, 
    marginBottom: 12, 
    minHeight: 100,
    fontSize: 16,
    textAlignVertical: 'top',
  },
  actionsRow: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    marginTop: 20,
    gap: 12,
  },
  button: { 
    flex: 1,
    paddingVertical: 14, 
    paddingHorizontal: 20, 
    borderRadius: 10,
    alignItems: 'center',
  },
  cancelButton: {
    flex: 0.4,
  },
  submitButton: {
    flex: 0.6,
  },
});
