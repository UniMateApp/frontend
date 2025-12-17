import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { listEvents } from '@/services/events';
import * as Location from 'expo-location';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import MapView, { Marker, PROVIDER_GOOGLE } from 'react-native-maps';

interface Event {
  id: string;
  title: string;
  latitude?: number;
  longitude?: number;
  location_name?: string;
  category?: string;
}

export default function MapScreen() {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const [currentLocation, setCurrentLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        // Get current location
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status === 'granted') {
          const location = await Location.getCurrentPositionAsync({});
          setCurrentLocation({
            latitude: location.coords.latitude,
            longitude: location.coords.longitude,
          });
        }

        // Fetch events with location data
        const eventsData = await listEvents();
        const eventsWithLocation = eventsData.filter((e: any) => e.latitude && e.longitude);
        setEvents(eventsWithLocation);
      } catch (error) {
        console.error('Error getting location or events:', error);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background, justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={[styles.loadingText, { color: colors.textSecondary }]}>Loading map...</Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <MapView
        provider={PROVIDER_GOOGLE}
        style={styles.map}
        initialRegion={{
          latitude: currentLocation?.latitude || 15.8700,
          longitude: currentLocation?.longitude || 75.4370,
          latitudeDelta: 0.02,
          longitudeDelta: 0.02,
        }}
        minZoomLevel={10}
        maxZoomLevel={20}
        showsUserLocation={true}
        showsMyLocationButton={true}
        showsCompass={false}
        showsScale={false}
        showsTraffic={false}
        showsBuildings={false}
        showsIndoors={false}
        zoomEnabled={true}
        scrollEnabled={true}
        pitchEnabled={false}
        rotateEnabled={false}
        loadingEnabled={false}
        cacheEnabled={true}
        toolbarEnabled={false}
      >
        {currentLocation && (
          <Marker
            coordinate={currentLocation}
            title="You are here"
            description="Your current location"
            tracksViewChanges={false}
            pinColor="blue"
          />
        )}
        {events.map((event) => (
          <Marker
            key={event.id}
            coordinate={{
              latitude: event.latitude!,
              longitude: event.longitude!,
            }}
            title={event.title}
            description={event.location_name || event.category || 'Event'}
            tracksViewChanges={false}
            pinColor="red"
          />
        ))}
      </MapView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  map: { flex: 1 },
  loadingText: { marginTop: 12, fontSize: 14 },
});
