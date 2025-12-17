/**
 * University campus coordinates and notification settings
 * These can be updated based on your actual university location
 */

export const CAMPUS_COORDINATES = {
  // University of Moratuwa, Sri Lanka
  latitude: 6.7964,
  longitude: 79.9014,
};

// Fixed location name for Lost & Found posts
export const DEFAULT_LOCATION_NAME = "University of Moratuwa";

// Formatted location string for database storage
export const DEFAULT_LOCATION = `${CAMPUS_COORDINATES.latitude},${CAMPUS_COORDINATES.longitude}`;

export const NOTIFICATION_RADIUS_KM = 2; // 2 kilometers

// For testing: 2 minutes before event
// For production: change to 60 (1 hour before event)
export const REMINDER_TIME_BEFORE_EVENT_MINUTES = 2; // 2 minutes for testing
