export interface StoryRecord {
  id: string;
  user_id: string;
  text_content?: string;
  media_urls: string[];
  voice_note_url?: string;
  media_type?: 'none' | 'images' | 'audio' | 'video';
  target_language?: string;
  expires_at: string; // ISO timestamp
  is_ephemeral: boolean; // always true
  created_at: string;
}

export interface StoryResponse {
  id: string;
  user_id: string;
  text_content: string | null;
  media_urls: string[];
  voice_note_url: string | null;
  media_type: string;
  target_language: string | null;
  expires_at: string;
  created_at: string;
  author: {
    id: string;
    display_name: string;
    avatar_url: string | null;
  };
}
