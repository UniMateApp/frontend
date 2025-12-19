// ========================================
// AUTH COMPONENT - SIGN IN / SIGN UP FORM
// ========================================
// This component handles user authentication:
// 1. Sign In: Email + Password
// 2. Sign Up: Email + Password + Name (sends verification email)
// 3. Profile Creation: Automatically creates profile after signup
// 4. Error Handling: Displays user-friendly error messages
// 5. Email Verification: Opens mail client for verification link
// ========================================

import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Colors } from '@/constants/theme'
import { useColorScheme } from '@/hooks/use-color-scheme'
import { ensureUserProfile, signInWithEmail as supabaseSignIn, signUpWithEmail as supabaseSignUp } from '@/services/auth'
import React, { useEffect, useState } from 'react'
import { Alert, AppState, Linking, StyleSheet, Text, TouchableOpacity, View } from 'react-native'

export default function Auth() {
  const colorScheme = useColorScheme()
  const theme = Colors[colorScheme ?? 'light']

  // Monitor app state changes (not currently used but kept for future session refresh)
  useEffect(() => {
    const subscription = AppState.addEventListener('change', async () => {
      // Client-side refresh is handled elsewhere
    })

    return () => subscription.remove()
  }, [])

  // FORM STATE - Track user inputs and UI state
  const [email, setEmail] = useState('') // User's email address
  const [password, setPassword] = useState('') // User's password
  const [name, setName] = useState('') // Full name (sign up only)
  const [loading, setLoading] = useState(false) // Loading state during auth
  const [mode, setMode] = useState<'signin' | 'signup'>('signin') // Toggle between sign in/up
  const [errorMessage, setErrorMessage] = useState<string | null>(null) // Error message display

  // OPERATION 1: SIGN IN - Authenticate existing user
  async function signInWithEmail() {
    setLoading(true)
    setErrorMessage(null) // Clear previous errors
    try {
      // Call auth service to sign in with email/password
      const { data, error } = await supabaseSignIn(email, password)
      console.log('Sign in response:', { data, error })
      
      if (error) {
        setErrorMessage(error.message) // Show error to user
      } else if (data?.user) {
        // Ensure profile exists in profiles table (create if missing)
        await ensureUserProfile(data.user)
        // UserContext will handle navigation to app after sign in
      }
    } catch (e: any) {
      setErrorMessage(e?.message ?? 'Sign in failed')
    } finally {
      setLoading(false)
    }
  }

  async function signUpWithEmail() {
    console.log('Signing up with email:', email, 'name:', name)
    setLoading(true)
    setErrorMessage(null)
    try {
      const res: any = await supabaseSignUp(email, password, { full_name: name })
      console.log('Sign up response:', res)
      
      const { data: { session, user } = {}, error } = res || {}
      console.log('Extracted data:', { session: !!session, user: !!user, error })
      
      if (error) {
        console.error('Signup error:', error)
        setErrorMessage(error.message)
      }
      
      // If user was created, try to ensure profile has correct name (don't let this block the flow)
      if (user && name) {
        console.log('Attempting to ensure profile for user...')
        try {
          await ensureUserProfile(user)
          console.log('Profile creation attempt completed successfully')
        } catch (profileError: any) {
          console.error('Profile creation failed (non-blocking - signup will continue):', profileError)
          console.error('Profile error details:', {
            code: profileError?.code,
            message: profileError?.message,
            details: profileError?.details
          })
          // Don't set error message for profile issues during signup
        }
      } else if (user && !name) {
        console.log('User created but no name provided, skipping profile creation')
      } else {
        console.log('No user returned from signup, skipping profile creation')
      }
      
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