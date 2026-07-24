import { Injectable } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { NotificationPreferencesDto } from './dto/notification-preferences.dto';
import {
  NotificationPreferences,
  CategoryPreference,
} from './interfaces/notification-preferences.interface';

@Injectable()
export class NotificationPreferencesService {
  private readonly defaultPreferences: Omit<
    NotificationPreferences,
    'userId' | 'updatedAt'
  > = {
    new_message: { push: true, email: false, in_app: true },
    call_invite: { push: true, email: false, in_app: true },
    moment_like: { push: true, email: false, in_app: true },
    moment_comment: { push: true, email: false, in_app: true },
    correction: { push: true, email: false, in_app: true },
    gift: { push: true, email: false, in_app: true },
    profile_view: { push: false, email: false, in_app: true },
    study_reminder: { push: true, email: true, in_app: true },
    friend_request: { push: true, email: false, in_app: true },
    audio_room_invite: { push: true, email: false, in_app: true },
    quiet_hours_start: undefined,
    quiet_hours_end: undefined,
    do_not_disturb: false,
  };

  constructor(private readonly supabaseService: SupabaseService) {}

  async getPreferences(userId: string): Promise<NotificationPreferences> {
    const supabase = this.supabaseService.getClient();
    const { data, error } = await supabase
      .from('notification_preferences')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (error && error.code !== 'PGRST116') {
      throw error;
    }

    if (!data) {
      return this.createDefaultPreferences(userId);
    }

    return this.mapDbToPreferences(data);
  }

  async updatePreferences(
    userId: string,
    dto: NotificationPreferencesDto,
  ): Promise<NotificationPreferences> {
    const supabase = this.supabaseService.getClient();
    const existing = await this.getPreferences(userId);

    const merged = this.mergePreferences(existing, dto);

    const dbPayload = this.mapPreferencesToDb(userId, merged);

    const { data, error } = await supabase
      .from('notification_preferences')
      .upsert(dbPayload, { onConflict: 'user_id' })
      .select()
      .single();

    if (error) {
      throw error;
    }

    return this.mapDbToPreferences(data);
  }

  async resetToDefaults(userId: string): Promise<NotificationPreferences> {
    const defaults = this.createDefaultPreferences(userId);
    const supabase = this.supabaseService.getClient();
    const dbPayload = this.mapPreferencesToDb(userId, defaults);

    const { data, error } = await supabase
      .from('notification_preferences')
      .upsert(dbPayload, { onConflict: 'user_id' })
      .select()
      .single();

    if (error) {
      throw error;
    }

    return this.mapDbToPreferences(data);
  }

  async shouldSendNotification(
    userId: string,
    category: keyof Omit<
      NotificationPreferences,
      | 'userId'
      | 'updatedAt'
      | 'quiet_hours_start'
      | 'quiet_hours_end'
      | 'do_not_disturb'
    >,
    channel: 'push' | 'email' | 'in_app',
  ): Promise<boolean> {
    const prefs = await this.getPreferences(userId);

    if (prefs.do_not_disturb) {
      const now = new Date();
      const currentMinutes = now.getHours() * 60 + now.getMinutes();

      if (prefs.quiet_hours_start && prefs.quiet_hours_end) {
        const [startH, startM] = prefs.quiet_hours_start.split(':').map(Number);
        const [endH, endM] = prefs.quiet_hours_end.split(':').map(Number);
        const startMinutes = startH * 60 + startM;
        const endMinutes = endH * 60 + endM;

        if (startMinutes <= endMinutes) {
          if (currentMinutes >= startMinutes && currentMinutes <= endMinutes) {
            return false;
          }
        } else {
          if (currentMinutes >= startMinutes || currentMinutes <= endMinutes) {
            return false;
          }
        }
      }
    }

    const categoryPref = prefs[category];
    if (!categoryPref) {
      return true;
    }

    return categoryPref[channel] ?? true;
  }

  private createDefaultPreferences(userId: string): NotificationPreferences {
    return {
      userId,
      ...this.defaultPreferences,
      updatedAt: new Date().toISOString(),
    };
  }

  private mergePreferences(
    existing: NotificationPreferences,
    dto: NotificationPreferencesDto,
  ): NotificationPreferences {
    const categories = [
      'new_message',
      'call_invite',
      'moment_like',
      'moment_comment',
      'correction',
      'gift',
      'profile_view',
      'study_reminder',
      'friend_request',
      'audio_room_invite',
    ] as const;

    const merged = { ...existing };

    for (const category of categories) {
      const dtoCategory = dto[category];
      if (dtoCategory) {
        merged[category] = {
          push: dtoCategory.push ?? existing[category]?.push ?? true,
          email: dtoCategory.email ?? existing[category]?.email ?? false,
          in_app: dtoCategory.in_app ?? existing[category]?.in_app ?? true,
        };
      }
    }

    if (dto.quiet_hours_start !== undefined) {
      merged.quiet_hours_start = dto.quiet_hours_start;
    }
    if (dto.quiet_hours_end !== undefined) {
      merged.quiet_hours_end = dto.quiet_hours_end;
    }
    if (dto.do_not_disturb !== undefined) {
      merged.do_not_disturb = dto.do_not_disturb;
    }

    merged.updatedAt = new Date().toISOString();
    return merged;
  }

  private mapDbToPreferences(data: any): NotificationPreferences {
    return {
      userId: data.user_id,
      new_message: data.new_message as CategoryPreference,
      call_invite: data.call_invite as CategoryPreference,
      moment_like: data.moment_like as CategoryPreference,
      moment_comment: data.moment_comment as CategoryPreference,
      correction: data.correction as CategoryPreference,
      gift: data.gift as CategoryPreference,
      profile_view: data.profile_view as CategoryPreference,
      study_reminder: data.study_reminder as CategoryPreference,
      friend_request: data.friend_request as CategoryPreference,
      audio_room_invite: data.audio_room_invite as CategoryPreference,
      quiet_hours_start: data.quiet_hours_start,
      quiet_hours_end: data.quiet_hours_end,
      do_not_disturb: data.do_not_disturb ?? false,
      updatedAt: data.updated_at,
    };
  }

  private mapPreferencesToDb(
    userId: string,
    prefs: NotificationPreferences,
  ): any {
    return {
      user_id: userId,
      new_message: prefs.new_message,
      call_invite: prefs.call_invite,
      moment_like: prefs.moment_like,
      moment_comment: prefs.moment_comment,
      correction: prefs.correction,
      gift: prefs.gift,
      profile_view: prefs.profile_view,
      study_reminder: prefs.study_reminder,
      friend_request: prefs.friend_request,
      audio_room_invite: prefs.audio_room_invite,
      quiet_hours_start: prefs.quiet_hours_start ?? null,
      quiet_hours_end: prefs.quiet_hours_end ?? null,
      do_not_disturb: prefs.do_not_disturb,
      updated_at: new Date().toISOString(),
    };
  }
}
