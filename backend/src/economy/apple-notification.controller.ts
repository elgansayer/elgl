import {
  Controller,
  Post,
  Body,
  Headers,
  HttpCode,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { AppleNotificationService } from './apple-notification.service';

@Controller('economy/apple-notifications')
export class AppleNotificationController {
  private readonly logger = new Logger(AppleNotificationController.name);

  constructor(
    private readonly appleNotificationService: AppleNotificationService,
  ) {}

  /**
   * Apple App Store Server-to-Server Notification endpoint.
   * Apple sends signed JWS payloads to this URL.
   *
   * IMPORTANT: This endpoint must be publicly accessible (no auth guard)
   * because Apple calls it directly. Security is ensured via JWS signature verification.
   */
  @Post()
  @HttpCode(HttpStatus.OK)
  handleNotification(@Body() body: { signedPayload: string }): {
    status: string;
  } {
    this.logger.log('Received Apple server notification');

    if (!body.signedPayload) {
      this.logger.warn('Missing signedPayload in Apple notification');
      return { status: 'error' };
    }

    try {
      this.appleNotificationService.handleNotification(body.signedPayload);
      return { status: 'ok' };
    } catch (error) {
      this.logger.error(
        `Failed to process Apple notification: ${(error as Error).message}`,
      );
      // Always return 200 to Apple to prevent retries
      return { status: 'ok' };
    }
  }
}
