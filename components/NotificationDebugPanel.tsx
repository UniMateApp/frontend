/**
 * Debug component for testing event reminders
 * Add this to your events screen to see notification status
 */

import { CAMPUS_COORDINATES, NOTIFICATION_RADIUS_KM } from '@/constants/campus';
import { calculateHaversineDistance } from '@/utils/distance';
import * as Location from 'expo-location';
import * as Notifications from 'expo-notifications';
import React, { useEffect, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

interface NotificationDebugProps {
  eventsCount: number;
}

export function NotificationDebugPanel({ eventsCount }: NotificationDebugProps) {
  const [status, setStatus] = useState({
    notificationPermission: 'unknown',
    locationPermission: 'unknown',
    scheduledCount: 0,
    currentLocation: null as { lat: number; lng: number; distance: number } | null,
    isNearCampus: false,
  });

  const checkStatus = async () => {
    try {
      // Check permissions
      const { status: notifStatus } = await Notifications.getPermissionsAsync();
      const { status: locStatus } = await Location.getForegroundPermissionsAsync();

      // Check scheduled notifications
      const scheduled = await Notifications.getAllScheduledNotificationsAsync();

      // Try to get location
      let locationInfo = null;
      let isNear = false;

      if (locStatus === 'granted') {
        try {
          const loc = await Location.getCurrentPositionAsync({
            accuracy: Location.Accuracy.Balanced,
          });
          const distance = calculateHaversineDistance(
            loc.coords.latitude,
            loc.coords.longitude,
            CAMPUS_COORDINATES.latitude,
            CAMPUS_COORDINATES.longitude
          );
          locationInfo = {
            lat: loc.coords.latitude,
            lng: loc.coords.longitude,
            distance: distance,
          };
          isNear = distance <= NOTIFICATION_RADIUS_KM;
        } catch (error) {
          console.log('Could not get location:', error);
        }
      }

      setStatus({
        notificationPermission: notifStatus,
        locationPermission: locStatus,
        scheduledCount: scheduled.length,
        currentLocation: locationInfo,
        isNearCampus: isNear,
      });
    } catch (error) {
      console.error('Error checking status:', error);
    }
  };

  useEffect(() => {
    checkStatus();
  }, [eventsCount]);

  const sendTestNotification = async () => {
    try {
      await Notifications.scheduleNotificationAsync({
        content: {
          title: '🧪 Test Notification',
          body: 'This is a test notification from the event reminder system!',
          data: { test: true },
          sound: true,
        },
        trigger: null,
      });
      Alert.alert('Success', 'Test notification sent!');
    } catch (error) {
      Alert.alert('Error', `Failed to send test notification: ${error}`);
    }
  };

  const requestPermissions = async () => {
    try {
      const { status: notifStatus } = await Notifications.requestPermissionsAsync();
      const { status: locStatus } = await Location.requestForegroundPermissionsAsync();
      
      Alert.alert(
        'Permissions',
        `Notifications: ${notifStatus}\nLocation: ${locStatus}`,
        [{ text: 'OK', onPress: checkStatus }]
      );
    } catch (error) {
      Alert.alert('Error', `Failed to request permissions: ${error}`);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'granted':
        return '✅';
      case 'denied':
        return '❌';
      case 'undetermined':
        return '⚠️';
      default:
        return '❓';
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>📱 Notification Debug Panel</Text>
        <TouchableOpacity onPress={checkStatus} style={styles.refreshButton}>
          <Text style={styles.refreshText}>🔄 Refresh</Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content}>
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Permissions</Text>
          <Text style={styles.statusText}>
            {getStatusIcon(status.notificationPermission)} Notifications: {status.notificationPermission}
          </Text>
          <Text style={styles.statusText}>
            {getStatusIcon(status.locationPermission)} Location: {status.locationPermission}
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Events & Notifications</Text>
          <Text style={styles.statusText}>📅 Total Events: {eventsCount}</Text>
          <Text style={styles.statusText}>🔔 Scheduled Notifications: {status.scheduledCount}</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Location</Text>
          {status.currentLocation ? (
            <>
              <Text style={styles.statusText}>
                📍 Current: {status.currentLocation.lat.toFixed(4)}, {status.currentLocation.lng.toFixed(4)}
              </Text>
              <Text style={styles.statusText}>
                🏫 Campus: {CAMPUS_COORDINATES.latitude.toFixed(4)}, {CAMPUS_COORDINATES.longitude.toFixed(4)}
              </Text>
              <Text style={styles.statusText}>
                📏 Distance: {status.currentLocation.distance.toFixed(2)} km
              </Text>
              <Text style={styles.statusText}>
                {status.isNearCampus ? '✅ Within campus radius' : '❌ Outside campus radius'}
              </Text>
            </>
          ) : (
            <Text style={styles.statusText}>❌ Location unavailable</Text>
          )}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Test Actions</Text>
          <TouchableOpacity style={styles.button} onPress={sendTestNotification}>
            <Text style={styles.buttonText}>Send Test Notification</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.button} onPress={requestPermissions}>
            <Text style={styles.buttonText}>Request Permissions</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Configuration</Text>
          <Text style={styles.infoText}>• Notification radius: {NOTIFICATION_RADIUS_KM} km</Text>
          <Text style={styles.infoText}>• Reminder time: 1 hour before event</Text>
          <Text style={styles.infoText}>• Auto-schedule: Enabled</Text>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: 'rgba(0,0,0,0.9)',
    borderRadius: 12,
    padding: 16,
    margin: 16,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#FFF',
  },
  refreshButton: {
    padding: 8,
  },
  refreshText: {
    color: '#4A90E2',
    fontSize: 14,
  },
  content: {
    maxHeight: 400,
  },
  section: {
    marginBottom: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.1)',
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#4A90E2',
    marginBottom: 8,
  },
  statusText: {
    fontSize: 12,
    color: '#FFF',
    marginBottom: 4,
    fontFamily: 'monospace',
  },
  infoText: {
    fontSize: 12,
    color: '#AAA',
    marginBottom: 4,
  },
  button: {
    backgroundColor: '#4A90E2',
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
  },
  buttonText: {
    color: '#FFF',
    textAlign: 'center',
    fontSize: 14,
    fontWeight: '600',
  },
});
