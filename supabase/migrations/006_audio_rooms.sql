-- Create audio_rooms and audio_room_captions tables for LiveKit SFU architecture
CREATE TABLE IF NOT EXISTS public.audio_rooms (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    room_name VARCHAR(255) NOT NULL UNIQUE,
    title VARCHAR(255) NOT NULL,
    target_language VARCHAR(50) NOT NULL DEFAULT 'en',
    host_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    is_active BOOLEAN NOT NULL DEFAULT true,
    speakers UUID[] DEFAULT '{}',
    raised_hands UUID[] DEFAULT '{}',
    listeners_count INTEGER NOT NULL DEFAULT 0,
    recording_url TEXT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.audio_room_captions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    room_id UUID NOT NULL REFERENCES public.audio_rooms(id) ON DELETE CASCADE,
    speaker_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    speaker_name VARCHAR(255),
    text_content TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS audio_rooms_active_idx ON public.audio_rooms (is_active, created_at DESC);
CREATE INDEX IF NOT EXISTS audio_room_captions_room_idx ON public.audio_room_captions (room_id, created_at ASC);
