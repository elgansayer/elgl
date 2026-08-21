import { Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { NotificationsService } from '../notifications.service';
import { LikeEvent } from '../events/notification.events';

@Injectable()
export class LikeNotificationListener {
  constructor(private readonly notificationsService: NotificationsService) {}

  @OnEvent('user.liked')
  async handleLike(payload: LikeEvent): Promise<void> {
    const type =
      payload.targetType === 'profile' ? 'like_profile' : 'like_moment';
    await this.notificationsService.createNotification(
      payload.targetUserId,
      payload.actorId,
      type,
      payload.targetId,
    );
  }
}
