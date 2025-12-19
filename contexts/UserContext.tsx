// ========================================
// USER CONTEXT - GLOBAL USER STATE MANAGEMENT
// ========================================
// This context provides global access to:
// 1. Authenticated user (from Supabase Auth)
// 2. User profile (from profiles table)
// 3. Loading state
// 4. Profile refresh function
//
// Used throughout the app to:
// - Check if user is signed in
// - Display user info (name, email, avatar)
// - Restrict access to authenticated-only features
// - React to auth state changes (sign in/out)
// ========================================

import { ensureUserProfile, getCurrentUser, onAuthStateChange } from '@/services/auth';
import { getProfile } from '@/services/profiles';
import React, { createContext, ReactNode, useContext, useEffect, useState } from 'react';

// TYPE DEFINITIONS
interface User {
  id: string; // Supabase Auth user ID
  email?: string; // User's email
  user_metadata?: { // Additional user data from signup
    full_name?: string;
    avatar_url?: string;
  };
}

interface Profile {
  id: string; // Same as user ID (foreign key)
  full_name?: string | null; // User's display name
  avatar_url?: string | null; // Profile picture URL
  expo_push_token?: string | null; // For push notifications
  created_at?: string;
  updated_at?: string;
}

interface UserContextType {
  user: User | null; // Authenticated user or null
  profile: Profile | null; // User profile or null
  loading: boolean; // True while fetching initial user/profile
  refreshProfile: () => Promise<void>; // Manually refresh profile data
}

const UserContext = createContext<UserContextType | undefined>(undefined);

export function UserProvider({ children }: { children: ReactNode }) {
  // GLOBAL STATE - Available to all components via useUser() hook
  const [user, setUser] = useState<User | null>(null); // Current authenticated user
  const [profile, setProfile] = useState<Profile | null>(null); // Current user's profile
  const [loading, setLoading] = useState(true); // Loading state

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