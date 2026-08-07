-- Migration: Harden deck_flashcards RLS to also verify flashcard ownership
-- Fixes #2350: The original deck_flashcards_insert_own policy from
-- 20260807143544 only verified that the deck belonged to the user.
-- An attacker with the authenticated role could add someone else's
-- flashcard to their own deck.  This migration hardens the INSERT policy
-- to also verify flashcard ownership.
--
-- The NestJS backend authenticates with the service_role key (bypasses RLS).
-- These policies are defence-in-depth (OWASP A01: Broken Access Control).

-- ── 1. Harden deck_flashcards INSERT ──────────────────────────────────────
-- Replace the existing INSERT policy with one that also verifies the
-- flashcard belongs to the authenticated user.
DROP POLICY IF EXISTS deck_flashcards_insert_own ON public.deck_flashcards;

CREATE POLICY deck_flashcards_insert_own ON public.deck_flashcards
    FOR INSERT TO authenticated WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.decks d
            WHERE d.id = deck_flashcards.deck_id AND d.user_id = auth.uid()
        )
        AND EXISTS (
            SELECT 1 FROM public.flashcards f
            WHERE f.id = deck_flashcards.flashcard_id AND f.user_id = auth.uid()
        )
    );

-- ── 2. Harden deck_flashcards SELECT ─────────────────────────────────────
-- Same as before: user can only see rows belonging to their own decks.
-- No change needed; the original policy is already correct.
-- (Repeated for idempotency.)
DROP POLICY IF EXISTS deck_flashcards_select_own ON public.deck_flashcards;

CREATE POLICY deck_flashcards_select_own ON public.deck_flashcards
    FOR SELECT TO authenticated USING (
        EXISTS (
            SELECT 1 FROM public.decks d
            WHERE d.id = deck_flashcards.deck_id AND d.user_id = auth.uid()
        )
    );

-- ── 3. Harden deck_flashcards DELETE ─────────────────────────────────────
-- Same: user can only delete rows from their own decks.
DROP POLICY IF EXISTS deck_flashcards_delete_own ON public.deck_flashcards;

CREATE POLICY deck_flashcards_delete_own ON public.deck_flashcards
    FOR DELETE TO authenticated USING (
        EXISTS (
            SELECT 1 FROM public.decks d
            WHERE d.id = deck_flashcards.deck_id AND d.user_id = auth.uid()
        )
    );

-- Note: deck_flashcards has no UPDATE policy. Rows in this junction table
-- have no mutable columns beyond the composite key and added_at timestamp.