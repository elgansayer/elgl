-- Keep the Discovery has-audio-intro filter truthful by normalising legacy
-- whitespace-only values and preventing new blank values from being stored.

UPDATE public.users
SET audio_intro_url = NULL
WHERE audio_intro_url IS NOT NULL
  AND btrim(audio_intro_url) = '';

ALTER TABLE public.users
  DROP CONSTRAINT IF EXISTS users_audio_intro_url_nonblank;

ALTER TABLE public.users
  ADD CONSTRAINT users_audio_intro_url_nonblank
  CHECK (audio_intro_url IS NULL OR btrim(audio_intro_url) <> '');
