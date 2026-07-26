-- Add split-screen co-host video support to audio_rooms
ALTER TABLE public.audio_rooms
    ADD COLUMN IF NOT EXISTS is_video_stream BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS co_host_id UUID NULL REFERENCES public.users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS audio_rooms_co_host_idx ON public.audio_rooms (co_host_id);
