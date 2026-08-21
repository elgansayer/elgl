-- Add profile_visibility column to users table
-- Values: 'everyone', 'vips_only', 'hidden'
ALTER TABLE users ADD COLUMN IF NOT EXISTS profile_visibility TEXT DEFAULT 'everyone' NOT NULL;

-- Add check constraint for valid values
ALTER TABLE users ADD CONSTRAINT users_profile_visibility_check
  CHECK (profile_visibility IN ('everyone', 'vips_only', 'hidden'));

COMMENT ON COLUMN users.profile_visibility IS 'Controls who can see this user profile: everyone, vips_only, or hidden';

