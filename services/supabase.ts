import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { Platform } from 'react-native';
import 'react-native-url-polyfill/auto';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.EXPO_PUBLIC_SUPABASE_KEY || process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '';

let client: SupabaseClient | null = null;

export async function supabase(): Promise<SupabaseClient> {
  if (client) return client;

  // Validate environment configuration early so we fail fast with a clear message.
  if (!supabaseUrl || !supabaseKey) {
    console.error('[supabase] Missing EXPO_PUBLIC_SUPABASE_URL or EXPO_PUBLIC_SUPABASE_KEY.');
    throw new Error('Supabase configuration missing. Set EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_KEY.');
  }

  if (Platform.OS === 'web') {
    // On web, supabase-js will use browser storage/localStorage by default
    client = createClient(supabaseUrl, supabaseKey, {
      auth: {
        detectSessionInUrl: false,
        persistSession: true,
        autoRefreshToken: true,
      },
    });
  } else {
    // On native, use AsyncStorage for auth storage
    const { default: AsyncStorage } = await import('@react-native-async-storage/async-storage');
    client = createClient(supabaseUrl, supabaseKey, {
      auth: {
        storage: AsyncStorage,
        detectSessionInUrl: false,
        persistSession: true,
        autoRefreshToken: true,
      },
    });
  }

  return client;
}
