// Factored clean-replay compatibility shims for historical schema-contract
// convergence. These are replay-only and are hashed into the generated replay
// manifest. Historical source migrations remain byte-for-byte unchanged.
export const schemaCompatibilityShims = [
  {
    beforeSourceFile: '20260808030000_create_moment_comment_votes.sql',
    name: 'converge_moment_comment_votes_vote_column',
    reason:
      '005_moments.sql creates moment_comment_votes.vote_type, while the later historical migration and the active MomentsService use moment_comment_votes.vote. Rename the legacy column before replaying the later migration so the corpus converges on the active contract without rewriting history.',
    sql: `DO $$
BEGIN
  IF to_regclass('public.moment_comment_votes') IS NOT NULL
     AND EXISTS (
       SELECT 1
       FROM information_schema.columns
       WHERE table_schema = 'public'
         AND table_name = 'moment_comment_votes'
         AND column_name = 'vote_type'
     )
     AND NOT EXISTS (
       SELECT 1
       FROM information_schema.columns
       WHERE table_schema = 'public'
         AND table_name = 'moment_comment_votes'
         AND column_name = 'vote'
     ) THEN
    ALTER TABLE public.moment_comment_votes
      RENAME COLUMN vote_type TO vote;
  END IF;
END
$$;
`,
  },
];
