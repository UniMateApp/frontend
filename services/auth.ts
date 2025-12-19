// ========================================
// AUTH SERVICE - AUTHENTICATION OPERATIONS
// ========================================
// This service handles all Supabase authentication operations:
// - Sign Up: Create new user account with email verification
// - Sign In: Authenticate existing user
// - Sign Out: End user session
// - Get Current User: Retrieve authenticated user
// - Ensure Profile: Create/update user profile in profiles table
// - Auth State Change: Listen to authentication events
// ========================================

import { supabase as getSupabase } from './supabase';

// OPERATION 1: SIGN UP NEW USER
/** Create new user account with email/password and optional metadata (name, etc.) */
export async function signUpWithEmail(email: string, password: string, userData?: { full_name?: string }) {
  const client = await getSupabase();
  try {
    return await client.auth.signUp({
      email,
      password,
      options: {
        data: userData || {}, // Store name in user_metadata for profile creation
      },
    });
  } catch (err: any) {
    console.error('[auth] signUpWithEmail error:', err);
    // Provide helpful error message for common configuration issues
    if ((err?.message || '').toLowerCase().includes('json')) {
      throw new Error('Auth signUp failed: received unexpected/non-JSON response. Check EXPO_PUBLIC_SUPABASE_URL/KEY and network connectivity.');
    }
    throw err;
  }
}

// OPERATION 2: SIGN IN EXISTING USER
/** Authenticate user with email and password */
export async function signInWithEmail(email: string, password: string) {
  const client = await getSupabase();
  try {
    return await client.auth.signInWithPassword({ email, password });
  } catch (err: any) {
    console.error('[auth] signInWithEmail error:', err);
    if ((err?.message || '').toLowerCase().includes('json') || (err?.message || '').toLowerCase().includes('unexpected')) {
      throw new Error('Auth signIn failed: received unexpected/non-JSON response. Check EXPO_PUBLIC_SUPABASE_URL/KEY and network connectivity.');
    }
    throw err;
  }
}

// OPERATION 3: SIGN OUT
/** End current user session and clear tokens */
export async function signOut() {
  const client = await getSupabase();
  return await client.auth.signOut();
}

// OPERATION 4: GET CURRENT USER
/** Retrieve the currently authenticated user (if any) */
export async function getCurrentUser() {
  try {
    const client = await getSupabase();
    const res: any = await client.auth.getUser();
    return res?.data?.user ?? null; // Return user or null if not authenticated
  } catch {
    return null; // Return null on any error
  }
}

// OPERATION 5: ENSURE USER PROFILE EXISTS
/** 
 * Create or update user profile in profiles table.
 * Called after signup/signin to ensure profile exists with correct data.
 * Uses UPSERT to handle both insert (new user) and update (existing user) cases.
 */
export async function ensureUserProfile(user: any) {
  try {
    const client = await getSupabase();
    console.log('Ensuring profile for user:', user?.id, 'with metadata:', user?.user_metadata);
    
    // UPSERT: Insert new profile or update existing one
    // Populates profile with data from auth user_metadata (name, avatar) and email
    const { data, error: upsertError } = await client
      .from('profiles')
      .upsert({
        id: user.id, // Must match auth user ID (foreign key)
        full_name: user.user_metadata?.full_name || null, // Name from signup form
        avatar_url: user.user_metadata?.avatar_url || null, // Avatar URL if provided
        email: user.email || null, // Email from auth
      })
      .select();
    
    if (upsertError) {
      console.error('[ensureUserProfile] Profile upsert failed:', upsertError);
      console.log('[ensureUserProfile] This is expected if RLS policies are not set up yet - signup will continue');
      // Don't throw - allow signup/signin to succeed even if profile creation fails
      // This prevents auth from being blocked by profile issues
    } else {
      console.log('[ensureUserProfile] Profile upserted successfully for user:', user.id, 'data:', data);
    }
  } catch (error) {
    console.error('[ensureUserProfile] Unexpected error:', error);
    // Don't re-throw - non-critical error, don't break auth flow
  }
}

export async function onAuthStateChange(callback: (event: string, session: any) => void) {
  const client = await getSupabase();
  const { data: subscription } = client.auth.onAuthStateChange((event: string, session: any) => {
    callback(event, session);
  });
  // supabase-js may return a subscription object or a nested shape.
  return () => {
    try {
      // prefer direct unsubscribe if present
      if ((subscription as any)?.unsubscribe) return (subscription as any).unsubscribe();
      // fallback to nested shape
      if ((subscription as any)?.subscription?.unsubscribe) return (subscription as any).subscription.unsubscribe();
    } catch {
      // ignore
    }
  };
}
