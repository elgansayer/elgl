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
    | 'text'
    | 'voice'
    | 'correction'
    | 'doodle'
    | 'sticker'
    | 'system'
    | 'status_reply'
    | 'view_once_media';
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
  /** ID of the message this is a reply to, for threaded conversations */
  reply_to_id?: string;
  /** Preview of the parent message (text_content + sender_id) for inline display */
  reply_preview?: {
    text_content: string;
    sender_id: string;
    display_name?: string;
    avatar_url?: string | null;
  };
  /** Contains data when the message is a reply to a status update */
  status_reply_payload?: {
    status_update_id: string;
    status_text: string;
  };

  /** Whether the media in this message disappears after opening */
  is_view_once?: boolean;

  /** Timestamp when the view‑once media was first accessed (null = not yet opened) */
  viewed_at?: string | null;
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
  is_locked?: boolean;
  created_at: string;
  labels?: string[];
  wallpaper_url?: string | null;
}
