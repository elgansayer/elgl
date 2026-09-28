import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { SupabaseService } from '../../supabase/supabase.service';
import { SystemMessageService } from '../services/system-message.service';

const MAX_SYSTEM_DISPLAY_NAME_LENGTH = 80;

@Injectable()
export class ChatSystemEventListener {
  private readonly logger = new Logger(ChatSystemEventListener.name);

  constructor(
    private readonly systemMessageService: SystemMessageService,
    private readonly supabaseService: SupabaseService,
  ) {}

  private async resolveDisplayName(
    userId: string,
  ): Promise<string | undefined> {
    try {
      const { data, error } = await this.supabaseService
        .getClient()
        .from('users')
        .select('display_name')
        .eq('id', userId)
        .maybeSingle();

      if (error || !data || typeof data.display_name !== 'string') {
        if (error) {
          this.logger.warn('Unable to resolve display name for system event');
        }
        return undefined;
      }

      const displayName = data.display_name.trim();
      return displayName
        ? displayName.slice(0, MAX_SYSTEM_DISPLAY_NAME_LENGTH)
        : undefined;
    } catch {
      this.logger.warn('Unable to resolve display name for system event');
      return undefined;
    }
  }

  @OnEvent('profile.updated', { async: true })
  async handleProfileUpdated(payload: { userId: string }): Promise<void> {
    const name = await this.resolveDisplayName(payload.userId);
    this.logger.log('Broadcasting profile.updated system event');

    await this.systemMessageService.publishToAllUserRooms(
      payload.userId,
      'profileUpdated',
      name ? { name } : {},
    );
  }

  @OnEvent('call.missed', { async: true })
  async handleCallMissed(payload: {
    callerId: string;
    calleeId: string;
    isVideo: boolean;
  }): Promise<void> {
    const name = await this.resolveDisplayName(payload.callerId);
    this.logger.log('Broadcasting missedCall system event');

    await this.systemMessageService.publishToDirectRoom(
      payload.callerId,
      payload.calleeId,
      'missedCall',
      {
        isVideo: payload.isVideo,
        ...(name ? { name } : {}),
      },
    );
  }
}
