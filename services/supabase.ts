import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { Platform } from 'react-native';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.EXPO_PUBLIC_SUPABASE_KEY!;

let client: SupabaseClient | null = null;

export async function supabase(): Promise<SupabaseClient> {
  if (client) return client;

  // Detect web vs native vs server (no global window)
  const isWeb = typeof window !== 'undefined' && Platform.OS === 'web';

  if (isWeb) {
    // small browser storage adapter that uses localStorage
    const browserStorage = {
      getItem(key: string) {
        return Promise.resolve(localStorage.getItem(key));
      },
      setItem(key: string, value: string) {
        localStorage.setItem(key, value);
        return Promise.resolve();
      },
      removeItem(key: string) {
        localStorage.removeItem(key);
        return Promise.resolve();
      },
      getAllKeys() {
        return Promise.resolve(Object.keys(localStorage));
      },
      multiGet(keys: string[]) {
        return Promise.resolve(keys.map(k => [k, localStorage.getItem(k)]));
      },
      multiSet(kv: [string, string][]) {
        kv.forEach(([k, v]) => localStorage.setItem(k, v));
        return Promise.resolve();
      },
      multiRemove(keys: string[]) {
        keys.forEach(k => localStorage.removeItem(k));
        return Promise.resolve();
      },
      // no-ops
      mergeItem() {
        return Promise.resolve();
      },
      multiMerge() {
        return Promise.resolve();
      },
      flushGetRequests: () => undefined,
    } as any;

    client = createClient(supabaseUrl, supabaseKey, {
      auth: {
        storage: browserStorage,
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: false,
      },
    });
  } else {
    // If running in a Node/server environment (no window), don't import
    // the web AsyncStorage implementation which references `window`.
    // Use a tiny in-memory shim for storage so server-side code won't throw.
    let storage: any;

    if (typeof window === 'undefined') {
      // Minimal in-memory storage shim implementing the AsyncStorage API used by supabase-js
      const map = new Map<string, string>();
      storage = {
        async getItem(key: string) {
          return map.has(key) ? (map.get(key) as string) : null;
        },
        async setItem(key: string, value: string) {
          map.set(key, value);
        },
        async removeItem(key: string) {
          map.delete(key);
        },
        async clear() {
          map.clear();
        },
        async getAllKeys() {
          return Array.from(map.keys());
        },
        // The following are no-ops but present for compatibility
        async mergeItem(_key: string, _value: string) {
          // no-op
        },
        async multiGet(keys: string[]) {
          return keys.map(k => [k, map.get(k) ?? null]);
        },
        async multiSet(kv: [string, string][]) {
          kv.forEach(([k, v]) => map.set(k, v));
        },
        async multiRemove(keys: string[]) {
          keys.forEach(k => map.delete(k));
        },
        async multiMerge(_kv: [string, string][]) {
          // no-op
        },
        flushGetRequests: () => undefined,
      };
    } else {
      const { default: AsyncStorage } = await import('@react-native-async-storage/async-storage');
      storage = AsyncStorage;
    }

    client = createClient(supabaseUrl, supabaseKey, {
      auth: {
        storage,
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: false,
      },
    });
  }

  return client;
}
