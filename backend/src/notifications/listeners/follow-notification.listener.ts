import { Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { NotificationsService } from '../notifications.service';
import { FollowEvent } from '../events/notification.events';

@Injectable()
export class FollowNotificationListener {
  constructor(private readonly notificationsService: NotificationsService) {}

  @OnEvent('user.followed')
  async handleFollow(payload: FollowEvent): Promise<void> {
    await this.notificationsService.createNotification(
      payload.followedUserId,
      payload.followerId,
      'follow',
    );
  }
}
