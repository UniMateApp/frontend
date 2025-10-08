import React, { ReactNode, useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { ensureUserProfile, getCurrentUser, onAuthStateChange } from '../services/auth';
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
            await ensureUserProfile(current);
          } catch (e: any) {
            // ignore profile failures but log silently
            console.log('AuthProvider: Profile creation skipped due to RLS (this is expected during signup)');
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
