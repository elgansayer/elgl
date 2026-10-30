import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../environments/environment';
import { AuthService } from './auth.service';

export type NotificationType =
  | 'follow'
  | 'like_profile'
  | 'like_moment'
  | 'comment_moment'
  | 'reply_comment'
  | 'profile_visit'
  | 'mention_comment'
  | 'mention_chat'
  | 'system';

export type NotificationFilter = 'all' | 'likes' | 'comments' | 'follows' | 'system';

export interface InAppNotification {
  id: string;
  recipient_id: string;
  actor_id: string;
  type: NotificationType;
  entity_id?: string;
  message?: string;
  is_read: boolean;
  created_at: string;
  actor?: {
    id: string;
    display_name?: string;
    avatar_url?: string;
    native_languages?: string[];
    target_languages?: string[];
  };
}

export interface NotificationPageOptions {
  limit?: number;
  before?: string;
}

export interface NotificationUnreadCounts {
  unreadCount: number;
  byTab: {
    moments: number;
    discovery: number;
    profile: number;
  };
}

export type NotificationUnreadTab = keyof NotificationUnreadCounts['byTab'];

export function notificationUnreadTab(type: NotificationType): NotificationUnreadTab | null {
  switch (type) {
    case 'like_moment':
    case 'comment_moment':
    case 'reply_comment':
    case 'mention_comment':
      return 'moments';
    case 'follow':
    case 'like_profile':
    case 'profile_visit':
      return 'discovery';
    case 'system':
      return 'profile';
    case 'mention_chat':
      return null;
  }
}

const NOTIFICATION_TYPES = new Set<NotificationType>([
  'follow',
  'like_profile',
  'like_moment',
  'comment_moment',
  'reply_comment',
  'profile_visit',
  'mention_comment',
  'mention_chat',
  'system',
]);

@Injectable({ providedIn: 'root' })
export class NotificationService {
  private readonly http = inject(HttpClient);
  private readonly authService = inject(AuthService);
  private readonly baseUrl = `${environment.apiUrl}/notifications`;

  async getNotifications(
    type: NotificationFilter = 'all',
    options: NotificationPageOptions = {},
  ): Promise<InAppNotification[]> {
    const limit = Math.min(50, Math.max(1, Math.trunc(options.limit ?? 20)));
    let params = new HttpParams().set('type', type).set('limit', limit);
    if (options.before) params = params.set('before', options.before);

    const response = await firstValueFrom(
      this.http.get<unknown>(this.baseUrl, {
        headers: this.getHeaders(),
        params,
      }),
    );

    if (!Array.isArray(response)) throw new Error('Invalid notifications response');
    return response
      .map((value) => this.parseNotification(value))
      .filter((value): value is InAppNotification => value !== null);
  }

  async getUnreadCount(): Promise<NotificationUnreadCounts> {
    const response = await firstValueFrom(
      this.http.get<unknown>(`${this.baseUrl}/unread-count`, {
        headers: this.getHeaders(),
      }),
    );
    if (!this.isRecord(response)) throw new Error('Invalid unread count response');
    const unreadCount = this.parseCount(response['unreadCount']);
    const byTab = response['byTab'];
    if (
      unreadCount === null ||
      !this.isRecord(byTab) ||
      this.parseCount(byTab['moments']) === null ||
      this.parseCount(byTab['discovery']) === null ||
      this.parseCount(byTab['profile']) === null
    ) {
      throw new Error('Invalid unread count response');
    }
    return {
      unreadCount,
      byTab: {
        moments: this.parseCount(byTab['moments']) ?? 0,
        discovery: this.parseCount(byTab['discovery']) ?? 0,
        profile: this.parseCount(byTab['profile']) ?? 0,
      },
    };
  }

  async markAsRead(notificationId: string): Promise<void> {
    await firstValueFrom(
      this.http.patch<void>(`${this.baseUrl}/${encodeURIComponent(notificationId)}/read`, {}, {
        headers: this.getHeaders(),
      }),
    );
  }

  async markAllAsRead(): Promise<void> {
    await firstValueFrom(
      this.http.patch<void>(`${this.baseUrl}/read-all`, {}, { headers: this.getHeaders() }),
    );
  }

  private getHeaders(): Record<string, string> {
    return { Authorization: `Bearer ${this.authService.getAccessToken() ?? ''}` };
  }

  private parseCount(value: unknown): number | null {
    return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 ? value : null;
  }

  private parseNotification(value: unknown): InAppNotification | null {
    if (!this.isRecord(value)) return null;
    const id = this.boundedString(value['id'], 255);
    const recipientId = this.boundedString(value['recipient_id'], 255);
    const actorId = this.boundedString(value['actor_id'], 255);
    const type = value['type'];
    const createdAt = this.boundedString(value['created_at'], 64);
    if (
      !id ||
      !recipientId ||
      !actorId ||
      typeof type !== 'string' ||
      !NOTIFICATION_TYPES.has(type as NotificationType) ||
      !createdAt ||
      Number.isNaN(Date.parse(createdAt)) ||
      typeof value['is_read'] !== 'boolean'
    ) {
      return null;
    }

    const notification: InAppNotification = {
      id,
      recipient_id: recipientId,
      actor_id: actorId,
      type: type as NotificationType,
      is_read: value['is_read'],
      created_at: createdAt,
    };
    const entityId = this.boundedString(value['entity_id'], 255);
    if (entityId) notification.entity_id = entityId;
    const message = this.boundedString(value['message'], 2000);
    if (message) notification.message = message;

    const actor = value['actor'];
    if (this.isRecord(actor)) {
      const actorRecord: NonNullable<InAppNotification['actor']> = { id: actorId };
      const displayName = this.boundedString(actor['display_name'], 200);
      if (displayName) actorRecord.display_name = displayName;
      const avatarUrl = this.safeHttpUrl(actor['avatar_url']);
      if (avatarUrl) actorRecord.avatar_url = avatarUrl;
      const nativeLanguages = this.boundedStringArray(actor['native_languages']);
      if (nativeLanguages) actorRecord.native_languages = nativeLanguages;
      const targetLanguages = this.boundedStringArray(actor['target_languages']);
      if (targetLanguages) actorRecord.target_languages = targetLanguages;
      notification.actor = actorRecord;
    }
    return notification;
  }

  private boundedString(value: unknown, maxLength: number): string | undefined {
    if (typeof value !== 'string') return undefined;
    const normalized = value.trim();
    return normalized.length > 0 && normalized.length <= maxLength ? normalized : undefined;
  }

  private boundedStringArray(value: unknown): string[] | undefined {
    if (!Array.isArray(value) || value.length > 10) return undefined;
    const items = value
      .map((item) => this.boundedString(item, 32))
      .filter((item): item is string => Boolean(item));
    return items.length > 0 ? items : undefined;
  }

  private safeHttpUrl(value: unknown): string | undefined {
    const candidate = this.boundedString(value, 2048);
    if (!candidate) return undefined;
    try {
      const parsed = new URL(candidate);
      return parsed.protocol === 'http:' || parsed.protocol === 'https:' ? parsed.toString() : undefined;
    } catch {
      return undefined;
    }
  }

  private isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
  }
}
