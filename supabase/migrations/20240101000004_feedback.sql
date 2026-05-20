-- User feedback / contact submissions

CREATE TABLE IF NOT EXISTS public.feedback (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  username    TEXT        NOT NULL,
  type        TEXT        NOT NULL CHECK (type IN ('bug_report', 'feature_request', 'other')),
  message     TEXT        NOT NULL CHECK (char_length(message) BETWEEN 1 AND 1000),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS feedback_created_at_idx ON public.feedback (created_at DESC);
CREATE INDEX IF NOT EXISTS feedback_user_id_idx    ON public.feedback (user_id);

ALTER TABLE public.feedback ENABLE ROW LEVEL SECURITY;

-- Users may submit feedback but cannot read other users' submissions.
-- Admins read via the service-role key (bypasses RLS) in the Supabase dashboard.
GRANT INSERT ON public.feedback TO authenticated;

CREATE POLICY "feedback_insert_own"
  ON public.feedback FOR INSERT
  WITH CHECK (auth.uid() = user_id);
