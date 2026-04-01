/**
 * Weather Service — fetches historical and forecast weather for games and events.
 * Uses Open-Meteo (free, no API key) geocoding + archive/forecast APIs.
 *
 * Weather codes (WMO) → our app conditions:
 *   0        → sunny
 *   1-2      → partly_cloudy
 *   3, 45-48 → cloudy
 *   51-67, 80-82 → rain
 *   71-77, 85-86 → snow
 *
 * - Past dates (≤ today): uses archive API
 * - Future dates (up to 16 days): uses forecast API
 * - Farther than 16 days: no-op (too far out)
 */

import type { Game, Event } from './store-types';
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

/** Geocode an address string → { lat, lon } using Nominatim. */
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
 * Fetch weather for a Game (past = historical, future = forecast).
 * No-op if: weather already fetched, game has no address, or >16 days out.
 */
export async function fetchAndSaveWeather(game: Game, teamId: string): Promise<void> {
  if (game.weatherAutoFetched) return;
  if (!game.date) return;

  const addressToGeocode = game.address || game.location;
  if (!addressToGeocode || addressToGeocode.trim() === '') return;

  const dateStr = game.date.split('T')[0];
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const gameDate = new Date(dateStr + 'T00:00:00');
  const diffDays = Math.round((gameDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

  // Too far in the future — skip
  if (diffDays > 16) return;

  await _fetchAndSave({
    id: game.id,
    date: dateStr,
    time: game.time,
    address: addressToGeocode,
    isFuture: diffDays > 0,
    saveToTable: 'games',
    localUpdate: (temp, condition, isForecast) => {
      useTeamStore.getState().updateGame(game.id, {
        weatherTemp: temp ?? undefined,
        weatherCondition: condition ?? undefined,
        weatherAutoFetched: true,
        weatherIsForecast: isForecast,
      });
    },
  });
}

/**
 * Fetch weather for an Event (past = historical, future = forecast).
 * No-op if: weather already fetched, event has no address, or >16 days out.
 */
export async function fetchAndSaveEventWeather(event: Event, teamId: string): Promise<void> {
  if (event.weatherAutoFetched) return;
  if (!event.date) return;

  const addressToGeocode = event.address || event.location;
  if (!addressToGeocode || addressToGeocode.trim() === '') return;

  const dateStr = event.date.split('T')[0];
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const eventDate = new Date(dateStr + 'T00:00:00');
  const diffDays = Math.round((eventDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

  // Too far in the future — skip
  if (diffDays > 16) return;

  await _fetchAndSave({
    id: event.id,
    date: dateStr,
    time: event.time,
    address: addressToGeocode,
    isFuture: diffDays > 0,
    saveToTable: 'events',
    localUpdate: (temp, condition, isForecast) => {
      useTeamStore.getState().updateEvent(event.id, {
        weatherTemp: temp ?? undefined,
        weatherCondition: condition ?? undefined,
        weatherAutoFetched: true,
        weatherIsForecast: isForecast,
      });
    },
  });
}

interface FetchParams {
  id: string;
  date: string; // YYYY-MM-DD
  time?: string;
  address: string;
  isFuture: boolean;
  saveToTable: 'games' | 'events';
  localUpdate: (temp: number | null, condition: WeatherCondition | null, isForecast: boolean) => void;
}

async function _fetchAndSave(params: FetchParams): Promise<void> {
  const { id, date, time, address, isFuture, saveToTable, localUpdate } = params;

  try {
    const coords = await geocodeAddress(address);
    if (!coords) {
      console.log('[weather] Geocoding failed for:', address);
      localUpdate(null, null, isFuture);
      return;
    }

    const gameHour = parseGameHour(time || '12:00 PM');

    let tempC: number;
    let wmoCode: number;

    if (isFuture) {
      // Forecast API (up to 16 days)
      const url = `https://api.open-meteo.com/v1/forecast?latitude=${coords.lat}&longitude=${coords.lon}&start_date=${date}&end_date=${date}&hourly=temperature_2m,weathercode&temperature_unit=celsius&timezone=auto`;
      const res = await fetch(url);
      const data = await res.json();

      if (!data?.hourly?.temperature_2m || !data?.hourly?.weathercode) {
        console.log('[weather] No forecast data from Open-Meteo');
        localUpdate(null, null, true);
        return;
      }

      tempC = data.hourly.temperature_2m[gameHour] ?? data.hourly.temperature_2m[12];
      wmoCode = data.hourly.weathercode[gameHour] ?? data.hourly.weathercode[12];
    } else {
      // Historical archive API
      const url = `https://archive-api.open-meteo.com/v1/archive?latitude=${coords.lat}&longitude=${coords.lon}&start_date=${date}&end_date=${date}&hourly=temperature_2m,weathercode&temperature_unit=celsius&timezone=auto`;
      const res = await fetch(url);
      const data = await res.json();

      if (!data?.hourly?.temperature_2m || !data?.hourly?.weathercode) {
        console.log('[weather] No archive data from Open-Meteo');
        localUpdate(null, null, false);
        return;
      }

      tempC = data.hourly.temperature_2m[gameHour] ?? data.hourly.temperature_2m[12];
      wmoCode = data.hourly.weathercode[gameHour] ?? data.hourly.weathercode[12];
    }

    const tempF = cToF(tempC);
    const condition = wmoToCondition(wmoCode);

    console.log(`[weather] ${saveToTable} ${id}: ${condition}, ${tempF}°F (WMO ${wmoCode}) [${isFuture ? 'forecast' : 'historical'}]`);

    // Save to Supabase (best-effort)
    const { error } = await supabase.from(saveToTable).update({
      weather_temp: tempF,
      weather_condition: condition,
      weather_auto_fetched: true,
      weather_is_forecast: isFuture,
    }).eq('id', id);

    if (error) {
      console.log(`[weather] Supabase save skipped (migration pending):`, error.message);
    }

    // Always update local store
    localUpdate(tempF, condition, isFuture);
  } catch (err) {
    console.error('[weather] fetch error:', err);
  }
}
