-- Add last_active_at column to users table
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS last_active_at TIMESTAMP WITH TIME ZONE DEFAULT now();

-- Create index for efficient querying
CREATE INDEX IF NOT EXISTS idx_users_last_active_at 
ON users(last_active_at);

-- Update existing users to have a default last_active_at
UPDATE users 
SET last_active_at = created_at 
WHERE last_active_at IS NULL;
