import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';

export interface CategoryPreference {
  push: boolean;
  email: boolean;
  in_app: boolean;
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
  quiet_hours_start?: string;
  quiet_hours_end?: string;
  do_not_disturb: boolean;
  customToneUrl?: string;
  vibrationPattern?: string;
  updatedAt: string;
}

export type NotificationCategory = keyof Omit<
  NotificationPreferences,
  | 'userId'
  | 'updatedAt'
  | 'quiet_hours_start'
  | 'quiet_hours_end'
  | 'do_not_disturb'
  | 'customToneUrl'
  | 'vibrationPattern'
>;

export type NotificationChannel = 'push' | 'email' | 'in_app';

@Injectable({
  providedIn: 'root',
})
export class NotificationPreferencesService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = '/api/notification-preferences';

  getPreferences(): Promise<NotificationPreferences> {
    return firstValueFrom(this.http.get<NotificationPreferences>(this.baseUrl));
  }

  updatePreferences(dto: Partial<NotificationPreferences>): Promise<NotificationPreferences> {
    return firstValueFrom(this.http.put<NotificationPreferences>(this.baseUrl, dto));
  }

  resetToDefaults(): Promise<NotificationPreferences> {
    return firstValueFrom(this.http.post<NotificationPreferences>(`${this.baseUrl}/reset`, {}));
  }

  toggleCategoryChannel(
    category: NotificationCategory,
    channel: NotificationChannel,
    enabled: boolean,
    currentPrefs: NotificationPreferences,
  ): Promise<NotificationPreferences> {
    const update: Record<string, unknown> = {
      [category]: {
        ...currentPrefs[category],
        [channel]: enabled,
      },
    };
    return this.updatePreferences(update);
  }

  toggleDoNotDisturb(
    enabled: boolean,
    start?: string,
    end?: string,
  ): Promise<NotificationPreferences> {
    const update: Record<string, unknown> = { do_not_disturb: enabled };
    if (start !== undefined) update['quiet_hours_start'] = start;
    if (end !== undefined) update['quiet_hours_end'] = end;
    return this.updatePreferences(update);
  }
}
