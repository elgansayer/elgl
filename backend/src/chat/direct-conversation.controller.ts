import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { User } from '@supabase/supabase-js';
import { CurrentUser } from '../auth/current-user.decorator';
import { SupabaseAuthGuard } from '../auth/supabase-auth.guard';
import { DirectConversationService } from './direct-conversation.service';
import { OpenDirectConversationDto } from './dto/open-direct-conversation.dto';

@Controller('chat/direct')
@UseGuards(SupabaseAuthGuard)
export class DirectConversationController {
  constructor(
    private readonly directConversationService: DirectConversationService,
  ) {}

  @Post()
  @Throttle({ default: { limit: 20, ttl: 60000 } })
  async openOrCreate(
    @CurrentUser() user: User,
    @Body() dto: OpenDirectConversationDto,
  ): Promise<{ room_id: string }> {
    return this.directConversationService.openOrCreate(
      user.id,
      dto.target_user_id,
    );
  }
}
