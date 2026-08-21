-- Migration: Add animated sticker pack fields
-- Fixes #388: Allow spending virtual coins to unlock animated sticker packs

-- Add is_animated flag to sticker_packs
ALTER TABLE sticker_packs
ADD COLUMN IF NOT EXISTS is_animated boolean NOT NULL DEFAULT false;

-- Add sticker_urls column (JSON array of sticker image/animation URLs)
ALTER TABLE sticker_packs
ADD COLUMN IF NOT EXISTS sticker_urls jsonb NOT NULL DEFAULT '[]'::jsonb;

-- Add optional animation_url for the pack preview/hero animation
ALTER TABLE sticker_packs
ADD COLUMN IF NOT EXISTS animation_url text;

COMMENT ON COLUMN sticker_packs.is_animated IS 'Whether this pack contains animated stickers';
COMMENT ON COLUMN sticker_packs.sticker_urls IS 'JSON array of sticker image URLs (or Lottie JSON URLs for animated packs)';
COMMENT ON COLUMN sticker_packs.animation_url IS 'Optional Lottie JSON URL for pack preview animation';