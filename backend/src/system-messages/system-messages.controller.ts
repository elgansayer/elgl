import { Controller, Post, Body } from '@nestjs/common';
import { SystemMessagesService } from './system-messages.service';
import { SendSystemBroadcastDto } from './dto/send-system-broadcast.dto';

@Controller('system-messages')
export class SystemMessagesController {
  constructor(
    private readonly systemMessagesService: SystemMessagesService,
  ) {}

  @Post('send')
  async send(@Body() dto: SendSystemBroadcastDto) {
    const payload: Record<string, any> = {
      type: 'system',
      i18nKey: dto.i18nKey ?? null,
      params: dto.params ?? {},
      text: dto.text ?? null,
    };
    await this.systemMessagesService.sendToUser(dto.target_user_id, payload);
    return { success: true };
  }
}
