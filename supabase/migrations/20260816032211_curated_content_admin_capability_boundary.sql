-- Curated reading content is read-only to authenticated clients. Privileged
-- catalogue mutations must use backend service-role operations protected by
-- admin capabilities and audit rather than browser-side users.is_admin checks.

DROP POLICY IF EXISTS curated_articles_insert_admin ON public.curated_articles;
DROP POLICY IF EXISTS curated_articles_update_admin ON public.curated_articles;
DROP POLICY IF EXISTS curated_articles_delete_admin ON public.curated_articles;

DROP POLICY IF EXISTS curated_dialogues_insert_admin ON public.curated_dialogues;
DROP POLICY IF EXISTS curated_dialogues_update_admin ON public.curated_dialogues;
DROP POLICY IF EXISTS curated_dialogues_delete_admin ON public.curated_dialogues;
