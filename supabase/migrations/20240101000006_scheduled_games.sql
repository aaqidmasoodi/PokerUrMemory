-- Migration: Scheduled games + reservations (Phase 1)
-- A scheduled game is a persisted, public, host-started lobby that players can
-- reserve a seat in ahead of time. The host launches the table manually at game
-- time (Phase 2). This migration only covers persistence + reservations.

-- ─── Scheduled games ─────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.scheduled_games (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  host_id          UUID        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  host_username    TEXT        NOT NULL,
  host_country_code CHAR(2),
  host_avatar_url  TEXT,
  scheduled_at     TIMESTAMPTZ NOT NULL,
  max_players      INT         NOT NULL DEFAULT 4 CHECK (max_players BETWEEN 2 AND 4),
  status           TEXT        NOT NULL DEFAULT 'open'
                               CHECK (status IN ('open', 'live', 'completed', 'cancelled', 'expired')),
  room_code        TEXT,
  game_session_id  UUID,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS scheduled_games_open_idx
  ON public.scheduled_games (scheduled_at)
  WHERE status = 'open';

ALTER TABLE public.scheduled_games ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.scheduled_games TO authenticated;

-- Anyone signed in can browse the schedule (the public games list).
CREATE POLICY "scheduled_games_select_authenticated"
  ON public.scheduled_games FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- You can only create a game hosted by yourself.
CREATE POLICY "scheduled_games_insert_own"
  ON public.scheduled_games FOR INSERT
  WITH CHECK (auth.uid() = host_id);

-- Only the host can edit / cancel their own game.
CREATE POLICY "scheduled_games_update_own"
  ON public.scheduled_games FOR UPDATE
  USING (auth.uid() = host_id);

CREATE POLICY "scheduled_games_delete_own"
  ON public.scheduled_games FOR DELETE
  USING (auth.uid() = host_id);

-- ─── Reservations ────────────────────────────────────────────────────────────
-- One row per player who has reserved a seat. The host is auto-reserved on
-- creation (see trigger below), so reservation count includes the host and is
-- capped at scheduled_games.max_players.

CREATE TABLE IF NOT EXISTS public.scheduled_game_reservations (
  game_id      UUID        NOT NULL REFERENCES public.scheduled_games(id) ON DELETE CASCADE,
  user_id      UUID        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  username     TEXT        NOT NULL,
  country_code CHAR(2),
  avatar_url   TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (game_id, user_id)
);

CREATE INDEX IF NOT EXISTS reservations_game_id_idx
  ON public.scheduled_game_reservations (game_id);

ALTER TABLE public.scheduled_game_reservations ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, DELETE ON public.scheduled_game_reservations TO authenticated;

-- Anyone signed in can see who has reserved (drives the "joined/max" count + avatars).
CREATE POLICY "reservations_select_authenticated"
  ON public.scheduled_game_reservations FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- You can only insert/remove your own reservation. (Capacity is enforced by the
-- reserve_spot RPC; direct inserts are still bounded by the trigger below.)
CREATE POLICY "reservations_insert_own"
  ON public.scheduled_game_reservations FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "reservations_delete_own"
  ON public.scheduled_game_reservations FOR DELETE
  USING (auth.uid() = user_id);

-- Host may remove (kick) any reservation in their own game.
CREATE POLICY "reservations_delete_by_host"
  ON public.scheduled_game_reservations FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.scheduled_games g
      WHERE g.id = scheduled_game_reservations.game_id
        AND g.host_id = auth.uid()
    )
  );

-- ─── Validation: +48h window + 2-game-per-host cap ───────────────────────────

CREATE OR REPLACE FUNCTION public.validate_scheduled_game()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_active_count INT;
BEGIN
  IF NEW.scheduled_at <= NOW() THEN
    RAISE EXCEPTION 'Scheduled time must be in the future';
  END IF;

  IF NEW.scheduled_at > NOW() + INTERVAL '48 hours' THEN
    RAISE EXCEPTION 'You can only schedule a game up to 48 hours from now';
  END IF;

  SELECT COUNT(*) INTO v_active_count
  FROM public.scheduled_games
  WHERE host_id = NEW.host_id
    AND status IN ('open', 'live');

  IF v_active_count >= 2 THEN
    RAISE EXCEPTION 'You can only have 2 scheduled games at a time';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_validate_scheduled_game
  BEFORE INSERT ON public.scheduled_games
  FOR EACH ROW EXECUTE FUNCTION public.validate_scheduled_game();

