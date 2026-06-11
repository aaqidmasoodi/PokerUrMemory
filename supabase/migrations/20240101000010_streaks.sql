-- Migration: gameplay streaks
-- Tracks consecutive days a player completed a real game (not practice).
-- touch_streak is called server-side from recordGameResult, so the date
-- is always UTC and never spoofable by the client.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS current_streak  INT  NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS longest_streak  INT  NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_played_date DATE;

-- ── touch_streak RPC ──────────────────────────────────────────────────────────
-- Call once per completed game session (server passes UTC date).
-- Idempotent: calling twice on the same day is a no-op.
--
-- Logic:
--   last_played_date IS NULL  → first ever game, streak = 1
--   last_played_date = today  → already played today, no change
--   last_played_date = today - 1 day → consecutive day, streak++
--   otherwise                 → streak broken, reset to 1
--   always: longest_streak = GREATEST(longest_streak, current_streak)

CREATE OR REPLACE FUNCTION public.touch_streak(
  p_user_id UUID,
  p_today   DATE
)
RETURNS INT   -- returns the new current_streak
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_last   DATE;
  v_cur    INT;
  v_new    INT;
BEGIN
  SELECT last_played_date, current_streak
    INTO v_last, v_cur
    FROM public.profiles
   WHERE id = p_user_id;

  IF NOT FOUND THEN
    RETURN 0;
  END IF;

  -- Already recorded a game today — no change.
  IF v_last = p_today THEN
    RETURN v_cur;
  END IF;

  -- Consecutive day → extend streak; any gap → reset.
  IF v_last = p_today - INTERVAL '1 day' THEN
    v_new := v_cur + 1;
  ELSE
    v_new := 1;
  END IF;

  UPDATE public.profiles
     SET current_streak   = v_new,
         longest_streak   = GREATEST(longest_streak, v_new),
         last_played_date = p_today
   WHERE id = p_user_id;

  RETURN v_new;
END;
$$;
