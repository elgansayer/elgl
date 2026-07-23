import { Controller, Post, Body, HttpCode, Logger } from '@nestjs/common';
import { AppleNotificationsService } from './apple-notifications.service';

@Controller('monetisation/apple-notifications')
export class AppleNotificationsController {
  private readonly logger = new Logger(AppleNotificationsController.name);

  constructor(
    private readonly appleNotificationsService: AppleNotificationsService,
  ) {}

  @Post()
  @HttpCode(200)
  async handleNotification(
    @Body() payload: { signedPayload: string },
  ): Promise<{ status: string }> {
    this.logger.log('Received Apple server notification');

    try {
      await this.appleNotificationsService.handleNotification(payload);
      return { status: 'ok' };
    } catch (error) {
      this.logger.error('Failed to process Apple notification', error);
      // Always return 200 to prevent Apple from retrying
      return { status: 'error' };
    }
  }
}
