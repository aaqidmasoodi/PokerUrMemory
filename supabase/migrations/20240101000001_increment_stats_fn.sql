-- Helper RPC function called by server to atomically increment player stats.
-- Uses security definer so it runs with elevated privileges regardless of caller.

CREATE OR REPLACE FUNCTION public.increment_stats(p_user_id UUID, p_add_wins INT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE public.profiles
  SET
    total_games = total_games + 1,
    wins        = wins + p_add_wins
  WHERE id = p_user_id;
END;
$$;
