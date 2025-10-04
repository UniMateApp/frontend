import App from '@/components/App';
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
      <App>
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
      </App>
      <StatusBar style="auto" />
    </ThemeProvider>
  );
}
