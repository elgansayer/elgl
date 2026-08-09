-- Migration: 20260807000000_add_srs_sm2_columns.sql
-- Description: Add easiness_factor and repetition_count columns to flashcards for SM-2 SRS algorithm

ALTER TABLE public.flashcards
  ADD COLUMN IF NOT EXISTS easiness_factor REAL NOT NULL DEFAULT 2.5,
  ADD COLUMN IF NOT EXISTS repetition_count INTEGER NOT NULL DEFAULT 0;