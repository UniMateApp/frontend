import { DEFAULT_LOCATION, DEFAULT_LOCATION_NAME } from '@/constants/campus';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { createNotifications } from '@/services/notifications';
import { supabase } from '@/services/supabase';
import { FontAwesome } from '@expo/vector-icons';
import * as FileSystem from 'expo-file-system/legacy';
import * as ImagePicker from 'expo-image-picker';
import React, { useState } from 'react';
import { ActivityIndicator, Alert, Image, Keyboard, KeyboardAvoidingView, Modal, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, TouchableWithoutFeedback, View } from 'react-native';
import MapLocationPicker from './map-location-picker';


type Props = {
  visible: boolean;
  onClose: () => void;
  onSubmit: (post: any) => void;
};

// ========================================
// LOST AND FOUND MODAL - CREATE POST FORM
// ========================================
// This modal handles the complete flow for creating a lost/found post:
// 1. User selects type (Lost or Found)
// 2. User fills in item details (name, description, contact)
// 3. User takes/selects a photo (required)
// 4. Photo is uploaded to Supabase Storage
// 5. User optionally selects location on map
// 6. Post is submitted to database
// 7. Notifications are sent to users who posted opposite type
// ========================================

export default function LostFoundModal({ visible, onClose, onSubmit }: Props) {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];

  // STEP 1: FORM STATE - Track all input fields for the post
  const [type, setType] = useState<'Lost' | 'Found'>('Lost'); // Type of post: Lost or Found
  const [title, setTitle] = useState(''); // Item name/title
  const [description, setDescription] = useState(''); // Detailed description
  const [contact, setContact] = useState(''); // Contact information
  const [imageUrl, setImageUrl] = useState<string | null>(null); // Final Supabase Storage URL
  const [showPhotoOptions, setShowPhotoOptions] = useState(false); // Show camera/gallery picker
  const [uploading, setUploading] = useState(false); // Upload in progress
  const [previewImage, setPreviewImage] = useState<string | null>(null); // Local preview URI
  const [showPreview, setShowPreview] = useState(false); // Show preview screen
  const [showMapPicker, setShowMapPicker] = useState(false); // Show map location picker
  const [selectedLocation, setSelectedLocation] = useState<{
    latitude: number;
    longitude: number;
    address?: string;
  } | null>(null); // Selected location coordinates

  const isPostDisabled = !title.trim() || !description.trim() || !contact.trim() || !imageUrl;

  const getMissingFields = () => {
    const missing = [] as string[];
    if (!title.trim()) missing.push('Item name');
    if (!description.trim()) missing.push('Description');
    if (!contact.trim()) missing.push('Contact');
    if (!imageUrl) missing.push('Photo');
    return missing;
  };

  const requestPermissions = async () => {
    const cameraPermission = await ImagePicker.requestCameraPermissionsAsync();
    const mediaLibraryPermission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    
    return {
      camera: cameraPermission.status === 'granted',
      mediaLibrary: mediaLibraryPermission.status === 'granted',
    };
  };

