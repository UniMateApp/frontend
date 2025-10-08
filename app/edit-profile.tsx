import { Colors } from '@/constants/theme';
import { useUser } from '@/contexts/UserContext';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { upsertProfile } from '@/services/profiles';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    KeyboardAvoidingView,
    Platform,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';

export default function EditProfileScreen() {
  const router = useRouter();
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const { user, profile, refreshProfile } = useUser();
  
  const [fullName, setFullName] = useState(profile?.full_name || user?.user_metadata?.full_name || '');
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!user?.id) return;
    
    try {
      setSaving(true);
      await upsertProfile({
        id: user.id,
        full_name: fullName.trim() || null,
        avatar_url: profile?.avatar_url || null,
        expo_push_token: profile?.expo_push_token || null,
      });
      
      await refreshProfile();
      
      Alert.alert('Success', 'Profile updated successfully!', [
        {
          text: 'OK',
          onPress: () => router.back(),
        },
      ]);
    } catch (error) {
      console.error('Failed to update profile:', error);
      Alert.alert('Error', 'Failed to update profile. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    router.back();
  };

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: colors.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={[styles.header, { backgroundColor: colors.card }]}>
          <View style={styles.headerButtons}>
            <TouchableOpacity 
              style={[styles.button, styles.cancelButton, { borderColor: colors.cardBorder }]} 
              onPress={handleCancel}>
              <Text style={[styles.buttonText, { color: colors.textSecondary }]}>Cancel</Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={[styles.button, styles.saveButton, { backgroundColor: colors.primary }]} 
              onPress={handleSave}
              disabled={saving}>
              {saving ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text style={[styles.buttonText, { color: '#fff' }]}>Save</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>

        <View style={[styles.formSection, { backgroundColor: colors.card }]}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Profile Information</Text>
          
          <View style={styles.field}>
            <Text style={[styles.label, { color: colors.textSecondary }]}>Full Name</Text>
            <TextInput
              style={[styles.input, { 
                color: colors.text, 
                borderColor: colors.cardBorder,
                backgroundColor: colors.background 
              }]}
              value={fullName}
              onChangeText={setFullName}
              placeholder="Enter your full name"
              placeholderTextColor={colors.textSecondary}
              autoCapitalize="words"
            />
          </View>

          <View style={styles.field}>
            <Text style={[styles.label, { color: colors.textSecondary }]}>Email</Text>
            <TextInput
              style={[styles.input, styles.disabledInput, { 
                color: colors.textSecondary, 
                borderColor: colors.cardBorder,
                backgroundColor: colors.cardBorder 
              }]}
              value={user?.email || ''}
              editable={false}
              placeholder="Email address"
              placeholderTextColor={colors.textSecondary}
            />
            <Text style={[styles.helpText, { color: colors.textSecondary }]}>
              Email cannot be changed
            </Text>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    padding: 16,
  },
  header: {
    padding: 16,
    borderRadius: 16,
    marginBottom: 24,
  },
  headerButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  button: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
    minWidth: 80,
    alignItems: 'center',
  },
  cancelButton: {
    borderWidth: 1,
  },
  saveButton: {
    // backgroundColor set dynamically
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  formSection: {
    padding: 20,
    borderRadius: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 20,
  },
  field: {
    marginBottom: 20,
  },
  label: {
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 16,
  },
  disabledInput: {
    opacity: 0.6,
  },
  helpText: {
    fontSize: 12,
    marginTop: 4,
  },
});