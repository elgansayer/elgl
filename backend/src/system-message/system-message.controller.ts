import { Body, Controller, Post } from '@nestjs/common';
import { SystemMessageService } from './system-message.service';
import { SendSystemMessageDto } from './dto/send-system-message.dto';

@Controller('system-message')
export class SystemMessageController {
  constructor(private readonly systemMessageService: SystemMessageService) {}

  @Post('announce')
  async announce(@Body() dto: SendSystemMessageDto) {
    await this.systemMessageService.publish(dto);
    return { success: true };
  }
}
