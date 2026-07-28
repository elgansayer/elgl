import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

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
  quiet_hours_start?: string;
  quiet_hours_end?: string;
  do_not_disturb: boolean;
  updatedAt: string;
}

export type NotificationCategory = keyof Omit<
  NotificationPreferences,
  'userId' | 'updatedAt' | 'quiet_hours_start' | 'quiet_hours_end' | 'do_not_disturb'
>;

export type NotificationChannel = 'push' | 'email' | 'in_app';

@Injectable({
  providedIn: 'root',
})
export class NotificationPreferencesService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = '/api/notification-preferences';

  getPreferences(): Observable<NotificationPreferences> {
    return this.http.get<NotificationPreferences>(this.baseUrl);
  }

  updatePreferences(dto: Partial<NotificationPreferences>): Observable<NotificationPreferences> {
    return this.http.put<NotificationPreferences>(this.baseUrl, dto);
  }

  resetToDefaults(): Observable<NotificationPreferences> {
    return this.http.post<NotificationPreferences>(`${this.baseUrl}/reset`, {});
  }

  toggleCategoryChannel(
    category: NotificationCategory,
    channel: NotificationChannel,
    enabled: boolean,
    currentPrefs: NotificationPreferences,
  ): Observable<NotificationPreferences> {
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
  ): Observable<NotificationPreferences> {
    const update: Record<string, unknown> = { do_not_disturb: enabled };
    if (start !== undefined) update['quiet_hours_start'] = start;
    if (end !== undefined) update['quiet_hours_end'] = end;
    return this.updatePreferences(update);
  }
}
