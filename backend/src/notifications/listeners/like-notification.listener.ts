import { Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { NotificationsService } from '../notifications.service';
import { NotificationPreferencesService } from '../notification-preferences.service';
import { LikeEvent } from '../events/notification.events';

@Injectable()
export class LikeNotificationListener {
  constructor(
    private readonly notificationsService: NotificationsService,
    private readonly notificationPreferencesService: NotificationPreferencesService,
  ) {}

  @OnEvent('moment.like')
  async handleMomentLike(payload: LikeEvent): Promise<void> {
    const recipientId = payload.ownerId;

    try {
      const shouldSend =
        await this.notificationPreferencesService.shouldSendNotification(
          recipientId,
          'moment_like',
          'push',
        );
      if (!shouldSend) {
        return;
      }
    } catch (err) {
      console.error(
        `Failed to check notification preferences for user ${recipientId}:`,
        err,
      );
    }

    await this.notificationsService.createNotification(
      recipientId,
      payload.actorId,
      'like_moment',
      payload.entityId,
    );
  }

  @OnEvent('profile.like')
  async handleProfileLike(payload: LikeEvent): Promise<void> {
    const recipientId = payload.ownerId;

    try {
      const shouldSend =
        await this.notificationPreferencesService.shouldSendNotification(
          recipientId,
          'moment_like',
          'push',
        );
      if (!shouldSend) {
        return;
      }
    } catch (err) {
      console.error(
        `Failed to check notification preferences for user ${recipientId}:`,
        err,
      );
    }

    await this.notificationsService.createNotification(
      recipientId,
      payload.actorId,
      'like_profile',
    );
  }
}