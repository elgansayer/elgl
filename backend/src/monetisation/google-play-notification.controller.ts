import { Controller, Post, HttpCode, Body, Headers } from '@nestjs/common';
import { PinoLogger, InjectPinoLogger } from 'nestjs-pino';
import { GooglePlayNotificationService } from './google-play-notification.service';

@Controller('monetisation/webhooks/google')
export class GooglePlayNotificationController {
  constructor(
    @InjectPinoLogger(GooglePlayNotificationController.name)
    private readonly logger: PinoLogger,
    private readonly googlePlayNotificationService: GooglePlayNotificationService,
  ) {}

  @Post()
  @HttpCode(200)
  async handleNotification(
    @Body() payload: unknown,
    @Headers('authorization') authorization?: string,
  ) {
    this.logger.info('Received Google Play Developer Notification');
    return await this.googlePlayNotificationService.handleNotification(
      payload,
      authorization,
    );
  }
}
