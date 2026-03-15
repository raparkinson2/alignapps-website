-- Migration: Add 'viewed' to event_responses and game_responses response CHECK constraints
-- Run this in the Supabase SQL editor

-- Drop the existing CHECK constraint on event_responses.response and recreate with 'viewed'
ALTER TABLE event_responses DROP CONSTRAINT IF EXISTS event_responses_response_check;
ALTER TABLE event_responses ADD CONSTRAINT event_responses_response_check
  CHECK (response IN ('confirmed', 'declined', 'invited', 'viewed'));

-- Drop the existing CHECK constraint on game_responses.response and recreate with 'viewed'
ALTER TABLE game_responses DROP CONSTRAINT IF EXISTS game_responses_response_check;
ALTER TABLE game_responses ADD CONSTRAINT game_responses_response_check
  CHECK (response IN ('in', 'out', 'invited', 'viewed'));
