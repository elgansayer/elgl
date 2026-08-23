import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SupabaseService } from '../supabase/supabase.service';
import { UpdateNotificationPreferencesDto } from '../notification-preferences/dto/update-notification-preferences.dto';
import { NotificationDto } from './dto/notification.dto';

type FirebaseAdmin = any;

export interface LegacyPreferenceChannel {
  push: boolean;
  badge: boolean;
}

export interface LegacyNotificationPreferences {
  userId: string;
  direct_messages: LegacyPreferenceChannel;
  groups: LegacyPreferenceChannel;
  likes: LegacyPreferenceChannel;
  voice_rooms: LegacyPreferenceChannel;
  do_not_disturb: boolean;
  updatedAt: string;
}

export type PushDispatchResult = 'sent' | 'suppressed' | 'retry';

type UpdatePreferencesInput = Partial<
  Omit<LegacyNotificationPreferences, 'userId' | 'updatedAt'>
> &
  Partial<UpdateNotificationPreferencesDto>;

@Injectable()
export class NotificationsService {
  constructor(
    private readonly configService: ConfigService,
    private readonly supabaseService: SupabaseService,
  ) {}

  async getPreferences(userId: string): Promise<LegacyNotificationPreferences> {
    const supabase = this.supabaseService.getClient();
    const { data, error } = await supabase
      .from('notification_preferences')
      .select('preferences, updated_at')
      .eq('user_id', userId)
      .single();

    if (error || !data) {
      // Return sensible defaults
      return {
        userId,
        direct_messages: { push: true, badge: true },
        groups: { push: true, badge: true },
        likes: { push: true, badge: true },
        voice_rooms: { push: true, badge: true },
        do_not_disturb: false,
        updatedAt: new Date().toISOString(),
      };
    }

    const prefs: LegacyNotificationPreferences = {
      userId,
      ...(data.preferences as Omit<
        LegacyNotificationPreferences,
        'userId' | 'updatedAt'
      >),
      updatedAt: data.updated_at,
    };
    return prefs;
  }

  async updatePreferences(
    userId: string,
    preferences: UpdatePreferencesInput,
  ): Promise<void> {
    const supabase = this.supabaseService.getClient();
    const { error } = await supabase.from('notification_preferences').upsert(
      {
        user_id: userId,
        preferences: {
          direct_messages: preferences.direct_messages ?? {
            push: true,
            badge: true,
          },
          groups: preferences.groups ?? { push: true, badge: true },
          likes: preferences.likes ?? { push: true, badge: true },
          voice_rooms: preferences.voice_rooms ?? { push: true, badge: true },
          do_not_disturb: preferences.do_not_disturb ?? false,
        },
        updated_at: new Date().toISOString(),
      } as Record<string, unknown>,
      { onConflict: 'user_id' },
    );
    if (error) {
      throw new Error(
        `Failed to update notification preferences: ${error.message}`,
      );
    }
  }

  async sendPushNotification(
    userId: string,
    payload: {
      type: string;
      title: string;
      body: string;
      data?: Record<string, string>;
      category?: 'direct_messages' | 'groups' | 'likes' | 'voice_rooms';
    },
  ): Promise<PushDispatchResult> {
    try {
      // Respect per-category push toggle and badge toggle. Suppression is a
      // terminal outcome for callers such as event reminders: retrying a user
      // preference every minute would be both wasteful and surprising.
      let pushEnabled = true;
      let badgeEnabled = true;
      if (payload.category) {
        const prefs = await this.getPreferences(userId);
        const cat = prefs[payload.category];
        if (cat) {
          pushEnabled = cat.push;
          badgeEnabled = cat.badge;
        }
      }
      if (!pushEnabled) {
        console.log(
          `Push disabled for category '${payload.category}' for user ${userId}, skipping`,
        );
        return 'suppressed';
      }

      const supabase = this.supabaseService.getClient();
      const { data: tokens, error } = await supabase
        .from('user_push_tokens')
        .select('fcm_token')
        .eq('user_id', userId);

      if (error) {
        console.warn(`Could not load push tokens for user ${userId}`);
        return 'retry';
      }
      if (!tokens || tokens.length === 0) {
        console.warn(`No push tokens found for user ${userId}`);
        return 'suppressed';
      }

      const fcmTokens = tokens.map((t: { fcm_token: string }) => t.fcm_token);
      const badgeCount = badgeEnabled ? 1 : 0;
      const sent = await this.sendFcmBatch(fcmTokens, payload, badgeCount);
      return sent ? 'sent' : 'retry';
    } catch (err) {
      console.error(`Failed to send push notification to user ${userId}:`, err);
      return 'retry';
    }
  }

