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
  message_type: string;
  text_content?: string | null;
  media_url?: string | null;
  correction_payload?: CorrectionPayload | null;
  system_event?: SystemEventPayload | null;
  is_read: boolean;
  delivery_status?: 'sent' | 'delivered' | 'read' | (string & {});
  created_at: string;
  /** Absolute server-assigned expiry for disappearing messages; null means normal retention. */
  expires_at?: string | null;
  sender?: {
    id: string;
    display_name?: string | null;
    avatar_url?: string | null;
  } | null;
  link_preview?: LinkPreview | null;
  /** Original text detected by the translation service */
  original_text?: string | null;
  /** Translated version of the text, if automatic translation was applied */
  translated_text?: string | null;
  /** ISO 639-1 code of the source language detected */
  detected_language?: string | null;
  /** ID of the message this is a reply to, for threaded conversations */
  reply_to_id?: string | null;
  /** Preview of the parent message (text_content + sender_id) for inline display */
  reply_preview?: {
    text_content: string;
    sender_id: string;
    display_name?: string | null;
    avatar_url?: string | null;
  } | null;
  /**
   * Contains data when the message is a reply to a status update.
   * Includes the ID of the status update and the reply text.
   */
  status_reply_payload?: {
    status_update_id: string;
    status_text: string;
  } | null;

  /** Whether the media in this message disappears after opening */
  is_view_once?: boolean;

  /** Timestamp when the view‑once media was first accessed (null = not yet opened) */
  viewed_at?: string | null;

  /** Payload for contact share messages */
  contact_payload?: {
    contact_user_id: string;
    display_name: string | null;
    avatar_url: string | null;
  } | null;

  /** User IDs for whom this message has been soft-deleted */
  deleted_for_user_ids?: string[] | null;

  /** Whether this message was forwarded from another conversation */
  is_forwarded?: boolean;
}

export interface DeletedAwareMessage extends ChatMessage {
  deleted_for_user_ids: string[] | null;
}

export interface FavouriteRecord {
  id: string;
  user_id: string;
  item_type: string;
  item_payload: Record<string, unknown>;
  notes?: string | null;
  created_at: string;
}

export interface ChatRoomRecord {
  id: string;
  title: string | null;
  subtitle?: string | null;
  avatar?: string | null;
  is_online: boolean | null;
  is_pinned: boolean | null;
  is_locked?: boolean | null;
  created_at?: string;
  labels?: string[] | null;
  wallpaper_url?: string | null;
  admin_id?: string | null;
}
