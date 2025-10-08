import { supabase as getSupabase } from './supabase';

export async function signUpWithEmail(email: string, password: string) {
  const client = await getSupabase();
  return await client.auth.signUp({ email, password });
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
