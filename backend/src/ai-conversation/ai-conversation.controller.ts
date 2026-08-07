import { Controller, Get, Post, Body } from '@nestjs/common';
import { AiConversationService } from './ai-conversation.service';

@Controller('ai-conversation')
export class AiConversationController {
  constructor(private readonly aiConversationService: AiConversationService) {}

  @Get('scenarios')
  getScenarios() {
    return this.aiConversationService.getScenarios();
  }

  @Post('message')
  handleMessage(@Body() dto: { message: string; scenarioId?: string }): {
    reply: string;
  } {
    if (!dto.message || dto.message.trim().length === 0) {
      return { reply: 'Please say something first!' };
    }
    const reply = this.aiConversationService.generateReply(
      dto.message,
      dto.scenarioId,
    );
    return { reply };
  }
}
