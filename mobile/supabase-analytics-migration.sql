-- =============================================
-- PREMIUM ANALYTICS MIGRATION
-- Run this in your Supabase SQL editor: https://supabase.com/dashboard
-- =============================================

-- ── 1. Games: Weather & Score columns ────────────────────────────────────────
ALTER TABLE games ADD COLUMN IF NOT EXISTS weather_temp INTEGER;
ALTER TABLE games ADD COLUMN IF NOT EXISTS weather_condition TEXT
  CHECK (weather_condition IN ('sunny', 'partly_cloudy', 'cloudy', 'rain', 'snow', 'indoor'));
ALTER TABLE games ADD COLUMN IF NOT EXISTS weather_auto_fetched BOOLEAN DEFAULT false;
ALTER TABLE games ADD COLUMN IF NOT EXISTS batting_order_lineup JSONB;
ALTER TABLE games ADD COLUMN IF NOT EXISTS lacrosse_lineup JSONB;

-- Ensure final score columns exist (may already be present from previous migration)
ALTER TABLE games ADD COLUMN IF NOT EXISTS final_score_us INTEGER;
ALTER TABLE games ADD COLUMN IF NOT EXISTS final_score_them INTEGER;
ALTER TABLE games ADD COLUMN IF NOT EXISTS game_result TEXT
  CHECK (game_result IN ('win', 'loss', 'tie', 'otLoss'));
ALTER TABLE games ADD COLUMN IF NOT EXISTS result_recorded BOOLEAN DEFAULT false;

-- ── 2. Game Responses: RSVP speed + Flake Factor tracking ────────────────────
ALTER TABLE game_responses ADD COLUMN IF NOT EXISTS responded_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE game_responses ADD COLUMN IF NOT EXISTS response_history JSONB DEFAULT '[]'::jsonb;

-- ── 3. Backfill responded_at for existing rows ────────────────────────────────
UPDATE game_responses SET responded_at = created_at WHERE responded_at IS NULL;

-- ── 4. Supabase RPC: Engagement Scores ────────────────────────────────────────
-- Returns engagement score per active player for a given team.
-- Score breakdown:
--   Attendance  : 0-40 pts  (games_attended / games_invited)
--   Payment     : 0-30 pts  (payment periods paid / owed)
--   RSVP Speed  : 0-30 pts  (avg hours before game time responded — earlier = more pts)

CREATE OR REPLACE FUNCTION get_engagement_scores(p_team_id UUID)
RETURNS TABLE(
  player_id     UUID,
  player_name   TEXT,
  jersey_number TEXT,
  games_invited INTEGER,
  games_attended INTEGER,
  attendance_rate NUMERIC,
  payment_score NUMERIC,
  rsvp_speed_score NUMERIC,
  engagement_score NUMERIC
)
LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  RETURN QUERY
  WITH game_stats AS (
    SELECT
      gr.player_id,
      COUNT(*) FILTER (WHERE gr.response = 'in')     AS attended,
      COUNT(*) FILTER (WHERE gr.response IN ('in','out','viewed')) AS invited,
      AVG(
        CASE
          WHEN gr.responded_at IS NOT NULL AND gr.response = 'in' THEN
            GREATEST(0,
              LEAST(30,
                EXTRACT(EPOCH FROM (g.date::TIMESTAMPTZ - gr.responded_at)) / 3600.0 / 24.0 * 3
              )
            )
          ELSE NULL
        END
      ) AS avg_rsvp_score
    FROM game_responses gr
    JOIN games g ON g.id = gr.game_id
    WHERE g.team_id = p_team_id
    GROUP BY gr.player_id
  ),
  payment_stats AS (
    SELECT
      pp.player_id,
      COUNT(*) FILTER (WHERE pp.status IN ('paid','partial'))::NUMERIC /
        NULLIF(COUNT(*), 0) * 30 AS payment_score
    FROM player_payments pp
    JOIN payment_periods per ON per.id = pp.payment_period_id
    WHERE per.team_id = p_team_id
    GROUP BY pp.player_id
  )
  SELECT
    p.id,
    COALESCE(p.first_name || ' ' || p.last_name, p.name, p.first_name) AS player_name,
    COALESCE(p.jersey_number, '') AS jersey_number,
    COALESCE(gs.invited, 0)::INTEGER,
    COALESCE(gs.attended, 0)::INTEGER,
    CASE WHEN COALESCE(gs.invited, 0) = 0 THEN 0
         ELSE ROUND(gs.attended::NUMERIC / gs.invited * 100, 1) END AS attendance_rate,
    ROUND(COALESCE(ps.payment_score, 0), 1) AS payment_score,
    ROUND(COALESCE(gs.avg_rsvp_score, 0), 1) AS rsvp_speed_score,
    ROUND(
      LEAST(40, CASE WHEN COALESCE(gs.invited, 0) = 0 THEN 0
                     ELSE gs.attended::NUMERIC / gs.invited * 40 END) +
      COALESCE(ps.payment_score, 0) +
      COALESCE(gs.avg_rsvp_score, 0)
    , 1) AS engagement_score
  FROM players p
  LEFT JOIN game_stats gs ON gs.player_id = p.id
  LEFT JOIN payment_stats ps ON ps.player_id = p.id
  WHERE p.team_id = p_team_id
    AND p.status = 'active';
