import { Controller, Post, Body } from '@nestjs/common';
import { AiConversationService } from './ai-conversation.service';

@Controller('ai-conversation')
export class AiConversationController {
  constructor(private readonly aiConversationService: AiConversationService) {}

  @Post('message')
  async handleMessage(
    @Body() dto: { message: string },
  ): Promise<{ reply: string }> {
    if (!dto.message || dto.message.trim().length === 0) {
      return { reply: 'Please say something first!' };
    }
    const reply = this.aiConversationService.generateReply(dto.message);
    return { reply };
  }
}
