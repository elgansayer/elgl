import { Controller, Post, HttpCode, Body, Logger } from '@nestjs/common';
import { GooglePlayNotificationService } from './google-play-notification.service';

@Controller('monetisation/webhooks/google')
export class GooglePlayNotificationController {
  private readonly logger = new Logger(GooglePlayNotificationController.name);

  constructor(
    private readonly googlePlayNotificationService: GooglePlayNotificationService,
  ) {}

  @Post()
  @HttpCode(200)
  async handleNotification(@Body() payload: any) {
    this.logger.log('Received Google Play Developer Notification');
    return await this.googlePlayNotificationService.handleNotification(payload);
  }
}
