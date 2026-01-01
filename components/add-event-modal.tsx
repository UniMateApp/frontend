import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { supabase as getSupabase } from '@/services/supabase';
import { FontAwesome } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import * as ImagePicker from 'expo-image-picker';
import React, { useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Image,
    KeyboardAvoidingView,
    Modal,
    Platform,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View
} from 'react-native';
import MapLocationPicker from './map-location-picker';

type Props = {
  visible: boolean;
  onClose: () => void;
  onAdd: (event: any) => void;
};

export default function AddEventModal({ visible, onClose, onAdd }: Props) {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];

  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('');
  const [organizer, setOrganizer] = useState('');
  const [date, setDate] = useState(new Date());
  const [time, setTime] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [showCategoryPicker, setShowCategoryPicker] = useState(false);
  const [description, setDescription] = useState('');
  const [price, setPrice] = useState('');
  const [showMapPicker, setShowMapPicker] = useState(false);

  // Predefined categories
  const categories = ['Seminar', 'Workshop', 'Sports', 'Cultural', 'Academic', 'Other'];
  const [location, setLocation] = useState<{ latitude: number; longitude: number; address?: string } | null>(null);
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

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

  const handleLocationSelect = (selectedLocation: { latitude: number; longitude: number; address?: string }) => {
    setLocation(selectedLocation);
    setShowMapPicker(false);
  };

  const pickImage = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission needed', 'Please grant camera roll permissions to upload images.');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [16, 9],
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]) {
        setImageUri(result.assets[0].uri);
      }
    } catch (error) {
      console.error('Error picking image:', error);
      Alert.alert('Error', 'Failed to pick image');
    }
  };

  const uploadImage = async (uri: string): Promise<string | null> => {
    try {
      const supabase = await getSupabase();
      const user = await supabase.auth.getUser();
      
      if (!user.data.user) {
        throw new Error('User not authenticated');
      }

      // Fetch the image from local URI
      const response = await fetch(uri);
      if (!response.ok) {
        throw new Error('Failed to fetch image');
      }
      
      const blob = await response.blob();
      
      // Ensure blob is valid
      if (!blob || blob.size === 0) {
        throw new Error('Invalid image file');
      }
      
      const fileExt = uri.split('.').pop()?.toLowerCase() || 'jpg';
      const fileName = `${user.data.user.id}_${Date.now()}.${fileExt}`;
      const filePath = `event-images/${fileName}`;

      // Convert blob to ArrayBuffer for React Native compatibility
      // Use FileReader since blob.arrayBuffer() is not available in React Native
      const arrayBuffer = await new Promise<ArrayBuffer>((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => {
          if (reader.result instanceof ArrayBuffer) {
            resolve(reader.result);
          } else {
            reject(new Error('Failed to read file as ArrayBuffer'));
          }
        };
        reader.onerror = () => reject(reader.error);
        reader.readAsArrayBuffer(blob);
      });
      
      const fileData = new Uint8Array(arrayBuffer);

      const { error: uploadError } = await supabase.storage
        .from('event-images')
        .upload(filePath, fileData, {
          contentType: blob.type || `image/${fileExt}`,
          upsert: false,
        });

      if (uploadError) {
        console.error('Upload error:', uploadError);
        throw new Error(uploadError.message || 'Failed to upload image');
      }

      const { data: { publicUrl } } = supabase.storage
        .from('event-images')
        .getPublicUrl(filePath);

      return publicUrl;
    } catch (error: any) {
      console.error('Error uploading image:', error);
      throw new Error(error.message || 'Failed to upload image. Please try again.');
    }
  };

  const isFormValid = () => {
    return (
      title.trim() !== '' &&
      category.trim() !== '' &&
      organizer.trim() !== '' &&
      description.trim() !== '' &&
      price.trim() !== '' &&
      location !== null &&
      date !== null &&
      time !== null
    );
  };

  // STEP 3: SUBMIT NEW EVENT - Validate, upload image, and create event
  const submit = async () => {
    // STEP 3A: VALIDATION - Ensure all required fields are filled
    if (!isFormValid()) {
      Alert.alert('Incomplete Form', 'Please fill in all required fields including date, time, and location');
      return;
    }

    try {
      setUploading(true);
      
      // STEP 3B: IMAGE UPLOAD - Upload photo to Supabase Storage if provided
      let imageUrl = null;
      if (imageUri) {
        try {
          imageUrl = await uploadImage(imageUri); // Upload and get public URL
        } catch (uploadError: any) {
          Alert.alert('Upload Failed', uploadError.message || 'Failed to upload image. Please try again.');
          setUploading(false);
          return; // Stop submission if image upload fails
        }
      }

      // STEP 3C: PRICE PARSING - Convert price string to number (LKR)
      let priceValue: number | null = null;
      if (price.trim()) {
        const priceStr = price.trim().toLowerCase();
        if (priceStr === 'free') {
          priceValue = 0; // "Free" becomes 0
        } else {
          // Remove currency symbols (LKR, Rs) and parse number
          const numericPrice = priceStr.replace(/[^0-9.]/g, '');
          const parsed = parseFloat(numericPrice);
          priceValue = isNaN(parsed) ? null : parsed;
        }
      }

      // STEP 3D: BUILD EVENT OBJECT - Combine all form data
      const newEvent = {
        title: title.trim(),
        category: category.trim(),
        organizer: organizer.trim(),
        start_at: new Date(date.setHours(time.getHours(), time.getMinutes())).toISOString(), // Combine date + time
        end_at: null, // End time not supported in current UI
        latitude: location!.latitude, // From map picker
        longitude: location!.longitude,
        location_name: location!.address || 'Location on map',
        location: location!.address || 'Location on map',
        description: description.trim(),
        price: priceValue,
        image_url: imageUrl, // Supabase Storage URL or null
        attendees: [], // Empty array for new events
        is_public: true, // All events are public
        is_resolved: false, // Not resolved/deleted
      };

      // STEP 3E: CALL PARENT CALLBACK - Send to events screen to insert in database
      await onAdd(newEvent);
      
      // STEP 3F: RESET FORM - Clear all inputs for next use
      resetForm();
      onClose(); // Close modal
    } catch (error: any) {
      console.error('Error creating event:', error);
      Alert.alert('Error', error.message || 'Failed to create event');
    } finally {
      setUploading(false);
    }
  };

  const resetForm = () => {
    setTitle('');
    setCategory('');
    setOrganizer('');
    setDate(new Date());
    setTime(new Date());
    setLocation(null);
    setDescription('');
    setPrice('');
    setImageUri(null);
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  return (
    <>
      <Modal visible={visible} animationType="slide" onRequestClose={handleClose} transparent>
        <KeyboardAvoidingView 
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.backdrop}
        >
          <View style={[styles.modalContainer, { backgroundColor: 'rgba(0,0,0,0.5)' }]}>
            <View style={[styles.sheet, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}> 
              <ScrollView 
                contentContainerStyle={styles.content}
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={true}
                bounces={true}
              >
                  <Text style={[styles.heading, { color: colors.text }]}>Add New Event</Text>

                  {/* Image Upload Section */}
                  <View style={styles.imageSection}>
                    {imageUri ? (
                      <View style={styles.imagePreviewContainer}>
                        <Image source={{ uri: imageUri }} style={styles.imagePreview} />
                        <TouchableOpacity 
                          style={styles.removeImageButton}
                          onPress={() => setImageUri(null)}
                        >
                          <FontAwesome name="times-circle" size={24} color="#e74c3c" />
                        </TouchableOpacity>
                      </View>
                    ) : (
                      <TouchableOpacity 
                        style={[styles.imagePicker, { borderColor: colors.cardBorder }]}
                        onPress={pickImage}
                      >
                        <FontAwesome name="image" size={32} color={colors.textSecondary} />
                        <Text style={[styles.imagePickerText, { color: colors.textSecondary }]}>
                          Upload Event Image (Optional)
                        </Text>
                      </TouchableOpacity>
                    )}
                  </View>

                  <Text style={[styles.label, { color: colors.text }]}>Title *</Text>
                  <TextInput 
                    placeholder="Event title" 
                    placeholderTextColor={colors.textSecondary} 
                    value={title} 
                    onChangeText={setTitle} 
                    style={[styles.input, { color: colors.text, borderColor: colors.cardBorder }]} 
                  />

                  <Text style={[styles.label, { color: colors.text }]}>Category *</Text>
                  <TouchableOpacity 
                    onPress={() => setShowCategoryPicker(true)} 
                    style={[styles.input, styles.pickerButton, { borderColor: colors.cardBorder }]}
                  >
                    <FontAwesome name="list" size={16} color={colors.textSecondary} style={styles.inputIcon} />
                    <Text style={{ color: category ? colors.text : colors.textSecondary }}>
                      {category || 'Select category'}
                    </Text>
                  </TouchableOpacity>

                  {/* Category Picker Modal */}
                  {showCategoryPicker && (
                    <Modal transparent animationType="fade" onRequestClose={() => setShowCategoryPicker(false)}>
                      <TouchableOpacity 
                        style={styles.pickerModalBackdrop}
                        activeOpacity={1}
                        onPress={() => setShowCategoryPicker(false)}
                      >
                        <View style={[styles.pickerModalContent, { backgroundColor: colors.card }]}>
                          <Text style={[styles.pickerModalTitle, { color: colors.text }]}>Select Category</Text>
                          {categories.map((cat) => (
                            <TouchableOpacity
                              key={cat}
                              style={[
                                styles.categoryOption,
                                { borderBottomColor: colors.cardBorder },
                                category === cat && { backgroundColor: colors.primary + '20' }
                              ]}
                              onPress={() => {
                                setCategory(cat);
                                setShowCategoryPicker(false);
                              }}
                            >
                              <Text style={[
                                styles.categoryOptionText, 
                                { color: category === cat ? colors.primary : colors.text }
                              ]}>
                                {cat}
                              </Text>
                              {category === cat && (
                                <FontAwesome name="check" size={16} color={colors.primary} />
                              )}
                            </TouchableOpacity>
                          ))}
                        </View>
                      </TouchableOpacity>
                    </Modal>
                  )}

                  <Text style={[styles.label, { color: colors.text }]}>Organizer *</Text>
                  <TextInput 
                    placeholder="Organizer name" 
                    placeholderTextColor={colors.textSecondary} 
                    value={organizer} 
                    onChangeText={setOrganizer} 
                    style={[styles.input, { color: colors.text, borderColor: colors.cardBorder }]} 
                  />
                  
                  <Text style={[styles.label, { color: colors.text }]}>Date *</Text>
                  <TouchableOpacity 
                    onPress={() => setShowDatePicker(true)} 
                    style={[styles.input, styles.pickerButton, { borderColor: colors.cardBorder }]}
                  >
                    <FontAwesome name="calendar" size={16} color={colors.textSecondary} style={styles.inputIcon} />
                    <Text style={{ color: colors.text }}>{formatDate(date)}</Text>
                  </TouchableOpacity>
                  {showDatePicker && (
                    <DateTimePicker
                      value={date}
                      mode="date"
                      display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                      onChange={onDateChange}
                      minimumDate={new Date()}
                    />
                  )}

                  <Text style={[styles.label, { color: colors.text }]}>Time *</Text>
                  <TouchableOpacity 
                    onPress={() => setShowTimePicker(true)} 
                    style={[styles.input, styles.pickerButton, { borderColor: colors.cardBorder }]}
                  >
                    <FontAwesome name="clock-o" size={16} color={colors.textSecondary} style={styles.inputIcon} />
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

                  <Text style={[styles.label, { color: colors.text }]}>Location *</Text>
                  <TouchableOpacity 
                    onPress={() => setShowMapPicker(true)}
                    style={[styles.input, styles.pickerButton, { borderColor: colors.cardBorder }]}
                  >
                    <FontAwesome name="map-marker" size={16} color={colors.textSecondary} style={styles.inputIcon} />
                    <Text style={{ color: location ? colors.text : colors.textSecondary }}>
                      {location ? location.address || 'Location selected' : 'Select location on map'}
                    </Text>
                  </TouchableOpacity>

                  <Text style={[styles.label, { color: colors.text }]}>Price (LKR) *</Text>
                  <TextInput 
                    placeholder="e.g., Free, 500, 1000" 
                    placeholderTextColor={colors.textSecondary} 
                    value={price} 
                    onChangeText={setPrice}
                    keyboardType="numeric"
                    style={[styles.input, { color: colors.text, borderColor: colors.cardBorder }]} 
                  />

                  <Text style={[styles.label, { color: colors.text }]}>Description *</Text>
                  <TextInput 
                    placeholder="Event description" 
                    placeholderTextColor={colors.textSecondary} 
                    value={description} 
                    onChangeText={setDescription} 
                    style={[styles.inputMultiline, { color: colors.text, borderColor: colors.cardBorder }]} 
                    multiline 
                    numberOfLines={4} 
                  />
              </ScrollView>

              {/* Fixed bottom buttons */}
              <View style={[styles.actionsContainer, { borderTopColor: colors.cardBorder, backgroundColor: colors.card }]}>
                <View style={styles.actionsRow}>
                    <TouchableOpacity 
                      style={[styles.button, styles.cancelButton, { backgroundColor: colors.cardBorder }]} 
                      onPress={handleClose}
                      disabled={uploading}
                    >
                      <Text style={{ color: colors.text, fontWeight: '600' }}>Cancel</Text>
                    </TouchableOpacity>
                    <TouchableOpacity 
                      style={[
                        styles.button, 
                        styles.submitButton,
                        { 
                          backgroundColor: isFormValid() && !uploading ? colors.primary : colors.cardBorder,
                          opacity: isFormValid() && !uploading ? 1 : 0.6
                        }
                      ]} 
                      onPress={submit}
                      disabled={!isFormValid() || uploading}
                    >
                      {uploading ? (
                        <ActivityIndicator size="small" color="#fff" />
                      ) : (
                        <Text style={{ color: '#fff', fontWeight: '600' }}>Publish Event</Text>
                      )}
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
          </View>
        </KeyboardAvoidingView>
        </Modal>
      {/* Map Location Picker Modal */}
      <MapLocationPicker
        visible={showMapPicker}
        onClose={() => setShowMapPicker(false)}
        onSelectLocation={handleLocationSelect}
        initialLocation={location || undefined}
      />
    </>
  );
}