  private async sendFcmBatch(
    tokens: string[],
    payload: {
      type: string;
      title: string;
      body: string;
      data?: Record<string, string>;
    },
    badgeCount?: number,
  ): Promise<boolean> {
    let firebaseAdmin: FirebaseAdmin;
    try {
      firebaseAdmin = await import('firebase-admin');
    } catch {
      console.warn('firebase-admin not installed, skipping push notification');
      return false;
    }

    if (!firebaseAdmin.apps.length) {
      const serviceAccountStr = this.configService.get<string>(
        'FIREBASE_SERVICE_ACCOUNT',
      );
      if (serviceAccountStr) {
        try {
          const serviceAccount = JSON.parse(serviceAccountStr);
          firebaseAdmin.initializeApp({
            credential: firebaseAdmin.credential.cert(serviceAccount),
          });
        } catch {
          console.warn(
            'Invalid FIREBASE_SERVICE_ACCOUNT config, skipping push',
          );
          return false;
        }
      } else {
        console.warn('Firebase not configured, skipping push notification');
        return false;
      }
    }

    const message = {
      tokens,
      notification: {
        title: payload.title,
        body: payload.body,
      },
      data: {
        type: payload.type,
        ...(payload.data || {}),
      },
      android: {
        priority: 'high' as const,
        notification: {
          channelId: 'hellotalk_default',
          priority: 'high' as const,
        },
      },
      apns: {
        payload: {
          aps: {
            sound: 'default',
            badge: badgeCount ?? 1,
            contentAvailable: true,
          },
        },
      },
    };

    try {
      const response = await firebaseAdmin
        .messaging()
        .sendEachForMulticast(message);
      console.log(
        `FCM sent: ${response.successCount} success, ${response.failureCount} failures`,
      );

      if (response.failureCount > 0) {
        const invalidTokens: string[] = [];
        response.responses.forEach((resp: FirebaseAdmin, idx: number) => {
          if (
            resp.error &&
            (resp.error.code === 'messaging/invalid-registration-token' ||
              resp.error.code === 'messaging/registration-token-not-registered')
          ) {
            invalidTokens.push(tokens[idx]);
          }
        });

        if (invalidTokens.length > 0) {
          const supabase = this.supabaseService.getClient();
          await supabase
            .from('user_push_tokens')
            .delete()
            .in('fcm_token', invalidTokens);
        }
      }

      return response.successCount > 0;
    } catch (err) {
      console.error('FCM batch send failed:', err);
      return false;
    }
  }

  async createNotification(
    recipientId: string,
    actorId: string,
    type:
      | 'follow'
      | 'like_profile'
      | 'like_moment'
      | 'comment_moment'
      | 'reply_comment'
      | 'profile_visit'
      | 'mention_comment'
      | 'mention_chat'
      | 'system',
    entityId?: string,
    message?: string,
  ): Promise<void> {
    if (recipientId === actorId) return;

    try {
      const supabase = this.supabaseService.getClient();
      await supabase.from('notifications').insert({
        recipient_id: recipientId,
        actor_id: actorId,
        type,
        entity_id: entityId,
        message,
        is_read: false,
      });

      // Dispatch push alert as well
      const titleMap: Record<string, string> = {
        follow: 'New Follower',
        like_profile: 'Profile Liked',
        like_moment: 'Moment Liked',
        comment_moment: 'New Comment',
        reply_comment: 'New Reply',
        profile_visit: 'Profile Visited',
        mention_comment: 'Mentioned in Comment',
        mention_chat: 'Mentioned in Chat',
        system: 'System Alert',
      };
      const bodyMap: Record<string, string> = {
        follow: 'Someone started following you',
        like_profile: 'Someone liked your profile',
        like_moment: 'Someone liked your moment',
        comment_moment: message || 'Someone commented on your moment',
        reply_comment: message || 'Someone replied to your comment',
        profile_visit: 'Someone viewed your profile',
        mention_comment: message || 'Someone mentioned you in a comment',
        mention_chat: message || 'Someone mentioned you in a chat',
        system: message || 'You have a new system alert',
      };

      // Determine notification category for push-toggle check
      let pushCategory:
        'direct_messages' | 'groups' | 'likes' | 'voice_rooms' | undefined;
      switch (type) {
        case 'follow':
        case 'like_profile':
        case 'like_moment':
          pushCategory = 'likes';
          break;
        case 'comment_moment':
        case 'reply_comment':
        case 'mention_comment':
          pushCategory = 'groups';
          break;
        case 'mention_chat':
          pushCategory = 'direct_messages';
          break;
        default:
          // system / other – always send
          break;
      }

      await this.sendPushNotification(recipientId, {
        type,
        title: titleMap[type] || 'New Notification',
        body: bodyMap[type] || 'You have a new alert',
        data: { actorId, entityId: entityId || '' },
        category: pushCategory,
      });
    } catch (err) {
      console.error(`Failed to create notification for ${recipientId}:`, err);
    }
  }

