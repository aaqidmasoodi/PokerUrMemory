-- Migration: per-hand stats
-- Goal: record every hand's outcome atomically so aggregate stats on profiles
-- can never drift from the underlying ground-truth in game_hands.
--
-- Idempotency: game_hands has UNIQUE (game_id, hand_number), and record_hand()
-- only bumps profile aggregates when its INSERT actually added a new row. Running
-- record_hand twice for the same hand is a no-op.

-- ─── Extend profiles with per-hand aggregates ────────────────────────────────

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS hands_played     INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS hands_won        INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS pots_won_total   INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS biggest_pot_won  INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS best_hand_rank   INT NOT NULL DEFAULT -1,
  ADD COLUMN IF NOT EXISTS best_hand_name   TEXT;

-- ─── game_hands ───────────────────────────────────────────────────────────────
-- One row per hand actually played. hand_number is per-game (1, 2, 3, …).

CREATE TABLE IF NOT EXISTS public.game_hands (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id      UUID        NOT NULL REFERENCES public.game_sessions(id) ON DELETE CASCADE,
  hand_number  INT         NOT NULL,
  pot_amount   INT         NOT NULL,
  ended_by     TEXT        NOT NULL CHECK (ended_by IN ('showdown', 'fold')),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (game_id, hand_number)
);

ALTER TABLE public.game_hands ENABLE ROW LEVEL SECURITY;

GRANT SELECT ON public.game_hands TO authenticated;

CREATE POLICY "game_hands_select_authenticated"
  ON public.game_hands FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- ─── game_hand_players ────────────────────────────────────────────────────────
-- One row per participant per hand. Tracks how much they put in, how much they
-- won (0 if they didn't), and their final hand description (if not folded).

CREATE TABLE IF NOT EXISTS public.game_hand_players (
  hand_id             UUID NOT NULL REFERENCES public.game_hands(id) ON DELETE CASCADE,
  user_id             UUID NOT NULL REFERENCES public.profiles(id)   ON DELETE CASCADE,
  amount_won          INT  NOT NULL DEFAULT 0,
  amount_contributed  INT  NOT NULL DEFAULT 0,
  hand_rank           INT,
  hand_description    TEXT,
  folded              BOOLEAN NOT NULL DEFAULT FALSE,
  PRIMARY KEY (hand_id, user_id)
);

CREATE INDEX IF NOT EXISTS game_hand_players_user_id_idx
  ON public.game_hand_players (user_id);

ALTER TABLE public.game_hand_players ENABLE ROW LEVEL SECURITY;

GRANT SELECT ON public.game_hand_players TO authenticated;

CREATE POLICY "game_hand_players_select_authenticated"
  ON public.game_hand_players FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- ─── record_hand RPC ──────────────────────────────────────────────────────────
-- Server calls this once per completed hand. All side-effects happen in a single
-- transaction. Re-calling with the same (game_id, hand_number) is a no-op.
--
-- p_players is an array of jsonb rows shaped like:
--   { user_id: uuid, amount_won: int, amount_contributed: int,
--     hand_rank: int|null, hand_description: text|null, folded: bool }

CREATE OR REPLACE FUNCTION public.record_hand(
  p_game_id     UUID,
  p_hand_number INT,
  p_pot_amount  INT,
  p_ended_by    TEXT,
  p_players     JSONB
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_hand_id     UUID;
  v_inserted    BOOLEAN;
  v_player      JSONB;
  v_user_id     UUID;
  v_amount_won  INT;
  v_hand_rank   INT;
  v_hand_name   TEXT;
BEGIN
  -- Insert the hand. ON CONFLICT DO NOTHING + xmax check gives us "did this
  -- INSERT actually add a row?" Returning the existing id when it didn't is
  -- handled by the second SELECT below.
  INSERT INTO public.game_hands (game_id, hand_number, pot_amount, ended_by)
  VALUES (p_game_id, p_hand_number, p_pot_amount, p_ended_by)
  ON CONFLICT (game_id, hand_number) DO NOTHING
  RETURNING id INTO v_hand_id;

  v_inserted := v_hand_id IS NOT NULL;

  -- If it was a duplicate call, bail out — all aggregate updates already happened
  -- on the first call. This is the idempotency guarantee.
  IF NOT v_inserted THEN
    RETURN;
  END IF;

  -- Insert per-player rows + update aggregate profile stats.
  FOR v_player IN SELECT jsonb_array_elements(p_players)
  LOOP
    v_user_id    := (v_player->>'user_id')::UUID;
    v_amount_won := COALESCE((v_player->>'amount_won')::INT, 0);
    v_hand_rank  := NULLIF(v_player->>'hand_rank', '')::INT;
    v_hand_name  := NULLIF(v_player->>'hand_description', '');

    IF v_user_id IS NULL THEN
      CONTINUE;
    END IF;

    INSERT INTO public.game_hand_players (
      hand_id, user_id, amount_won, amount_contributed,
      hand_rank, hand_description, folded
    ) VALUES (
      v_hand_id,
      v_user_id,
      v_amount_won,
      COALESCE((v_player->>'amount_contributed')::INT, 0),
      v_hand_rank,
      v_hand_name,
      COALESCE((v_player->>'folded')::BOOLEAN, FALSE)
    );

    -- Every seated player counts as a hand played.
    UPDATE public.profiles
      SET hands_played = hands_played + 1
      WHERE id = v_user_id;

    -- Winner-side aggregates only when they actually took chips.
    IF v_amount_won > 0 THEN
      UPDATE public.profiles
        SET hands_won       = hands_won + 1,
            pots_won_total  = pots_won_total + v_amount_won,
            biggest_pot_won = GREATEST(biggest_pot_won, v_amount_won)
        WHERE id = v_user_id;
    END IF;

    -- Track the best hand rank a player has ever shown down (won or not).
    IF v_hand_rank IS NOT NULL THEN
      UPDATE public.profiles
        SET best_hand_rank = v_hand_rank,
            best_hand_name = v_hand_name
        WHERE id = v_user_id AND v_hand_rank > best_hand_rank;
    END IF;
  END LOOP;
END;
$$;
