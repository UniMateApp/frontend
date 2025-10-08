// import App from '@/components/App';
import AuthProvider from '@/components/AuthProvider';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';

export const unstable_settings = {
  anchor: '(tabs)',
};

export default function RootLayout() {
  const colorScheme = useColorScheme();

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
