-- =============================================
-- SUPABASE SCHEMA FOR TEAM MANAGEMENT APP
-- Run this in your Supabase SQL Editor
-- =============================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =============================================
-- TEAMS TABLE
-- =============================================
CREATE TABLE teams (
  id TEXT PRIMARY KEY, -- Use TEXT to allow app-generated IDs like "team-1234567890"
  name TEXT NOT NULL,
  sport TEXT NOT NULL DEFAULT 'hockey' CHECK (sport IN ('hockey', 'baseball', 'basketball', 'soccer', 'lacrosse', 'softball')),
  team_logo TEXT,
  -- Team record
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
  -- Jersey colors stored as JSONB array
  jersey_colors JSONB DEFAULT '[{"name": "White", "color": "#ffffff"}, {"name": "Black", "color": "#1a1a1a"}]'::jsonb,
  -- Payment methods stored as JSONB array
  payment_methods JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- PLAYERS TABLE (linked to Supabase Auth)
-- =============================================
CREATE TABLE players (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  auth_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  team_id UUID REFERENCES teams(id) ON DELETE CASCADE,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  jersey_number TEXT,
  position TEXT,
  positions TEXT[] DEFAULT '{}',
  avatar TEXT,
  roles TEXT[] DEFAULT '{}', -- 'admin', 'captain', 'coach'
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'reserve')),
  is_injured BOOLEAN DEFAULT false,
  is_suspended BOOLEAN DEFAULT false,
  -- Notification preferences as JSONB
  notification_preferences JSONB DEFAULT '{
    "gameInvites": true,
    "gameReminderDayBefore": true,
    "gameReminderHoursBefore": true,
    "chatMessages": true,
    "chatMentions": true,
    "paymentReminders": true
  }'::jsonb,
  -- Stats stored as JSONB (flexible for different sports)
  stats JSONB DEFAULT '{}'::jsonb,
  goalie_stats JSONB DEFAULT '{}'::jsonb,
  pitcher_stats JSONB DEFAULT '{}'::jsonb,
  game_logs JSONB DEFAULT '[]'::jsonb,
  push_token TEXT,
  password TEXT, -- Hashed password for phone-only users (no Supabase Auth account)
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- GAMES TABLE
-- =============================================
CREATE TABLE games (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  team_id UUID REFERENCES teams(id) ON DELETE CASCADE,
  opponent TEXT NOT NULL,
  date DATE NOT NULL,
  time TEXT NOT NULL,
  location TEXT NOT NULL,
  address TEXT,
  jersey_color TEXT,
  notes TEXT,
  show_beer_duty BOOLEAN DEFAULT false,
  beer_duty_player_id UUID REFERENCES players(id) ON DELETE SET NULL,
  -- Lineups stored as JSONB (flexible for different sports)
  hockey_lineup JSONB,
  basketball_lineup JSONB,
  baseball_lineup JSONB,
  soccer_lineup JSONB,
  soccer_diamond_lineup JSONB,
  -- Invite settings
  invite_release_option TEXT DEFAULT 'now' CHECK (invite_release_option IN ('now', 'scheduled', 'none')),
  invite_release_date TIMESTAMPTZ,
  invites_sent BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- GAME RESPONSES (Check-in/Check-out)
-- =============================================
CREATE TABLE game_responses (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  game_id UUID REFERENCES games(id) ON DELETE CASCADE,
  player_id UUID REFERENCES players(id) ON DELETE CASCADE,
  response TEXT CHECK (response IN ('in', 'out', 'invited', 'viewed')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(game_id, player_id)
);

-- =============================================
-- EVENTS TABLE
-- =============================================
CREATE TABLE events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  team_id UUID REFERENCES teams(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  type TEXT DEFAULT 'other' CHECK (type IN ('practice', 'meeting', 'social', 'other')),
  date DATE NOT NULL,
  time TEXT NOT NULL,
  location TEXT NOT NULL,
  address TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- EVENT RESPONSES
-- =============================================
CREATE TABLE event_responses (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  event_id UUID REFERENCES events(id) ON DELETE CASCADE,
  player_id UUID REFERENCES players(id) ON DELETE CASCADE,
  response TEXT CHECK (response IN ('confirmed', 'declined', 'invited', 'viewed')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(event_id, player_id)
);

-- =============================================
-- CHAT MESSAGES
-- =============================================
CREATE TABLE chat_messages (
  id TEXT PRIMARY KEY, -- Use TEXT to allow app-generated IDs like timestamps
  team_id TEXT NOT NULL, -- Local team ID format
  sender_id TEXT NOT NULL, -- Local player ID format
  sender_name TEXT, -- Cached sender name for display
  message TEXT,
  image_url TEXT,
  gif_url TEXT,
  gif_width INTEGER,
  gif_height INTEGER,
  mentioned_player_ids TEXT[] DEFAULT '{}',
  mention_type TEXT CHECK (mention_type IN ('all', 'specific')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable Realtime for chat_messages
ALTER PUBLICATION supabase_realtime ADD TABLE chat_messages;

-- =============================================
-- CHAT READ STATUS
-- =============================================
CREATE TABLE chat_read_status (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  team_id UUID REFERENCES teams(id) ON DELETE CASCADE,
  player_id UUID REFERENCES players(id) ON DELETE CASCADE,
  last_read_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(team_id, player_id)
);

-- =============================================
-- NOTIFICATIONS
-- =============================================
CREATE TABLE notifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  team_id UUID REFERENCES teams(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('game_invite', 'game_reminder', 'payment_reminder', 'chat_message')),
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  game_id UUID REFERENCES games(id) ON DELETE SET NULL,
  from_player_id UUID REFERENCES players(id) ON DELETE SET NULL,
  to_player_id UUID REFERENCES players(id) ON DELETE CASCADE,
  read BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- PHOTOS
-- =============================================
CREATE TABLE photos (
  id TEXT PRIMARY KEY, -- Use TEXT to allow app-generated IDs
  team_id TEXT NOT NULL, -- Local team ID format
  game_id TEXT, -- Local game ID format (optional)
  uri TEXT NOT NULL,
  uploaded_by TEXT, -- Local player ID format
  uploaded_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable Realtime for photos
ALTER PUBLICATION supabase_realtime ADD TABLE photos;

-- =============================================
-- PAYMENT PERIODS
-- =============================================
CREATE TABLE payment_periods (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  team_id UUID REFERENCES teams(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  amount DECIMAL(10,2) NOT NULL,
  type TEXT DEFAULT 'dues' CHECK (type IN ('dues', 'reserve_fee', 'facility_rental', 'misc')),
  due_date DATE,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- PLAYER PAYMENTS
-- =============================================
CREATE TABLE player_payments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  payment_period_id UUID REFERENCES payment_periods(id) ON DELETE CASCADE,
  player_id UUID REFERENCES players(id) ON DELETE CASCADE,
  status TEXT DEFAULT 'unpaid' CHECK (status IN ('unpaid', 'paid', 'partial')),
  amount DECIMAL(10,2) DEFAULT 0,
  notes TEXT,
  paid_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(payment_period_id, player_id)
);

-- =============================================
-- PAYMENT ENTRIES (individual payments)
-- =============================================
CREATE TABLE payment_entries (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  player_payment_id UUID REFERENCES player_payments(id) ON DELETE CASCADE,
  amount DECIMAL(10,2) NOT NULL,
  date DATE NOT NULL,
  note TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- EMAIL LOGS (for Email Team feature)
-- =============================================
CREATE TABLE email_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  team_id UUID REFERENCES teams(id) ON DELETE CASCADE,
  sent_by UUID REFERENCES players(id) ON DELETE SET NULL,
  subject TEXT NOT NULL,
  body TEXT NOT NULL,
  recipient_player_ids UUID[] NOT NULL,
  sent_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- INDEXES FOR PERFORMANCE
-- =============================================
CREATE INDEX idx_players_team ON players(team_id);
CREATE INDEX idx_players_auth ON players(auth_user_id);
CREATE INDEX idx_players_email ON players(email);
CREATE INDEX idx_games_team ON games(team_id);
CREATE INDEX idx_games_date ON games(date);
CREATE INDEX idx_game_responses_game ON game_responses(game_id);
CREATE INDEX idx_game_responses_player ON game_responses(player_id);
CREATE INDEX idx_chat_messages_team ON chat_messages(team_id);
CREATE INDEX idx_chat_messages_created ON chat_messages(created_at);
CREATE INDEX idx_notifications_to_player ON notifications(to_player_id);
CREATE INDEX idx_notifications_unread ON notifications(to_player_id, read) WHERE read = false;

-- =============================================
-- ROW LEVEL SECURITY (RLS)
-- =============================================

-- Enable RLS on all tables
ALTER TABLE teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE players ENABLE ROW LEVEL SECURITY;
ALTER TABLE games ENABLE ROW LEVEL SECURITY;
ALTER TABLE game_responses ENABLE ROW LEVEL SECURITY;
ALTER TABLE events ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_responses ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_read_status ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE photos ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_periods ENABLE ROW LEVEL SECURITY;
ALTER TABLE player_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_logs ENABLE ROW LEVEL SECURITY;

-- Helper function to get current player's team
CREATE OR REPLACE FUNCTION get_my_team_id()
RETURNS UUID AS $$
  SELECT team_id FROM players WHERE auth_user_id = auth.uid() LIMIT 1;
$$ LANGUAGE sql SECURITY DEFINER;

-- Teams: Users can read their own team
CREATE POLICY "Users can view their team" ON teams
  FOR SELECT USING (id = get_my_team_id());

CREATE POLICY "Team admins can update their team" ON teams
  FOR UPDATE USING (
    id = get_my_team_id()
    AND EXISTS (
      SELECT 1 FROM players
      WHERE auth_user_id = auth.uid()
      AND team_id = teams.id
      AND 'admin' = ANY(roles)
    )
  );

-- Players: Users can view teammates
CREATE POLICY "Users can view teammates" ON players
  FOR SELECT USING (team_id = get_my_team_id());

CREATE POLICY "Users can update their own profile" ON players
  FOR UPDATE USING (auth_user_id = auth.uid());

CREATE POLICY "Admins can insert players" ON players
  FOR INSERT WITH CHECK (
    team_id = get_my_team_id()
    AND EXISTS (
      SELECT 1 FROM players
      WHERE auth_user_id = auth.uid()
      AND 'admin' = ANY(roles)
    )
  );

CREATE POLICY "Admins can update any player" ON players
  FOR UPDATE USING (
    team_id = get_my_team_id()
    AND EXISTS (
      SELECT 1 FROM players
      WHERE auth_user_id = auth.uid()
      AND team_id = players.team_id
      AND 'admin' = ANY(roles)
    )
  );

-- Games: Team members can view, admins can modify
CREATE POLICY "Team members can view games" ON games
  FOR SELECT USING (team_id = get_my_team_id());

CREATE POLICY "Admins can manage games" ON games
  FOR ALL USING (
    team_id = get_my_team_id()
    AND EXISTS (
      SELECT 1 FROM players
      WHERE auth_user_id = auth.uid()
      AND team_id = games.team_id
      AND ('admin' = ANY(roles) OR 'captain' = ANY(roles))
    )
  );

-- Game responses: Players can manage their own responses
CREATE POLICY "Players can view game responses" ON game_responses
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM games WHERE games.id = game_id AND games.team_id = get_my_team_id())
  );

CREATE POLICY "Players can manage their responses" ON game_responses
  FOR ALL USING (
    player_id IN (SELECT id FROM players WHERE auth_user_id = auth.uid())
  );

-- Chat: Allow all operations since app handles access control
-- Note: team_id is TEXT format (local app IDs), not UUID
CREATE POLICY "Anyone can view chat" ON chat_messages
  FOR SELECT USING (true);

CREATE POLICY "Anyone can send messages" ON chat_messages
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Anyone can delete their messages" ON chat_messages
  FOR DELETE USING (true);

-- Notifications: Users can view their own
CREATE POLICY "Users can view their notifications" ON notifications
  FOR SELECT USING (
    to_player_id IN (SELECT id FROM players WHERE auth_user_id = auth.uid())
  );

CREATE POLICY "Users can update their notifications" ON notifications
  FOR UPDATE USING (
    to_player_id IN (SELECT id FROM players WHERE auth_user_id = auth.uid())
  );

-- Photos: Team members can view, anyone can upload
CREATE POLICY "Team members can view photos" ON photos
  FOR SELECT USING (team_id = get_my_team_id());

CREATE POLICY "Team members can upload photos" ON photos
  FOR INSERT WITH CHECK (team_id = get_my_team_id());

-- Payments: Team members can view, admins can manage
CREATE POLICY "Team members can view payments" ON payment_periods
  FOR SELECT USING (team_id = get_my_team_id());

CREATE POLICY "Admins can manage payments" ON payment_periods
  FOR ALL USING (
    team_id = get_my_team_id()
    AND EXISTS (
      SELECT 1 FROM players
      WHERE auth_user_id = auth.uid()
      AND 'admin' = ANY(roles)
    )
  );

-- Similar policies for other payment tables...
CREATE POLICY "Team members can view player payments" ON player_payments
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM payment_periods WHERE payment_periods.id = payment_period_id AND payment_periods.team_id = get_my_team_id())
  );

CREATE POLICY "Team members can view payment entries" ON payment_entries
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM player_payments pp
      JOIN payment_periods per ON pp.payment_period_id = per.id
      WHERE pp.id = player_payment_id AND per.team_id = get_my_team_id()
    )
  );

-- Events policies
CREATE POLICY "Team members can view events" ON events
  FOR SELECT USING (team_id = get_my_team_id());

CREATE POLICY "Admins can manage events" ON events
  FOR ALL USING (
    team_id = get_my_team_id()
    AND EXISTS (
      SELECT 1 FROM players
      WHERE auth_user_id = auth.uid()
      AND ('admin' = ANY(roles) OR 'captain' = ANY(roles))
    )
  );

CREATE POLICY "Team members can view event responses" ON event_responses
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM events WHERE events.id = event_id AND events.team_id = get_my_team_id())
  );

CREATE POLICY "Players can manage their event responses" ON event_responses
  FOR ALL USING (
    player_id IN (SELECT id FROM players WHERE auth_user_id = auth.uid())
  );

-- Chat read status
CREATE POLICY "Users can manage their read status" ON chat_read_status
  FOR ALL USING (
    player_id IN (SELECT id FROM players WHERE auth_user_id = auth.uid())
  );

-- Email logs: Team members can view
CREATE POLICY "Team members can view email logs" ON email_logs
  FOR SELECT USING (team_id = get_my_team_id());

CREATE POLICY "Admins can send emails" ON email_logs
  FOR INSERT WITH CHECK (
    team_id = get_my_team_id()
    AND EXISTS (
      SELECT 1 FROM players
      WHERE auth_user_id = auth.uid()
      AND ('admin' = ANY(roles) OR 'captain' = ANY(roles))
    )
  );

-- =============================================
-- TRIGGERS FOR UPDATED_AT
-- =============================================
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER teams_updated_at BEFORE UPDATE ON teams
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER players_updated_at BEFORE UPDATE ON players
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER games_updated_at BEFORE UPDATE ON games
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER events_updated_at BEFORE UPDATE ON events
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- =============================================
-- TEAM INVITATIONS TABLE (for cross-device invitations)
-- =============================================
CREATE TABLE team_invitations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  team_id TEXT NOT NULL, -- Local team ID from the inviting device
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
  accepted_at TIMESTAMPTZ, -- NULL means pending, set when accepted
  CONSTRAINT team_invitations_contact_check CHECK (email IS NOT NULL OR phone IS NOT NULL)
);

