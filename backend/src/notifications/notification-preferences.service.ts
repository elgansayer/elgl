import { BadRequestException, Injectable } from '@nestjs/common';
import { Database, SupabaseService } from '../supabase/supabase.service';
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
  new_follower: CategoryPreference;
  quiet_hours_start: string | null;
  quiet_hours_end: string | null;
  quiet_hours_timezone: string | null;
  do_not_disturb: boolean;
  custom_tone_url: string | null;
  vibration_pattern: string | null;
  updated_at: string;
}

type DbNotificationPreferencesInsert =
  Database['public']['Tables']['notification_preferences']['Insert'];

type CategoryKeys = keyof Omit<
  NotificationPreferences,
  | 'userId'
  | 'updatedAt'
  | 'quiet_hours_start'
  | 'quiet_hours_end'
  | 'quiet_hours_timezone'
  | 'do_not_disturb'
  | 'customToneUrl'
  | 'vibrationPattern'
>;

type DeliveryChannel = 'push' | 'email' | 'in_app';

const QUIET_HOURS_TIME_PATTERN = /^(?:[01]\d|2[0-3]):[0-5]\d$/;
const DEFAULT_QUIET_HOURS_TIMEZONE = 'UTC';

@Injectable()
export class NotificationPreferencesService {
  private readonly defaultPreferences: Omit<
    NotificationPreferences,
    'userId' | 'updatedAt'
  > = {
    new_message: { push: true, email: false, in_app: true, badges: true },
    call_invite: { push: true, email: false, in_app: true, badges: true },
    moment_like: { push: true, email: false, in_app: true, badges: true },
    moment_comment: { push: true, email: false, in_app: true, badges: true },
    correction: { push: true, email: false, in_app: true, badges: true },
    gift: { push: true, email: false, in_app: true, badges: true },
    profile_view: { push: false, email: false, in_app: true, badges: true },
    study_reminder: { push: true, email: true, in_app: true, badges: true },
    friend_request: { push: true, email: false, in_app: true, badges: true },
    audio_room_invite: { push: true, email: false, in_app: true, badges: true },
    new_follower: { push: true, email: false, in_app: true, badges: true },
    quiet_hours_start: undefined,
    quiet_hours_end: undefined,
    quiet_hours_timezone: undefined,
    do_not_disturb: false,
    customToneUrl: undefined,
    vibrationPattern: undefined,
  };

  constructor(private readonly supabaseService: SupabaseService) {}

