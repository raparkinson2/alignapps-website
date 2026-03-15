-- =============================================================================
-- ALIGN SPORTS - SUPABASE SETUP V2
-- Supabase-first architecture: all data lives in Supabase, devices are caches.
-- All IDs are TEXT to match app-generated IDs (e.g., "team-1234567890").
-- RLS is open (no auth.uid()) because the app manages its own player identity.
-- Run this entire file in your Supabase SQL Editor.
-- =============================================================================

-- Enable UUID extension (still used for some generated IDs)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =============================================================================
-- DROP EXISTING TABLES (clean slate - comment these out if you want to preserve data)
-- =============================================================================
DROP TABLE IF EXISTS player_payments CASCADE;
DROP TABLE IF EXISTS payment_periods CASCADE;
DROP TABLE IF EXISTS payment_entries CASCADE;
DROP TABLE IF EXISTS event_responses CASCADE;
DROP TABLE IF EXISTS game_responses CASCADE;
DROP TABLE IF EXISTS events CASCADE;
DROP TABLE IF EXISTS games CASCADE;
DROP TABLE IF EXISTS chat_messages CASCADE;
DROP TABLE IF EXISTS chat_read_status CASCADE;
DROP TABLE IF EXISTS notifications CASCADE;
DROP TABLE IF EXISTS photos CASCADE;
DROP TABLE IF EXISTS team_invitations CASCADE;
DROP TABLE IF EXISTS email_logs CASCADE;
DROP TABLE IF EXISTS players CASCADE;
DROP TABLE IF EXISTS teams CASCADE;

