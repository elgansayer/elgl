import { Controller, Post, HttpCode, Body, Logger } from '@nestjs/common';
import { AppleNotificationService } from './apple-notification.service';

@Controller('monetisation/webhooks/apple')
export class AppleNotificationController {
  private readonly logger = new Logger(AppleNotificationController.name);

  constructor(
    private readonly appleNotificationService: AppleNotificationService,
  ) {}

  @Post()
  @HttpCode(200)
  async handleNotification(@Body() payload: unknown) {
    this.logger.log('Received Apple App Store Server Notification v2');
    return await this.appleNotificationService.handleNotification(payload);
  }
}
