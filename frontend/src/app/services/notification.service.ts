import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom, catchError, of } from 'rxjs';
import { environment } from '../../environments/environment';
import { AuthService } from './auth.service';

export interface InAppNotification {
  id: string;
  recipient_id: string;
  actor_id: string;
  type:
    | 'follow'
    | 'like_profile'
    | 'like_moment'
    | 'comment_moment'
    | 'reply_comment'
    | 'profile_visit'
    | 'mention_comment'
    | 'mention_chat'
    | 'system';
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

@Injectable({
  providedIn: 'root',
})
export class NotificationService {
  private http = inject(HttpClient);
  private authService = inject(AuthService);
  private baseUrl = `${environment.apiUrl}/notifications`;

  private getHeaders() {
    const token = this.authService.getAccessToken();
    return {
      Authorization: `Bearer ${token ?? ''}`,
    };
  }

  async getNotifications(type?: string): Promise<InAppNotification[]> {
    const url = type ? `${this.baseUrl}?type=${type}` : this.baseUrl;
    return firstValueFrom(
      this.http
        .get<InAppNotification[]>(url, { headers: this.getHeaders() })
        .pipe(catchError(() => of(this.getFallbackNotifications(type)))),
    );
  }

  async getUnreadCount(): Promise<number> {
    return firstValueFrom(
      this.http
        .get<{ unreadCount: number }>(`${this.baseUrl}/unread-count`, {
          headers: this.getHeaders(),
        })
        .pipe(catchError(() => of({ unreadCount: 2 }))),
    ).then((res) => res.unreadCount);
  }

  async markAsRead(notificationId: string): Promise<void> {
    return firstValueFrom(
      this.http
        .patch<void>(`${this.baseUrl}/${notificationId}/read`, {}, { headers: this.getHeaders() })
        .pipe(catchError(() => of(undefined))),
    );
  }

  async markAllAsRead(): Promise<void> {
    return firstValueFrom(
      this.http
        .patch<void>(`${this.baseUrl}/read-all`, {}, { headers: this.getHeaders() })
        .pipe(catchError(() => of(undefined))),
    );
  }

  private getFallbackNotifications(type?: string): InAppNotification[] {
    const mocks: InAppNotification[] = [
      {
        id: 'notif-1',
        recipient_id: 'me',
        actor_id: 'user-201',
        type: 'follow',
        is_read: false,
        created_at: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
        actor: {
          id: 'user-201',
          display_name: 'Sofia Tanaka',
          avatar_url: 'https://i.pravatar.cc/150?u=user-201',
          native_languages: ['ja'],
          target_languages: ['en'],
        },
      },
      {
        id: 'notif-2',
        recipient_id: 'me',
        actor_id: 'user-202',
        type: 'like_profile',
        is_read: false,
        created_at: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
        actor: {
          id: 'user-202',
          display_name: 'Mateo Garcia',
          avatar_url: 'https://i.pravatar.cc/150?u=user-202',
          native_languages: ['es'],
          target_languages: ['en'],
        },
      },
      {
        id: 'notif-3',
        recipient_id: 'me',
        actor_id: 'user-203',
        type: 'comment_moment',
        message: 'Great pronunciation in your voice clip!',
        is_read: true,
        created_at: new Date(Date.now() - 2 * 3600 * 1000).toISOString(),
        actor: {
          id: 'user-203',
          display_name: 'Emma Watson',
          avatar_url: 'https://i.pravatar.cc/150?u=user-203',
          native_languages: ['en'],
          target_languages: ['fr'],
        },
      },
      {
        id: 'notif-4',
        recipient_id: 'me',
        actor_id: 'user-204',
        type: 'like_moment',
        is_read: true,
        created_at: new Date(Date.now() - 5 * 3600 * 1000).toISOString(),
        actor: {
          id: 'user-204',
          display_name: 'Kenji Sato',
          avatar_url: 'https://i.pravatar.cc/150?u=user-204',
          native_languages: ['ja'],
          target_languages: ['es'],
        },
      },
      {
        id: 'notif-5',
        recipient_id: 'me',
        actor_id: 'user-205',
        type: 'profile_visit',
        is_read: true,
        created_at: new Date(Date.now() - 24 * 3600 * 1000).toISOString(),
        actor: {
          id: 'user-205',
          display_name: 'Lucas Bernard',
          avatar_url: 'https://i.pravatar.cc/150?u=user-205',
          native_languages: ['fr'],
          target_languages: ['en'],
        },
      },
      {
        id: 'notif-6',
        recipient_id: 'me',
        actor_id: 'admin-001',
        type: 'system',
        message: 'Welcome to HelloTalk! Your unified notifications area is ready.',
        is_read: false,
        created_at: new Date(Date.now() - 15 * 60 * 1000).toISOString(),
        actor: {
          id: 'admin-001',
          display_name: 'HelloTalk Team',
          avatar_url: 'https://i.pravatar.cc/150?u=admin-001',
          native_languages: ['en'],
          target_languages: [],
        },
      },
    ];

    if (!type || type === 'all') return mocks;
    if (type === 'likes')
      return mocks.filter((n) => n.type === 'like_profile' || n.type === 'like_moment');
    if (type === 'comments')
      return mocks.filter(
        (n) =>
          n.type === 'comment_moment' || n.type === 'reply_comment' || n.type === 'mention_comment',
      );
    if (type === 'follows') return mocks.filter((n) => n.type === 'follow');
    return mocks;
  }
}
