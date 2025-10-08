import React, { ReactNode } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { UserProvider, useUser } from '../contexts/UserContext';
import Auth from './Auth';

function AuthContent({ children }: { children: ReactNode }) {
  const { user, loading } = useUser();

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

export default function AuthProvider({ children }: { children: ReactNode }) {
  return (
    <UserProvider>
      <AuthContent>{children}</AuthContent>
    </UserProvider>
  );
}