END;
$$;

-- ── 5. Supabase RPC: Opponent Scouting ────────────────────────────────────────
CREATE OR REPLACE FUNCTION get_opponent_scouting(p_team_id UUID)
RETURNS TABLE(
  opponent      TEXT,
  total_games   INTEGER,
  wins          INTEGER,
  losses        INTEGER,
  ties          INTEGER,
  avg_score_us  NUMERIC,
  avg_score_them NUMERIC,
  last_played   DATE
)
LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  RETURN QUERY
  SELECT
    g.opponent,
    COUNT(*)::INTEGER AS total_games,
    COUNT(*) FILTER (WHERE g.game_result = 'win')::INTEGER AS wins,
    COUNT(*) FILTER (WHERE g.game_result IN ('loss','otLoss'))::INTEGER AS losses,
    COUNT(*) FILTER (WHERE g.game_result = 'tie')::INTEGER AS ties,
    ROUND(AVG(g.final_score_us) FILTER (WHERE g.final_score_us IS NOT NULL), 1) AS avg_score_us,
    ROUND(AVG(g.final_score_them) FILTER (WHERE g.final_score_them IS NOT NULL), 1) AS avg_score_them,
    MAX(g.date) AS last_played
  FROM games g
  WHERE g.team_id = p_team_id
    AND g.game_result IS NOT NULL
  GROUP BY g.opponent
  ORDER BY total_games DESC;
END;
$$;

-- ── 6. Supabase RPC: Weather Impact ────────────────────────────────────────────
CREATE OR REPLACE FUNCTION get_weather_impact(p_team_id UUID)
RETURNS TABLE(
  weather_condition TEXT,
  total_games       INTEGER,
  wins              INTEGER,
  losses            INTEGER,
  ties              INTEGER,
  win_pct           NUMERIC
)
LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  RETURN QUERY
  SELECT
    g.weather_condition,
    COUNT(*)::INTEGER AS total_games,
    COUNT(*) FILTER (WHERE g.game_result = 'win')::INTEGER AS wins,
    COUNT(*) FILTER (WHERE g.game_result IN ('loss','otLoss'))::INTEGER AS losses,
    COUNT(*) FILTER (WHERE g.game_result = 'tie')::INTEGER AS ties,
    ROUND(
      COUNT(*) FILTER (WHERE g.game_result = 'win')::NUMERIC /
      NULLIF(COUNT(*), 0) * 100, 1
    ) AS win_pct
  FROM games g
  WHERE g.team_id = p_team_id
    AND g.weather_condition IS NOT NULL
    AND g.game_result IS NOT NULL
  GROUP BY g.weather_condition
  ORDER BY total_games DESC;
END;
$$;

-- ── 7. Supabase RPC: Flake Factor ────────────────────────────────────────────
-- A "flake" = player changed from 'in' → 'out' recorded in response_history
-- within 24 hours of game time.
CREATE OR REPLACE FUNCTION get_flake_factor(p_team_id UUID)
RETURNS TABLE(
  player_id    UUID,
  player_name  TEXT,
  flake_count  INTEGER,
  total_games  INTEGER,
  flake_rate   NUMERIC
)
LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  RETURN QUERY
  WITH history_flakes AS (
    SELECT
      gr.player_id,
      g.id AS game_id,
      g.date,
      -- Count flakes: entries in history where response went from 'in' to 'out'
      -- within 24h of game
      (
        SELECT COUNT(*)
        FROM jsonb_array_elements(COALESCE(gr.response_history, '[]'::jsonb)) AS h
        WHERE (h->>'response') = 'out'
          AND (h->>'at')::TIMESTAMPTZ > (g.date::TIMESTAMPTZ - INTERVAL '24 hours')
      ) AS flaked
    FROM game_responses gr
    JOIN games g ON g.id = gr.game_id
    WHERE g.team_id = p_team_id
  )
  SELECT
    p.id,
    COALESCE(p.first_name || ' ' || p.last_name, p.name, p.first_name),
    SUM(CASE WHEN hf.flaked > 0 THEN 1 ELSE 0 END)::INTEGER AS flake_count,
    COUNT(DISTINCT hf.game_id)::INTEGER AS total_games,
    ROUND(
      SUM(CASE WHEN hf.flaked > 0 THEN 1 ELSE 0 END)::NUMERIC /
      NULLIF(COUNT(DISTINCT hf.game_id), 0) * 100, 1
    ) AS flake_rate
  FROM players p
  LEFT JOIN history_flakes hf ON hf.player_id = p.id
  WHERE p.team_id = p_team_id
    AND p.status = 'active'
  GROUP BY p.id, p.first_name, p.last_name, p.name
  HAVING COUNT(DISTINCT hf.game_id) > 0
  ORDER BY flake_count DESC;
END;
$$;

-- ── 8. Grant execute to anon/authenticated ────────────────────────────────────
GRANT EXECUTE ON FUNCTION get_engagement_scores(UUID) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION get_opponent_scouting(UUID) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION get_weather_impact(UUID) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION get_flake_factor(UUID) TO anon, authenticated;
