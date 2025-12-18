import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { FontAwesome } from '@expo/vector-icons';
import * as Location from 'expo-location';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import MapView, { Marker, PROVIDER_GOOGLE } from 'react-native-maps';

type LocationData = {
  latitude: number;
  longitude: number;
  address?: string;
};

type Props = {
  visible: boolean;
  onClose: () => void;
  onSelectLocation: (location: LocationData) => void;
  initialLocation?: LocationData;
};

export default function MapLocationPicker({ visible, onClose, onSelectLocation, initialLocation }: Props) {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  
  const [selectedLocation, setSelectedLocation] = useState<LocationData | null>(
    initialLocation || null
  );
  const [loading, setLoading] = useState(true);
  const [currentLocation, setCurrentLocation] = useState<{ latitude: number; longitude: number } | null>(null);

  useEffect(() => {
    if (visible) {
      getCurrentLocation();
    }
  }, [visible]);

  const getCurrentLocation = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status === 'granted') {
        const location = await Location.getCurrentPositionAsync({});
        const coords = {
          latitude: location.coords.latitude,
          longitude: location.coords.longitude,
        };
        setCurrentLocation(coords);
        if (!selectedLocation) {
          setSelectedLocation(coords);
        }
      }
    } catch (error) {
      console.error('Error getting location:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleMapPress = async (event: any) => {
    const { coordinate } = event.nativeEvent;
    
    // Get address from coordinates (reverse geocoding)
    try {
      const [result] = await Location.reverseGeocodeAsync({
        latitude: coordinate.latitude,
        longitude: coordinate.longitude,
      });
      
      const address = result
        ? `${result.street || ''} ${result.name || ''}, ${result.city || ''}`
        : 'Selected location';
      
      setSelectedLocation({
        latitude: coordinate.latitude,
        longitude: coordinate.longitude,
        address: address.trim(),
      });
    } catch (error) {
      console.error('Error reverse geocoding:', error);
      setSelectedLocation({
        latitude: coordinate.latitude,
        longitude: coordinate.longitude,
        address: 'Selected location',
      });
    }
  };

  const handleConfirm = () => {
    if (selectedLocation) {
      onSelectLocation(selectedLocation);
      onClose();
    }
  };

  const getMapRegion = () => {
    if (selectedLocation) {
      return {
        latitude: selectedLocation.latitude,
        longitude: selectedLocation.longitude,
        latitudeDelta: 0.01,
        longitudeDelta: 0.01,
      };
    }
    if (currentLocation) {
      return {
        latitude: currentLocation.latitude,
        longitude: currentLocation.longitude,
        latitudeDelta: 0.01,
        longitudeDelta: 0.01,
      };
    }
    // Default to a general location
    return {
      latitude: 15.8700,
      longitude: 75.4370,
      latitudeDelta: 0.02,
      longitudeDelta: 0.02,
    };
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.container}>
        <View style={[styles.header, { backgroundColor: colors.card, borderBottomColor: colors.cardBorder }]}>
          <Text style={[styles.title, { color: colors.text }]}>Select Location</Text>
          <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
            Tap on the map to select where you {initialLocation ? 'found' : 'lost'} the item
          </Text>
        </View>

        {loading ? (
          <View style={[styles.loadingContainer, { backgroundColor: colors.background }]}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={[styles.loadingText, { color: colors.textSecondary }]}>Loading map...</Text>
          </View>
        ) : (
          <MapView
            provider={PROVIDER_GOOGLE}
            style={styles.map}
            initialRegion={getMapRegion()}
            onPress={handleMapPress}
            showsUserLocation={true}
            showsMyLocationButton={true}
          >
            {selectedLocation && (
              <Marker
                coordinate={{
                  latitude: selectedLocation.latitude,
                  longitude: selectedLocation.longitude,
                }}
                title="Selected Location"
                description={selectedLocation.address || 'Tap to confirm'}
              />
            )}
          </MapView>
        )}

        {selectedLocation && (
          <View style={[styles.locationInfo, { backgroundColor: colors.card, borderTopColor: colors.cardBorder }]}>
            <FontAwesome name="map-marker" size={20} color={colors.primary} />
            <View style={styles.locationTextContainer}>
              <Text style={[styles.locationTitle, { color: colors.text }]}>Selected Location</Text>
              <Text style={[styles.locationAddress, { color: colors.textSecondary }]}>
                {selectedLocation.address || `${selectedLocation.latitude.toFixed(6)}, ${selectedLocation.longitude.toFixed(6)}`}
              </Text>
            </View>
          </View>
        )}

        <View style={[styles.footer, { backgroundColor: colors.card, borderTopColor: colors.cardBorder }]}>
          <TouchableOpacity
            style={[styles.button, styles.cancelButton, { backgroundColor: colors.background }]}
            onPress={onClose}
          >
            <Text style={[styles.buttonText, { color: colors.text }]}>Cancel</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.button,
              styles.confirmButton,
              { 
                backgroundColor: selectedLocation ? colors.primary : colors.cardBorder,
                opacity: selectedLocation ? 1 : 0.7 
              }
            ]}
            onPress={handleConfirm}
            disabled={!selectedLocation}
          >
            <Text style={[styles.buttonText, { color: '#fff' }]}>Confirm Location</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    padding: 16,
    borderBottomWidth: 1,
    paddingTop: 50, // Account for status bar
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
  },
  map: {
    flex: 1,
  },
  locationInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderTopWidth: 1,
    gap: 12,
  },
  locationTextContainer: {
    flex: 1,
  },
  locationTitle: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 2,
  },
  locationAddress: {
    fontSize: 12,
  },
  footer: {
    flexDirection: 'row',
    padding: 16,
    paddingBottom: 32,
    gap: 12,
    borderTopWidth: 1,
  },
  button: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelButton: {
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.1)',
  },
  confirmButton: {
    // backgroundColor handled dynamically
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '600',
  },
});
