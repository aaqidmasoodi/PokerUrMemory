-- Fix: the 2-game-per-host cap should only block scheduling new *open* (pending)
-- games. Once a game goes live or completes it must not count, otherwise hosts
-- can never schedule again after their first two games run.

CREATE OR REPLACE FUNCTION public.validate_scheduled_game()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_open_count INT;
BEGIN
  IF NEW.scheduled_at <= NOW() THEN
    RAISE EXCEPTION 'Scheduled time must be in the future';
  END IF;

  IF NEW.scheduled_at > NOW() + INTERVAL '48 hours' THEN
    RAISE EXCEPTION 'You can only schedule a game up to 48 hours from now';
  END IF;

  SELECT COUNT(*) INTO v_open_count
  FROM public.scheduled_games
  WHERE host_id = NEW.host_id
    AND status = 'open';

  IF v_open_count >= 2 THEN
    RAISE EXCEPTION 'You can only have 2 open scheduled games at a time';
  END IF;

  RETURN NEW;
END;
$$;
