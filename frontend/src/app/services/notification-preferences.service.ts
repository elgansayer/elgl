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

@Injectable({
  providedIn: 'root',
})
export class NotificationPreferencesService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiUrl}/notifications/preferences`;

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
