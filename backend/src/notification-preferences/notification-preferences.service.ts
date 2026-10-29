import { Injectable } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { UpdateNotificationPreferencesDto } from './dto/update-notification-preferences.dto';

export interface NotificationCategoryPreference {
  push: boolean;
  email: boolean;
  in_app: boolean;
  badges?: boolean;
}

export interface NotificationPreferences {
  user_id: string;
  new_message: NotificationCategoryPreference;
  call_invite: NotificationCategoryPreference;
  moment_like: NotificationCategoryPreference;
  moment_comment: NotificationCategoryPreference;
  correction: NotificationCategoryPreference;
  gift: NotificationCategoryPreference;
  profile_view: NotificationCategoryPreference;
  study_reminder: NotificationCategoryPreference;
  friend_request: NotificationCategoryPreference;
  audio_room_invite: NotificationCategoryPreference;
  new_follower: NotificationCategoryPreference;
  quiet_hours_start: string | null;
  quiet_hours_end: string | null;
  do_not_disturb: boolean;
  customToneUrl: string | null;
  vibrationPattern: string | null;
  updated_at: string;
}

@Injectable()
export class NotificationPreferencesService {
  private readonly table = 'notification_preferences';

  constructor(private readonly supabaseService: SupabaseService) {}

  async getPreferences(userId: string): Promise<NotificationPreferences> {
    const supabase = this.supabaseService.getClient();
    const { data, error } = await supabase
      .from(this.table)
      .select('*')
      .eq('user_id', userId)
      .single();
    // Not found case
    if (error && error.code !== 'PGRST116') {
      throw error;
    }
    if (!data) {
      return this.getDefaultPreferences(userId);
    }
    return {
      user_id: data.user_id,
      new_message: data.new_message,
      call_invite: data.call_invite,
      moment_like: data.moment_like,
      moment_comment: data.moment_comment,
      correction: data.correction,
      gift: data.gift,
      profile_view: data.profile_view,
      study_reminder: data.study_reminder,
      friend_request: data.friend_request,
      audio_room_invite: data.audio_room_invite,
      new_follower: data.new_follower,
      quiet_hours_start: data.quiet_hours_start ?? null,
      quiet_hours_end: data.quiet_hours_end ?? null,
      do_not_disturb: data.do_not_disturb ?? false,
      customToneUrl: data.custom_tone_url ?? null,
      vibrationPattern: data.vibration_pattern ?? null,
      updated_at: data.updated_at,
    };
  }

  async updatePreferences(
    userId: string,
    dto: UpdateNotificationPreferencesDto,
  ): Promise<NotificationPreferences> {
    return this.upsertPreferences(userId, dto);
  }

  async resetToDefaults(userId: string): Promise<NotificationPreferences> {
    const defaults = this.getDefaultPreferences(userId);
    return this.upsertPreferences(userId, defaults);
  }

  private async upsertPreferences(
    userId: string,
    changes: object,
  ): Promise<NotificationPreferences> {
    const supabase = this.supabaseService.getClient();
    const { data, error } = await supabase
      .from(this.table)
      .upsert({
        user_id: userId,
        ...changes,
        updated_at: new Date().toISOString(),
      })
      .select()
      .single();
    if (error) throw error;
    return {
      user_id: data.user_id,
      new_message: data.new_message,
      call_invite: data.call_invite,
      moment_like: data.moment_like,
      moment_comment: data.moment_comment,
      correction: data.correction,
      gift: data.gift,
      profile_view: data.profile_view,
      study_reminder: data.study_reminder,
      friend_request: data.friend_request,
      audio_room_invite: data.audio_room_invite,
      new_follower: data.new_follower,
      quiet_hours_start: data.quiet_hours_start ?? null,
      quiet_hours_end: data.quiet_hours_end ?? null,
      do_not_disturb: data.do_not_disturb ?? false,
      customToneUrl: data.custom_tone_url ?? null,
      vibrationPattern: data.vibration_pattern ?? null,
      updated_at: data.updated_at,
    };
  }

  private getDefaultPreferences(userId: string) {
    const defaultCategory = {
      push: false,
      email: false,
      in_app: true,
      badges: true,
    };
    return {
      user_id: userId,
      new_message: { ...defaultCategory },
      call_invite: { ...defaultCategory },
      moment_like: { ...defaultCategory },
      moment_comment: { ...defaultCategory },
      correction: { ...defaultCategory },
      gift: { ...defaultCategory },
      profile_view: { ...defaultCategory },
      study_reminder: { ...defaultCategory },
      friend_request: { ...defaultCategory },
      audio_room_invite: { ...defaultCategory },
      new_follower: { ...defaultCategory },
      quiet_hours_start: null,
      quiet_hours_end: null,
      do_not_disturb: false,
      customToneUrl: null,
      vibrationPattern: null,
      updated_at: new Date().toISOString(),
    };
  }
}
