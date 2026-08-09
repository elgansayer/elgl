import { Controller, Post, HttpCode, Body } from '@nestjs/common';
import { PinoLogger, InjectPinoLogger } from 'nestjs-pino';
import { AppleNotificationService } from './apple-notification.service';

@Controller('monetisation/webhooks/apple')
export class AppleNotificationController {
  constructor(
    @InjectPinoLogger(AppleNotificationController.name)
    private readonly logger: PinoLogger,
    private readonly appleNotificationService: AppleNotificationService,
  ) {}

  @Post()
  @HttpCode(200)
  async handleNotification(@Body() payload: unknown) {
    this.logger.info('Received Apple App Store Server Notification v2');
    return await this.appleNotificationService.handleNotification(payload);
  }
}
