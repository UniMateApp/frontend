// import App from '@/components/App';
import AuthProvider from '@/components/AuthProvider';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { configureNotificationHandler, requestNotificationPermissions } from '@/services/backgroundScheduler';
import { registerBackgroundTask } from '@/services/backgroundTaskService';
import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import * as Location from 'expo-location';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';

export const unstable_settings = {
  anchor: '(tabs)',
};

export default function RootLayout() {
  const colorScheme = useColorScheme();

  // Configure notification handler and request permissions on app start
  useEffect(() => {
    const initializeApp = async () => {
      console.log('[App] 🚀 Initializing app...');
      
      // Configure notification handler first
      configureNotificationHandler();
      console.log('[App] ✅ Notification handler configured');
      
      // Request notification permissions
      console.log('[App] Requesting notification permissions...');
      const notificationGranted = await requestNotificationPermissions();
      console.log('[App] Notification permission:', notificationGranted ? '✅ Granted' : '❌ Denied');
      
      // Request location permissions
      console.log('[App] Requesting location permissions...');
      const { status: foregroundStatus } = await Location.requestForegroundPermissionsAsync();
      console.log('[App] Location permission:', foregroundStatus === 'granted' ? '✅ Granted' : '❌ Denied');
      
      if (foregroundStatus === 'granted') {
        try {
          const { status: bgStatus } = await Location.requestBackgroundPermissionsAsync();
          console.log('[App] Background location permission:', bgStatus === 'granted' ? '✅ Granted' : '❌ Denied');
          
          // Register background task if permissions are granted
          if (bgStatus === 'granted' && notificationGranted) {
            console.log('[App] 🔄 Registering background task...');
            try {
              await registerBackgroundTask();
              console.log('[App] ✅ Background task registered - will check events every minute');
            } catch (error) {
              console.error('[App] ❌ Failed to register background task:', error);
            }
          } else {
            console.log('[App] ⚠️ Cannot register background task - missing permissions');
          }
        } catch (error) {
          console.log('[App] Background location not available:', error);
        }
      }
      
      console.log('[App] 🎉 App initialization complete');
    };
    
    initializeApp();
  }, []);

  return (
      <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
        <AuthProvider>
          <Stack>
            <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
            <Stack.Screen 
              name="event/[id]" 
              options={{ 
                title: 'Event Details',
                headerShown: true,
                headerBackTitle: 'Back'
              }} 
            />
          </Stack>
        </AuthProvider>
      <StatusBar style="auto" />
    </ThemeProvider>
  );
}
