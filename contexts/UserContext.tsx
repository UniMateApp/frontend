import { ensureUserProfile, getCurrentUser, onAuthStateChange } from '@/services/auth';
import { getProfile } from '@/services/profiles';
import React, { createContext, ReactNode, useContext, useEffect, useState } from 'react';

interface User {
  id: string;
  email?: string;
  user_metadata?: {
    full_name?: string;
    avatar_url?: string;
  };
}

interface Profile {
  id: string;
  full_name?: string | null;
  avatar_url?: string | null;
  expo_push_token?: string | null;
  created_at?: string;
  updated_at?: string;
}

interface UserContextType {
  user: User | null;
  profile: Profile | null;
  loading: boolean;
  refreshProfile: () => Promise<void>;
}

const UserContext = createContext<UserContextType | undefined>(undefined);

export function UserProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  const loadProfile = async (userId: string) => {
    try {
      const profileData = await getProfile(userId);
      setProfile(profileData);
    } catch (error) {
      console.log('Profile not found or error loading profile:', error);
      setProfile(null);
    }
  };

  const refreshProfile = async () => {
    if (user?.id) {
      await loadProfile(user.id);
    }
  };

  useEffect(() => {
    let unsub: (() => void) | undefined;
    
    (async () => {
      setLoading(true);
      const currentUser = await getCurrentUser();
      setUser(currentUser);
      
      if (currentUser?.id) {
        await loadProfile(currentUser.id);
      }
      
      setLoading(false);

      unsub = await onAuthStateChange(async (_event, session) => {
        const current = await getCurrentUser();
        setUser(current);
        
        if (current) {
          try {
            await ensureUserProfile(current);
            await loadProfile(current.id);
          } catch (e) {
            console.log('UserProvider: Profile creation/loading skipped due to RLS or other error');
          }
        } else {
          setProfile(null);
        }
      });
    })();

    return () => {
      try { 
        unsub && unsub(); 
      } catch {}
    };
  }, []);

  return (
    <UserContext.Provider value={{ user, profile, loading, refreshProfile }}>
      {children}
    </UserContext.Provider>
  );
}

export function useUser() {
  const context = useContext(UserContext);
  if (context === undefined) {
    throw new Error('useUser must be used within a UserProvider');
  }
  return context;
}