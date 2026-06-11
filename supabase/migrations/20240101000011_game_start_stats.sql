-- Migration: record game start stats
-- Moves total_games increment to game START instead of game end.
-- increment_stats now only handles wins (called at game end).
-- record_game_start increments total_games for all players when the first hand deals.

-- ── record_game_start RPC ─────────────────────────────────────────────────────
-- Server calls this once per real game, when hand #1 is dealt.
-- Accepts an array of user IDs (all seated human players at game start).

CREATE OR REPLACE FUNCTION public.record_game_start(
  p_user_ids  UUID[],
  p_game_id   UUID DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE public.profiles
     SET total_games = total_games + 1
   WHERE id = ANY(p_user_ids);

  -- Mark the session as active
  IF p_game_id IS NOT NULL THEN
    UPDATE public.game_sessions
       SET status     = 'active',
           started_at = NOW()
     WHERE id = p_game_id
       AND status = 'forming';
  END IF;
END;
$$;

-- ── increment_stats: wins only ────────────────────────────────────────────────
-- total_games is now handled by record_game_start above.
-- This function is kept for wins only to avoid breaking the existing call site.

CREATE OR REPLACE FUNCTION public.increment_stats(p_user_id UUID, p_add_wins INT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF p_add_wins > 0 THEN
    UPDATE public.profiles
       SET wins = wins + p_add_wins
     WHERE id = p_user_id;
  END IF;
END;
$$;
