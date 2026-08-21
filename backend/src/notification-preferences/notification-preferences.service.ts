import { Injectable } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { UpdateNotificationPreferencesDto } from './dto/update-notification-preferences.dto';

@Injectable()
export class NotificationPreferencesService {
  private readonly table = 'notification_preferences';

  constructor(private readonly supabaseService: SupabaseService) {}

  async getPreferences(userId: string): Promise<any> {
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
    return data;
  }

  async updatePreferences(
    userId: string,
    dto: UpdateNotificationPreferencesDto,
  ): Promise<any> {
    return this.upsertPreferences(userId, dto);
  }

  async resetToDefaults(userId: string): Promise<any> {
    const defaults = this.getDefaultPreferences(userId);
    return this.upsertPreferences(userId, defaults);
  }

  private async upsertPreferences(
    userId: string,
    changes: object,
  ): Promise<any> {
    const supabase = this.supabaseService.getClient();
    const { data, error } = await supabase
      .from(this.table)
      .upsert({
        user_id: userId,
        ...changes,
        updated_at: new Date().toISOString(),
      })
      .single();
    if (error) throw error;
    return data;
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
