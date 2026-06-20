import * as Location from 'expo-location'

// Live local weather for the Today screen, from Open-Meteo (free, no API key).
// Best-effort by design: any failure — permission denied, no location fix, no
// network — resolves to null and the screen simply omits the weather block.

export type WeatherCondition =
  | 'clear'
  | 'partly'
  | 'overcast'
  | 'fog'
  | 'rain'
  | 'snow'
  | 'storm'

export type Weather = {
  temperatureF: number
  condition: WeatherCondition
}

// Weather doesn't move fast — cache the last real read so tab focus changes and
// re-renders don't hit the network (or the GPS) again for half an hour. A failed
// read (permission denied, offline, no fix) is cached only briefly, so granting
// permission or regaining network recovers on the next visit instead of being
// stuck on a stale `null` for the full window.
const CACHE_MS = 30 * 60 * 1000
const NEGATIVE_CACHE_MS = 2 * 60 * 1000
let cached: { at: number; value: Weather | null } | null = null

/** Coarse condition from the WMO weather code Open-Meteo returns. */
function toCondition(code: number): WeatherCondition {
  if (code === 0) return 'clear'
  if (code <= 2) return 'partly'
  if (code === 3) return 'overcast'
  if (code <= 48) return 'fog'
  if (code <= 67) return 'rain'
  if (code <= 77) return 'snow'
  if (code <= 82) return 'rain'
  if (code <= 86) return 'snow'
  return 'storm'
}

async function fetchWeather(): Promise<Weather | null> {
  try {
    const { status } = await Location.requestForegroundPermissionsAsync()
    if (status !== 'granted') return null

    // A last-known fix is instant and plenty accurate for weather; only fall
    // back to a fresh (low-accuracy) fix when the device has none cached.
    const last = await Location.getLastKnownPositionAsync()
    const position =
      last ?? (await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Low }))
    const { latitude, longitude } = position.coords

    const url =
      'https://api.open-meteo.com/v1/forecast' +
      `?latitude=${latitude.toFixed(3)}&longitude=${longitude.toFixed(3)}` +
      '&current=temperature_2m,weather_code&temperature_unit=fahrenheit'
    const res = await fetch(url)
    if (!res.ok) return null

    const json = (await res.json()) as {
      current?: { temperature_2m?: number; weather_code?: number }
    }
    const temp = json.current?.temperature_2m
    const code = json.current?.weather_code
    if (typeof temp !== 'number' || typeof code !== 'number') return null

    return { temperatureF: Math.round(temp), condition: toCondition(code) }
  } catch {
    return null
  }
}

/** The last cached weather read, synchronously, if still fresh — else null. Lets a
 *  screen seed its initial state so the value paints on first frame (no pop-in)
 *  instead of waiting for the async getWeather to resolve. */
export function cachedWeather(): Weather | null {
  if (!cached) return null
  const ttl = cached.value ? CACHE_MS : NEGATIVE_CACHE_MS
  return Date.now() - cached.at < ttl ? cached.value : null
}

/** The current local weather, or null when it can't be known. Real reads cached 30 min, failures 2 min. */
export async function getWeather(): Promise<Weather | null> {
  if (cached) {
    const ttl = cached.value ? CACHE_MS : NEGATIVE_CACHE_MS
    if (Date.now() - cached.at < ttl) return cached.value
  }
  const value = await fetchWeather()
  cached = { at: Date.now(), value }
  return value
}