-- ─── Auto-reserve the host on creation ───────────────────────────────────────

CREATE OR REPLACE FUNCTION public.auto_reserve_host()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO public.scheduled_game_reservations
    (game_id, user_id, username, country_code, avatar_url)
  VALUES
    (NEW.id, NEW.host_id, NEW.host_username, NEW.host_country_code, NEW.host_avatar_url)
  ON CONFLICT (game_id, user_id) DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_auto_reserve_host
  AFTER INSERT ON public.scheduled_games
  FOR EACH ROW EXECUTE FUNCTION public.auto_reserve_host();

-- Backup capacity guard for any direct reservation insert (the RPC below is the
-- primary, race-safe path). Skips the host's own auto-reservation.
CREATE OR REPLACE FUNCTION public.guard_reservation_capacity()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_max   INT;
  v_count INT;
  v_host  UUID;
BEGIN
  SELECT max_players, host_id INTO v_max, v_host
  FROM public.scheduled_games WHERE id = NEW.game_id FOR UPDATE;

  IF v_max IS NULL THEN
    RAISE EXCEPTION 'Game not found';
  END IF;

  SELECT COUNT(*) INTO v_count
  FROM public.scheduled_game_reservations WHERE game_id = NEW.game_id;

  IF v_count >= v_max AND NEW.user_id <> v_host THEN
    RAISE EXCEPTION 'Game is full';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_guard_reservation_capacity
  BEFORE INSERT ON public.scheduled_game_reservations
  FOR EACH ROW EXECUTE FUNCTION public.guard_reservation_capacity();

-- ─── reserve_spot: race-safe join ────────────────────────────────────────────
-- Locks the game row so two players can't grab the last seat at once. Pulls the
-- reserving player's profile fields server-side so the client can't spoof them.

CREATE OR REPLACE FUNCTION public.reserve_spot(p_game_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_uid     UUID := auth.uid();
  v_max     INT;
  v_status  TEXT;
  v_count   INT;
  v_profile public.profiles%ROWTYPE;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT max_players, status INTO v_max, v_status
  FROM public.scheduled_games WHERE id = p_game_id FOR UPDATE;

  IF v_max IS NULL THEN
    RAISE EXCEPTION 'Game not found';
  END IF;
  IF v_status <> 'open' THEN
    RAISE EXCEPTION 'This game is no longer open';
  END IF;

  -- Already reserved? Idempotent success.
  IF EXISTS (
    SELECT 1 FROM public.scheduled_game_reservations
    WHERE game_id = p_game_id AND user_id = v_uid
  ) THEN
    RETURN;
  END IF;

  SELECT COUNT(*) INTO v_count
  FROM public.scheduled_game_reservations WHERE game_id = p_game_id;

  IF v_count >= v_max THEN
    RAISE EXCEPTION 'Game is full';
  END IF;

  SELECT * INTO v_profile FROM public.profiles WHERE id = v_uid;
  IF v_profile.id IS NULL THEN
    RAISE EXCEPTION 'Profile not found';
  END IF;

  INSERT INTO public.scheduled_game_reservations
    (game_id, user_id, username, country_code, avatar_url)
  VALUES
    (p_game_id, v_uid, v_profile.username, v_profile.country_code, v_profile.avatar_url);
END;
$$;

GRANT EXECUTE ON FUNCTION public.reserve_spot(UUID) TO authenticated;

-- ─── kick_player: host removes a reservation ─────────────────────────────────

CREATE OR REPLACE FUNCTION public.kick_player(p_game_id UUID, p_user_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_uid  UUID := auth.uid();
  v_host UUID;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT host_id INTO v_host FROM public.scheduled_games WHERE id = p_game_id;
  IF v_host IS NULL THEN
    RAISE EXCEPTION 'Game not found';
  END IF;
  IF v_host <> v_uid THEN
    RAISE EXCEPTION 'Only the host can remove players';
  END IF;
  IF p_user_id = v_host THEN
    RAISE EXCEPTION 'The host cannot be removed';
  END IF;

  DELETE FROM public.scheduled_game_reservations
  WHERE game_id = p_game_id AND user_id = p_user_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.kick_player(UUID, UUID) TO authenticated;

-- ─── Realtime ────────────────────────────────────────────────────────────────
-- Add both tables to the realtime publication so the browser's "upcoming games"
-- list and joined/max counts update live.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'scheduled_games'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.scheduled_games;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'scheduled_game_reservations'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.scheduled_game_reservations;
  END IF;
END $$;