-- =============================================================================
-- TEAMS TABLE
-- Stores everything about a team including settings, record, and preferences.
-- =============================================================================
CREATE TABLE teams (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  sport TEXT NOT NULL DEFAULT 'hockey',
  team_logo TEXT,
  -- Record
  wins INTEGER DEFAULT 0,
  losses INTEGER DEFAULT 0,
  ties INTEGER DEFAULT 0,
  ot_losses INTEGER DEFAULT 0,
  -- Feature toggles
  show_team_stats BOOLEAN DEFAULT true,
  show_payments BOOLEAN DEFAULT true,
  show_team_chat BOOLEAN DEFAULT true,
  show_photos BOOLEAN DEFAULT true,
  show_refreshment_duty BOOLEAN DEFAULT true,
  refreshment_duty_is_21_plus BOOLEAN DEFAULT true,
  show_lineups BOOLEAN DEFAULT true,
  allow_player_self_stats BOOLEAN DEFAULT false,
  show_records BOOLEAN DEFAULT true,
  enabled_roles TEXT[] DEFAULT ARRAY['player','reserve','coach','parent'],
  is_softball BOOLEAN DEFAULT false,
  -- Colors and payment config as JSONB
  jersey_colors JSONB DEFAULT '[{"name":"White","color":"#ffffff"},{"name":"Black","color":"#1a1a1a"}]'::jsonb,
  payment_methods JSONB DEFAULT '[]'::jsonb,
  -- Season management
  current_season_name TEXT,
  season_history JSONB DEFAULT '[]'::jsonb,
  -- Championships
  championships JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================================================
-- PLAYERS TABLE
-- All player data including notification preferences and stats.
-- No auth.users FK — app uses its own player IDs.
-- =============================================================================
CREATE TABLE players (
  id TEXT PRIMARY KEY,
  team_id TEXT NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  jersey_number TEXT DEFAULT '',
  position TEXT DEFAULT 'C',
  positions TEXT[] DEFAULT '{}',
  avatar TEXT,
  roles TEXT[] DEFAULT '{}',
  status TEXT DEFAULT 'active',
  is_injured BOOLEAN DEFAULT false,
  is_suspended BOOLEAN DEFAULT false,
  status_end_date TEXT,
  unavailable_dates TEXT[] DEFAULT '{}',
  notification_preferences JSONB DEFAULT '{"gameInvites":true,"gameReminderDayBefore":true,"gameReminderHoursBefore":true,"chatMessages":true,"chatMentions":true,"paymentReminders":true}'::jsonb,
  push_token TEXT,
  password TEXT, -- Hashed password for phone-only users (no Supabase Auth account)
  stats JSONB DEFAULT '{}'::jsonb,
  goalie_stats JSONB DEFAULT '{}'::jsonb,
  pitcher_stats JSONB DEFAULT '{}'::jsonb,
  game_logs JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================================================
-- GAMES TABLE
-- =============================================================================
CREATE TABLE games (
  id TEXT PRIMARY KEY,
  team_id TEXT NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  opponent TEXT NOT NULL DEFAULT '',
  date TEXT NOT NULL,
  time TEXT NOT NULL DEFAULT '',
  location TEXT NOT NULL DEFAULT '',
  address TEXT DEFAULT '',
  jersey_color TEXT DEFAULT '',
  notes TEXT,
  show_beer_duty BOOLEAN DEFAULT false,
  beer_duty_player_id TEXT REFERENCES players(id) ON DELETE SET NULL,
  -- Lineups as JSONB
  hockey_lineup JSONB,
  basketball_lineup JSONB,
  baseball_lineup JSONB,
  batting_order_lineup JSONB,
  soccer_lineup JSONB,
  soccer_diamond_lineup JSONB,
  lacrosse_lineup JSONB,
  -- Invite settings
  invite_release_option TEXT DEFAULT 'now',
  invite_release_date TEXT,
  invites_sent BOOLEAN DEFAULT false,
  -- Final score
  final_score_us INTEGER,
  final_score_them INTEGER,
  game_result TEXT,
  result_recorded BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================================================
-- GAME RESPONSES (check-in / check-out / invited)
-- =============================================================================
CREATE TABLE game_responses (
  id TEXT PRIMARY KEY DEFAULT concat('gr-', extract(epoch from now())::text, '-', substr(md5(random()::text), 1, 8)),
  game_id TEXT NOT NULL REFERENCES games(id) ON DELETE CASCADE,
  player_id TEXT NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  response TEXT NOT NULL CHECK (response IN ('in', 'out', 'invited', 'viewed')),
  note TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(game_id, player_id)
);

-- =============================================================================
-- EVENTS TABLE (practices, meetings, socials, other)
-- =============================================================================
CREATE TABLE events (
  id TEXT PRIMARY KEY,
  team_id TEXT NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  type TEXT DEFAULT 'other' CHECK (type IN ('practice', 'meeting', 'social', 'other')),
  date TEXT NOT NULL,
  time TEXT NOT NULL DEFAULT '',
  location TEXT NOT NULL DEFAULT '',
  address TEXT,
  notes TEXT,
  invite_release_option TEXT DEFAULT 'now',
  invite_release_date TEXT,
  invites_sent BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================================================
-- EVENT RESPONSES
-- =============================================================================
CREATE TABLE event_responses (
  id TEXT PRIMARY KEY DEFAULT concat('er-', extract(epoch from now())::text, '-', substr(md5(random()::text), 1, 8)),
  event_id TEXT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  player_id TEXT NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  response TEXT NOT NULL CHECK (response IN ('confirmed', 'declined', 'invited', 'viewed')),
  note TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(event_id, player_id)
);

-- =============================================================================
-- CHAT MESSAGES
-- =============================================================================
CREATE TABLE chat_messages (
  id TEXT PRIMARY KEY,
  team_id TEXT NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  sender_id TEXT NOT NULL,
  sender_name TEXT,
  message TEXT,
  image_url TEXT,
  gif_url TEXT,
  gif_width INTEGER,
  gif_height INTEGER,
  mentioned_player_ids TEXT[] DEFAULT '{}',
  mention_type TEXT CHECK (mention_type IN ('all', 'specific')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================================================
-- NOTIFICATIONS
-- =============================================================================
CREATE TABLE notifications (
  id TEXT PRIMARY KEY,
  team_id TEXT NOT NULL,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  game_id TEXT,
  event_id TEXT,
  from_player_id TEXT,
  to_player_id TEXT NOT NULL,
  read BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================================================
-- PHOTOS
-- =============================================================================
CREATE TABLE photos (
  id TEXT PRIMARY KEY,
  team_id TEXT NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  game_id TEXT,
  uri TEXT NOT NULL,
  uploaded_by TEXT,
  uploaded_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================================================
-- PAYMENT PERIODS
-- =============================================================================
CREATE TABLE payment_periods (
  id TEXT PRIMARY KEY,
  team_id TEXT NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  amount DECIMAL(10,2) NOT NULL DEFAULT 0,
  type TEXT DEFAULT 'misc',
  due_date TEXT,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================================================
-- PLAYER PAYMENTS
-- =============================================================================
CREATE TABLE player_payments (
  id TEXT PRIMARY KEY DEFAULT concat('pp-', extract(epoch from now())::text, '-', substr(md5(random()::text), 1, 8)),
  payment_period_id TEXT NOT NULL REFERENCES payment_periods(id) ON DELETE CASCADE,
  player_id TEXT NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  status TEXT DEFAULT 'unpaid' CHECK (status IN ('unpaid', 'paid', 'partial')),
  amount DECIMAL(10,2) DEFAULT 0,
  notes TEXT,
  paid_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(payment_period_id, player_id)
);

-- =============================================================================
-- PAYMENT ENTRIES (individual payment events within a player_payment)
-- =============================================================================
CREATE TABLE payment_entries (
  id TEXT PRIMARY KEY DEFAULT concat('pe-', extract(epoch from now())::text, '-', substr(md5(random()::text), 1, 8)),
  player_payment_id TEXT NOT NULL REFERENCES player_payments(id) ON DELETE CASCADE,
  amount DECIMAL(10,2) NOT NULL,
  date TEXT NOT NULL,
  note TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================================================
-- TEAM INVITATIONS (for inviting new players via email/phone)
-- =============================================================================
CREATE TABLE team_invitations (
  id TEXT PRIMARY KEY DEFAULT concat('inv-', extract(epoch from now())::text, '-', substr(md5(random()::text), 1, 8)),
  team_id TEXT NOT NULL,
  team_name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  jersey_number TEXT,
  position TEXT,
  roles TEXT[] DEFAULT '{}',
  sport TEXT DEFAULT 'hockey',
  invited_by_email TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  accepted_at TIMESTAMPTZ,
  CONSTRAINT team_invitations_contact_check CHECK (email IS NOT NULL OR phone IS NOT NULL)
);

-- =============================================================================
-- POLLS
-- =============================================================================
CREATE TABLE polls (
  id TEXT PRIMARY KEY,
  team_id TEXT NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  question TEXT NOT NULL,
  options JSONB DEFAULT '[]'::jsonb,
  created_by TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ,
  is_active BOOLEAN DEFAULT true,
  allow_multiple_votes BOOLEAN DEFAULT false,
  group_id TEXT,
  group_name TEXT,
  is_required BOOLEAN DEFAULT false
);

-- =============================================================================
-- TEAM LINKS
-- =============================================================================
CREATE TABLE team_links (
  id TEXT PRIMARY KEY,
  team_id TEXT NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  url TEXT NOT NULL,
  created_by TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================================================
-- INDEXES
-- =============================================================================
CREATE INDEX idx_players_team ON players(team_id);
CREATE INDEX idx_players_email ON players(lower(email)) WHERE email IS NOT NULL;
CREATE INDEX idx_players_phone ON players(phone) WHERE phone IS NOT NULL;
CREATE INDEX idx_games_team ON games(team_id);
CREATE INDEX idx_games_date ON games(date);
CREATE INDEX idx_game_responses_game ON game_responses(game_id);
CREATE INDEX idx_game_responses_player ON game_responses(player_id);
CREATE INDEX idx_events_team ON events(team_id);
CREATE INDEX idx_event_responses_event ON event_responses(event_id);
CREATE INDEX idx_chat_messages_team ON chat_messages(team_id);
CREATE INDEX idx_chat_messages_created ON chat_messages(created_at);
CREATE INDEX idx_notifications_to_player ON notifications(to_player_id);
CREATE INDEX idx_notifications_unread ON notifications(to_player_id, read) WHERE read = false;
CREATE INDEX idx_photos_team ON photos(team_id);
CREATE INDEX idx_payment_periods_team ON payment_periods(team_id);
CREATE INDEX idx_player_payments_period ON player_payments(payment_period_id);
CREATE INDEX idx_player_payments_player ON player_payments(player_id);
CREATE INDEX idx_team_invitations_email ON team_invitations(lower(email)) WHERE email IS NOT NULL;
CREATE INDEX idx_team_invitations_phone ON team_invitations(phone) WHERE phone IS NOT NULL;
CREATE INDEX idx_polls_team ON polls(team_id);
CREATE INDEX idx_team_links_team ON team_links(team_id);

-- =============================================================================
-- ROW LEVEL SECURITY
-- All tables are open (no auth.uid()) because the app manages player identity.
-- =============================================================================
ALTER TABLE teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE players ENABLE ROW LEVEL SECURITY;
ALTER TABLE games ENABLE ROW LEVEL SECURITY;
ALTER TABLE game_responses ENABLE ROW LEVEL SECURITY;
ALTER TABLE events ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_responses ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE photos ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_periods ENABLE ROW LEVEL SECURITY;
ALTER TABLE player_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE team_invitations ENABLE ROW LEVEL SECURITY;
ALTER TABLE polls ENABLE ROW LEVEL SECURITY;
ALTER TABLE team_links ENABLE ROW LEVEL SECURITY;

-- Open policies (app enforces access control)
CREATE POLICY "Open teams" ON teams FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Open players" ON players FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Open games" ON games FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Open game_responses" ON game_responses FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Open events" ON events FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Open event_responses" ON event_responses FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Open chat_messages" ON chat_messages FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Open notifications" ON notifications FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Open photos" ON photos FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Open payment_periods" ON payment_periods FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Open player_payments" ON player_payments FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Open payment_entries" ON payment_entries FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Open team_invitations" ON team_invitations FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Open polls" ON polls FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Open team_links" ON team_links FOR ALL USING (true) WITH CHECK (true);

-- =============================================================================
-- REALTIME - Enable all tables for live sync
-- =============================================================================
ALTER TABLE teams REPLICA IDENTITY FULL;
ALTER TABLE players REPLICA IDENTITY FULL;
ALTER TABLE games REPLICA IDENTITY FULL;
ALTER TABLE game_responses REPLICA IDENTITY FULL;
ALTER TABLE events REPLICA IDENTITY FULL;
ALTER TABLE event_responses REPLICA IDENTITY FULL;
ALTER TABLE chat_messages REPLICA IDENTITY FULL;
ALTER TABLE notifications REPLICA IDENTITY FULL;
ALTER TABLE photos REPLICA IDENTITY FULL;
ALTER TABLE payment_periods REPLICA IDENTITY FULL;
ALTER TABLE player_payments REPLICA IDENTITY FULL;
ALTER TABLE payment_entries REPLICA IDENTITY FULL;
ALTER TABLE polls REPLICA IDENTITY FULL;
ALTER TABLE team_links REPLICA IDENTITY FULL;

ALTER PUBLICATION supabase_realtime ADD TABLE teams;
ALTER PUBLICATION supabase_realtime ADD TABLE players;
ALTER PUBLICATION supabase_realtime ADD TABLE games;
ALTER PUBLICATION supabase_realtime ADD TABLE game_responses;
ALTER PUBLICATION supabase_realtime ADD TABLE events;
ALTER PUBLICATION supabase_realtime ADD TABLE event_responses;
ALTER PUBLICATION supabase_realtime ADD TABLE chat_messages;
ALTER PUBLICATION supabase_realtime ADD TABLE notifications;
ALTER PUBLICATION supabase_realtime ADD TABLE photos;
ALTER PUBLICATION supabase_realtime ADD TABLE payment_periods;
ALTER PUBLICATION supabase_realtime ADD TABLE player_payments;
ALTER PUBLICATION supabase_realtime ADD TABLE payment_entries;
ALTER PUBLICATION supabase_realtime ADD TABLE polls;
ALTER PUBLICATION supabase_realtime ADD TABLE team_links;

-- =============================================================================
-- UPDATED_AT TRIGGERS
-- =============================================================================
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER teams_updated_at BEFORE UPDATE ON teams FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER players_updated_at BEFORE UPDATE ON players FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER games_updated_at BEFORE UPDATE ON games FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER events_updated_at BEFORE UPDATE ON events FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- =============================================================================
-- STORAGE BUCKET FOR TEAM PHOTOS
-- =============================================================================
INSERT INTO storage.buckets (id, name, public)
VALUES ('team-photos', 'team-photos', true)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Anyone can upload photos" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can view photos" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can delete photos" ON storage.objects;

CREATE POLICY "Anyone can upload photos" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'team-photos');
CREATE POLICY "Anyone can view photos" ON storage.objects FOR SELECT USING (bucket_id = 'team-photos');
CREATE POLICY "Anyone can delete photos" ON storage.objects FOR DELETE USING (bucket_id = 'team-photos');
