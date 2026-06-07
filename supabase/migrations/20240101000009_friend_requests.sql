-- Two-way friend request system.
-- Sending a friend request inserts a row here; acceptance runs accept_friend_request()
-- which atomically inserts both directions into friendships and removes the request.

CREATE TABLE IF NOT EXISTS public.friend_requests (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  from_id    UUID        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  to_id      UUID        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (from_id, to_id),
  CHECK (from_id <> to_id)
);

CREATE INDEX IF NOT EXISTS friend_requests_to_id_idx   ON public.friend_requests (to_id);
CREATE INDEX IF NOT EXISTS friend_requests_from_id_idx ON public.friend_requests (from_id);

ALTER TABLE public.friend_requests ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, DELETE ON public.friend_requests TO authenticated;

-- Both sender and recipient can see the request
CREATE POLICY "friend_requests_select"
  ON public.friend_requests FOR SELECT
  USING (auth.uid() = from_id OR auth.uid() = to_id);

-- Only the sender can create a request
CREATE POLICY "friend_requests_insert"
  ON public.friend_requests FOR INSERT
  WITH CHECK (auth.uid() = from_id);

-- Sender can cancel; recipient can decline (both just delete)
CREATE POLICY "friend_requests_delete"
  ON public.friend_requests FOR DELETE
  USING (auth.uid() = from_id OR auth.uid() = to_id);

-- ─── RPC: atomically accept a friend request ─────────────────────────────────
-- Deletes the request row, then inserts both friendship directions.
-- Runs as SECURITY DEFINER so it can write rows the recipient doesn't own.

CREATE OR REPLACE FUNCTION public.accept_friend_request(request_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_from_id UUID;
  v_to_id   UUID;
BEGIN
  SELECT from_id, to_id INTO v_from_id, v_to_id
  FROM public.friend_requests
  WHERE id = request_id AND to_id = auth.uid();

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Friend request not found or you are not the recipient';
  END IF;

  DELETE FROM public.friend_requests WHERE id = request_id;

  INSERT INTO public.friendships (user_id, friend_id)
  VALUES (v_from_id, v_to_id), (v_to_id, v_from_id)
  ON CONFLICT DO NOTHING;
END;
$$;

GRANT EXECUTE ON FUNCTION public.accept_friend_request(UUID) TO authenticated;

-- Enable realtime for this table so clients get live request notifications
ALTER PUBLICATION supabase_realtime ADD TABLE public.friend_requests;
