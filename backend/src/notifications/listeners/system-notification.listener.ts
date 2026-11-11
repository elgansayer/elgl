import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { NotificationsService } from '../notifications.service';
import { SystemAlertEvent } from '../events/notification.events';

/** Keeps push bodies and inbox rows bounded regardless of the producer. */
export const MAX_SYSTEM_ALERT_LENGTH = 500;

/**
 * Truncates on code point boundaries so an emoji straddling the limit can never
 * leave a lone surrogate that the database or JSON transport would reject. The
 * code unit pre-slice keeps the work bounded for oversized producer input.
 */
function truncateToCodePoints(value: string, maxCodePoints: number): string {
  return Array.from(value.slice(0, maxCodePoints * 2))
    .slice(0, maxCodePoints)
    .join('');
}

@Injectable()
export class SystemNotificationListener {
  private readonly logger = new Logger(SystemNotificationListener.name);

  constructor(private readonly notificationsService: NotificationsService) {}

  @OnEvent('system.alert')
  async handleSystemAlert(payload: SystemAlertEvent): Promise<void> {
    const message =
      typeof payload.message === 'string'
        ? truncateToCodePoints(payload.message.trim(), MAX_SYSTEM_ALERT_LENGTH)
        : '';

    // An alert without a recipient or readable text cannot be shown, so reject
    // it instead of persisting an empty inbox row. Never log the payload: it
    // can contain account-specific text.
    if (!payload.recipientId || !message) {
      this.logger.warn('system_alert_rejected');
      return;
    }

    await this.notificationsService.createNotification(
      payload.recipientId,
      payload.recipientId,
      'system',
      payload.entityId,
      message,
    );
  }
}
