export interface AudioRoomRecord {
  id: string;
  room_name: string;
  title: string;
  target_language: string;
  language_pair?: string;
  topic_tag?: string;
  party_type?: string | null;
  event_id?: string | null;
  host_id: string;
  co_host_id?: string | null;
  is_video_stream: boolean;
  is_active: boolean;
  speakers: string[];
  raised_hands: string[];
  listeners_count: number;
  recording_url?: string | null;
  created_at: string;
  is_private?: boolean;
  invited_user_ids?: string[];
  biometric_lock?: boolean;
  host?: {
    id: string;
    display_name?: string;
    avatar_url?: string | null;
  };
}

export interface RoomTokenResponse {
  token: string;
  room_id: string;
  room_name: string;
  livekit_url: string;
  is_speaker: boolean;
  user_id: string;
}

export interface CaptionRecord {
  id: string;
  room_id: string;
  speaker_id: string;
  speaker_name?: string;
  text_content: string;
  created_at: string;
}
