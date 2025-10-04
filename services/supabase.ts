import { createBrowserStorageClient } from '@supabase/auth-helpers-shared';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { Platform } from 'react-native';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.EXPO_PUBLIC_SUPABASE_KEY!;

let client: SupabaseClient | null = null;

export async function supabase(): Promise<SupabaseClient> {
  if (client) return client;

  if (Platform.OS === 'web') {
    client = createClient(supabaseUrl, supabaseKey, {
      auth: {
        storage: createBrowserStorageClient(),
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: false,
      },
    });
  } else {
    const { default: AsyncStorage } = await import('@react-native-async-storage/async-storage');
    client = createClient(supabaseUrl, supabaseKey, {
      auth: {
        storage: AsyncStorage,
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: false,
      },
    });
  }

  return client;
}
