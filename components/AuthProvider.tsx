import React, { ReactNode, useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { getCurrentUser, onAuthStateChange } from '../services/auth';
import { upsertProfile } from '../services/profiles';
import Auth from './Auth';

export default function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let unsub: (() => void) | undefined;
    (async () => {
      setLoading(true);
      const u = await getCurrentUser();
      setUser(u);
      setLoading(false);

      unsub = await onAuthStateChange(async (_event, session) => {
        // session may contain access_token and user
        const current = await getCurrentUser();
        setUser(current);
        // on sign in, ensure profile exists
        if (current) {
          try {
            await upsertProfile({ id: current.id, full_name: current.user_metadata?.full_name ?? null, avatar_url: current.user_metadata?.avatar_url ?? null });
          } catch (e) {
            // ignore profile failures
          }
        }
      });
    })();

    return () => {
      try { unsub && unsub(); } catch {}
    };
  }, []);

  if (loading) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator />
      </View>
    );
  }

  if (!user) {
    return <Auth />;
  }

  return <>{children}</>;
}
