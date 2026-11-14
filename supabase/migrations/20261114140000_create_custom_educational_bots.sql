-- Developer/Creator tier custom educational bots.
--
-- Every row is owner-scoped: the Nest API uses service_role and bypasses RLS,
-- but a leaked authenticated key or a future direct client must never read or
-- mutate another subscriber's bot.

CREATE TABLE IF NOT EXISTS public.custom_educational_bots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  display_name TEXT NOT NULL,
  persona TEXT NOT NULL,
  target_language TEXT NOT NULL,
  tone TEXT NOT NULL DEFAULT 'friendly',
  greeting TEXT,
  is_enabled BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT custom_educational_bots_display_name_length_check
    CHECK (char_length(btrim(display_name)) BETWEEN 1 AND 80),
  CONSTRAINT custom_educational_bots_persona_length_check
    CHECK (char_length(btrim(persona)) BETWEEN 1 AND 4000),
  CONSTRAINT custom_educational_bots_greeting_length_check
    CHECK (greeting IS NULL OR char_length(greeting) <= 500),
  CONSTRAINT custom_educational_bots_tone_check
    CHECK (tone IN ('friendly', 'formal', 'playful', 'strict'))
);

CREATE INDEX IF NOT EXISTS custom_educational_bots_owner_idx
  ON public.custom_educational_bots (owner_id, created_at DESC);

ALTER TABLE public.custom_educational_bots ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.custom_educational_bots FROM PUBLIC, anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.custom_educational_bots TO authenticated;
GRANT ALL ON TABLE public.custom_educational_bots TO service_role;

DROP POLICY IF EXISTS custom_educational_bots_select_owner ON public.custom_educational_bots;
CREATE POLICY custom_educational_bots_select_owner ON public.custom_educational_bots
  FOR SELECT TO authenticated
  USING (owner_id = auth.uid());

DROP POLICY IF EXISTS custom_educational_bots_insert_owner ON public.custom_educational_bots;
CREATE POLICY custom_educational_bots_insert_owner ON public.custom_educational_bots
  FOR INSERT TO authenticated
  WITH CHECK (owner_id = auth.uid());

DROP POLICY IF EXISTS custom_educational_bots_update_owner ON public.custom_educational_bots;
CREATE POLICY custom_educational_bots_update_owner ON public.custom_educational_bots
  FOR UPDATE TO authenticated
  USING (owner_id = auth.uid())
  WITH CHECK (owner_id = auth.uid());

DROP POLICY IF EXISTS custom_educational_bots_delete_owner ON public.custom_educational_bots;
CREATE POLICY custom_educational_bots_delete_owner ON public.custom_educational_bots
  FOR DELETE TO authenticated
  USING (owner_id = auth.uid());

COMMENT ON TABLE public.custom_educational_bots IS
  'Developer/Creator tier educational bots scoped to their owner.';