// STEP 2: IMAGE UPLOAD - Upload selected photo to Supabase Storage
const uploadImageToSupabase = async (uri: string): Promise<string | null> => {
  try {
    setUploading(true);

    const supabaseClient = await supabase(); // Get Supabase client

    // STEP 2A: GENERATE UNIQUE FILENAME
    const fileExt = uri.split('.').pop()?.toLowerCase() || 'jpg';
    const fileName = `${Date.now()}-${Math.random().toString(36).substring(2)}.${fileExt}`;
    const filePath = `lost-found/${fileName}`; // Store in lost-found folder

    // STEP 2B: CONVERT IMAGE TO BINARY DATA
    // Different approach for web vs mobile platforms
    let fileData: Uint8Array;

    if (Platform.OS === 'web') {
      // Web: Fetch blob and convert to ArrayBuffer
      const response = await fetch(uri);
      const blob = await response.blob();
      const arrayBuffer = await blob.arrayBuffer();
      fileData = new Uint8Array(arrayBuffer);
    } else {
      // Mobile: Read as base64 and convert to binary
      const base64 = await FileSystem.readAsStringAsync(uri, { encoding: 'base64' });
      fileData = Uint8Array.from(atob(base64), c => c.charCodeAt(0));
    }

    // STEP 2C: UPLOAD TO SUPABASE STORAGE
    const { data, error } = await supabaseClient.storage
      .from('images') // 'images' bucket
      .upload(filePath, fileData, {
        contentType: `image/${fileExt}`,
        upsert: false, // Don't overwrite existing files
      });

    if (error) {
      console.error('Upload error:', error);
      Alert.alert('Upload Error', error.message);
      return null;
    }

    // STEP 2D: GET PUBLIC URL - Retrieve the publicly accessible URL
    const { data: publicData } = supabaseClient.storage
      .from('images')
      .getPublicUrl(filePath);

    return publicData.publicUrl; // Return URL to store in database
  } catch (error: any) {
    console.error('Upload failed:', error);
    Alert.alert('Upload Failed', error.message || 'Failed to upload image');
    return null;
  } finally {
    setUploading(false);
  }
};


  const takePhoto = async () => {
    const permissions = await requestPermissions();
    
    if (!permissions.camera) {
      Alert.alert('Permission Required', 'Camera permission is needed to take photos.');
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.7,
    });

    if (!result.canceled && result.assets[0]) {
      setPreviewImage(result.assets[0].uri);
      setShowPreview(true);
      setShowPhotoOptions(false);
    }
  };

  const pickPhoto = async () => {
    const permissions = await requestPermissions();
    
    if (!permissions.mediaLibrary) {
      Alert.alert('Permission Required', 'Media library permission is needed to select photos.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.7,
      allowsMultipleSelection: false, // Single image only
    });

    console.log(result)

    if (!result.canceled && result.assets[0]) {
      setPreviewImage(result.assets[0].uri);
      setShowPreview(true);
      setShowPhotoOptions(false);
    }
  };

  const confirmPhoto = async () => {
    if (previewImage) {
      const publicUrl = await uploadImageToSupabase(previewImage);
      if (publicUrl) {
        console.log("✅ Final Image URL saved:", publicUrl);

        setImageUrl(publicUrl);
        setShowPreview(false);
        setPreviewImage(null);
      }
    }
  };

  const retakePhoto = () => {
    setShowPreview(false);
    setPreviewImage(null);
    setShowPhotoOptions(true);
  };

  const removePhoto = () => {
    setImageUrl(null);
  };

  const submit = async () => {
    if (isPostDisabled) {
      const missing = getMissingFields();
      const message = missing.length
        ? `Please complete: ${missing.join(', ')}`
        : 'Please fill in all required fields before posting.';
      Alert.alert('Missing details', message);
      return;
    }

    const post = {
      id: String(Date.now()),
      type,
      title: title.trim(),
      description,
      contact,
      image_url: imageUrl,
      createdAt: new Date().toISOString(),
      resolved: false,
      location: selectedLocation 
        ? `${selectedLocation.latitude},${selectedLocation.longitude}`
        : DEFAULT_LOCATION,
    };

    console.log('📝 Submitting data with image:', post);

    try {
      // STEP 3A: DATABASE INSERT - Call parent handler to insert post into database
      const result = await onSubmit(post as any); // Wait for DB insert to complete

      // STEP 3B: SMART NOTIFICATIONS - Notify users who posted opposite type
      // Example: If user posts "Found Wallet", notify users who posted "Lost Wallet"
      try {
        const client = await supabase();
        // Get current user id (may be null if anonymous posting)
        let currentUserId: string | null = null;
        try {
          const { data: userRes } = await client.auth.getUser();
          currentUserId = userRes?.user?.id ?? null;
        } catch (e) {
          // Ignore if not logged in
        }

        // Determine opposite type: Lost -> found, Found -> lost
        const oppositeKind = (type === 'Lost') ? 'found' : 'lost';

        const { data: others, error: fetchErr } = await client
          .from('lost_found')
          .select('*')
          .eq('resolved', false)
          .eq('kind', oppositeKind)
          .neq('created_by', currentUserId);

        if (fetchErr) {
          console.error('Failed to fetch opposite posts for notifications', fetchErr);
        } else if (others && others.length) {
          // Group posts by recipient (created_by) to avoid sending multiple notifications
          const byRecipient = new Map<string, any[]>();
          for (const o of others) {
            const rid = String(o.created_by || '');
            if (!rid) continue;
            if (!byRecipient.has(rid)) byRecipient.set(rid, []);
            byRecipient.get(rid)!.push(o);
          }

          // Build one notification per recipient
          const notifications: any[] = [];
          for (const [recipientId, postsForUser] of byRecipient.entries()) {
            if (!recipientId || recipientId === currentUserId) continue; // skip bad or self

            const matchedIds = postsForUser.map(p => String(p.id));
            const metadata = {
              matched_post_ids: matchedIds,
              new_post_client_id: post.id,
              kind: post.type.toLowerCase(),
              location: selectedLocation?.address || DEFAULT_LOCATION_NAME,
            };

            notifications.push({
              recipient_id: recipientId,
              sender_id: currentUserId,
              title: `${type} posted: ${post.title}`,
              message: post.description || '',
              metadata: JSON.stringify(metadata),
              read: false,
              created_at: new Date().toISOString(),
            });
          }

          if (notifications.length) {
            try {
              await createNotifications(notifications);
              console.log('Notifications created for opposite-type posters', notifications.length);
            } catch (nErr) {
              console.error('Failed to create notifications', nErr);
            }
          }
        }
      } catch (notifyErr) {
        console.error('Notification flow failed', notifyErr);
      }

    } catch (err) {
      console.error('Submit handler failed', err);
    }

    // reset UI regardless of notification outcome
    setType('Lost');
    setTitle('');
    setDescription('');
    setContact('');
    setImageUrl(null);
    setShowPhotoOptions(false);
    setPreviewImage(null);
    setShowPreview(false);
    setSelectedLocation(null);
    onClose();
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
        <View style={[styles.backdrop, { backgroundColor: 'rgba(0,0,0,0.4)' }]}>
          <KeyboardAvoidingView 
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={styles.keyboardView}
            keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
          >
            <View style={[styles.sheet, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}> 
              <ScrollView 
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
                contentContainerStyle={styles.scrollContent}
              >
            <Text style={[styles.heading, { color: colors.text }]}>New {type} Post</Text>

            <View style={styles.typeRow}>
              <TouchableOpacity style={[styles.typeButton, type === 'Lost' ? { borderColor: colors.primary } : { borderColor: colors.cardBorder }]} onPress={() => setType('Lost')}>
                <Text style={{ color: colors.text }}>Lost</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.typeButton, type === 'Found' ? { borderColor: colors.primary } : { borderColor: colors.cardBorder }]} onPress={() => setType('Found')}>
                <Text style={{ color: colors.text }}>Found</Text>
              </TouchableOpacity>
            </View>

            {/* Photo Section */}
            <View style={styles.photoSection}>
              <View style={styles.photoHeader}>
                <Text style={[styles.photoLabel, { color: colors.text }]}>Photo</Text>
                {!imageUrl && (
                  <TouchableOpacity 
                    style={[styles.addPhotoButton, { borderColor: colors.primary, opacity: uploading ? 0.6 : 1 }]} 
                    onPress={() => setShowPhotoOptions(!showPhotoOptions)}
                    disabled={uploading}
                  >
                    {uploading ? (
                      <ActivityIndicator size="small" color={colors.primary} />
                    ) : (
                      <FontAwesome name="plus" size={16} color={colors.primary} />
                    )}
                    <Text style={[styles.addPhotoText, { color: colors.primary }]}>
                      {uploading ? 'Uploading...' : 'Add Photo'}
                    </Text>
                  </TouchableOpacity>
                )}
              </View>

              {/* Photo Options - Only Camera and Gallery */}
              {showPhotoOptions && !imageUrl && !showPreview && (
                <View style={[styles.photoOptions, { backgroundColor: colors.background, borderColor: colors.cardBorder }]}>
                  <TouchableOpacity style={styles.photoOption} onPress={takePhoto} disabled={uploading}>
                    <FontAwesome name="camera" size={20} color={colors.primary} />
                    <Text style={[styles.photoOptionText, { color: colors.text }]}>Take Photo</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.photoOption} onPress={pickPhoto} disabled={uploading}>
                    <FontAwesome name="image" size={20} color={colors.primary} />
                    <Text style={[styles.photoOptionText, { color: colors.text }]}>Choose from Gallery</Text>
                  </TouchableOpacity>
                </View>
              )}

              {/* Photo Preview with Retake/Reupload Options */}
              {showPreview && previewImage && (
                <View style={styles.previewSection}>
                  <View style={styles.imageContainer}>
                    <Image source={{ uri: previewImage }} style={styles.image} />
                    {!uploading && (
                      <TouchableOpacity 
                        style={[styles.okButton, { backgroundColor: colors.primary }]} 
                        onPress={confirmPhoto}
                      >
                        <FontAwesome name="check" size={12} color="#fff" />
                      </TouchableOpacity>
                    )}
                  </View>
                  
                  {uploading && (
                    <View style={styles.uploadingContainer}>
                      <ActivityIndicator size="small" color={colors.primary} />
                      <Text style={[styles.uploadingText, { color: colors.textSecondary }]}>Uploading...</Text>
                    </View>
                  )}
                  
                  {!uploading && (
                    <View style={styles.retakeActions}>
                      <TouchableOpacity 
                        style={styles.retakeOption} 
                        onPress={takePhoto}
                      >
                        <FontAwesome name="camera" size={16} color={colors.primary} />
                        <Text style={[styles.retakeText, { color: colors.primary }]}>Retake</Text>
                      </TouchableOpacity>
                      <TouchableOpacity 
                        style={styles.retakeOption} 
                        onPress={pickPhoto}
                      >
                        <FontAwesome name="image" size={16} color={colors.primary} />
                        <Text style={[styles.retakeText, { color: colors.primary }]}>Reupload</Text>
                      </TouchableOpacity>
                    </View>
                  )}
                </View>
              )}

              {/* Final Photo Display */}
              {imageUrl && !showPreview && (
                <View style={styles.imageContainer}>
                  <Image source={{ uri: imageUrl }} style={styles.image} />
                  <TouchableOpacity 
                    style={[styles.okButton, { backgroundColor: colors.primary }]} 
                    onPress={removePhoto}
                  >
                    <FontAwesome name="times" size={12} color="#fff" />
                  </TouchableOpacity>
                </View>
              )}
            </View>

            <TextInput placeholder="Item name" placeholderTextColor={colors.textSecondary} value={title} onChangeText={setTitle} style={[styles.input, { color: colors.text, borderColor: colors.cardBorder }]} />
            <TextInput placeholder="Description" placeholderTextColor={colors.textSecondary} value={description} onChangeText={setDescription} style={[styles.inputMultiline, { color: colors.text, borderColor: colors.cardBorder }]} multiline numberOfLines={4} />
            <TextInput placeholder="Contact (WhatsApp)" placeholderTextColor={colors.textSecondary} value={contact} onChangeText={setContact} style={[styles.input, { color: colors.text, borderColor: colors.cardBorder }]} />
            
            {/* Location Picker */}
            <View style={styles.locationSection}>
              <Text style={[styles.locationLabel, { color: colors.text }]}>Location</Text>
              <TouchableOpacity 
                style={[styles.locationButton, { 
                  backgroundColor: colors.background, 
                  borderColor: selectedLocation ? colors.primary : colors.cardBorder 
                }]}
                onPress={() => setShowMapPicker(true)}
              >
                <FontAwesome 
                  name="map-marker" 
                  size={18} 
                  color={selectedLocation ? colors.primary : colors.textSecondary} 
                />
                <View style={styles.locationButtonText}>
                  <Text style={[
                    styles.locationButtonTitle, 
                    { color: selectedLocation ? colors.text : colors.textSecondary }
                  ]}>
                    {selectedLocation ? 'Location Selected' : 'Select Location on Map'}
                  </Text>
                  {selectedLocation?.address && (
                    <Text style={[styles.locationButtonAddress, { color: colors.textSecondary }]} numberOfLines={1}>
                      {selectedLocation.address}
                    </Text>
                  )}
                </View>
                <FontAwesome name="chevron-right" size={14} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>
              </ScrollView>

              <View style={styles.actionsContainer}>
            <View style={styles.actionsRow}>
              <TouchableOpacity style={[styles.button, { backgroundColor: colors.cardBorder }]} onPress={onClose}>
                <Text style={{ color: colors.text }}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.button, { backgroundColor: isPostDisabled ? colors.cardBorder : colors.primary, opacity: isPostDisabled ? 0.7 : 1 }]}
                onPress={submit}
              >
                <Text style={{ color: '#fff' }}>Post</Text>
              </TouchableOpacity>
            </View>
              </View>
            </View>
          </KeyboardAvoidingView>

          {/* Map Location Picker Modal */}
          <MapLocationPicker
            visible={showMapPicker}
            onClose={() => setShowMapPicker(false)}
            onSelectLocation={(location) => setSelectedLocation(location)}
            initialLocation={selectedLocation || undefined}
          />
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: 'flex-end' },
  keyboardView: { width: '100%' },
  scrollContent: { flexGrow: 1, paddingTop: 20, paddingBottom: 300, paddingHorizontal: 16 },
  sheet: { maxHeight: '90%', borderTopLeftRadius: 12, borderTopRightRadius: 12, borderWidth: 1, paddingBottom: 0 },
  heading: { fontSize: 18, fontWeight: '700', marginBottom: 12 },
  typeRow: { flexDirection: 'row', marginBottom: 12 },
  typeButton: { borderWidth: 1, paddingVertical: 8, paddingHorizontal: 12, borderRadius: 8, marginRight: 8 },
  
  // Photo section styles
  photoSection: {
    marginBottom: 16,
  },
  photoHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  photoLabel: {
    fontSize: 16,
    fontWeight: '600',
  },
  addPhotoButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    borderRadius: 8,
  },
  addPhotoText: {
    marginLeft: 6,
    fontSize: 14,
    fontWeight: '500',
  },
  photoOptions: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
  },
  photoOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
  },
  photoOptionText: {
    marginLeft: 12,
    fontSize: 16,
  },
  // Image styles (matching lost-found detail page)
  imageContainer: {
    position: 'relative',
    marginTop: 12,
  },
  image: {
    width: '100%',
    height: 200,
    borderRadius: 12,
  },
  okButton: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  
  // Preview styles
  previewSection: {
    marginTop: 12,
  },
  uploadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 12,
  },
  uploadingText: {
    marginLeft: 8,
    fontSize: 14,
  },
  retakeActions: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: 12,
    paddingHorizontal: 20,
  },
  retakeOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  retakeText: {
    marginLeft: 6,
    fontSize: 14,
    fontWeight: '500',
  },
  
  input: { borderWidth: 1, borderRadius: 8, padding: 10, marginBottom: 10 },
  inputMultiline: { borderWidth: 1, borderRadius: 8, padding: 10, marginBottom: 10, minHeight: 80 },
  actionsContainer: { 
    paddingTop: 12, 
    paddingBottom: 32, 
    borderTopWidth: 1, 
    borderTopColor: 'rgba(0,0,0,0.05)' 
  },
  actionsRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 12 },
  button: { flex: 1, paddingVertical: 14, paddingHorizontal: 16, borderRadius: 8, alignItems: 'center' },
  
  // Location picker styles
  locationSection: {
    marginBottom: 16,
  },
  locationLabel: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
  },
  locationButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    gap: 12,
  },
  locationButtonText: {
    flex: 1,
  },
  locationButtonTitle: {
    fontSize: 14,
    fontWeight: '500',
  },
  locationButtonAddress: {
    fontSize: 12,
    marginTop: 2,
  },
  
  // Location info box (read-only) - kept for backward compatibility
  locationInfoBox: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    marginBottom: 16,
    gap: 8,
  },
  locationInfoText: {
    fontSize: 13,
    marginLeft: 4,
  },
});
