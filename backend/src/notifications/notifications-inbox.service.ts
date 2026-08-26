import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { GetNotificationsQueryDto, NotificationFilter } from './dto/get-notifications-query.dto';
import { NotificationDto } from './dto/notification.dto';

const FILTER_TYPES: Record<Exclude<NotificationFilter, 'all'>, NotificationDto['type'][]> = {
  likes: ['like_profile', 'like_moment'],
  comments: ['comment_moment', 'reply_comment', 'mention_comment'],
  follows: ['follow'],
  system: ['system'],
};

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
      throw new ServiceUnavailableException('Notifications are temporarily unavailable');
    }

    return (data ?? []) as NotificationDto[];
  }

  async getUnreadCount(recipientId: string): Promise<{ unreadCount: number }> {
    const supabase = this.supabaseService.getClient();
    const { count, error } = await supabase
      .from('notifications')
      .select('id', { count: 'exact', head: true })
      .eq('recipient_id', recipientId)
      .eq('is_read', false);

    if (error) {
      this.logger.warn('notifications_inbox.unread_count_failed');
      throw new ServiceUnavailableException('Notification count is temporarily unavailable');
    }

    const unreadCount = Number.isSafeInteger(count) && (count ?? 0) > 0 ? (count as number) : 0;
    return { unreadCount };
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
      throw new ServiceUnavailableException('Notification could not be updated');
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
      throw new ServiceUnavailableException('Notifications could not be updated');
    }
  }
}
