import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { SystemMessageService } from '../services/system-message.service';

@Injectable()
export class ChatSystemEventListener {
  constructor(private readonly systemMessageService: SystemMessageService) {}

  @OnEvent('profile.updated', { async: true })
  async handleProfileUpdated(payload: { userId: string }): Promise<void> {
    Logger.log(
      `Broadcasting profile.updated system event for user ${payload.userId}`,
      'ChatSystemEventListener',
    );
    await this.systemMessageService.publishToAllUserRooms(
      payload.userId,
      'profileUpdated',
    );
  }

  @OnEvent('call.missed', { async: true })
  async handleCallMissed(payload: {
    callerId: string;
    calleeId: string;
    isVideo: boolean;
  }): Promise<void> {
    Logger.log(
      `Broadcasting missedCall system event from ${payload.callerId} to ${payload.calleeId}`,
      'ChatSystemEventListener',
    );
    await this.systemMessageService.publishToDirectRoom(
      payload.callerId,
      payload.calleeId,
      'missedCall',
      { isVideo: payload.isVideo },
    );
  }
}
