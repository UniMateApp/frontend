import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import DateTimePicker from '@react-native-community/datetimepicker';
import React, { useEffect, useState } from 'react';
import { Alert, Modal, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';

type Props = {
  visible: boolean;
  onClose: () => void;
  onUpdate: (eventData: any) => void;
  initialData: any;
};

// ========================================
// EDIT EVENT MODAL - UPDATE EVENT FORM
// ========================================
// This modal allows event owners to edit existing event details:
// 1. Pre-populate form with existing event data
// 2. Allow modification of title, category, organizer, date/time, location, description, price
// 3. Validate and submit changes
// 4. Update database via onUpdate callback
// 
// Note: This modal does NOT handle image upload (images can't be changed after creation)
// ========================================

export default function EditEventModal({ visible, onClose, onUpdate, initialData }: Props) {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];

  // FORM STATE - Track all editable fields
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('');
  const [organizer, setOrganizer] = useState('');
  const [date, setDate] = useState(new Date());
  const [time, setTime] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [location, setLocation] = useState('');
  const [description, setDescription] = useState('');
  const [price, setPrice] = useState('');

  // STEP 1: POPULATE FORM - Load existing event data when modal opens
  useEffect(() => {
    if (visible && initialData) {
      setTitle(initialData.title || '');
      setCategory(initialData.category || '');
      setOrganizer(initialData.organizer || '');
      
      // Format date from database timestamp (ISO 8601 string)
      if (initialData.start_at) {
        const dateObj = new Date(initialData.start_at);
        setDate(dateObj); // Set date picker
        setTime(dateObj); // Set time picker
      } else {
        setDate(new Date());
        setTime(new Date());
      }
      
      setLocation(initialData.location || '');
      setDescription(initialData.description || '');
      
      // Format price for display in text input
      if (initialData.price === 0) {
        setPrice('Free'); // Show "Free" for zero price
      } else if (initialData.price !== null && initialData.price !== undefined) {
        setPrice(String(initialData.price)); // Convert number to string
      } else {
        setPrice('Free');
      }
    }
  }, [visible, initialData]);

  const onDateChange = (event: any, selectedDate?: Date) => {
    if (Platform.OS === 'android') {
      setShowDatePicker(false);
    }
    if (event.type === 'set' && selectedDate) {
      setDate(selectedDate);
    }
  };

  const onTimeChange = (event: any, selectedTime?: Date) => {
    if (Platform.OS === 'android') {
      setShowTimePicker(false);
    }
    if (event.type === 'set' && selectedTime) {
      setTime(selectedTime);
    }
  };

  const formatDate = (date: Date) => {
    return date.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  };

  const formatTime = (time: Date) => {
    return time.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
  };

  // STEP 2: SUBMIT CHANGES - Validate and send updates to parent component
  const submit = () => {
    // VALIDATION: Ensure required fields are filled
    if (!title.trim()) {
      Alert.alert('Validation Error', 'Title is required');
      return;
    }

    // STEP 2A: PRICE PARSING - Convert price string to number
    let priceValue: number | null = null;
    if (price) {
      const lower = String(price).toLowerCase().trim();
      if (lower === 'free' || lower === 'free admission') {
        priceValue = 0; // "Free" becomes 0
      } else {
        const parsed = parseFloat(String(price));
        priceValue = isNaN(parsed) ? null : parsed; // Parse or set to null
      }
    }

    // STEP 2B: COMBINE DATE AND TIME - Merge separate date/time into single timestamp
    const combinedDateTime = new Date(date);
    combinedDateTime.setHours(time.getHours());
    combinedDateTime.setMinutes(time.getMinutes());
    combinedDateTime.setSeconds(0);

    // STEP 2C: BUILD UPDATE OBJECT - Only include modified fields
    const updatedEvent = {
      title: title.trim(),
      category: category.trim() || null,
      organizer: organizer.trim() || null,
      start_at: combinedDateTime.toISOString(), // Convert to ISO 8601 string
      location: location.trim() || null,
      description: description.trim() || null,
      price: priceValue,
    };

    // STEP 2D: CALL PARENT CALLBACK - Send update to detail screen
    onUpdate(updatedEvent);
  };

  const handleClose = () => {
    // Reset form on close
    setTitle('');
    setCategory('');
    setOrganizer('');
    setDate(new Date());
    setTime(new Date());
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

            <Text style={[styles.label, { color: colors.text }]}>Date</Text>
            <TouchableOpacity onPress={() => setShowDatePicker(true)} style={[styles.input, styles.pickerButton, { borderColor: colors.cardBorder, backgroundColor: colors.background }]}>
              <Text style={{ color: colors.text }}>{formatDate(date)}</Text>
            </TouchableOpacity>
            {showDatePicker && (
              <DateTimePicker
                value={date}
                mode="date"
                display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                onChange={onDateChange}
              />
            )}

            <Text style={[styles.label, { color: colors.text }]}>Time</Text>
            <TouchableOpacity onPress={() => setShowTimePicker(true)} style={[styles.input, styles.pickerButton, { borderColor: colors.cardBorder, backgroundColor: colors.background }]}>
              <Text style={{ color: colors.text }}>{formatTime(time)}</Text>
            </TouchableOpacity>
            {showTimePicker && (
              <DateTimePicker
                value={time}
                mode="time"
                display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                onChange={onTimeChange}
              />
            )}

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
    padding: 20,
    paddingBottom: 32
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
  pickerButton: {
    justifyContent: 'center',
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
