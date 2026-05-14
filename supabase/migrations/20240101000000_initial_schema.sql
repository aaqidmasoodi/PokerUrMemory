-- Migration: Initial schema
-- Tables: profiles, matchmaking_queue, game_sessions, game_players

-- ─── Profiles ────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.profiles (
  id          UUID        PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username    TEXT        UNIQUE NOT NULL,
  country_code CHAR(2),
  avatar_url  TEXT,
  total_games INT         NOT NULL DEFAULT 0,
  wins        INT         NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;

CREATE POLICY "profiles_select_authenticated"
  ON public.profiles FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "profiles_insert_own"
  ON public.profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

CREATE POLICY "profiles_update_own"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id);

-- ─── Matchmaking queue ───────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.matchmaking_queue (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  username     TEXT        NOT NULL,
  country_code CHAR(2),
  status       TEXT        NOT NULL DEFAULT 'waiting'
                           CHECK (status IN ('waiting', 'matched', 'cancelled', 'timeout')),
  game_id      UUID,
  joined_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.matchmaking_queue ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE ON public.matchmaking_queue TO authenticated;

CREATE POLICY "queue_select_own"
  ON public.matchmaking_queue FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "queue_insert_own"
  ON public.matchmaking_queue FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "queue_update_own"
  ON public.matchmaking_queue FOR UPDATE
  USING (auth.uid() = user_id);

-- ─── Game sessions ───────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.game_sessions (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  room_code    TEXT        UNIQUE NOT NULL,
  status       TEXT        NOT NULL DEFAULT 'forming'
                           CHECK (status IN ('forming', 'active', 'completed')),
  player_count INT         NOT NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  started_at   TIMESTAMPTZ,
  completed_at TIMESTAMPTZ
);

ALTER TABLE public.game_sessions ENABLE ROW LEVEL SECURITY;

GRANT SELECT ON public.game_sessions TO authenticated;

CREATE POLICY "game_sessions_select_authenticated"
  ON public.game_sessions FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- ─── Game players ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.game_players (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id      UUID        NOT NULL REFERENCES public.game_sessions(id) ON DELETE CASCADE,
  user_id      UUID        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  username     TEXT        NOT NULL,
  final_chips  INT,
  placement    INT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.game_players ENABLE ROW LEVEL SECURITY;

GRANT SELECT ON public.game_players TO authenticated;

CREATE POLICY "game_players_select_own"
  ON public.game_players FOR SELECT
  USING (auth.uid() = user_id);
