export interface CorrectionPayload {
  original: string;
  corrected: string;
  explanation?: string;
}

export interface ChatMessage {
  id: string;
  room_id: string;
  sender_id: string;
  message_type: 'text' | 'voice' | 'correction' | 'doodle';
  text_content?: string;
  media_url?: string;
  correction_payload?: CorrectionPayload;
  is_read: boolean;
  created_at: string;
  sender?: {
    id: string;
    display_name?: string;
    avatar_url?: string | null;
  };
}

export interface FavouriteRecord {
  id: string;
  user_id: string;
  message_id: string;
  note_text?: string;
  created_at: string;
  message?: ChatMessage;
}
