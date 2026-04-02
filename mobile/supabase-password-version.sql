-- ============================================================
-- Password Version Column
-- Run this in your Supabase SQL Editor to support offline
-- session invalidation when a password is changed.
-- ============================================================

ALTER TABLE players
  ADD COLUMN IF NOT EXISTS password_version INTEGER NOT NULL DEFAULT 1;
