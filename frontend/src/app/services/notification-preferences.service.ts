import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../environments/environment';

export interface PreferenceChannel {
  push: boolean;
  email: boolean;
  in_app: boolean;
  badges: boolean;
}

export type NotificationChannel = keyof PreferenceChannel;

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

export interface NotificationPreferences {
  userId: string;
  new_message: PreferenceChannel;
  call_invite: PreferenceChannel;
  moment_like: PreferenceChannel;
  moment_comment: PreferenceChannel;
  correction: PreferenceChannel;
  gift: PreferenceChannel;
  profile_view: PreferenceChannel;
  study_reminder: PreferenceChannel;
  friend_request: PreferenceChannel;
  audio_room_invite: PreferenceChannel;
  new_follower: PreferenceChannel;
  quiet_hours_start?: string | null;
  quiet_hours_end?: string | null;
  quiet_hours_timezone?: string | null;
  do_not_disturb: boolean;
  customToneUrl?: string;
  vibrationPattern?: string;
  updatedAt: string;
}

export type NotificationPreferencesUpdate = Partial<{
  [Category in NotificationCategory]: Partial<PreferenceChannel>;
}> & {
  quiet_hours_start?: string | null;
  quiet_hours_end?: string | null;
  quiet_hours_timezone?: string | null;
  do_not_disturb?: boolean;
  customToneUrl?: string;
  vibrationPattern?: string;
};

/**
 * The single client contract for notification preferences:
 * `GET/PUT /api/notification-preferences` plus `POST /api/notification-preferences/reset`.
 * The legacy `/api/notifications/preferences` and
 * `/api/users/me/notification-preferences` contracts were removed.
 */
@Injectable({
  providedIn: 'root',
})
export class NotificationPreferencesService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiUrl}/notification-preferences`;

  getPreferences(): Promise<NotificationPreferences> {
    return firstValueFrom(
      this.http.get<NotificationPreferences>(this.baseUrl),
    );
  }

  updatePreferences(
    dto: NotificationPreferencesUpdate,
  ): Promise<NotificationPreferences> {
    return firstValueFrom(
      this.http.put<NotificationPreferences>(this.baseUrl, dto),
    );
  }

  toggleCategoryChannel(
    category: NotificationCategory,
    channel: NotificationChannel,
    enabled: boolean,
    currentPrefs: NotificationPreferences,
  ): Promise<NotificationPreferences> {
    return this.updatePreferences({
      [category]: {
        ...currentPrefs[category],
        [channel]: enabled,
      },
    });
  }

  toggleDoNotDisturb(
    enabled: boolean,
    quietHoursStart: string,
    quietHoursEnd: string,
  ): Promise<NotificationPreferences> {
    return this.updatePreferences({
      do_not_disturb: enabled,
      quiet_hours_start: quietHoursStart || null,
      quiet_hours_end: quietHoursEnd || null,
    });
  }

  resetToDefaults(): Promise<NotificationPreferences> {
    return firstValueFrom(
      this.http.post<NotificationPreferences>(`${this.baseUrl}/reset`, {}),
    );
  }
}
