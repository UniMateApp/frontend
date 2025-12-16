import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { signOut } from '@/services/auth'
import { Session } from '@supabase/supabase-js'
import { useCallback, useEffect, useState } from 'react'
import { Alert, StyleSheet, View } from 'react-native'
import { supabase as getSupabase } from '../services/supabase'

export default function Account({ session }: { session: Session }) {
  const [loading, setLoading] = useState(true)
  const [username, setUsername] = useState('')
  const [website, setWebsite] = useState('')
  const [avatarUrl, setAvatarUrl] = useState('')

  const getProfile = useCallback(async () => {
    try {
      setLoading(true)
      if (!session?.user) throw new Error('No user on the session!')

      const supabase = await getSupabase();
      const { data, error, status } = await supabase
        .from('profiles')
        .select(`username, website, avatar_url`)
        .eq('id', session?.user.id)
        .single()
      if (error && status !== 406) {
        throw error
      }

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

      const updates = {
        id: session?.user.id,
        username,
        website,
        avatar_url,
        updated_at: new Date(),
      }

  const supabase = await getSupabase();
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