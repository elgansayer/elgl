import { Injectable } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { UpdateNotificationPreferencesDto } from './dto/update-notification-preferences.dto';

export interface CategoryPreference {
  push?: boolean;
  email?: boolean;
  in_app?: boolean;
  badges?: boolean;
}

export interface NotificationPreferencesRecord {
  id?: string;
  user_id: string;
  new_message?: CategoryPreference;
  call_invite?: CategoryPreference;
  moment_like?: CategoryPreference;
  moment_comment?: CategoryPreference;
  correction?: CategoryPreference;
  gift?: CategoryPreference;
  profile_view?: CategoryPreference;
  study_reminder?: CategoryPreference;
  friend_request?: CategoryPreference;
  audio_room_invite?: CategoryPreference;
  new_follower?: CategoryPreference;
  quiet_hours_start?: string | null;
  quiet_hours_end?: string | null;
  do_not_disturb?: boolean;
  customToneUrl?: string | null;
  vibrationPattern?: string | null;
  created_at?: string;
  updated_at?: string;
  [key: string]: unknown;
}

@Injectable()
export class NotificationPreferencesService {
  private readonly table = 'notification_preferences';

  constructor(private readonly supabaseService: SupabaseService) {}

  async getPreferences(userId: string): Promise<NotificationPreferencesRecord> {
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
  ): Promise<NotificationPreferencesRecord> {
    return this.upsertPreferences(userId, dto);
  }

  async resetToDefaults(
    userId: string,
  ): Promise<NotificationPreferencesRecord> {
    const defaults = this.getDefaultPreferences(userId);
    return this.upsertPreferences(userId, defaults);
  }

  private async upsertPreferences(
    userId: string,
    changes: object,
  ): Promise<NotificationPreferencesRecord> {
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
