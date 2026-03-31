-- Add is_premium column to teams table
-- Run this in your Supabase SQL editor: https://supabase.com/dashboard

ALTER TABLE teams ADD COLUMN IF NOT EXISTS is_premium BOOLEAN NOT NULL DEFAULT FALSE;
