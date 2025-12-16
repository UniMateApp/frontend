// Previously this file created a supabase client at module load and imported
// @react-native-async-storage/async-storage which can reference `window` on web
// during SSR. Instead, use the async factory in services/supabase.ts.
import { supabase as createSupabaseClient } from '@/services/supabase';
import type { SupabaseClient } from '@supabase/supabase-js';
import React from 'react';
import { View } from 'react-native';

// Helper that returns the already-created client synchronously when possible,
// or falls back to creating it asynchronously. Callers can `await getSupabase()`
// to ensure the client is ready.
let _client: SupabaseClient | null = null;
export async function getSupabase(): Promise<SupabaseClient> {
  if (_client) return _client;
  _client = await createSupabaseClient();
  return _client;
}

export function useSupabaseSync(): SupabaseClient | null {
  return _client;
}

// Default App wrapper component used by the router layouts. Keep it minimal
// so importing this module doesn't trigger storage-related code paths.
export default function App({ children }: { children: React.ReactNode }) {
  return <View style={{ flex: 1 }}>{children}</View>;
}