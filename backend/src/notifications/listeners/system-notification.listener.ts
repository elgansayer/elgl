import { Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { NotificationsService } from '../notifications.service';
import { SystemAlertEvent } from '../events/notification.events';

@Injectable()
export class SystemNotificationListener {
  constructor(private readonly notificationsService: NotificationsService) {}

  @OnEvent('system.alert')
  async handleSystemAlert(payload: SystemAlertEvent): Promise<void> {
    await this.notificationsService.createNotification(
      payload.recipientId,
      payload.actorId ?? 'system',
      'system',
      payload.entityId,
      payload.message,
    );
  }
}
