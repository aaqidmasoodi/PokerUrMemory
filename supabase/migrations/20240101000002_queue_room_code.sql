-- Add room_code to matchmaking_queue so clients don't need to query game_sessions
ALTER TABLE public.matchmaking_queue ADD COLUMN IF NOT EXISTS room_code TEXT;
