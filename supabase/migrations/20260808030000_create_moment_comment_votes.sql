-- Create moment_comment_votes table for correction quality up/down voting
CREATE TABLE IF NOT EXISTS public.moment_comment_votes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    comment_id UUID NOT NULL REFERENCES public.moment_comments(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    vote VARCHAR(5) NOT NULL CHECK (vote IN ('up', 'down')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT unique_comment_vote UNIQUE (comment_id, user_id)
);

CREATE INDEX IF NOT EXISTS moment_comment_votes_comment_idx
    ON public.moment_comment_votes (comment_id, vote);

-- RLS: users can read all votes but only insert/update/delete their own
ALTER TABLE public.moment_comment_votes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view all comment votes"
    ON public.moment_comment_votes FOR SELECT
    USING (true);

CREATE POLICY "Users can insert their own votes"
    ON public.moment_comment_votes FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own votes"
    ON public.moment_comment_votes FOR UPDATE
    USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own votes"
    ON public.moment_comment_votes FOR DELETE
    USING (auth.uid() = user_id);