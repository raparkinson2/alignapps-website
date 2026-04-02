-- ============================================================
-- RLS Fix: Phone-Auth User Support
-- Run this in your Supabase SQL Editor.
--
-- Problem: get_my_team_id() only looks up by auth.uid(), which
-- is NULL for phone-auth users (they have no Supabase Auth account).
-- RLS policies evaluating `team_id = get_my_team_id()` return false
-- for ALL phone users, blocking their access.
--
-- Fix: Update get_my_team_id() to also check a session-level
-- player_id set via set_player_context() RPC call. Phone users
-- call this RPC at login to establish their identity for RLS.
-- ============================================================

-- Step 1: Update get_my_team_id() to support both auth methods
CREATE OR REPLACE FUNCTION get_my_team_id()
RETURNS TEXT AS $$
DECLARE
  v_team_id TEXT;
  v_player_id TEXT;
BEGIN
  -- Primary: email/OAuth users (have Supabase Auth accounts)
  SELECT team_id INTO v_team_id
    FROM players WHERE auth_user_id = auth.uid() LIMIT 1;
  IF v_team_id IS NOT NULL THEN
    RETURN v_team_id;
  END IF;

  -- Fallback: phone-auth users set app.player_id via set_player_context()
  BEGIN
    v_player_id := current_setting('app.player_id', true);
    IF v_player_id IS NOT NULL AND v_player_id <> '' THEN
      SELECT team_id INTO v_team_id
        FROM players WHERE id = v_player_id LIMIT 1;
      RETURN v_team_id;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    NULL; -- setting not present, return NULL below
  END;

  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Step 2: Helper to get the current player ID (used in delete policies)
CREATE OR REPLACE FUNCTION get_my_player_id()
RETURNS TEXT AS $$
DECLARE
  v_player_id TEXT;
BEGIN
  -- Primary: email/OAuth users
  SELECT id INTO v_player_id
    FROM players WHERE auth_user_id = auth.uid() LIMIT 1;
  IF v_player_id IS NOT NULL THEN
    RETURN v_player_id;
  END IF;

  -- Fallback: phone-auth users
  BEGIN
    v_player_id := current_setting('app.player_id', true);
    IF v_player_id IS NOT NULL AND v_player_id <> '' THEN
      RETURN v_player_id;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;

  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Step 3: RPC for phone-auth users to set their session context
-- The app calls this once at login before making other Supabase calls.
-- Uses set_config with is_local=true so it's scoped to the transaction.
CREATE OR REPLACE FUNCTION set_player_context(player_id TEXT)
RETURNS void AS $$
BEGIN
  PERFORM set_config('app.player_id', player_id, true);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Step 4: Update the chat delete policy to use get_my_player_id()
-- so it works for phone users too (currently uses auth_user_id directly)
DROP POLICY IF EXISTS "Team members can delete their messages" ON chat_messages;
CREATE POLICY "Team members can delete their messages" ON chat_messages
  FOR DELETE USING (
    team_id = get_my_team_id()
    AND sender_id = get_my_player_id()
  );

-- Step 5: Update team invitations admin check to use get_my_player_id()
DROP POLICY IF EXISTS "Admins can create invitations" ON team_invitations;
CREATE POLICY "Admins can create invitations" ON team_invitations
  FOR INSERT WITH CHECK (
    team_id = get_my_team_id()
    AND EXISTS (
      SELECT 1 FROM players
      WHERE id = get_my_player_id()
      AND 'admin' = ANY(roles)
    )
  );

-- ============================================================
-- IMPORTANT: After running this SQL, update the mobile app to
-- call set_player_context at phone-auth login:
--
--   await supabase.rpc('set_player_context', { player_id: playerId });
--
-- This must be called once per Supabase client session for phone
-- users before any RLS-protected queries run.
-- ============================================================
