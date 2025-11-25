import React, { ReactNode } from 'react';
import { ActivityIndicator, Animated, Easing, Image, StyleSheet, Text, View } from 'react-native';
import { UserProvider, useUser } from '../contexts/UserContext';
import Auth from './Auth';

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconContainer: {
    marginBottom: 24,
  },
  icon: {
    width: 120,
    height: 120,
    borderRadius: 24,
  },
  themeText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#11181C',
    marginBottom: 20,
    textAlign: 'center',
    paddingHorizontal: 16,
  },
  indicator: {
    marginTop: 8,
  },
});

function AuthContent({ children }: { children: ReactNode }) {
  const { user, loading } = useUser();
  const [spinValue] = React.useState(new Animated.Value(0));

  React.useEffect(() => {
    Animated.loop(
      Animated.timing(spinValue, {
        toValue: 1,
        duration: 3000,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    ).start();
  }, [spinValue]);

  const spin = spinValue.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: '#ffffff' }]}>
        <Animated.View style={[styles.iconContainer, { transform: [{ rotate: spin }] }]}>
          <Image
            source={require('../assets/images/unimate.png')}
            style={styles.icon}
          />
        </Animated.View>
        <Text style={styles.themeText}>Your Campus Life, Connected.</Text>
        <ActivityIndicator size="small" color="#800000" style={styles.indicator} />
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
