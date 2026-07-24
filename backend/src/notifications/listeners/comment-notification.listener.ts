import { Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { NotificationsService } from '../notifications.service';
import { SupabaseService } from '../../supabase/supabase.service';
import { MomentCommentEvent } from '../events/notification.events';

@Injectable()
export class CommentNotificationListener {
  constructor(
    private readonly notificationsService: NotificationsService,
    private readonly supabaseService: SupabaseService,
  ) {}

  @OnEvent('moment.comment')
  async handleMomentComment(event: MomentCommentEvent): Promise<void> {
    if (event.commenterId === event.momentAuthorId) return;

    try {
      const supabase = this.supabaseService.getClient();
      const { data: commenter } = await supabase
        .from('users')
        .select('display_name, avatar_url')
        .eq('id', event.commenterId)
        .single();

      if (!commenter) return;

      const commenterName = commenter.display_name || 'Someone';
      const preview = event.commentPreview
        ? event.commentPreview.substring(0, 100)
        : '';

      if (event.replyToUserId && event.replyToUserId !== event.commenterId) {
        await this.notificationsService.createNotification(
          event.replyToUserId,
          event.commenterId,
          'reply_comment',
          event.momentId,
          preview,
        );
      }

      if (
        event.momentAuthorId !== event.commenterId &&
        event.momentAuthorId !== event.replyToUserId
      ) {
        await this.notificationsService.createNotification(
          event.momentAuthorId,
          event.commenterId,
          'comment_moment',
          event.momentId,
          preview,
        );
      }
    } catch (err) {
      console.error('Comment notification listener error:', err);
    }
  }
}
