-- Add privacy visibility controls for Last Seen, Profile Photo, About Info, and Status
ALTER TABLE users
ADD COLUMN IF NOT EXISTS privacy_last_seen text NOT NULL DEFAULT 'everyone',
ADD COLUMN IF NOT EXISTS privacy_profile_photo text NOT NULL DEFAULT 'everyone',
ADD COLUMN IF NOT EXISTS privacy_about_info text NOT NULL DEFAULT 'everyone',
ADD COLUMN IF NOT EXISTS privacy_status text NOT NULL DEFAULT 'everyone';

-- Optionally add a check constraint to guarantee allowed values
ALTER TABLE users
ADD CONSTRAINT privacy_last_seen_check CHECK (privacy_last_seen = ANY (ARRAY['everyone', 'contacts', 'nobody']));
ALTER TABLE users
ADD CONSTRAINT privacy_profile_photo_check CHECK (privacy_profile_photo = ANY (ARRAY['everyone', 'contacts', 'nobody']));
ALTER TABLE users
ADD CONSTRAINT privacy_about_info_check CHECK (privacy_about_info = ANY (ARRAY['everyone', 'contacts', 'nobody']));
ALTER TABLE users
ADD CONSTRAINT privacy_status_check CHECK (privacy_status = ANY (ARRAY['everyone', 'contacts', 'nobody']));
