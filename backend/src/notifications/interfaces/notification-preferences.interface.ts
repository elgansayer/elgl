export interface CategoryPreference {
  push: boolean;
  email: boolean;
  in_app: boolean;
  badges: boolean;
}

export interface NotificationPreferences {
  userId: string;
  new_message: CategoryPreference;
  call_invite: CategoryPreference;
  moment_like: CategoryPreference;
  moment_comment: CategoryPreference;
  correction: CategoryPreference;
  gift: CategoryPreference;
  profile_view: CategoryPreference;
  study_reminder: CategoryPreference;
  friend_request: CategoryPreference;
  audio_room_invite: CategoryPreference;
  new_follower: CategoryPreference;
  quiet_hours_start?: string;
  quiet_hours_end?: string;
  do_not_disturb: boolean;
  customToneUrl?: string;
  vibrationPattern?: string;
  updatedAt: string;
}
