-- Migration: 20260807000001_add_srs_algorithm_fields.sql
-- Description: Add easiness_factor, repetitions, and interval_days columns
-- to flashcards table for SM-2 SRS review scheduling algorithm.

ALTER TABLE public.flashcards
    ADD COLUMN IF NOT EXISTS easiness_factor REAL NOT NULL DEFAULT 2.5,
    ADD COLUMN IF NOT EXISTS repetitions INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS interval_days INTEGER NOT NULL DEFAULT 0;