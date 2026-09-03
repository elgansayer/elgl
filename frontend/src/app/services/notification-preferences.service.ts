import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../environments/environment';

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
  do_not_disturb: boolean;
  quiet_hours_start?: string;
  quiet_hours_end?: string;
  quiet_hours_timezone?: string;
  updatedAt: string;
}

export type NotificationCategory =
  | 'new_message'
  | 'call_invite'
  | 'moment_like'
  | 'moment_comment'
  | 'correction'
  | 'gift'
  | 'profile_view'
  | 'study_reminder'
  | 'friend_request'
  | 'audio_room_invite'
  | 'new_follower';

export type NotificationChannel = 'push' | 'email' | 'in_app' | 'badges';

export interface UpdateNotificationPreferences {
  new_message?: Partial<CategoryPreference>;
  call_invite?: Partial<CategoryPreference>;
  moment_like?: Partial<CategoryPreference>;
  moment_comment?: Partial<CategoryPreference>;
  correction?: Partial<CategoryPreference>;
  gift?: Partial<CategoryPreference>;
  profile_view?: Partial<CategoryPreference>;
  study_reminder?: Partial<CategoryPreference>;
  friend_request?: Partial<CategoryPreference>;
  audio_room_invite?: Partial<CategoryPreference>;
  new_follower?: Partial<CategoryPreference>;
  do_not_disturb?: boolean;
  quiet_hours_start?: string | null;
  quiet_hours_end?: string | null;
  quiet_hours_timezone?: string | null;
}

export interface LegacyChannelPreference {
  push: boolean;
  badge: boolean;
}

export interface LegacyNotificationPreferences {
  userId: string;
  direct_messages: LegacyChannelPreference;
  groups: LegacyChannelPreference;
  likes: LegacyChannelPreference;
  voice_rooms: LegacyChannelPreference;
  do_not_disturb: boolean;
  updatedAt: string;
}

export type LegacyCategory = keyof Omit<
  LegacyNotificationPreferences,
  'userId' | 'updatedAt' | 'do_not_disturb'
>;
export type LegacyChannel = keyof LegacyChannelPreference;

@Injectable({
  providedIn: 'root',
})
export class NotificationPreferencesService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = '/api/notification-preferences';
  private readonly notificationsUrl = '/api/notifications';

  async getPreferences(): Promise<NotificationPreferences> {
    return firstValueFrom(this.http.get<NotificationPreferences>(this.baseUrl));
  }

  async updatePreferences(dto: UpdateNotificationPreferences): Promise<NotificationPreferences> {
    return firstValueFrom(this.http.put<NotificationPreferences>(this.baseUrl, dto));
  }

  async toggleCategoryChannel(
    category: NotificationCategory,
    channel: NotificationChannel,
    enabled: boolean,
    currentPrefs: NotificationPreferences,
  ): Promise<NotificationPreferences> {
    const update: UpdateNotificationPreferences = {
      [category]: {
        ...currentPrefs[category],
        [channel]: enabled,
      },
    };
    return this.updatePreferences(update);
  }

  resetToDefaults(): Promise<NotificationPreferences> {
    return firstValueFrom(this.http.post<NotificationPreferences>(`${this.baseUrl}/reset`, {}));
  }

  toggleDoNotDisturb(enabled: boolean): Promise<NotificationPreferences> {
    return this.updatePreferences({ do_not_disturb: enabled });
  }

  getLegacyPreferences(): Promise<LegacyNotificationPreferences> {
    return firstValueFrom(
      this.http.get<LegacyNotificationPreferences>(`${this.notificationsUrl}/preferences`),
    );
  }

  updateLegacyPreferences(
    dto: Partial<LegacyNotificationPreferences>,
  ): Promise<{ success: boolean; preferences: LegacyNotificationPreferences }> {
    return firstValueFrom(
      this.http.put<{
        success: boolean;
        preferences: LegacyNotificationPreferences;
      }>(`${this.notificationsUrl}/preferences`, dto),
    );
  }

  updateCustomizationPreferences(
    customToneUrl?: string,
    vibrationPattern?: number[],
  ): Promise<void> {
    return firstValueFrom(
      this.http.patch<void>(`${environment.apiUrl}/users/me/notification-preferences`, {
        custom_tone_url: customToneUrl,
        vibration_pattern: vibrationPattern,
      }),
    );
  }

  async getCustomizationPreferences(): Promise<{
    customToneUrl?: string;
    vibrationPattern?: number[];
  }> {
    const raw = await firstValueFrom(
      this.http.get<{
        custom_tone_url?: string;
        vibration_pattern?: number[];
      }>(`${environment.apiUrl}/users/me/notification-preferences`),
    );
    return {
      customToneUrl: raw.custom_tone_url,
      vibrationPattern: raw.vibration_pattern,
    };
  }
}
