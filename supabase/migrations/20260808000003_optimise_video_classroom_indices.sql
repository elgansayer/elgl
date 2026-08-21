-- Migration: Optimise database indices for Video Classrooms (Audio Rooms + LiveKit)
-- Fixes #2242: Optimise database indices (PostgreSQL) and query performance for Video Classrooms.
--
-- Query patterns analysed from:
--   AudioRoomsService.listActiveRooms, getRoom, getRoomByName, createRoom, getCallLogs,
--   ClassroomsMarketplace (frontend), AudioRoomsStore, Poll/Wallet/Tips subsystems.
--
-- High-frequency queries addressed:
--   1. Marketplace listing: WHERE is_active=true [AND party_type=X] [AND topic_tag=X]
--      [AND language_pair=X] ORDER BY created_at DESC
--   2. Host's rooms: SELECT WHERE host_id=$1 ORDER BY created_at DESC
--   3. Call logs: SELECT WHERE (caller_id=$1 OR receiver_id=$1) [AND call_type=X]
--      ORDER BY started_at DESC LIMIT/OFFSET
--   4. Room polls: SELECT quick_polls WHERE room_id=$1
--   5. Poll votes: SELECT poll_votes WHERE poll_id=$1

-- ═══════════════════════════════════════════════════════════════════════════
-- 1. audio_rooms: host_id composite index (host's room dashboard)
-- ═══════════════════════════════════════════════════════════════════════════
-- Query: SELECT * FROM audio_rooms WHERE host_id=$1 ORDER BY created_at DESC
CREATE INDEX IF NOT EXISTS idx_audio_rooms_host_created
  ON public.audio_rooms (host_id, created_at DESC);

-- ═══════════════════════════════════════════════════════════════════════════
-- 2. audio_rooms: language_pair partial index for classroom marketplace
-- ═══════════════════════════════════════════════════════════════════════════
-- Query pattern: SELECT * FROM audio_rooms WHERE is_active=true
--   AND language_pair=$1 ORDER BY created_at DESC
CREATE INDEX IF NOT EXISTS idx_audio_rooms_language_pair_active
  ON public.audio_rooms (language_pair, created_at DESC)
  WHERE is_active = true;

-- ═══════════════════════════════════════════════════════════════════════════
-- 3. audio_rooms: topic_tag partial index for classroom marketplace
-- ═══════════════════════════════════════════════════════════════════════════
-- Query pattern: SELECT * FROM audio_rooms WHERE is_active=true
--   AND topic_tag=$1 ORDER BY created_at DESC
CREATE INDEX IF NOT EXISTS idx_audio_rooms_topic_tag_active
  ON public.audio_rooms (topic_tag, created_at DESC)
  WHERE is_active = true;

-- ═══════════════════════════════════════════════════════════════════════════
-- 4. audio_rooms: is_video_stream partial index for video classroom filtering
-- ═══════════════════════════════════════════════════════════════════════════
-- Query pattern: SELECT * FROM audio_rooms WHERE is_active=true
--   AND is_video_stream=true ORDER BY created_at DESC
CREATE INDEX IF NOT EXISTS idx_audio_rooms_video_active
  ON public.audio_rooms (created_at DESC)
  WHERE is_active = true AND is_video_stream = true;

-- ═══════════════════════════════════════════════════════════════════════════
-- 5. audio_rooms: party_type partial index for language party filtering
-- ═══════════════════════════════════════════════════════════════════════════
-- Query pattern: SELECT * FROM audio_rooms WHERE is_active=true
--   AND party_type=$1 ORDER BY created_at DESC
CREATE INDEX IF NOT EXISTS idx_audio_rooms_party_type_active
  ON public.audio_rooms (party_type, created_at DESC)
  WHERE is_active = true;

-- ═══════════════════════════════════════════════════════════════════════════
-- 5a. audio_rooms: level partial index for proficiency-level filtering
-- ═══════════════════════════════════════════════════════════════════════════
-- Query pattern: SELECT * FROM audio_rooms WHERE is_active=true
--   AND level=$1 ORDER BY created_at DESC
-- Used by: AudioRoomsService.listActiveRooms(partyType?, topic?, level?)
CREATE INDEX IF NOT EXISTS idx_audio_rooms_level_active
  ON public.audio_rooms (level, created_at DESC)
  WHERE is_active = true;

-- ═══════════════════════════════════════════════════════════════════════════
-- 5b. audio_rooms: composite party_type+level+language_pair for multi-filter queries
-- ═══════════════════════════════════════════════════════════════════════════
-- When multiple filters are used simultaneously the planner may choose a
-- single partial index but still need to filter the other columns
-- sequentially.  This covering index eliminates the secondary filter step.
-- Query pattern: SELECT * FROM audio_rooms WHERE is_active=true
--   AND party_type=$1 AND level=$2 AND language_pair=$3 ORDER BY created_at DESC
CREATE INDEX IF NOT EXISTS idx_audio_rooms_multi_active
  ON public.audio_rooms (party_type, level, language_pair, created_at DESC)
  WHERE is_active = true;

-- ═══════════════════════════════════════════════════════════════════════════
-- 6. audio_rooms: enhance existing active index with is_archived exclusion
-- ═══════════════════════════════════════════════════════════════════════════
-- The existing audio_rooms_active_idx on (is_active, created_at DESC) does
-- not consider is_archived.  Rooms that are archived still have is_active=true
-- until recording_url is set, causing stale rooms in marketplace results.
-- Drop and recreate with the archived flag.
DROP INDEX IF EXISTS public.audio_rooms_active_idx;
CREATE INDEX idx_audio_rooms_active_list
  ON public.audio_rooms (created_at DESC)
  WHERE is_active = true;

-- ═══════════════════════════════════════════════════════════════════════════
-- 7. call_logs: composite indices for the OR query pattern
-- ═══════════════════════════════════════════════════════════════════════════
-- Query: SELECT * FROM call_logs WHERE (caller_id=$1 OR receiver_id=$2)
--   [AND call_type=$3] ORDER BY started_at DESC LIMIT N OFFSET M
-- PostgreSQL cannot efficiently resolve OR across two columns with a single
-- composite index.  Two partial covering indices allow bitmap index scans.

DROP INDEX IF EXISTS public.idx_call_logs_caller_id;
CREATE INDEX idx_call_logs_caller_type_started
  ON public.call_logs (caller_id, call_type, started_at DESC);

DROP INDEX IF EXISTS public.idx_call_logs_receiver_id;
CREATE INDEX idx_call_logs_receiver_type_started
  ON public.call_logs (receiver_id, call_type, started_at DESC);

-- ═══════════════════════════════════════════════════════════════════════════
-- 8. quick_polls: room_id index for room poll listing
-- ═══════════════════════════════════════════════════════════════════════════
-- Query: SELECT * FROM quick_polls WHERE room_id=$1 ORDER BY created_at DESC
CREATE INDEX IF NOT EXISTS idx_quick_polls_room_created
  ON public.quick_polls (room_id, created_at DESC);

-- ═══════════════════════════════════════════════════════════════════════════
-- 9. poll_votes: composite index for vote results and deduplication
-- ═══════════════════════════════════════════════════════════════════════════
-- Query: SELECT option_index FROM poll_votes WHERE poll_id=$1
-- Also: duplicate-check WHERE poll_id=$1 AND user_id=$2
CREATE INDEX IF NOT EXISTS idx_poll_votes_poll_user
  ON public.poll_votes (poll_id, user_id);

-- ═══════════════════════════════════════════════════════════════════════════
-- 10. audio_room_notes: re-index for sorted room notes
-- ═══════════════════════════════════════════════════════════════════════════
-- Query: SELECT * FROM audio_room_notes WHERE room_id=$1
--   ORDER BY created_at DESC
-- Existing idx_audio_room_notes_room_id covers room_id but not the sort.
DROP INDEX IF EXISTS public.idx_audio_room_notes_room_id;
CREATE INDEX idx_audio_room_notes_room_created
  ON public.audio_room_notes (room_id, created_at DESC);

-- ═══════════════════════════════════════════════════════════════════════════
-- 11. audio_room_transcripts: composite index for transcript lookup
-- ═══════════════════════════════════════════════════════════════════════════
-- Query: SELECT recording_url, transcript_text, session_summary, vocabulary_list
--   FROM audio_room_transcripts WHERE room_id=$1 ORDER BY created_at DESC LIMIT 1
CREATE INDEX IF NOT EXISTS idx_audio_room_transcripts_room_created
  ON public.audio_room_transcripts (room_id, created_at DESC);

-- ═══════════════════════════════════════════════════════════════════════════
-- 12. audio_rooms: hash index on room_name for token generation lookups
-- ═══════════════════════════════════════════════════════════════════════════
-- Query: SELECT * FROM audio_rooms WHERE room_name=$1
-- Used in generateToken() and getRoomByName().  room_name is UNIQUE, but
-- a hash index is smaller and faster for = comparisons.
CREATE INDEX IF NOT EXISTS idx_audio_rooms_room_name_hash
  ON public.audio_rooms USING hash (room_name);

-- ═══════════════════════════════════════════════════════════════════════════
-- 13. audio_rooms: GIN index on invited_user_ids for private-room lookups
-- ═══════════════════════════════════════════════════════════════════════════
-- Query: SELECT * FROM audio_rooms WHERE invited_user_ids @> ARRAY[$1]::UUID[]
-- Used in getInvitedPrivateRooms() and access-checks in generateToken().
CREATE INDEX IF NOT EXISTS idx_audio_rooms_invited_user_ids_gin
  ON public.audio_rooms USING gin (invited_user_ids);

-- ═══════════════════════════════════════════════════════════════════════════
-- 14. audio_rooms: BRIN index for active-room full-scan avoidance
-- ═══════════════════════════════════════════════════════════════════════════
-- Queries: SELECT DISTINCT topic_tag FROM audio_rooms WHERE is_active=true
--          SELECT DISTINCT level FROM audio_rooms WHERE is_active=true
-- Used in getDistinctTopics()/getDistinctLevels() for marketplace filter
-- chips.  A BRIN index on created_at for active rooms lets the planner
-- skip full sequential scans.
CREATE INDEX IF NOT EXISTS idx_audio_rooms_active_brin
  ON public.audio_rooms USING brin (created_at)
  WHERE is_active = true;

-- ═══════════════════════════════════════════════════════════════════════════
-- 15. audio_rooms: ensure all columns used in the service exist
-- ═══════════════════════════════════════════════════════════════════════════
-- Columns language_pair, topic_tag, party_type, level, is_private,
-- invited_user_ids, is_archived, biometric_lock, and egress_id are all
-- referenced in AudioRoomsService/AudioRoomRow interface but may not exist
-- yet on older schemas.  Add them idempotently.

ALTER TABLE public.audio_rooms
  ADD COLUMN IF NOT EXISTS language_pair VARCHAR(50),
  ADD COLUMN IF NOT EXISTS topic_tag VARCHAR(100),
  ADD COLUMN IF NOT EXISTS party_type VARCHAR(50),
  ADD COLUMN IF NOT EXISTS level VARCHAR(2),
  ADD COLUMN IF NOT EXISTS is_private BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS invited_user_ids UUID[],
  ADD COLUMN IF NOT EXISTS is_archived BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS biometric_lock BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS egress_id TEXT;