/**
 * Testing utilities for location-based event reminders
 * Import these functions in your app to help with debugging and testing
 */

import { CAMPUS_COORDINATES, NOTIFICATION_RADIUS_KM } from '@/constants/campus';
import { getActiveReminders, scheduleEventReminder } from '@/services/backgroundScheduler';
import { Event } from '@/services/selectiveWishlist';
import { calculateHaversineDistance } from '@/utils/distance';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Location from 'expo-location';
import * as Notifications from 'expo-notifications';

/**
 * Test: Check all permissions
 */
export async function testPermissions() {
  console.log('🔍 Testing Permissions...');
  
  const { status: notifStatus } = await Notifications.getPermissionsAsync();
  console.log('Notification Permission:', notifStatus);
  
  const { status: fgLocationStatus } = await Location.getForegroundPermissionsAsync();
  console.log('Foreground Location Permission:', fgLocationStatus);
  
  const { status: bgLocationStatus } = await Location.getBackgroundPermissionsAsync();
  console.log('Background Location Permission:', bgLocationStatus);
  
  return {
    notifications: notifStatus === 'granted',
    foregroundLocation: fgLocationStatus === 'granted',
    backgroundLocation: bgLocationStatus === 'granted',
  };
}

/**
 * Test: Get current location and check distance to campus
 */
export async function testLocation() {
  console.log('📍 Testing Location...');
  
  try {
    const location = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.Balanced,
    });
    
    const { latitude, longitude } = location.coords;
    console.log('Current Location:', { latitude, longitude });
    console.log('Campus Location:', CAMPUS_COORDINATES);
    
    const distance = calculateHaversineDistance(
      latitude,
      longitude,
      CAMPUS_COORDINATES.latitude,
      CAMPUS_COORDINATES.longitude
    );
    
    console.log(`Distance to Campus: ${distance.toFixed(2)} km`);
    console.log(`Within Radius (${NOTIFICATION_RADIUS_KM}km): ${distance <= NOTIFICATION_RADIUS_KM ? 'YES ✅' : 'NO ❌'}`);
    
    return {
      currentLocation: { latitude, longitude },
      campusLocation: CAMPUS_COORDINATES,
      distance,
      withinRadius: distance <= NOTIFICATION_RADIUS_KM,
    };
  } catch (error) {
    console.error('Error getting location:', error);
    throw error;
  }
}

/**
 * Test: List all scheduled notifications
 */
export async function testScheduledNotifications() {
  console.log('📅 Testing Scheduled Notifications...');
  
  const scheduled = await Notifications.getAllScheduledNotificationsAsync();
  console.log(`Found ${scheduled.length} scheduled notifications`);
  
  scheduled.forEach((notif, index) => {
    console.log(`\nNotification ${index + 1}:`, {
      id: notif.identifier,
      title: notif.content.title,
      body: notif.content.body,
      trigger: notif.trigger,
    });
  });
  
  return scheduled;
}

/**
 * Test: List active reminders from storage
 */
export async function testActiveReminders() {
  console.log('💾 Testing Active Reminders from Storage...');
  
  const reminders = await getActiveReminders();
  console.log(`Found ${reminders.length} active reminders in storage`);
  
  reminders.forEach((reminder, index) => {
    const scheduledTime = new Date(reminder.scheduledTime);
    console.log(`\nReminder ${index + 1}:`, {
      eventId: reminder.eventId,
      eventTitle: reminder.eventTitle,
      scheduledFor: scheduledTime.toLocaleString(),
    });
  });
  
  return reminders;
}

/**
 * Test: Send an immediate test notification
 */
export async function testSendNotification() {
  console.log('🔔 Sending Test Notification...');
  
  try {
    await Notifications.scheduleNotificationAsync({
      content: {
        title: '🧪 Test Notification',
        body: 'This is a test notification from the event reminder system!',
        data: { test: true },
        sound: true,
      },
      trigger: null, // Send immediately
    });
    
    console.log('✅ Test notification sent!');
    return true;
  } catch (error) {
    console.error('❌ Failed to send test notification:', error);
    throw error;
  }
}

/**
 * Test: Schedule a notification for a test event
 */
export async function testScheduleEvent(minutesFromNow: number = 65) {
  console.log(`📝 Scheduling Test Event (${minutesFromNow} minutes from now)...`);
  
  const testEvent: Event = {
    id: `test-${Date.now()}`,
    title: 'Test Event',
    description: 'This is a test event for notification testing',
    start_at: new Date(Date.now() + minutesFromNow * 60 * 1000).toISOString(),
    location: 'Test Location',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
  
  console.log('Test Event:', {
    title: testEvent.title,
    startTime: new Date(testEvent.start_at!).toLocaleString(),
    reminderTime: new Date(testEvent.start_at!).getTime() - 60 * 60 * 1000,
  });
  
  try {
    const notificationId = await scheduleEventReminder(testEvent);
    console.log('✅ Test event scheduled! Notification ID:', notificationId);
    return notificationId;
  } catch (error) {
    console.error('❌ Failed to schedule test event:', error);
    throw error;
  }
}

/**
 * Test: Clear all notifications and storage
 */
export async function testClearAll() {
  console.log('🗑️ Clearing All Notifications and Storage...');
  
  try {
    await Notifications.cancelAllScheduledNotificationsAsync();
    await AsyncStorage.removeItem('@scheduled_notifications');
    await AsyncStorage.removeItem('@notified_events');
    
    console.log('✅ All notifications and storage cleared!');
    return true;
  } catch (error) {
    console.error('❌ Failed to clear:', error);
    throw error;
  }
}

/**
 * Run all tests
 */
export async function runAllTests() {
  console.log('\n🧪 ===== RUNNING ALL TESTS ===== 🧪\n');
  
  try {
    console.log('\n--- Test 1: Permissions ---');
    const perms = await testPermissions();
    
    console.log('\n--- Test 2: Location ---');
    if (perms.foregroundLocation) {
      await testLocation();
    } else {
      console.log('⚠️ Skipped - No location permission');
    }
    
    console.log('\n--- Test 3: Scheduled Notifications ---');
    await testScheduledNotifications();
    
    console.log('\n--- Test 4: Active Reminders ---');
    await testActiveReminders();
    
    console.log('\n--- Test 5: Send Test Notification ---');
    if (perms.notifications) {
      await testSendNotification();
    } else {
      console.log('⚠️ Skipped - No notification permission');
    }
    
    console.log('\n✅ All tests completed!');
  } catch (error) {
    console.error('\n❌ Test failed:', error);
  }
}

/**
 * Quick diagnostic report
 */
export async function getDiagnosticReport() {
  const report = {
    timestamp: new Date().toISOString(),
    permissions: await testPermissions(),
    location: null as any,
    scheduledCount: 0,
    activeRemindersCount: 0,
  };
  
  try {
    if (report.permissions.foregroundLocation) {
      report.location = await testLocation();
    }
  } catch {
    console.log('Could not get location');
  }
  
  try {
    const scheduled = await Notifications.getAllScheduledNotificationsAsync();
    report.scheduledCount = scheduled.length;
  } catch {
    console.log('Could not get scheduled notifications');
  }
  
  try {
    const reminders = await getActiveReminders();
    report.activeRemindersCount = reminders.length;
  } catch {
    console.log('Could not get active reminders');
  }
  
  console.log('📊 Diagnostic Report:', report);
  return report;
}

// Export all test functions
export const testUtils = {
  testPermissions,
  testLocation,
  testScheduledNotifications,
  testActiveReminders,
  testSendNotification,
  testScheduleEvent,
  testClearAll,
  runAllTests,
  getDiagnosticReport,
};
