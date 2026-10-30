import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { UnreadCountsChangedEvent } from '../../notifications/events/notification.events';
import { CentrifugoService } from '../centrifugo.service';

@Injectable()
export class PersonalUnreadListener {
  private readonly logger = new Logger(PersonalUnreadListener.name);

  constructor(private readonly centrifugoService: CentrifugoService) {}

  @OnEvent('unread.counts_changed', { async: true })
  async handleCountsChanged(event: UnreadCountsChangedEvent): Promise<void> {
    const published = await this.centrifugoService.publish(
      `user_${event.recipientId}`,
      {
        type: 'unread_counts_changed',
        source: event.source,
      },
    );

    if (!published) {
      this.logger.warn(
        { source: event.source },
        'Personal unread invalidation was not published',
      );
    }
  }
}
