-- Add last_active_at column to users table if not present
ALTER TABLE users
ADD COLUMN IF NOT EXISTS last_active_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- Create index for efficient querying in the cron job
CREATE INDEX IF NOT EXISTS idx_users_last_active_at ON users(last_active_at);

-- Update existing users to have last_active_at set to created_at as fallback
UPDATE users
SET last_active_at = created_at
WHERE last_active_at IS NULL;