const styles = StyleSheet.create({
  backdrop: { 
    flex: 1,
  },
  modalContainer: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  sheet: { 
    maxHeight: '67%', // 2/3 of screen height
    minHeight: '67%',
    borderTopLeftRadius: 16, 
    borderTopRightRadius: 16, 
    borderWidth: 1,
    flexDirection: 'column',
  },
  content: { 
    padding: 16, 
    paddingTop: 20, 
    paddingBottom: 100, // Add padding for button space
    flexGrow: 1,
    paddingBottom: 20 
  },
  heading: { 
    fontSize: 20, 
    fontWeight: '700', 
    marginBottom: 20 
  },
  label: { 
    fontSize: 14, 
    fontWeight: '600', 
    marginBottom: 6, 
    marginTop: 8 
  },
  input: { 
    borderWidth: 1, 
    borderRadius: 8, 
    padding: 12, 
    marginBottom: 12,
    fontSize: 15,
  },
  inputIcon: {
    marginRight: 8,
  },
  inputMultiline: { 
    borderWidth: 1, 
    borderRadius: 8, 
    padding: 12, 
    marginBottom: 12, 
    minHeight: 100,
    textAlignVertical: 'top',
    fontSize: 15,
  },
  pickerButton: { 
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start' 
  },
  imageSection: {
    marginBottom: 16,
  },
  imagePicker: {
    borderWidth: 2,
    borderStyle: 'dashed',
    borderRadius: 12,
    padding: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  imagePickerText: {
    marginTop: 12,
    fontSize: 14,
    fontWeight: '500',
  },
  imagePreviewContainer: {
    position: 'relative',
    borderRadius: 12,
    overflow: 'hidden',
  },
  imagePreview: {
    width: '100%',
    height: 200,
    borderRadius: 12,
  },
  removeImageButton: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: '#fff',
    bosition: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 16,
    paddingTop: 12, 
    paddingBottom: Platform.OS === 'ios' ? 32 : 16, 
    borderTopWidth: 1,
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  actionsRow: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    gap: 12 
  },
  button: { 
    flex: 1, 
    paddingVertical: 14, 
    paddingHorizontal: 16, 
    borderRadius: 8, 
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelButton: {
    // Additional styles if needed
  },
  submitButton: {
    // Additional styles if needed
  },
  pickerModalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  pickerModalContent: {
    width: '90%',
    maxWidth: 400,
    borderRadius: 12,
    padding: 20,
    maxHeight: '70%',
  },
  pickerModalTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 16,
    textAlign: 'center',
  },
  categoryOption: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
  },
  categoryOptionText: {
    fontSize: 16,
    fontWeight: '500',
  },
});
