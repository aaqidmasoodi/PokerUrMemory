-- Enable pg_cron extension (no-op if already enabled)
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Grant cron usage to postgres role
GRANT USAGE ON SCHEMA cron TO postgres;

-- Schedule: every 15 minutes, expire open/live games that are 2+ hours past their scheduled time
SELECT cron.schedule(
  'expire-scheduled-games',
  '*/15 * * * *',
  $$
    UPDATE public.scheduled_games
    SET status = 'expired'
    WHERE status IN ('open', 'live')
      AND scheduled_at + INTERVAL '2 hours' < NOW();
  $$
);
