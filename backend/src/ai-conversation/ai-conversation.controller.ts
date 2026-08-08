import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { AiConversationService } from './ai-conversation.service';
import { SupabaseAuthGuard } from '../auth/supabase-auth.guard';

@Controller('ai-conversation')
@UseGuards(SupabaseAuthGuard)
export class AiConversationController {
  constructor(private readonly aiConversationService: AiConversationService) {}

  @Get('scenarios')
  getScenarios() {
    return this.aiConversationService.getScenarios();
  }

  @Post('message')
  async handleMessage(
    @Body()
    dto: {
      message: string;
      scenarioId?: string;
      conversationHistory?: { role: 'user' | 'assistant'; content: string }[];
    },
  ): Promise<{ reply: string }> {
    if (!dto.message || dto.message.trim().length === 0) {
      return { reply: 'Please say something first!' };
    }
    const reply = await this.aiConversationService.generateReply(
      dto.message,
      dto.scenarioId,
      dto.conversationHistory,
    );
    return { reply };
  }
}
