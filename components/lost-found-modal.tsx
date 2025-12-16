import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { createNotifications } from '@/services/notifications';
import { supabase } from '@/services/supabase';
import { FontAwesome } from '@expo/vector-icons';
import * as FileSystem from 'expo-file-system/legacy';
import * as ImagePicker from 'expo-image-picker';
import React, { useState } from 'react';
import { ActivityIndicator, Alert, Image, Modal, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';


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
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [showPhotoOptions, setShowPhotoOptions] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  const [selectedLocation, setSelectedLocation] = useState<{ latitude: number; longitude: number } | null>(null);

  const isPostDisabled = !title.trim() || !description.trim() || !contact.trim() || !selectedLocation || !imageUrl;

  const getMissingFields = () => {
    const missing = [] as string[];
    if (!title.trim()) missing.push('Item name');
    if (!description.trim()) missing.push('Description');
    if (!contact.trim()) missing.push('Contact');
    if (!imageUrl) missing.push('Photo');
    if (!selectedLocation) missing.push('Location');
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

const uploadImageToSupabase = async (uri: string): Promise<string | null> => {
  try {
    setUploading(true);

    const supabaseClient = await supabase(); // ✅ await

    const fileExt = uri.split('.').pop()?.toLowerCase() || 'jpg';
    const fileName = `${Date.now()}-${Math.random().toString(36).substring(2)}.${fileExt}`;
    const filePath = `lost-found/${fileName}`;

    let fileData: Uint8Array;

    if (Platform.OS === 'web') {
      const response = await fetch(uri);
      const blob = await response.blob();
      const arrayBuffer = await blob.arrayBuffer();
      fileData = new Uint8Array(arrayBuffer);
    } else {
      const base64 = await FileSystem.readAsStringAsync(uri, { encoding: 'base64' });
      fileData = Uint8Array.from(atob(base64), c => c.charCodeAt(0));
    }

    const { data, error } = await supabaseClient.storage
      .from('images')
      .upload(filePath, fileData, {
        contentType: `image/${fileExt}`,
        upsert: false,
      });

    if (error) {
      console.error('Upload error:', error);
      Alert.alert('Upload Error', error.message);
      return null;
    }

    const { data: publicData } = supabaseClient.storage
      .from('images')
      .getPublicUrl(filePath);

    return publicData.publicUrl;
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
        : 'Please add a photo, pick a location, and fill in all fields before posting.';
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
      : null,
    };

    console.log('📝 Submitting data with image:', post);

    try {
      // Await the parent handler so we only notify after DB insert completes
      const result = await onSubmit(post as any);

      // After successful submission, notify other users who posted the opposite kind
      try {
        const client = await supabase();
        // get current user id (may be null if anonymous)
        let currentUserId: string | null = null;
        try {
          const { data: userRes } = await client.auth.getUser();
          currentUserId = userRes?.user?.id ?? null;
        } catch (e) {
          // ignore
        }

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
              location: post.location,
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
    setSelectedLocation(null); // Reset location
    onClose();
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={[styles.backdrop, { backgroundColor: 'rgba(0,0,0,0.4)' }]}>
        <View style={[styles.sheet, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}> 
          <ScrollView showsVerticalScrollIndicator={false}>
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

            {/* Location Section (no Google Maps dependency) */}
            <View style={[styles.mapFallback, { borderColor: colors.cardBorder, backgroundColor: colors.background, marginBottom: 16 }]}
            >
              <Text style={{ color: colors.text, marginBottom: 8, fontWeight: '600' }}>Set location</Text>
              <Text style={{ color: colors.textSecondary, marginBottom: 8 }}>
                Enter coordinates or use your current location. No map API key required.
              </Text>
              <View style={styles.manualRow}>
                <TextInput
                  style={[styles.manualInput, { borderColor: colors.cardBorder, color: colors.text }]}
                  placeholder="Latitude"
                  placeholderTextColor={colors.textSecondary}
                  value={latInput}
                  onChangeText={setLatInput}
                  keyboardType="decimal-pad"
                />
                <TextInput
                  style={[styles.manualInput, { borderColor: colors.cardBorder, color: colors.text }]}
                  placeholder="Longitude"
                  placeholderTextColor={colors.textSecondary}
                  value={lngInput}
                  onChangeText={setLngInput}
                  keyboardType="decimal-pad"
                />
              </View>
              <View style={styles.manualActions}>
                <TouchableOpacity style={[styles.manualButton, { borderColor: colors.cardBorder }]} onPress={handleManualLocationSave}>
                  <Text style={{ color: colors.text }}>Save coords</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.manualButton, { borderColor: colors.cardBorder }]} onPress={handleUseCurrentLocation}>
                  <Text style={{ color: colors.primary }}>Use my location</Text>
                </TouchableOpacity>
              </View>
              {selectedLocation && (
                <Text style={{ color: colors.textSecondary, marginTop: 6 }}>
                  Selected: {selectedLocation.latitude.toFixed(5)}, {selectedLocation.longitude.toFixed(5)}
                </Text>
              )}
            </View>
          </ScrollView>

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
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: 'flex-end' },
  sheet: { maxHeight: '90%', borderTopLeftRadius: 12, borderTopRightRadius: 12, borderWidth: 1, padding: 16 },
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
  actionsRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 8 },
  button: { paddingVertical: 12, paddingHorizontal: 16, borderRadius: 8 },
  mapFallback: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
  },
  manualRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 8,
  },
  manualInput: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  manualActions: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 4,
  },
  manualButton: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: 'center',
  },
});
