import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Colors } from '@/constants/theme'
import { useColorScheme } from '@/hooks/use-color-scheme'
import { signInWithEmail as supabaseSignIn, signUpWithEmail as supabaseSignUp } from '@/services/auth'
import React, { useEffect, useState } from 'react'
import { Alert, AppState, Linking, StyleSheet, Text, TouchableOpacity, View } from 'react-native'

// Keep Supabase session refresh commented — kept for reference.
  // ✅ Move AppState listener inside useEffect
  useEffect(() => {
    const subscription = AppState.addEventListener('change', async () => {
      // noop; client-side refresh is handled elsewhere
    })

    return () => subscription.remove()
  }, [])

export default function Auth() {
  const colorScheme = useColorScheme()
  const theme = Colors[colorScheme ?? 'light']

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [loading, setLoading] = useState(false)
  const [mode, setMode] = useState<'signin' | 'signup'>('signin')
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  async function signInWithEmail() {
    setLoading(true)
    setErrorMessage(null)
    try {
      const { error } = await supabaseSignIn(email, password)
      if (error) setErrorMessage(error.message)
    } catch (e: any) {
      setErrorMessage(e?.message ?? 'Sign in failed')
    } finally {
      setLoading(false)
    }
  }

  async function signUpWithEmail() {
    console.log('Signing up with email:', email)
    setLoading(true)
    setErrorMessage(null)
    try {
      const res: any = await supabaseSignUp(email, password)
      const { data: { session } = {}, error } = res || {}
      console.log('Sign up response:', res)
      if (error) setErrorMessage(error.message)
      if (!session) {
        // Show platform-appropriate confirmation and an option to open the mail app
        // Web: use window.confirm + window.open
        // Native: use Alert.alert + Linking.openURL
        try {
          // `Platform` is available from react-native; guard for web using typeof
          const isWeb = typeof window !== 'undefined' && (window as any).document != null
          if (isWeb) {
            const open = window.confirm(`We sent a verification link to ${email}.\n\nPress OK to open your mail client or Cancel to continue.`)
            if (open) {
              try {
                window.open(`mailto:${encodeURIComponent(email)}`)
              } catch (err) {
                window.alert('Could not open mail app. Please open your mail client manually to check the verification email.')
              }
            }
          } else {
            Alert.alert(
              'Verify your email',
              `We sent a verification link to ${email}. Please check your inbox to confirm your account.`,
              [
                {
                  text: 'Open Mail',
                  onPress: async () => {
                    try {
                      await Linking.openURL(`mailto:${encodeURIComponent(email)}`)
                    } catch (err) {
                      Alert.alert('Could not open mail app', 'Please open your mail app manually to check the verification email.')
                    }
                  },
                },
                { text: 'OK', style: 'cancel' },
              ],
              { cancelable: true }
            )
          }
        } catch (err) {
          // Fallback: show native alert when anything unexpected happens
          Alert.alert('Verify your email', `We sent a verification link to ${email}. Please check your inbox.`)
        }
      }
    } catch (e: any) {
      setErrorMessage(e?.message ?? 'Sign up failed')
    } finally {
      setLoading(false)
    }
  }

  const bgTint = colorScheme === 'dark' ? '#0B0C0D' : '#FFF6F6'

  return (
    <View style={[styles.container, { backgroundColor: bgTint }]}> 
      <View style={[styles.card, { backgroundColor: theme.card, borderColor: 'transparent', shadowColor: theme.shadow }]}> 
        <View style={styles.headerRow}>
          <TouchableOpacity onPress={() => setMode('signin')} style={[styles.modeButton, mode === 'signin' && { backgroundColor: theme.primary }]}> 
            <Text style={[styles.modeText, mode === 'signin' && { color: '#fff', fontWeight: '700' }]}>Sign in</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setMode('signup')} style={[styles.modeButton, mode === 'signup' && { backgroundColor: theme.primary }]}> 
            <Text style={[styles.modeText, mode === 'signup' && { color: '#fff', fontWeight: '700' }]}>Sign up</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.content}>
          {mode === 'signup' && (
            <View style={styles.verticallySpaced}>
              <Input label="Full name" leftIcon={{ type: 'font-awesome', name: 'user' }} onChangeText={setName} value={name} placeholder="Your full name" />
            </View>
          )}

          <View style={styles.verticallySpaced}>
            <Input label="Email" leftIcon={{ type: 'font-awesome', name: 'envelope' }} onChangeText={(text) => setEmail(text)} value={email} placeholder="email@address.com" autoCapitalize={'none'} />
          </View>

          <View style={styles.verticallySpaced}>
            <Input label="Password" leftIcon={{ type: 'font-awesome', name: 'lock' }} onChangeText={(text) => setPassword(text)} value={password} secureTextEntry placeholder="Password" autoCapitalize={'none'} />
          </View>

          {errorMessage ? <Text style={[styles.errorText, { color: theme.accent }]}>{errorMessage}</Text> : null}

          <View style={[styles.verticallySpaced, styles.mt20]}>
            {mode === 'signin' ? (
              <Button title={loading ? 'Signing in...' : 'Sign in'} disabled={loading} onPress={signInWithEmail} />
            ) : (
              <Button title={loading ? 'Signing up...' : 'Create account'} disabled={loading} onPress={signUpWithEmail} />
            )}
          </View>
        </View>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 16,
  },
  verticallySpaced: {
    paddingTop: 4,
    paddingBottom: 4,
    alignSelf: 'stretch',
  },
  mt20: {
    marginTop: 20,
  },
  headerRow: { flexDirection: 'row', justifyContent: 'center', marginBottom: 12 },
  modeButton: { paddingVertical: 8, paddingHorizontal: 20, borderRadius: 24, marginHorizontal: 8 },
  modeText: { fontSize: 16, color: '#444' },
  errorText: { color: '#c00', marginTop: 8, textAlign: 'center' },
  card: { width: '100%', maxWidth: 520, padding: 20, borderRadius: 12, borderWidth: 1, elevation: 6, shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.08, shadowRadius: 12 },
  content: { marginTop: 6 },
})