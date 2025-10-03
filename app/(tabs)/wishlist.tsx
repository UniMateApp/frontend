import { EventCard } from '@/components/event-card';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { router } from 'expo-router';
import { ScrollView, StyleSheet } from 'react-native';

export default function WishlistScreen() {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];

  const handleEventPress = (eventId: string) => {
    router.push({
      pathname: '/event/[id]',
      params: { id: eventId }
    });
  };

  const handleBookmark = (eventId: string) => {
    // TODO: Implement bookmark removal
    console.log('Remove bookmark:', eventId);
  };

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.background }]}
      contentContainerStyle={styles.content}>
      
      <EventCard
        title="Tech Workshop: Mobile App Development"
        organizer="Computing Society"
        date="Oct 20, 2025"
        location="Lab Complex"
        imageUrl={require('../../assets/images/icon.png')}
        onPress={() => handleEventPress('2')}
        onBookmark={() => handleBookmark('2')}
        isBookmarked={true}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    paddingVertical: 16,
  },
});