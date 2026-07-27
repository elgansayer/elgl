import { Injectable } from '@nestjs/common';
import { CentrifugoService } from './centrifugo.service';

export interface SystemMessageEvent {
  event_type: string;
  [key: string]: any;
}

@Injectable()
export class SystemMessageService {
  constructor(private readonly centrifugoService: CentrifugoService) {}

  async publishSystemMessage(
    roomId: string,
    senderId: string,
    event: SystemMessageEvent,
  ) {
    const channel = `room_${roomId}`;
    const message = {
      id: `sys_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      room_id: roomId,
      sender_id: senderId,
      message_type: 'system',
      system_event: {
        type: event.event_type,
        ...event,
      },
      is_read: false,
      created_at: new Date().toISOString(),
    };

    await this.centrifugoService.publish(channel, message);
  }
}
