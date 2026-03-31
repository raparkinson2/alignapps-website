/**
 * Weather Service — auto-fetches historical weather for completed games.
 * Uses Open-Meteo (free, no API key) geocoding + archive API.
 *
 * Weather codes (WMO) → our app conditions:
 *   0        → sunny
 *   1-2      → partly_cloudy
 *   3, 45-48 → cloudy
 *   51-67, 80-82 → rain
 *   71-77, 85-86 → snow
 *
 * Call fetchAndSaveWeather(game, teamId) after a game score is recorded.
 * It is a no-op if weather already fetched or game has no address.
 */

import type { Game } from './store-types';
import { supabase } from './supabase';
import { useTeamStore } from './store';

type WeatherCondition = 'sunny' | 'partly_cloudy' | 'cloudy' | 'rain' | 'snow' | 'indoor';

function wmoToCondition(code: number): WeatherCondition {
  if (code === 0) return 'sunny';
  if (code <= 2) return 'partly_cloudy';
  if (code === 3 || (code >= 45 && code <= 48)) return 'cloudy';
  if ((code >= 51 && code <= 67) || (code >= 80 && code <= 82)) return 'rain';
  if ((code >= 71 && code <= 77) || code === 85 || code === 86) return 'snow';
  return 'cloudy';
}

/** Geocode an address string → { lat, lon } using Open-Meteo geocoding (Nominatim). */
async function geocodeAddress(address: string): Promise<{ lat: number; lon: number } | null> {
  try {
    const encoded = encodeURIComponent(address);
    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?q=${encoded}&format=json&limit=1`,
      { headers: { 'User-Agent': 'TeamManagementApp/1.0' } }
    );
    const data = await res.json();
    if (data?.length > 0) {
      return { lat: parseFloat(data[0].lat), lon: parseFloat(data[0].lon) };
    }
    return null;
  } catch {
    return null;
  }
}

/** Parse a game time string like "7:30 PM" → hour in 24h format. */
function parseGameHour(timeStr: string): number {
  try {
    const match = timeStr.match(/(\d+):(\d+)\s*(AM|PM)/i);
    if (!match) return 12;
    let hour = parseInt(match[1], 10);
    const period = match[3].toUpperCase();
    if (period === 'PM' && hour !== 12) hour += 12;
    if (period === 'AM' && hour === 12) hour = 0;
    return hour;
  } catch {
    return 12;
  }
}

/** Celsius → Fahrenheit */
function cToF(c: number): number {
  return Math.round(c * 9 / 5 + 32);
}

/**
 * Main entry point.
 * Fetches weather for a past game and saves it to Supabase + local store.
 * No-op if: weather already fetched, game is in future, game has no address/location,
 *           or game has no final score (not yet complete).
 */
export async function fetchAndSaveWeather(game: Game, teamId: string): Promise<void> {
  // Guard conditions
  if (game.weatherAutoFetched) return;
  if (!game.gameResult) return; // Only fetch for completed games
  if (!game.date) return;

  const gameDate = new Date(game.date);
  const now = new Date();
  // Only fetch if game was in the past
  if (gameDate >= now) return;

  const addressToGeocode = game.address || game.location;
  if (!addressToGeocode || addressToGeocode.trim() === '') return;

  try {
    // Step 1: Geocode
    const coords = await geocodeAddress(addressToGeocode);
    if (!coords) {
      console.log('[weather] Geocoding failed for:', addressToGeocode);
      // Mark as fetched anyway so we don't keep retrying
      await markWeatherFetched(game.id, null, null);
      return;
    }

    // Step 2: Fetch historical weather
    const dateStr = game.date.split('T')[0]; // YYYY-MM-DD
    const gameHour = parseGameHour(game.time || '12:00 PM');

    const url = `https://archive-api.open-meteo.com/v1/archive?latitude=${coords.lat}&longitude=${coords.lon}&start_date=${dateStr}&end_date=${dateStr}&hourly=temperature_2m,weathercode&temperature_unit=celsius&timezone=auto`;

    const res = await fetch(url);
    const data = await res.json();

    if (!data?.hourly?.temperature_2m || !data?.hourly?.weathercode) {
      console.log('[weather] No data returned from Open-Meteo');
      await markWeatherFetched(game.id, null, null);
      return;
    }

    // Pick the hour closest to game time
    const tempC = data.hourly.temperature_2m[gameHour] ?? data.hourly.temperature_2m[12];
    const wmoCode = data.hourly.weathercode[gameHour] ?? data.hourly.weathercode[12];

    const tempF = cToF(tempC);
    const condition = wmoToCondition(wmoCode);

    console.log(`[weather] Game ${game.id}: ${condition}, ${tempF}°F (WMO ${wmoCode})`);

    // Step 3: Save to Supabase (best-effort — columns may not exist until migration is run)
    const { error } = await supabase.from('games').update({
      weather_temp: tempF,
      weather_condition: condition,
      weather_auto_fetched: true,
    }).eq('id', game.id);

    if (error) {
      // Columns missing = migration not run yet. Still save locally so the session works.
      console.log('[weather] Supabase save skipped (migration pending):', error.message);
    }

    // Step 4: Always update local store regardless of Supabase result
    useTeamStore.getState().updateGame(game.id, {
      weatherTemp: tempF,
      weatherCondition: condition,
      weatherAutoFetched: true,
    });

    console.log(`[weather] Saved weather for game ${game.id}`);
  } catch (err) {
    console.error('[weather] fetchAndSaveWeather error:', err);
  }
}

async function markWeatherFetched(gameId: string, temp: number | null, condition: WeatherCondition | null): Promise<void> {
  try {
    // Best-effort Supabase save — silently skip if columns missing (migration not run yet)
    await supabase.from('games').update({
      weather_temp: temp,
      weather_condition: condition,
      weather_auto_fetched: true,
    }).eq('id', gameId);
    // Always update local store
    useTeamStore.getState().updateGame(gameId, {
      weatherTemp: temp ?? undefined,
      weatherCondition: condition ?? undefined,
      weatherAutoFetched: true,
    });
  } catch {
    // Silently ignore — migration may not be run yet
  }
}
