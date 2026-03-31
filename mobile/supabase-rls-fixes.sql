-- ============================================================
-- RLS Security Fixes
-- Run this entire file in your Supabase SQL Editor:
-- supabase.com → your project → SQL Editor → New Query
-- ============================================================

-- Create (or update) the helper function that returns the current user's team ID
CREATE OR REPLACE FUNCTION get_my_team_id()
RETURNS TEXT AS $$
  SELECT team_id FROM players WHERE auth_user_id = auth.uid() LIMIT 1;
$$ LANGUAGE sql SECURITY DEFINER;

-- 1. CHAT MESSAGES — restrict to team members only
DROP POLICY IF EXISTS "Anyone can view chat" ON chat_messages;
DROP POLICY IF EXISTS "Anyone can send messages" ON chat_messages;
DROP POLICY IF EXISTS "Anyone can delete their messages" ON chat_messages;

CREATE POLICY "Team members can view chat" ON chat_messages
  FOR SELECT USING (team_id = get_my_team_id());

CREATE POLICY "Team members can send messages" ON chat_messages
  FOR INSERT WITH CHECK (team_id = get_my_team_id());

CREATE POLICY "Team members can delete their messages" ON chat_messages
  FOR DELETE USING (
    team_id = get_my_team_id()
    AND sender_id IN (SELECT id FROM players WHERE auth_user_id = auth.uid())
  );

-- 2. STORAGE BUCKET — require authentication to upload or delete
DROP POLICY IF EXISTS "Anyone can upload photos" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can delete photos" ON storage.objects;

CREATE POLICY "Authenticated users can upload photos" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'team-photos'
    AND auth.uid() IS NOT NULL
  );

CREATE POLICY "Authenticated users can delete photos" ON storage.objects
  FOR DELETE USING (
    bucket_id = 'team-photos'
    AND auth.uid() IS NOT NULL
  );

-- 3. TEAM INVITATIONS — restrict creation to admins only
DROP POLICY IF EXISTS "Anyone can create invitations" ON team_invitations;
DROP POLICY IF EXISTS "Anyone can accept invitations" ON team_invitations;

CREATE POLICY "Admins can create invitations" ON team_invitations
  FOR INSERT WITH CHECK (
    team_id = get_my_team_id()
    AND EXISTS (
      SELECT 1 FROM players
      WHERE auth_user_id = auth.uid()
      AND 'admin' = ANY(roles)
    )
  );

CREATE POLICY "Authenticated users can accept invitations" ON team_invitations
  FOR UPDATE USING (
    accepted_at IS NULL
    AND auth.uid() IS NOT NULL
  );
