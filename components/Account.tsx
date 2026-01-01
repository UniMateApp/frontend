// ========================================
// ACCOUNT COMPONENT - USER PROFILE MANAGEMENT
// ========================================
// This component allows authenticated users to view and update their profile.
// Features:
// 1. Display user's email (read-only from auth)
// 2. Edit username, website, and avatar URL
// 3. Save changes to the profiles table
// 4. Sign out functionality
// ========================================

import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { signOut } from '@/services/auth'
import { Session } from '@supabase/supabase-js'
import { useCallback, useEffect, useState } from 'react'
import { Alert, StyleSheet, View } from 'react-native'
import { supabase as getSupabase } from '../services/supabase'

export default function Account({ session }: { session: Session }) {
  // PROFILE STATE - Track editable profile fields
  const [loading, setLoading] = useState(true)
  const [username, setUsername] = useState('')
  const [website, setWebsite] = useState('')
  const [avatarUrl, setAvatarUrl] = useState('')

  // STEP 1: LOAD PROFILE - Fetch user's profile data from database
  const getProfile = useCallback(async () => {
    try {
      setLoading(true)
      if (!session?.user) throw new Error('No user on the session!')

      const supabase = await getSupabase();
      // Query profiles table for current user's data
      const { data, error, status } = await supabase
        .from('profiles')
        .select(`username, website, avatar_url`) // Select only needed fields
        .eq('id', session?.user.id) // Match by user ID
        .single() // Expect exactly one result
      
      // 406 status means profile doesn't exist yet (acceptable)
      if (error && status !== 406) {
        throw error
      }

      // Populate form fields with existing data
      if (data) {
        setUsername(data.username)
        setWebsite(data.website)
        setAvatarUrl(data.avatar_url)
      }
    } catch (error) {
      if (error instanceof Error) {
        Alert.alert(error.message)
      }
    } finally {
      setLoading(false)
    }
  }, [session])

  useEffect(() => {
    if (session) getProfile()
  }, [session, getProfile])

  // STEP 2: UPDATE PROFILE - Save changes to database
  async function updateProfile({
    username,
    website,
    avatar_url,
  }: {
    username: string
    website: string
    avatar_url: string
  }) {
    try {
      setLoading(true)
      if (!session?.user) throw new Error('No user on the session!')

      // Build update object with new values
      const updates = {
        id: session?.user.id, // Required for upsert to match existing row
        username,
        website,
        avatar_url,
        updated_at: new Date(), // Track when profile was last modified
      }

      const supabase = await getSupabase();
      // UPSERT: Update if exists, insert if not (though profile should exist)
      const { error } = await supabase.from('profiles').upsert(updates)

      if (error) {
        throw error
      }
    } catch (error) {
      if (error instanceof Error) {
        Alert.alert(error.message)
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <View style={styles.container}>
      <View style={[styles.verticallySpaced, styles.mt20]}>
        <Input label="Email" value={session?.user?.email} editable={false} />
      </View>
      <View style={styles.verticallySpaced}>
        <Input label="Username" value={username || ''} onChangeText={(text) => setUsername(text)} />
      </View>
      <View style={styles.verticallySpaced}>
        <Input label="Website" value={website || ''} onChangeText={(text) => setWebsite(text)} />
      </View>

      <View style={[styles.verticallySpaced, styles.mt20]}>
        <Button
          title={loading ? 'Loading ...' : 'Update'}
          onPress={() => updateProfile({ username, website, avatar_url: avatarUrl })}
          disabled={loading}
        />
      </View>

      <View style={styles.verticallySpaced}>
        <Button
          title="Sign Out"
          onPress={async () => {
            const isWeb = typeof window !== 'undefined' && (window as any).document != null
            if (isWeb) {
              const ok = window.confirm('Are you sure you want to sign out?')
              if (!ok) return
              try {
                await signOut()
              } catch (e) {
                window.alert('Sign out failed. Please try again.')
              }
            } else {
              try {
                await signOut()
              } catch (e) {
                Alert.alert('Sign out failed', 'Please try again.')
              }
            }
          }}
        />
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    marginTop: 40,
    padding: 12,
  },
  verticallySpaced: {
    paddingTop: 4,
    paddingBottom: 4,
    alignSelf: 'stretch',
  },
  mt20: {
    marginTop: 20,
  },
})