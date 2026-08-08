import {
  BadRequestException,
  Controller,
  Get,
  Post,
  Body,
  UseGuards,
} from '@nestjs/common';
import { User } from '@supabase/supabase-js';
import { AiConversationService } from './ai-conversation.service';
import { CurrentUser } from '../auth/current-user.decorator';
import { SupabaseAuthGuard } from '../auth/supabase-auth.guard';
import { UsersService } from '../users/users.service';

@Controller('ai-conversation')
@UseGuards(SupabaseAuthGuard)
export class AiConversationController {
  constructor(
    private readonly aiConversationService: AiConversationService,
    private readonly usersService: UsersService,
  ) {}

  @Get('scenarios')
  getScenarios() {
    return this.aiConversationService.getScenarios();
  }

  @Post('message')
  async handleMessage(
    @CurrentUser() user: User | null,
    @Body()
    dto: {
      message: string;
      scenarioId?: string;
      conversationHistory?: { role: 'user' | 'assistant'; content: string }[];
    },
  ): Promise<{ reply: string }> {
    if (!user) return { reply: 'Authentication required.' };
    if (!dto.message || dto.message.trim().length === 0) {
      return { reply: 'Please say something first!' };
    }

    const profile = await this.usersService.getProfile(user.id);
    const isVip = profile?.is_vip ?? false;

    if (!isVip) {
      throw new BadRequestException(
        'AI conversation is a VIP benefit. Upgrade to Consumer VIP (8 UKP / $10 USD per month or 6 UKP / $8 USD annual equivalent) for unlimited AI conversations, 3 target languages, location spoofing, and incognito profile views.',
      );
    }

    const reply = await this.aiConversationService.generateReply(
      dto.message,
      dto.scenarioId,
      dto.conversationHistory,
    );
    return { reply };
  }
}
