-- Friends + case-insensitive username search.
-- Lobbies and invites are not persisted — they live in the server's in-memory state.

-- ─── Case-insensitive username search index ──────────────────────────────────

CREATE INDEX IF NOT EXISTS profiles_username_lower_idx
  ON public.profiles (lower(username) text_pattern_ops);

-- ─── Friendships (follow-model, single row per direction) ────────────────────

CREATE TABLE IF NOT EXISTS public.friendships (
  user_id    UUID        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  friend_id  UUID        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, friend_id),
  CHECK (user_id <> friend_id)
);

CREATE INDEX IF NOT EXISTS friendships_user_id_idx ON public.friendships (user_id);

ALTER TABLE public.friendships ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, DELETE ON public.friendships TO authenticated;

CREATE POLICY "friendships_select_own"
  ON public.friendships FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "friendships_insert_own"
  ON public.friendships FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "friendships_delete_own"
  ON public.friendships FOR DELETE
  USING (auth.uid() = user_id);
