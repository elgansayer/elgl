import { Injectable } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { NotificationPreferencesDto } from './dto/notification-preferences.dto';
import {
  NotificationPreferences,
  CategoryPreference,
} from './interfaces/notification-preferences.interface';

interface DbNotificationPreferences {
  user_id: string;
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
  quiet_hours_start: string | null;
  quiet_hours_end: string | null;
  do_not_disturb: boolean;
  updated_at: string;
}

type CategoryKeys = keyof Omit<
  NotificationPreferences,
  | 'userId'
  | 'updatedAt'
  | 'quiet_hours_start'
  | 'quiet_hours_end'
  | 'do_not_disturb'
>;

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

    const dbError = error as { code?: string } | null;
    const dbData = data as DbNotificationPreferences | null;

    if (dbError && dbError.code !== 'PGRST116') {
      throw dbError;
    }

    if (!dbData) {
      return this.createDefaultPreferences(userId);
    }

    return this.mapDbToPreferences(dbData);
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

    const dbError = error as { code?: string } | null;
    const dbData = data as DbNotificationPreferences | null;

    if (dbError) {
      throw dbError;
    }

    return this.mapDbToPreferences(dbData!);
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

    const dbError = error as { code?: string } | null;
    const dbData = data as DbNotificationPreferences | null;

    if (dbError) {
      throw dbError;
    }

    return this.mapDbToPreferences(dbData!);
  }

  async shouldSendNotification(
    userId: string,
    category: CategoryKeys,
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
    const categories: CategoryKeys[] = [
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
    ];

    const merged: Record<string, unknown> = { ...existing };

    for (const category of categories) {
      const dtoCategory = (dto as any)[category] as
        | import('./dto/notification-preferences.dto').CategoryPreferenceDto
        | undefined;
      if (dtoCategory) {
        const existingCategory = (existing as any)[category] as
          | import('./interfaces/notification-preferences.interface').CategoryPreference
          | undefined;

        merged[category] = {
          push: dtoCategory.push ?? existingCategory?.push ?? true,
          email: dtoCategory.email ?? existingCategory?.email ?? false,
          in_app: dtoCategory.in_app ?? existingCategory?.in_app ?? true,
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
    return merged as unknown as NotificationPreferences;
  }

  private mapDbToPreferences(
    data: DbNotificationPreferences,
  ): NotificationPreferences {
    return {
      userId: data.user_id,
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
      quiet_hours_start: data.quiet_hours_start ?? undefined,
      quiet_hours_end: data.quiet_hours_end ?? undefined,
      do_not_disturb: data.do_not_disturb,
      updatedAt: data.updated_at,
    };
  }

  private mapPreferencesToDb(
    userId: string,
    prefs: NotificationPreferences,
  ): DbNotificationPreferences {
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