  async getPreferences(userId: string): Promise<NotificationPreferences> {
    const supabase = this.supabaseService.getClient();
    const response = await supabase
      .from('notification_preferences')
      .select('*')
      .eq('user_id', userId)
      .single();

    const data = response.data;
    const error = response.error;

    if (error && error.code !== 'PGRST116') {
      throw new Error(error.message || 'Database error');
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
    this.validateQuietHours(merged);

    const dbPayload: DbNotificationPreferencesInsert = this.mapPreferencesToDb(
      userId,
      merged,
    );

    const upsertResponse = await supabase
      .from('notification_preferences')
      .upsert([dbPayload], { onConflict: 'user_id' })
      .select()
      .single();

    const dbData = upsertResponse.data;
    const dbError = upsertResponse.error;

    if (dbError) {
      throw new Error(dbError.message || 'Database error');
    }

    return this.mapDbToPreferences(dbData);
  }

  async resetToDefaults(userId: string): Promise<NotificationPreferences> {
    const defaults = this.createDefaultPreferences(userId);
    const supabase = this.supabaseService.getClient();
    const dbPayload: DbNotificationPreferencesInsert = this.mapPreferencesToDb(
      userId,
      defaults,
    );

    const upsertResponse = await supabase
      .from('notification_preferences')
      .upsert([dbPayload], { onConflict: 'user_id' })
      .select()
      .single();

    const dbData = upsertResponse.data;
    const dbError = upsertResponse.error;

    if (dbError) {
      throw new Error(dbError.message || 'Database error');
    }

    return this.mapDbToPreferences(dbData);
  }

  async shouldSendNotification(
    userId: string,
    category: CategoryKeys,
    channel: DeliveryChannel,
    at: Date = new Date(),
  ): Promise<boolean> {
    const prefs = await this.getPreferences(userId);

    // Do Not Disturb and scheduled quiet hours silence interruptive delivery
    // while keeping the in-app inbox available for users to review later.
    if (channel !== 'in_app') {
      if (prefs.do_not_disturb) {
        return false;
      }

      if (this.isInQuietHours(prefs, at)) {
        return false;
      }
    }

    const categoryPref = prefs[category];
    return categoryPref[channel] ?? true;
  }

  private isInQuietHours(prefs: NotificationPreferences, at: Date): boolean {
    const start = prefs.quiet_hours_start;
    const end = prefs.quiet_hours_end;

    if (!start || !end || start === end) {
      return false;
    }

    const configuredTimezone = prefs.quiet_hours_timezone;
    const timezone =
      configuredTimezone && this.isValidTimeZone(configuredTimezone)
        ? configuredTimezone
        : DEFAULT_QUIET_HOURS_TIMEZONE;
    const currentMinutes = this.localMinutes(at, timezone);
    const startMinutes = this.timeToMinutes(start);
    const endMinutes = this.timeToMinutes(end);

    // Start is inclusive and end is exclusive. This prevents a notification at
    // exactly the configured wake-up time from being suppressed.
    if (startMinutes < endMinutes) {
      return currentMinutes >= startMinutes && currentMinutes < endMinutes;
    }

    return currentMinutes >= startMinutes || currentMinutes < endMinutes;
  }

  private localMinutes(at: Date, timeZone: string): number {
    const parts = new Intl.DateTimeFormat('en-GB', {
      timeZone,
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    }).formatToParts(at);

    const hour = Number(parts.find((part) => part.type === 'hour')?.value ?? 0);
    const minute = Number(
      parts.find((part) => part.type === 'minute')?.value ?? 0,
    );
    return hour * 60 + minute;
  }

  private timeToMinutes(value: string): number {
    const [hour, minute] = value.split(':').map(Number);
    return hour * 60 + minute;
  }

  private validateQuietHours(prefs: NotificationPreferences): void {
    const start = prefs.quiet_hours_start;
    const end = prefs.quiet_hours_end;

    if (!start && !end) {
      prefs.quiet_hours_start = undefined;
      prefs.quiet_hours_end = undefined;
      prefs.quiet_hours_timezone = undefined;
      return;
    }

    if (!start || !end) {
      throw new BadRequestException(
        'Quiet hours require both a start time and an end time.',
      );
    }

    if (
      !QUIET_HOURS_TIME_PATTERN.test(start) ||
      !QUIET_HOURS_TIME_PATTERN.test(end)
    ) {
      throw new BadRequestException(
        'Quiet hours must use valid 24-hour HH:mm times.',
      );
    }

    if (start === end) {
      throw new BadRequestException(
        'Quiet hours start and end times must be different.',
      );
    }

    const timezone = prefs.quiet_hours_timezone ?? DEFAULT_QUIET_HOURS_TIMEZONE;
    if (!this.isValidTimeZone(timezone)) {
      throw new BadRequestException('Quiet hours timezone is invalid.');
    }
    prefs.quiet_hours_timezone = timezone;
  }

  private isValidTimeZone(value: string | undefined): boolean {
    if (!value) {
      return false;
    }

    try {
      new Intl.DateTimeFormat('en-GB', { timeZone: value }).format(new Date(0));
      return true;
    } catch {
      return false;
    }
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
      'new_follower',
    ];

    const merged: NotificationPreferences = { ...existing };

    for (const category of categories) {
      const dtoCategory = dto[category];
      if (dtoCategory) {
        const existingCategory = existing[category];
        merged[category] = {
          push: dtoCategory.push ?? existingCategory.push,
          email: dtoCategory.email ?? existingCategory.email,
          in_app: dtoCategory.in_app ?? existingCategory.in_app,
          badges: dtoCategory.badges ?? existingCategory.badges,
        };
      }
    }

    if (dto.quiet_hours_start !== undefined) {
      merged.quiet_hours_start = dto.quiet_hours_start ?? undefined;
    }
    if (dto.quiet_hours_end !== undefined) {
      merged.quiet_hours_end = dto.quiet_hours_end ?? undefined;
    }
    if (dto.quiet_hours_timezone !== undefined) {
      merged.quiet_hours_timezone = dto.quiet_hours_timezone ?? undefined;
    }
    if (dto.do_not_disturb !== undefined) {
      merged.do_not_disturb = dto.do_not_disturb;
    }

    if (dto.customToneUrl !== undefined) {
      merged.customToneUrl = dto.customToneUrl;
    }

    if (dto.vibrationPattern !== undefined) {
      merged.vibrationPattern = dto.vibrationPattern;
    }

    merged.updatedAt = new Date().toISOString();
    return merged;
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
      new_follower: data.new_follower,
      quiet_hours_start: data.quiet_hours_start ?? undefined,
      quiet_hours_end: data.quiet_hours_end ?? undefined,
      quiet_hours_timezone: data.quiet_hours_timezone ?? undefined,
      do_not_disturb: data.do_not_disturb,
      customToneUrl: data.custom_tone_url ?? undefined,
      vibrationPattern: data.vibration_pattern ?? undefined,
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
      new_follower: prefs.new_follower,
      quiet_hours_start: prefs.quiet_hours_start ?? null,
      quiet_hours_end: prefs.quiet_hours_end ?? null,
      quiet_hours_timezone: prefs.quiet_hours_timezone ?? null,
      do_not_disturb: prefs.do_not_disturb,
      custom_tone_url: prefs.customToneUrl ?? null,
      vibration_pattern: prefs.vibrationPattern ?? null,
      updated_at: new Date().toISOString(),
    };
  }
}
