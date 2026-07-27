import { Injectable, Logger } from '@nestjs/common';
import { CentrifugoService } from '../chat/services/centrifugo.service';

@Injectable()
export class SystemMessagesService {
  private readonly logger = new Logger(SystemMessagesService.name);

  constructor(private readonly centrifugo: CentrifugoService) {}

  /**
   * Publish a payload to the user's personal Centrifugo channel (`user_<id>`).
   */
  async sendToUser(
    userId: string,
    payload: Record<string, any>,
  ): Promise<void> {
    const channel = `user_${userId}`;
    await this.centrifugo.publish(channel, payload);
    this.logger.log(`System message sent to user ${userId}`);
  }
}
