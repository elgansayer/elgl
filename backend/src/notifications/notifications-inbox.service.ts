import {
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import {
  GetNotificationsQueryDto,
  NotificationFilter,
} from './dto/get-notifications-query.dto';
import { NotificationDto } from './dto/notification.dto';

const FILTER_TYPES: Record<
  Exclude<NotificationFilter, 'all'>,
  NotificationDto['type'][]
> = {
  likes: ['like_profile', 'like_moment'],
  comments: ['comment_moment', 'reply_comment', 'mention_comment'],
  follows: ['follow'],
  system: ['system'],
};

export interface NotificationUnreadCounts {
  unreadCount: number;
  byTab: {
    moments: number;
    discovery: number;
    profile: number;
  };
}

const MOMENTS_NOTIFICATION_TYPES: NotificationDto['type'][] = [
  'like_moment',
  'comment_moment',
  'reply_comment',
  'mention_comment',
];
const DISCOVERY_NOTIFICATION_TYPES: NotificationDto['type'][] = [
  'follow',
  'like_profile',
  'profile_visit',
];
const PROFILE_NOTIFICATION_TYPES: NotificationDto['type'][] = ['system'];

@Injectable()
export class NotificationsInboxService {
  private readonly logger = new Logger(NotificationsInboxService.name);

  constructor(private readonly supabaseService: SupabaseService) {}

  async getNotifications(
    recipientId: string,
    options: GetNotificationsQueryDto = {},
  ): Promise<NotificationDto[]> {
    const filter = options.type ?? 'all';
    const limit = options.limit ?? 20;
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

    if (filter !== 'all') {
      query = query.in('type', FILTER_TYPES[filter]);
    }
    if (options.before) {
      query = query.lt('created_at', options.before);
    }

    const { data, error } = await query
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      this.logger.warn('notifications_inbox.list_failed');
      throw new ServiceUnavailableException(
        'Notifications are temporarily unavailable',
      );
    }

    return (data ?? []) as NotificationDto[];
  }

  async getUnreadCount(recipientId: string): Promise<NotificationUnreadCounts> {
    const [all, moments, discovery, profile] = await Promise.all([
      this.countUnread(recipientId),
      this.countUnread(recipientId, MOMENTS_NOTIFICATION_TYPES),
      this.countUnread(recipientId, DISCOVERY_NOTIFICATION_TYPES),
      this.countUnread(recipientId, PROFILE_NOTIFICATION_TYPES),
    ]);

    if (
      [all, moments, discovery, profile].some((result) => result.error !== null)
    ) {
      this.logger.warn('notifications_inbox.unread_count_failed');
      throw new ServiceUnavailableException(
        'Notification count is temporarily unavailable',
      );
    }

    return {
      unreadCount: this.safeCount(all.count),
      byTab: {
        moments: this.safeCount(moments.count),
        discovery: this.safeCount(discovery.count),
        profile: this.safeCount(profile.count),
      },
    };
  }

  private countUnread(recipientId: string, types?: NotificationDto['type'][]) {
    let query = this.supabaseService
      .getClient()
      .from('notifications')
      .select('id', { count: 'exact', head: true })
      .eq('recipient_id', recipientId)
      .eq('is_read', false);
    if (types) query = query.in('type', types);
    return query;
  }

  private safeCount(count: number | null): number {
    return Number.isSafeInteger(count) && (count ?? 0) > 0 ? (count ?? 0) : 0;
  }

  async markAsRead(recipientId: string, notificationId: string): Promise<void> {
    const supabase = this.supabaseService.getClient();
    const { error } = await supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('id', notificationId)
      .eq('recipient_id', recipientId);

    if (error) {
      this.logger.warn('notifications_inbox.mark_read_failed');
      throw new ServiceUnavailableException(
        'Notification could not be updated',
      );
    }
  }

  async markAllAsRead(recipientId: string): Promise<void> {
    const supabase = this.supabaseService.getClient();
    const { error } = await supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('recipient_id', recipientId)
      .eq('is_read', false);

    if (error) {
      this.logger.warn('notifications_inbox.mark_all_read_failed');
      throw new ServiceUnavailableException(
        'Notifications could not be updated',
      );
    }
  }
}
