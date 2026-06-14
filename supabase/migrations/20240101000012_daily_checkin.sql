-- Migration: daily check-in
-- A separate "open the app daily" streak, distinct from the gameplay streak
-- (current_streak / touch_streak). Rewards XP on the first open each UTC day.
--
-- claim_daily_checkin() is SECURITY DEFINER and uses CURRENT_DATE (the database's
-- own UTC date), so the reward can't be farmed by changing the device clock. It is
-- idempotent within a day: a second call returns is_new_today=false and grants
-- nothing. Safe to call on every app open / resume.

-- ── Profile columns ──────────────────────────────────────────────────────────
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS xp                     BIGINT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS checkin_streak         INT    NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS longest_checkin_streak INT    NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_checkin_date      DATE;

-- ── Reward curve ─────────────────────────────────────────────────────────────
-- 7-day repeating cycle. Position in the cycle = ((streak - 1) % 7) + 1.
-- Day 7 is the big payoff, then the cycle repeats. Keep this table in sync with
-- CYCLE_REWARDS in client/src/components/DailyCheckInModal.tsx (display only —
-- this function is the authoritative source of the grant).
CREATE OR REPLACE FUNCTION public.checkin_reward_for_day(p_cycle_day INT)
RETURNS INT
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE p_cycle_day
    WHEN 1 THEN 50
    WHEN 2 THEN 75
    WHEN 3 THEN 100
    WHEN 4 THEN 125
    WHEN 5 THEN 150
    WHEN 6 THEN 200
    WHEN 7 THEN 500
    ELSE 50
  END;
$$;

-- ── claim_daily_checkin RPC ──────────────────────────────────────────────────
-- Called directly from the client (authenticated). Returns a JSON object:
--   { is_new_today, checkin_streak, longest_checkin_streak, cycle_day,
--     xp_earned, total_xp }
CREATE OR REPLACE FUNCTION public.claim_daily_checkin()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid        UUID   := auth.uid();
  v_today      DATE   := CURRENT_DATE;
  v_last       DATE;
  v_streak     INT;
  v_longest    INT;
  v_total_xp   BIGINT;
  v_new_streak INT;
  v_cycle_day  INT;
  v_reward     INT;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;

  SELECT last_checkin_date, checkin_streak, longest_checkin_streak, xp
    INTO v_last, v_streak, v_longest, v_total_xp
    FROM public.profiles
   WHERE id = v_uid
   FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'profile not found';
  END IF;

  -- Already checked in today → no-op, report current state.
  IF v_last = v_today THEN
    v_cycle_day := ((v_streak - 1) % 7) + 1;
    RETURN jsonb_build_object(
      'is_new_today',           false,
      'checkin_streak',         v_streak,
      'longest_checkin_streak', v_longest,
      'cycle_day',              v_cycle_day,
      'xp_earned',              0,
      'total_xp',               v_total_xp
    );
  END IF;

  -- Consecutive day extends the streak; any gap (or first ever) resets to 1.
  IF v_last = v_today - INTERVAL '1 day' THEN
    v_new_streak := v_streak + 1;
  ELSE
    v_new_streak := 1;
  END IF;

  v_cycle_day := ((v_new_streak - 1) % 7) + 1;
  v_reward    := public.checkin_reward_for_day(v_cycle_day);
  v_longest   := GREATEST(v_longest, v_new_streak);

  UPDATE public.profiles
     SET checkin_streak         = v_new_streak,
         longest_checkin_streak = v_longest,
         last_checkin_date      = v_today,
         xp                     = xp + v_reward
   WHERE id = v_uid
   RETURNING xp INTO v_total_xp;

  RETURN jsonb_build_object(
    'is_new_today',           true,
    'checkin_streak',         v_new_streak,
    'longest_checkin_streak', v_longest,
    'cycle_day',              v_cycle_day,
    'xp_earned',              v_reward,
    'total_xp',               v_total_xp
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.claim_daily_checkin() TO authenticated;
