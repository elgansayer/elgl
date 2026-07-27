import { Injectable } from '@nestjs/common';
import { CentrifugoService } from '../centrifugo.service';
import { ChatMessage } from '../interfaces/chat-message.interface';

@Injectable()
export class SystemMessageService {
  constructor(private readonly centrifugoService: CentrifugoService) {}

  async publishToRoom(
    roomId: string,
    eventType: string,
    params: Record<string, unknown> = {},
  ): Promise<void> {
    const message: ChatMessage = {
      id: `sys_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
      room_id: roomId,
      sender_id: '',
      message_type: 'system',
      system_event: { type: eventType, ...params },
      is_read: false,
      created_at: new Date().toISOString(),
    };

    await this.centrifugoService.publish(`chat:${roomId}`, { message });
  }
}
