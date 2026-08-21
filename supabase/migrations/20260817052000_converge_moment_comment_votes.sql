-- Converge the two historical moment_comment_votes schema variants on the
-- active application contract. Older databases created `vote_type`; the later
-- migration and MomentsService use `vote`.
DO $$
BEGIN
  IF to_regclass('public.moment_comment_votes') IS NULL THEN
    RETURN;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'moment_comment_votes'
      AND column_name = 'vote_type'
  ) AND NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'moment_comment_votes'
      AND column_name = 'vote'
  ) THEN
    ALTER TABLE public.moment_comment_votes
      RENAME COLUMN vote_type TO vote;
  ELSIF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'moment_comment_votes'
      AND column_name = 'vote_type'
  ) AND EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'moment_comment_votes'
      AND column_name = 'vote'
  ) THEN
    UPDATE public.moment_comment_votes
      SET vote = COALESCE(vote, vote_type)
      WHERE vote IS NULL;
    ALTER TABLE public.moment_comment_votes
      DROP COLUMN vote_type;
  END IF;
END
$$;

DO $$
BEGIN
  IF to_regclass('public.moment_comment_votes') IS NULL THEN
    RETURN;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'moment_comment_votes'
      AND column_name = 'vote'
  ) THEN
    ALTER TABLE public.moment_comment_votes
      ALTER COLUMN vote TYPE VARCHAR(5) USING vote::VARCHAR(5),
      ALTER COLUMN vote SET NOT NULL;

    IF EXISTS (
      SELECT 1 FROM pg_constraint
      WHERE conrelid = 'public.moment_comment_votes'::regclass
        AND conname = 'moment_comment_votes_vote_type_check'
    ) AND NOT EXISTS (
      SELECT 1 FROM pg_constraint
      WHERE conrelid = 'public.moment_comment_votes'::regclass
        AND conname = 'moment_comment_votes_vote_check'
    ) THEN
      ALTER TABLE public.moment_comment_votes
        RENAME CONSTRAINT moment_comment_votes_vote_type_check
        TO moment_comment_votes_vote_check;
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM pg_constraint
      WHERE conrelid = 'public.moment_comment_votes'::regclass
        AND conname = 'moment_comment_votes_vote_check'
    ) THEN
      ALTER TABLE public.moment_comment_votes
        ADD CONSTRAINT moment_comment_votes_vote_check
        CHECK (vote IN ('up', 'down'));
    END IF;

    IF EXISTS (
      SELECT 1 FROM pg_constraint
      WHERE conrelid = 'public.moment_comment_votes'::regclass
        AND conname = 'unique_moment_comment_vote'
    ) AND NOT EXISTS (
      SELECT 1 FROM pg_constraint
      WHERE conrelid = 'public.moment_comment_votes'::regclass
        AND conname = 'unique_comment_vote'
    ) THEN
      ALTER TABLE public.moment_comment_votes
        RENAME CONSTRAINT unique_moment_comment_vote TO unique_comment_vote;
    END IF;
  END IF;
END
$$;

CREATE INDEX IF NOT EXISTS moment_comment_votes_comment_idx
  ON public.moment_comment_votes (comment_id, vote);
