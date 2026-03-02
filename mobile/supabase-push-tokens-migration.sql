-- =============================================================================
-- PUSH TOKENS TABLE MIGRATION
-- Separate table for push tokens so player/profile sync can never wipe them.
-- Uses player_id (TEXT) to match the app's own player ID system (not auth.users).
-- Run this in your Supabase SQL Editor.
-- Safe to re-run: all statements are idempotent.
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.push_tokens (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id   TEXT NOT NULL,
  token       TEXT NOT NULL,
  platform    TEXT,
  app_build   TEXT,
  last_seen   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Add unique constraint on token if it doesn't already exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.push_tokens'::regclass
      AND contype = 'u'
      AND conname = 'push_tokens_token_key'
  ) THEN
    ALTER TABLE public.push_tokens ADD CONSTRAINT push_tokens_token_key UNIQUE (token);
  END IF;
END;
$$;

-- DROP the unique constraint on player_id if it exists.
-- A player switching devices gets a new token — we must allow that INSERT.
-- The backend handles "one token per player" by deleting old tokens before inserting.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.push_tokens'::regclass
      AND contype = 'u'
      AND conname = 'push_tokens_player_id_key'
  ) THEN
    ALTER TABLE public.push_tokens DROP CONSTRAINT push_tokens_player_id_key;
  END IF;
END;
$$;

CREATE INDEX IF NOT EXISTS push_tokens_player_id_idx ON public.push_tokens (player_id);

-- RLS: fully open (backend uses service-role key to bypass anyway)
ALTER TABLE public.push_tokens ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'push_tokens'
      AND policyname = 'Open push_tokens'
  ) THEN
    CREATE POLICY "Open push_tokens" ON public.push_tokens FOR ALL USING (true) WITH CHECK (true);
  END IF;
END;
$$;

-- Realtime (optional)
ALTER TABLE public.push_tokens REPLICA IDENTITY FULL;

-- =============================================================================
-- PUSH DIAGNOSTICS TABLE (optional but highly recommended for TestFlight debugging)
-- Run this to get visibility into registration failures on tester devices.
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.push_diagnostics (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id        TEXT,
  platform         TEXT,
  os_version       TEXT,
  app_version      TEXT,
  permission_status TEXT,
  token_obtained   BOOLEAN DEFAULT false,
  token_prefix     TEXT,
  error_message    TEXT,
  backend_url_seen TEXT,
  timestamp        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE public.push_diagnostics ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Open push_diagnostics" ON public.push_diagnostics FOR ALL USING (true) WITH CHECK (true);
