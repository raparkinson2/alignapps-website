/**
 * Weather Service — fetches weather via the backend proxy.
 * The backend calls Nominatim (geocoding) + Open-Meteo (weather).
 * Routing through the backend avoids React Native network issues with external APIs.
 *
 * - Past dates: historical data from Open-Meteo archive
 * - Future dates (≤16 days): forecast data from Open-Meteo forecast
 */

import type { Game, Event } from './store-types';
import { supabase } from './supabase';
import { useTeamStore } from './store';
import { BACKEND_URL } from './config';
import { cacheWeather } from './weather-cache';

type WeatherCondition = 'sunny' | 'partly_cloudy' | 'cloudy' | 'rain' | 'snow' | 'indoor';

/**
 * Fetch weather for a Game via the backend proxy.
 * No-op if: weather already fetched AND has data, no address, or >16 days out.
 */
export async function fetchAndSaveWeather(game: Game, teamId: string): Promise<void> {
  if (!game.date) return;

  const address = game.address || game.location;
  if (!address?.trim()) return;

  const dateStr = game.date.split('T')[0];
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const diffDays = Math.round(
    (new Date(dateStr + 'T00:00:00').getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
  );
  if (diffDays > 16) return;

  // For past games with data already fetched, skip re-fetch (historical data doesn't change)
  const isPast = diffDays < 0;
  if (isPast && game.weatherAutoFetched && (game.weatherTemp != null || game.weatherCondition)) return;

  await _fetchAndSave({
    id: game.id,
    date: dateStr,
    time: game.time,
    address,
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
 * Fetch weather for an Event via the backend proxy.
 * No-op if: weather already fetched AND has data, no address, or >16 days out.
 */
export async function fetchAndSaveEventWeather(event: Event, teamId: string): Promise<void> {
  if (!event.date) return;

  const address = event.address || event.location;
  if (!address?.trim()) return;

  const dateStr = event.date.split('T')[0];
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const diffDays = Math.round(
    (new Date(dateStr + 'T00:00:00').getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
  );
  if (diffDays > 16) return;

  // For past events with data already fetched, skip re-fetch (historical data doesn't change)
  const isPast = diffDays < 0;
  if (isPast && event.weatherAutoFetched && (event.weatherTemp != null || event.weatherCondition)) return;

  await _fetchAndSave({
    id: event.id,
    date: dateStr,
    time: event.time,
    address,
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
  date: string;
  time?: string;
  address: string;
  saveToTable: 'games' | 'events';
  localUpdate: (temp: number | null, condition: WeatherCondition | null, isForecast: boolean) => void;
}

async function _fetchAndSave(params: FetchParams): Promise<void> {
  const { id, date, time, address, saveToTable, localUpdate } = params;

  try {
    const url = new URL(`${BACKEND_URL}/api/weather`);
    url.searchParams.set('address', address);
    url.searchParams.set('date', date);
    if (time) url.searchParams.set('time', time);

    const res = await fetch(url.toString());

    if (!res.ok) {
      const err = await res.json().catch(() => ({})) as { error?: string };
      console.log(`[weather] Backend error for ${saveToTable} ${id}:`, err.error ?? res.status);
      // Mark as auto-fetched so bad addresses don't retry forever
      supabase.from(saveToTable).update({ weather_auto_fetched: true }).eq('id', id).then(() => {});
      localUpdate(null, null, false);
      return;
    }

    const data = await res.json() as { tempF: number; condition: WeatherCondition; isForecast: boolean };
    console.log(`[weather] ${saveToTable} ${id}: ${data.condition}, ${data.tempF}°F [${data.isForecast ? 'forecast' : 'historical'}]`);

    // Persist to Supabase (best-effort)
    supabase.from(saveToTable).update({
      weather_temp: data.tempF,
      weather_condition: data.condition,
      weather_auto_fetched: true,
    }).eq('id', id).then(({ error }) => {
      if (error) console.log('[weather] Supabase save skipped:', error.message);
    });

    // Always cache locally so it survives app restarts even if Supabase columns are missing
    cacheWeather(id, {
      weatherTemp: data.tempF,
      weatherCondition: data.condition,
      weatherAutoFetched: true,
      weatherIsForecast: data.isForecast,
    }).catch(() => {});

    localUpdate(data.tempF, data.condition, data.isForecast);
  } catch (err) {
    console.warn('[weather] fetch error:', err);
  }
}
