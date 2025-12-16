/**
 * Utility functions for calculating distances between geographic coordinates
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
