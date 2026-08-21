export interface NotificationActorDto {
  id: string;
  display_name?: string;
  avatar_url?: string;
  native_languages?: string[];
  target_languages?: string[];
}

export interface NotificationDto {
  id: string;
  recipient_id: string;
  actor_id: string;
  type:
    | 'follow'
    | 'like_profile'
    | 'like_moment'
    | 'comment_moment'
    | 'reply_comment'
    | 'profile_visit'
    | 'mention_comment'
    | 'mention_chat'
    | 'system';
  entity_id?: string;
  message?: string;
  is_read: boolean;
  created_at: string;
  actor?: NotificationActorDto;
}
