export interface NotificationPreferences {
  userId: string;
  direct_messages: { push: boolean; badge: boolean };
  groups: { push: boolean; badge: boolean };
  likes: { push: boolean; badge: boolean };
  voice_rooms: { push: boolean; badge: boolean };
  quiet_hours_start?: string;
  quiet_hours_end?: string;
  do_not_disturb: boolean;
  updatedAt: string;
}
