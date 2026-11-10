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

  @OnEvent('user.liked')
  async handleLike(payload: LikeEvent): Promise<void> {
    const recipientId = payload.targetUserId;
    if (!recipientId || recipientId === payload.actorId) return;

    const type =
      payload.targetType === 'profile' ? 'like_profile' : 'like_moment';

    let shouldPush: boolean;
    let shouldInApp: boolean;
    try {
      shouldPush =
        await this.notificationPreferencesService.shouldSendNotification(
          recipientId,
          'moment_like',
          'push',
        );
      shouldInApp =
        await this.notificationPreferencesService.shouldSendNotification(
          recipientId,
          'moment_like',
          'in_app',
        );
    } catch {
      // Preferences are a privacy boundary: fail closed when they cannot be
      // read, and keep user identifiers out of the diagnostic.
      this.logger.warn('like_preferences_unavailable');
      return;
    }
    if (!shouldPush && !shouldInApp) return;

    // Like toggling is user-triggered: like, unlike, like must not re-notify
    // (or re-push) the author for the same actor and target.
    if (
      await this.notificationsService.hasNotification(
        recipientId,
        payload.actorId,
        type,
        payload.targetId,
      )
    ) {
      return;
    }

    // The in-app row is created without its built-in push so the explicit,
    // preference-gated push below is the only dispatch.
    if (shouldInApp) {
      await this.notificationsService.createNotification(
        recipientId,
        payload.actorId,
        type,
        payload.targetId,
        undefined,
        false,
      );
    }

    if (shouldPush) {
      await this.notificationsService.sendPushNotification(recipientId, {
        type,
        title:
          payload.targetType === 'profile' ? 'Profile Liked' : 'Moment Liked',
        body:
          payload.targetType === 'profile'
            ? 'Someone liked your profile'
            : 'Someone liked your moment',
        data: {},
        category: 'likes',
      });
    }
  }
}
