-- Migration: 20260808020233_rename_flashcard_columns.sql
-- Description: Rename context_sentence → original_context and
-- audio_pronunciation_url → pronunciation_url on flashcards table
-- to match the NestJS backend DTO and interface definitions.
-- Fixes #977.

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'flashcards'
      AND column_name = 'context_sentence'
  ) THEN
    ALTER TABLE public.flashcards RENAME COLUMN context_sentence TO original_context;
    -- Make original_context nullable (the backend treats it as optional)
    ALTER TABLE public.flashcards ALTER COLUMN original_context DROP NOT NULL;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'flashcards'
      AND column_name = 'audio_pronunciation_url'
  ) THEN
    ALTER TABLE public.flashcards RENAME COLUMN audio_pronunciation_url TO pronunciation_url;
  END IF;
END $$;