  async getNotifications(
    recipientId: string,
    filterType?: string,
  ): Promise<NotificationDto[]> {
    const supabase = this.supabaseService.getClient();
    let query = supabase
      .from('notifications')
      .select(
        `
        id,
        recipient_id,
        actor_id,
        type,
        entity_id,
        message,
        is_read,
        created_at,
        actor:actor_id (
          id,
          display_name,
          avatar_url,
          native_languages,
          target_languages
        )
      `,
      )
      .eq('recipient_id', recipientId);

    if (filterType && filterType !== 'all') {
      if (filterType === 'likes') {
        query = query.in('type', ['like_profile', 'like_moment']);
      } else if (filterType === 'comments') {
        query = query.in('type', [
          'comment_moment',
          'reply_comment',
          'mention_comment',
        ]);
      } else if (filterType === 'follows') {
        query = query.eq('type', 'follow');
      } else if (filterType === 'system') {
        query = query.eq('type', 'system');
      }
    }

    const { data, error } = await query
      .order('created_at', { ascending: false })
      .limit(50);
    if (error || !data || data.length === 0) {
      return this.getMockNotifications(recipientId, filterType);
    }
    return data as NotificationDto[];
  }

  async getUnreadCount(recipientId: string): Promise<{ unreadCount: number }> {
    const supabase = this.supabaseService.getClient();
    const { count, error } = await supabase
      .from('notifications')
      .select('id', { count: 'exact', head: true })
      .eq('recipient_id', recipientId)
      .eq('is_read', false);

    if (error) {
      return { unreadCount: 2 };
    }
    return { unreadCount: count ?? 0 };
  }

  async markAsRead(recipientId: string, notificationId: string): Promise<void> {
    const supabase = this.supabaseService.getClient();
    await supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('id', notificationId)
      .eq('recipient_id', recipientId);
  }

  async markAllAsRead(recipientId: string): Promise<void> {
    const supabase = this.supabaseService.getClient();
    await supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('recipient_id', recipientId);
  }

  private getMockNotifications(
    recipientId: string,
    filterType?: string,
  ): any[] {
    const allMocks = [
      {
        id: 'notif-1',
        recipient_id: recipientId,
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
        recipient_id: recipientId,
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
        recipient_id: recipientId,
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
        recipient_id: recipientId,
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
        recipient_id: recipientId,
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
        recipient_id: recipientId,
        actor_id: 'admin-001',
        type: 'system',
        message:
          'Welcome to HelloTalk! Your unified notifications area is ready.',
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

    if (!filterType || filterType === 'all') return allMocks;
    if (filterType === 'likes')
      return allMocks.filter(
        (n) => n.type === 'like_profile' || n.type === 'like_moment',
      );
    if (filterType === 'comments')
      return allMocks.filter(
        (n) =>
          n.type === 'comment_moment' ||
          n.type === 'reply_comment' ||
          n.type === 'mention_comment',
      );
    if (filterType === 'follows')
      return allMocks.filter((n) => n.type === 'follow');
    return allMocks;
  }
}
