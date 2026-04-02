-- =============================================
-- EVENTS WEATHER MIGRATION
-- Run this in your Supabase SQL editor: https://supabase.com/dashboard
-- Adds weather columns to the events table so weather data persists across app restarts.
-- =============================================

ALTER TABLE events ADD COLUMN IF NOT EXISTS weather_temp INTEGER;
ALTER TABLE events ADD COLUMN IF NOT EXISTS weather_condition TEXT
  CHECK (weather_condition IN ('sunny','partly_cloudy','cloudy','rain','snow','indoor'));
ALTER TABLE events ADD COLUMN IF NOT EXISTS weather_auto_fetched BOOLEAN DEFAULT false;
ALTER TABLE events ADD COLUMN IF NOT EXISTS weather_is_forecast BOOLEAN DEFAULT false;
