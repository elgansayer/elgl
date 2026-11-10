import {
  Controller,
  Get,
  Post,
  Body,
  HttpException,
  HttpStatus,
  UseGuards,
} from '@nestjs/common';
import { User } from '@supabase/supabase-js';
import { AiConversationService } from './ai-conversation.service';
import { CurrentUser } from '../auth/current-user.decorator';
import { SupabaseAuthGuard } from '../auth/supabase-auth.guard';
import { AiConversationMessageDto } from './dto/ai-conversation-message.dto';

@Controller('ai-conversation')
export class AiConversationController {
  constructor(private readonly aiConversationService: AiConversationService) {}

  @Get('scenarios')
  getScenarios() {
    return this.aiConversationService.getScenarios();
  }

  @UseGuards(SupabaseAuthGuard)
  @Post('message')
  async handleMessage(
    @CurrentUser() user: User | null,
    @Body() dto: AiConversationMessageDto,
  ): Promise<{ reply: string }> {
    if (!user) {
      throw new HttpException('Unauthorized', HttpStatus.UNAUTHORIZED);
    }

    if (!dto.message || dto.message.trim().length === 0) {
      return { reply: 'Please say something first!' };
    }

    const allowed = await this.aiConversationService.checkDailyAiRateLimit(
      user.id,
    );
    if (!allowed) {
      throw new HttpException(
        'Daily AI usage limit reached. Upgrade to VIP for unlimited access.',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    const reply = await this.aiConversationService.generateReply(
      user.id,
      dto.message,
      dto.scenarioId ?? undefined,
      dto.conversationHistory,
    );
    return { reply };
  }
}
