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

      await this.notificationsService.sendPushNotification(event.momentAuthorId, {
        type: 'moment_comment',
        title: commenterName,
        body: preview
          ? `commented: "${preview}"`
          : 'commented on your moment',
        data: {
          moment_id: event.momentId,
          sender_id: event.commenterId,
          sender_name: commenterName,
          sender_avatar: commenter.avatar_url || '',
        },
      });
    } catch (err) {
      console.error('Comment notification listener error:', err);
    }
  }
}