-- Indexes for fast lookup
CREATE INDEX idx_team_invitations_email ON team_invitations(lower(email)) WHERE email IS NOT NULL;
CREATE INDEX idx_team_invitations_phone ON team_invitations(phone) WHERE phone IS NOT NULL;
CREATE INDEX idx_team_invitations_pending ON team_invitations(accepted_at) WHERE accepted_at IS NULL;

-- Enable RLS
ALTER TABLE team_invitations ENABLE ROW LEVEL SECURITY;

-- Allow anyone to read invitations (needed for users to check their invitations)
CREATE POLICY "Anyone can view pending invitations" ON team_invitations
  FOR SELECT USING (accepted_at IS NULL);

-- Allow anyone to create invitations (admins creating invitations for their team)
CREATE POLICY "Anyone can create invitations" ON team_invitations
  FOR INSERT WITH CHECK (true);

-- Allow updating invitations (for marking as accepted)
CREATE POLICY "Anyone can accept invitations" ON team_invitations
  FOR UPDATE USING (true);

-- =============================================
-- STORAGE BUCKET FOR TEAM PHOTOS
-- =============================================
-- Note: Run this in Supabase SQL Editor to create the storage bucket

-- Create the storage bucket for team photos
INSERT INTO storage.buckets (id, name, public)
VALUES ('team-photos', 'team-photos', true)
ON CONFLICT (id) DO NOTHING;

-- Allow anyone to upload photos (authenticated or anonymous)
CREATE POLICY "Anyone can upload photos" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'team-photos');

-- Allow anyone to view photos (public bucket)
CREATE POLICY "Anyone can view photos" ON storage.objects
  FOR SELECT USING (bucket_id = 'team-photos');

-- Allow anyone to delete their uploaded photos
CREATE POLICY "Anyone can delete photos" ON storage.objects
  FOR DELETE USING (bucket_id = 'team-photos');

