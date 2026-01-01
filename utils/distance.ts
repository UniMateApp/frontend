/**
 * ===============================================================================
 * DISTANCE CALCULATION UTILITIES
 * ===============================================================================
 * 
 * PURPOSE:
 * Calculate accurate distances between GPS coordinates using the Haversine formula.
 * Essential for determining if user is within event notification radius.
 * 
 * HAVERSINE FORMULA EXPLANATION:
 * ────────────────────────────────────────────────────────────────────────────
 * The Haversine formula calculates the great-circle distance between two points
 * on a sphere (Earth) given their latitudes and longitudes.
 * 
 * Formula Steps:
 * 1. Convert latitude/longitude from degrees to radians
 * 2. Calculate differences: dLat = lat2 - lat1, dLon = lon2 - lon1
 * 3. Apply Haversine formula:
 *    a = sin²(dLat/2) + cos(lat1) × cos(lat2) × sin²(dLon/2)
 *    c = 2 × atan2(√a, √(1−a))
 *    distance = R × c (where R = Earth's radius = 6371 km)
 * 
 * ACCURACY:
 * - Assumes Earth is a perfect sphere (6371 km radius)
 * - Accurate to within 0.5% for most distances
 * - More accurate than simple Euclidean distance for geographic coordinates
 * 
 * USAGE IN NOTIFICATION SYSTEM:
 * ────────────────────────────────────────────────────────────────────────────
 * Example: Check if user is near an event
 * 
 * User location: (6.7950, 79.8950)
 * Event location: (6.7970, 79.8999)
 * 
 * distance = calculateHaversineDistance(6.7950, 79.8950, 6.7970, 79.8999)
 * → Result: 0.52 km
 * 
 * isWithinRadius(6.7950, 79.8950, 6.7970, 79.8999, 8.0)
 * → Result: true (0.52 km < 8 km)
 * 
 * CONFIGURATION:
 * ────────────────────────────────────────────────────────────────────────────
 * Notification radius defined in: constants/campus.ts
 * - NOTIFICATION_RADIUS_KM = 8 (8 kilometers)
 * - Campus coordinates: University of Moratuwa (6.7970, 79.8999)
 * ===============================================================================
 */

/**
 * Calculates the Haversine distance between two geographic coordinates
 * @param lat1 - Latitude of point 1 (in degrees)
 * @param lon1 - Longitude of point 1 (in degrees)
 * @param lat2 - Latitude of point 2 (in degrees)
 * @param lon2 - Longitude of point 2 (in degrees)
 * @returns Distance in kilometers
 */
export function calculateHaversineDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  // Earth's radius in kilometers
  const R = 6371;

  // Convert degrees to radians
  const dLat = toRadians(lat2 - lat1);
  const dLon = toRadians(lon2 - lon1);
  const radLat1 = toRadians(lat1);
  const radLat2 = toRadians(lat2);

  // Haversine formula
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.sin(dLon / 2) * Math.sin(dLon / 2) * Math.cos(radLat1) * Math.cos(radLat2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const distance = R * c;

  return distance;
}

/**
 * Converts degrees to radians
 * @param degrees - Angle in degrees
 * @returns Angle in radians
 */
function toRadians(degrees: number): number {
  return degrees * (Math.PI / 180);
}

/**
 * Checks if a coordinate is within a specified radius of a target location
 * @param currentLat - Current latitude
 * @param currentLon - Current longitude
 * @param targetLat - Target latitude
 * @param targetLon - Target longitude
 * @param radiusKm - Radius in kilometers
 * @returns true if within radius, false otherwise
 */
export function isWithinRadius(
  currentLat: number,
  currentLon: number,
  targetLat: number,
  targetLon: number,
  radiusKm: number
): boolean {
  const distance = calculateHaversineDistance(currentLat, currentLon, targetLat, targetLon);
  return distance <= radiusKm;
}
