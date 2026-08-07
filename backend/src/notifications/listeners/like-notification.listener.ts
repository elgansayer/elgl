import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { NotificationsService } from '../notifications.service';
import { NotificationPreferencesService } from '../notification-preferences.service';
import { LikeEvent } from '../events/notification.events';

@Injectable()
export class LikeNotificationListener {
  private readonly logger = new Logger(LikeNotificationListener.name);

  constructor(
    private readonly notificationsService: NotificationsService,
    private readonly notificationPreferencesService: NotificationPreferencesService,
  ) {}

  @OnEvent('moment.like')
  async handleMomentLike(payload: LikeEvent): Promise<void> {
    const recipientId = payload.ownerId;

    await this.notificationsService.createNotification(
      recipientId,
      payload.actorId,
      'like_moment',
      payload.entityId,
    );

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
      this.logger.error(
        `Failed to check notification preferences for user ${recipientId}:`,
        err,
      );
    }

    const title = 'Moment Liked';
    const body = 'Someone liked your moment';
    await this.notificationsService.sendPushNotification(recipientId, {
      type: 'like_moment',
      title,
      body,
      data: { entityId: payload.entityId || '' },
      category: 'likes',
    });
  }

  @OnEvent('profile.like')
  async handleProfileLike(payload: LikeEvent): Promise<void> {
    const recipientId = payload.ownerId;

    await this.notificationsService.createNotification(
      recipientId,
      payload.actorId,
      'like_profile',
    );

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
      this.logger.error(
        `Failed to check notification preferences for user ${recipientId}:`,
        err,
      );
    }

    const title = 'Profile Liked';
    const body = 'Someone liked your profile';
    await this.notificationsService.sendPushNotification(recipientId, {
      type: 'like_profile',
      title,
      body,
      data: {},
      category: 'likes',
    });
  }
}