import { Controller, Post, Body, HttpCode, HttpStatus, Logger } from '@nestjs/common';
import { GooglePlayNotificationService } from './google-play-notification.service';

@Controller('economy/google-play-notifications')
export class GooglePlayNotificationController {
  private readonly logger = new Logger(GooglePlayNotificationController.name);

  constructor(
    private readonly googlePlayNotificationService: GooglePlayNotificationService,
  ) {}

  /**
   * Google Play Developer Notifications endpoint.
   * Google sends Pub/Sub messages to this URL.
   *
   * IMPORTANT: This endpoint must be publicly accessible (no auth guard)
   * because Google calls it directly. Security is ensured via Pub/Sub verification.
   */
  @Post()
  @HttpCode(HttpStatus.OK)
  async handleNotification(
    @Body() body: any,
  ): Promise<{ status: string }> {
    this.logger.log('Received Google Play notification');

    try {
      await this.googlePlayNotificationService.handleNotification(body);
      return { status: 'ok' };
    } catch (error) {
      this.logger.error(
        `Failed to process Google Play notification: ${(error as Error).message}`,
      );
      // Always return 200 to Google to prevent retries
      return { status: 'ok' };
    }
  }
}
