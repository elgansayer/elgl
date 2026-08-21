-- Migration: Fix missing UPDATE RLS policy for deck_flashcards upsert
-- Fixes #2350 (additional): The previous RLS review (20260807143544)
-- omitted an UPDATE policy on deck_flashcards under the assumption that
-- rows in the junction table would only be INSERTed or DELETEd.
-- However, decks.service.ts#addFlashcardToDeck uses .upsert(), which in
-- PostgreSQL translates to INSERT ... ON CONFLICT ... DO UPDATE.
-- When the upsert encounters a conflict (same deck_id + flashcard_id),
-- the UPDATE path requires an UPDATE permission under RLS; without it,
-- re-adding an existing flashcard to a deck would fail for non-service_role
-- clients.

-- The UPDATE policy uses the same ownership check as the INSERT/DELETE
-- policies: the authenticated user must own the deck.
DROP POLICY IF EXISTS deck_flashcards_update_own ON public.deck_flashcards;
CREATE POLICY deck_flashcards_update_own ON public.deck_flashcards
    FOR UPDATE TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.decks d
            WHERE d.id = deck_flashcards.deck_id AND d.user_id = auth.uid()
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.decks d
            WHERE d.id = deck_flashcards.deck_id AND d.user_id = auth.uid()
        )
    );