import { LinkPreview } from '../../link-preview/interfaces/link-preview.interface';

export interface CorrectionPayload {
  original: string;
  corrected: string;
  explanation?: string;
}

export interface SystemEventPayload {
  type: string; // e.g., 'user_joined', 'correction_given', 'call_ended', 'language_exchange'
  [key: string]: any;
}

export interface ChatMessage {
  id: string;
  room_id: string;
  sender_id: string;
  message_type:
    'text' | 'voice' | 'correction' | 'doodle' | 'sticker' | 'system';
  text_content?: string;
  media_url?: string;
  correction_payload?: CorrectionPayload;
  system_event?: SystemEventPayload;
  is_read: boolean;
  created_at: string;
  sender?: {
    id: string;
    display_name?: string;
    avatar_url?: string | null;
  };
  link_preview?: LinkPreview;
  /** Original text detected by the translation service */
  original_text?: string;
  /** Translated version of the text, if automatic translation was applied */
  translated_text?: string;
  /** ISO 639-1 code of the source language detected */
  detected_language?: string;
}

export interface FavouriteRecord {
  id: string;
  user_id: string;
  message_id: string;
  note_text?: string;
  created_at: string;
  message?: ChatMessage;
}

export interface ChatRoomRecord {
  id: string;
  title: string;
  subtitle: string;
  avatar: string;
  is_online: boolean;
  is_pinned: boolean;
  created_at: string;
}
