import { Injectable, Logger } from '@nestjs/common';
import { CentrifugoService } from '../chat/services/centrifugo.service';
import { SendSystemMessageDto } from './dto/send-system-message.dto';

@Injectable()
export class SystemMessageService {
  private readonly logger = new Logger(SystemMessageService.name);

  constructor(private readonly centrifugo: CentrifugoService) {}

  async publish(dto: SendSystemMessageDto): Promise<void> {
    const targetChannel =
      dto.channel ??
      (dto.targetUserId ? `user_${dto.targetUserId}` : 'global_announcements');

    const payload = {
      type: 'system_message',
      text: dto.text,
      i18nKey: dto.i18nKey ?? null,
      i18nArgs: dto.i18nArgs ?? null,
    };

    this.logger.log(`Publishing system message to channel "${targetChannel}"`);
    await this.centrifugo.publish(targetChannel, payload);
  }
}
