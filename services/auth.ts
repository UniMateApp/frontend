import { supabase as getSupabase } from './supabase';

export async function signUpWithEmail(email: string, password: string, userData?: { full_name?: string }) {
  const client = await getSupabase();
  return await client.auth.signUp({ 
    email, 
    password,
    options: {
      data: userData || {}
    }
  });
}

export async function signInWithEmail(email: string, password: string) {
  const client = await getSupabase();
  return await client.auth.signInWithPassword({ email, password });
}

export async function signOut() {
  const client = await getSupabase();
  return await client.auth.signOut();
}

export async function getCurrentUser() {
  try {
    const client = await getSupabase();
    const res: any = await client.auth.getUser();
    return res?.data?.user ?? null;
  } catch {
    return null;
  }
}

// Ensure user profile exists in profiles table
export async function ensureUserProfile(user: any) {
  try {
    const client = await getSupabase();
    console.log('Ensuring profile for user:', user?.id, 'with metadata:', user?.user_metadata);
    
    // Use upsert to create or update profile with user metadata
    const { data, error: upsertError } = await client
      .from('profiles')
      .upsert({
        id: user.id,
        full_name: user.user_metadata?.full_name || null,
        avatar_url: user.user_metadata?.avatar_url || null,
      })
      .select();
    
    if (upsertError) {
      console.error('[ensureUserProfile] Profile upsert failed:', upsertError);
      console.log('[ensureUserProfile] This is expected if RLS policies are not set up yet - signup will continue');
      // Don't throw - let signup continue even if profile creation fails
    } else {
      console.log('[ensureUserProfile] Profile upserted successfully for user:', user.id, 'data:', data);
    }
  } catch (error) {
    console.error('[ensureUserProfile] Unexpected error:', error);
    // Don't re-throw the error to avoid breaking signup flow
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
