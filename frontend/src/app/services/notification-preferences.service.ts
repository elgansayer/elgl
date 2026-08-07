import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../environments/environment';

export interface PreferenceChannel {
  push: boolean;
  badge: boolean;
}

export interface NotificationPreferences {
  userId: string;
  direct_messages: PreferenceChannel;
  groups: PreferenceChannel;
  likes: PreferenceChannel;
  voice_rooms: PreferenceChannel;
  do_not_disturb: boolean;
  updatedAt: string;
}

export type NotificationCategory = 'direct_messages' | 'groups' | 'likes' | 'voice_rooms';

export type NotificationChannel = 'push' | 'badge';

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

export type LegacyChannel = 'push' | 'badge';

@Injectable({
  providedIn: 'root',
})
export class NotificationPreferencesService {
  private readonly http = inject(HttpClient);
<<<<<<< HEAD
  private readonly baseUrl = `${environment.apiUrl}/notifications/preferences`;
=======
  private readonly baseUrl = '/api/notification-preferences';
  private readonly notificationsUrl = '/api/notifications';
>>>>>>> origin/main

  async getPreferences(): Promise<NotificationPreferences> {
    return firstValueFrom(this.http.get<NotificationPreferences>(this.baseUrl));
  }

  async updatePreferences(dto: Partial<NotificationPreferences>): Promise<NotificationPreferences> {
    const response = await firstValueFrom(
      this.http.put<{ success: boolean; preferences: NotificationPreferences }>(
        this.baseUrl,
        dto,
      ),
    );
    return response.preferences;
  }

  async toggleCategoryChannel(
    category: NotificationCategory,
    channel: NotificationChannel,
    enabled: boolean,
    currentPrefs: NotificationPreferences,
  ): Promise<NotificationPreferences> {
    const update: Partial<NotificationPreferences> = {
      [category]: {
        ...currentPrefs[category],
        [channel]: enabled,
      },
    };
    return this.updatePreferences(update);
  }

  resetToDefaults(): Promise<NotificationPreferences> {
    return this.updatePreferences({
      direct_messages: { push: true, badge: true },
      groups: { push: true, badge: true },
      likes: { push: true, badge: true },
      voice_rooms: { push: true, badge: true },
    });
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
      this.http.put<{ success: boolean; preferences: LegacyNotificationPreferences }>(
        `${this.notificationsUrl}/preferences`,
        dto,
      ),
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
      this.http.get<{ custom_tone_url?: string; vibration_pattern?: number[] }>(
        `${environment.apiUrl}/users/me/notification-preferences`,
      ),
    );
    return {
      customToneUrl: raw.custom_tone_url,
      vibrationPattern: raw.vibration_pattern,
    };
  }
}
