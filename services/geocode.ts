import AsyncStorage from '@react-native-async-storage/async-storage';

const ASYNC_PREFIX = 'um:geocode:';

const inMemoryCache: Map<string, string | null> = (global as any).__UM_GeocodeCache ||= new Map();

function toKey(lat: number, lon: number) {
  return `${lat},${lon}`;
}

export function parseLatLng(loc?: string | null) {
  if (!loc) return null;
  const parts = String(loc).split(',').map(s => s.trim());
  if (parts.length < 2) return null;
  const lat = Number(parts[0]);
  const lon = Number(parts[1]);
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
  return { latitude: lat, longitude: lon };
}

async function readCached(key: string): Promise<string | null> {
  try {
    if (inMemoryCache.has(key)) return inMemoryCache.get(key) ?? null;
    const raw = await AsyncStorage.getItem(ASYNC_PREFIX + key);
    if (raw == null) return null;
    try {
      const parsed = JSON.parse(raw);
      inMemoryCache.set(key, parsed);
      return parsed;
    } catch {
      inMemoryCache.set(key, raw);
      return raw;
    }
  } catch (e) {
    console.warn('geocode: readCached failed', e);
    return null;
  }
}

async function writeCached(key: string, value: string | null) {
  try {
    inMemoryCache.set(key, value);
    await AsyncStorage.setItem(ASYNC_PREFIX + key, JSON.stringify(value));
  } catch (e) {
    console.warn('geocode: writeCached failed', e);
  }
}

/**
 * Reverse-geocode lat/lon to a human-friendly name. Uses Nominatim and caches results.
 * Returns `null` when no name could be found or on persistent failure.
 */
export async function getPlaceNameFromLatLng(lat: number, lon: number): Promise<string | null> {
  const key = toKey(lat, lon);
  const cached = await readCached(key);
  if (cached !== null) return cached;

  const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lon}&accept-language=en`;
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    // For production replace with your app/contact URL
    'User-Agent': 'Uni_Mate/1.0 (+https://your-app.example)',
    'Referer': 'https://your-app.example'
  };

  const maxAttempts = 3;
  const backoff = (n: number) => new Promise(res => setTimeout(res, 200 * n));

  let attempt = 0;
  while (attempt < maxAttempts) {
    try {
      const res = await fetch(url, { headers });
      if (!res.ok) {
        attempt++;
        if (attempt >= maxAttempts) throw new Error(`Geocode request failed: ${res.status}`);
        await backoff(attempt);
        continue;
      }
      const data = await res.json();
      const name = data?.name || data?.display_name || null;
      await writeCached(key, name);
      console.debug && console.debug(`geocode: success ${key} -> ${name}`);
      return name;
    } catch (err) {
      attempt++;
      if (attempt >= maxAttempts) {
        console.warn('geocode: failed', err);
        await writeCached(key, null);
        console.debug && console.debug(`geocode: failed ${key} -> null (${String(err)})`);
        return null;
      }
      await backoff(attempt);
    }
  }

  return null;
}
