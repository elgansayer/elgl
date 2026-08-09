-- Create table for storing client-side error reports
CREATE TABLE IF NOT EXISTS client_errors (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at timestamptz DEFAULT now() NOT NULL,
  message text NOT NULL,
  name text NOT NULL DEFAULT 'Error',
  stack text,
  component_stack text,
  url text,
  user_agent text,
  metadata jsonb,
  stack_frames jsonb,
  client_timestamp timestamptz DEFAULT now()
);

-- Index for sorting by most recent
CREATE INDEX IF NOT EXISTS idx_client_errors_created_at ON client_errors (created_at DESC);

-- Index for querying by error name/type
CREATE INDEX IF NOT EXISTS idx_client_errors_name ON client_errors (name);