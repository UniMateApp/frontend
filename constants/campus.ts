/**
 * ===============================================================================
 * CAMPUS LOCATION & NOTIFICATION CONFIGURATION
 * ===============================================================================
 * 
 * PURPOSE:
 * Central configuration for location-aware notifications. All distance-based
 * features use these coordinates as reference points.
 * 
 * CAMPUS_COORDINATES:
 * ────────────────────────────────────────────────────────────────────────────
 * University of Moratuwa, Sri Lanka
 * Latitude: 6.7970301 (North of equator)
 * Longitude: 79.8999734 (East of prime meridian)
 * 
 * Usage:
 * - Center point for proximity checks
 * - Default location for Lost & Found posts
 * - Reference point for "on campus" determination
 * 
 * NOTIFICATION_RADIUS_KM:
 * ────────────────────────────────────────────────────────────────────────────
 * Radius: 8 kilometers (approximately 5 miles)
 * 
 * How it works:
 * - When an event is starting soon (within 2 minutes)
 * - System checks user's GPS location
 * - Calculates distance from user to event location using Haversine formula
 * - If distance ≤ 8 km: Send notification ✅
 * - If distance > 8 km: Skip notification ❌
 * 
 * Why 8 km?
 * - Covers reasonable commute distance to campus
 * - Prevents notifications when user is far away (e.g., at home, another city)
 * - Can be adjusted based on campus size and commute patterns
 * 
 * REMINDER_TIME_BEFORE_EVENT_MINUTES:
 * ────────────────────────────────────────────────────────────────────────────
 * Current: 2 minutes (for testing)
 * Production: Change to 60 minutes (1 hour)
 * 
 * How it works:
 * - Event starts at 2:00 PM
 * - Reminder time: 2 minutes before = 1:58 PM
 * - At 1:58 PM, if user is within 8km, send notification
 * - Notification window: 1:58 PM - 2:00 PM (2 minutes)
 * 
 * Testing vs Production:
 * - Testing (2 min): Easier to test without waiting an hour
 * - Production (60 min): Gives users time to travel to event
 * 
 * DEFAULT_LOCATION & DEFAULT_LOCATION_NAME:
 * ────────────────────────────────────────────────────────────────────────────
 * Used for Lost & Found posts when user doesn't specify location.
 * Format: "6.7970301,79.8999734" (latitude,longitude as string)
 * Location Name: "University of Moratuwa" (displayed in UI)
 * 
 * CUSTOMIZATION:
 * ────────────────────────────────────────────────────────────────────────────
 * To change campus location:
 * 1. Update CAMPUS_COORDINATES with your university's GPS coordinates
 * 2. Update DEFAULT_LOCATION_NAME with your university name
 * 3. Adjust NOTIFICATION_RADIUS_KM based on campus size
 * 4. Change REMINDER_TIME_BEFORE_EVENT_MINUTES for production (60 min)
 * ===============================================================================
 */

export const CAMPUS_COORDINATES = {
  // University of Moratuwa, Sri Lanka
  latitude: 6.7970301,
  longitude: 79.8999734,
};

// Fixed location name for Lost & Found posts
export const DEFAULT_LOCATION_NAME = "University of Moratuwa";

// Formatted location string for database storage
export const DEFAULT_LOCATION = `${CAMPUS_COORDINATES.latitude},${CAMPUS_COORDINATES.longitude}`;

export const NOTIFICATION_RADIUS_KM = 8; // 2 kilometers

// For testing: 2 minutes before event
// For production: change to 60 (1 hour before event)
export const REMINDER_TIME_BEFORE_EVENT_MINUTES = 2; // 2 minutes for testing
