import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { SupabaseService } from '../supabase/supabase.service';
import { NotificationPreferencesService } from './notification-preferences.service';
import { NotificationDto } from './dto/notification.dto';
import { UnreadCountsChangedEvent } from './events/notification.events';

type FirebaseAdmin = any;

export type PushDispatchResult = 'sent' | 'suppressed' | 'retry';

const LEGACY_PUSH_CATEGORY = {
  direct_messages: 'new_message',
  groups: 'moment_comment',
  likes: 'moment_like',
  voice_rooms: 'audio_room_invite',
} as const;

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    private readonly configService: ConfigService,
    private readonly supabaseService: SupabaseService,
    private readonly eventEmitter: EventEmitter2,
    private readonly preferencesService: NotificationPreferencesService,
  ) {}

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
        const richCategory = LEGACY_PUSH_CATEGORY[payload.category];
        const prefs = await this.preferencesService.getPreferences(userId);
        pushEnabled = await this.preferencesService.shouldSendNotification(
          userId,
          richCategory,
          'push',
        );
        badgeEnabled = prefs[richCategory]?.badges ?? true;
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
    dispatchPush = true,
  ): Promise<void> {
    // System alerts are platform-generated and have no human actor. The
    // notifications.actor_id column is a required foreign key to users, so the
    // alert is attributed to the recipient's own row and clients never render
    // an actor for the system type. Every social type still rejects self-actions.
    const isSystemAlert = type === 'system';
    if (!isSystemAlert && recipientId === actorId) return;
    const persistedActorId = isSystemAlert ? recipientId : actorId;

    try {
      const supabase = this.supabaseService.getClient();
      const { error } = await supabase.from('notifications').insert({
        recipient_id: recipientId,
        actor_id: persistedActorId,
        type,
        entity_id: entityId,
        message,
        is_read: false,
      });
      if (error) {
        this.logger.warn(
          { type },
          'Notification persistence failed before unread invalidation',
        );
        return;
      }

      // Chat messages already invalidate the chat counter through the durable
      // chat.message event, so their mirrored inbox row must not double count.
      if (type !== 'mention_chat') {
        this.eventEmitter.emit(
          'unread.counts_changed',
          new UnreadCountsChangedEvent(recipientId, 'notifications'),
        );
      }

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

      if (dispatchPush) {
        await this.sendPushNotification(recipientId, {
          type,
          title: titleMap[type] || 'New Notification',
          body: bodyMap[type] || 'You have a new alert',
          data: {
            actorId: isSystemAlert ? '' : actorId,
            entityId: entityId || '',
          },
          category: pushCategory,
        });
      }
    } catch (err) {
      console.error(`Failed to create notification for ${recipientId}:`, err);
    }
  }

  /**
   * Reports whether the recipient already has a notification for the same
   * actor, type and entity. Used to keep toggle-style actions (like, unlike,
   * like) from re-notifying. Fails open: a lookup failure must not suppress a
   * genuine first notification.
   */
  async hasNotification(
    recipientId: string,
    actorId: string,
    type: NotificationDto['type'],
    entityId?: string,
  ): Promise<boolean> {
    try {
      let query = this.supabaseService
        .getClient()
        .from('notifications')
        .select('id')
        .eq('recipient_id', recipientId)
        .eq('actor_id', actorId)
        .eq('type', type);
      query = entityId
        ? query.eq('entity_id', entityId)
        : query.is('entity_id', null);

      const { data, error } = await query.limit(1);
      if (error) {
        this.logger.warn({ type }, 'Notification duplicate lookup failed');
        return false;
      }
      return Array.isArray(data) && data.length > 0;
    } catch {
      this.logger.warn({ type }, 'Notification duplicate lookup failed');
      return false;
    }
  }
}
