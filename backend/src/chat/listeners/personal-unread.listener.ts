import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { PersonalUnreadEvent } from '../../notifications/events/notification.events';
import { CentrifugoService } from '../centrifugo.service';

@Injectable()
export class PersonalUnreadListener {
  private readonly logger = new Logger(PersonalUnreadListener.name);

  constructor(private readonly centrifugoService: CentrifugoService) {}

  @OnEvent('unread.created', { async: true })
  async handleUnreadCreated(event: PersonalUnreadEvent): Promise<void> {
    const published = await this.centrifugoService.publish(
      `user_${event.recipientId}`,
      {
        type: 'unread_count_changed',
        tab: event.tab,
      },
    );

    if (!published) {
      this.logger.warn(
        { tab: event.tab },
        'Personal unread update was not published',
      );
    }
  }
}
