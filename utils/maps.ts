import * as Linking from 'expo-linking';
import { Platform } from 'react-native';

export async function openDirectionsTo(lat: number, lon: number) {
  const destStr = `${lat},${lon}`;
  const iosUrl = `http://maps.apple.com/?daddr=${destStr}`;
  const googleUrl = `https://www.google.com/maps/dir/?api=1&destination=${destStr}&travelmode=driving`;
  const url = Platform.OS === 'ios' ? iosUrl : googleUrl;

  try {
    await Linking.openURL(url);
  } catch (err) {
    try {
      await Linking.openURL(googleUrl);
    } catch (e) {
      throw new Error('Could not open maps');
    }
  }
}
