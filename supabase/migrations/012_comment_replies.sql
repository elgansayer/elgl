-- Add parent_comment_id and reply_to_user_id to moment_comments for threaded comment replies
ALTER TABLE public.moment_comments 
ADD COLUMN IF NOT EXISTS parent_comment_id UUID NULL REFERENCES public.moment_comments(id) ON DELETE CASCADE,
ADD COLUMN IF NOT EXISTS reply_to_user_id UUID NULL REFERENCES public.users(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS moment_comments_parent_idx ON public.moment_comments(parent_comment_id);
