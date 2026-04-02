/**
 * Local AsyncStorage cache for event/game weather data.
 * Used as a fallback when Supabase doesn't have weather columns on the events table.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

const CACHE_KEY = 'weather_cache_v1';

interface WeatherEntry {
  weatherTemp?: number;
  weatherCondition?: 'sunny' | 'partly_cloudy' | 'cloudy' | 'rain' | 'snow' | 'indoor';
  weatherAutoFetched?: boolean;
  weatherIsForecast?: boolean;
}

type WeatherCache = Record<string, WeatherEntry>;

let _cache: WeatherCache | null = null;

async function loadCache(): Promise<WeatherCache> {
  if (_cache !== null) return _cache;
  try {
    const raw = await AsyncStorage.getItem(CACHE_KEY);
    _cache = raw ? (JSON.parse(raw) as WeatherCache) : {};
  } catch {
    _cache = {};
  }
  return _cache;
}

async function saveCache(): Promise<void> {
  if (_cache === null) return;
  try {
    await AsyncStorage.setItem(CACHE_KEY, JSON.stringify(_cache));
  } catch {
    // best effort
  }
}

export async function cacheWeather(id: string, entry: WeatherEntry): Promise<void> {
  const cache = await loadCache();
  cache[id] = entry;
  await saveCache();
}

export async function getCachedWeather(id: string): Promise<WeatherEntry | null> {
  const cache = await loadCache();
  return cache[id] ?? null;
}

export async function getAllCachedWeather(): Promise<WeatherCache> {
  return loadCache();
}
