import { Injectable, Logger } from '@nestjs/common';
import { CentrifugoService } from '../chat/services/centrifugo.service';
import { SystemEventPayload } from './interfaces/system-event.interface';

@Injectable()
export class SystemMessagesService {
  private readonly logger = new Logger(SystemMessagesService.name);

  constructor(private readonly centrifugo: CentrifugoService) {}

  /**
   * Sends a system message to a user's personal Centrifugo channel.
   *
   * @param userId - UUID of the recipient user.
   * @param event  - The system event to send (type + optional payload).
   */
  async sendToUser(userId: string, event: SystemEventPayload): Promise<void> {
    const channel = `user_${userId}`;
    const message = {
      type: 'system',
      system_event: event,
      created_at: new Date().toISOString(),
    };
    await this.centrifugo.publish(channel, message);
    this.logger.log(
      `System message sent to user ${userId}, type ${event.type}`,
    );
  }
}
