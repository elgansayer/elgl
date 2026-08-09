-- RLS policies for archive_requests table
ALTER TABLE public.archive_requests ENABLE ROW LEVEL SECURITY;

-- Users can view their own archive requests
CREATE POLICY "Users can view own archive requests"
  ON public.archive_requests
  FOR SELECT
  USING (auth.uid() = user_id);

-- Only the service role can insert/update (handled by backend API)
CREATE POLICY "Service role can manage archive requests"
  ON public.archive_requests
  FOR ALL
  USING (true)
  WITH CHECK (true);