import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { User } from '@supabase/supabase-js';
import { CurrentUser } from '../auth/current-user.decorator';
import { SupabaseAuthGuard } from '../auth/supabase-auth.guard';
import { DirectChatService } from './direct-chat.service';
import { OpenDirectChatDto } from './dto/open-direct-chat.dto';

@Controller('chat/direct-rooms')
@UseGuards(SupabaseAuthGuard)
export class DirectChatController {
  constructor(private readonly directChatService: DirectChatService) {}

  @Post()
  @Throttle({ default: { limit: 20, ttl: 60000 } })
  async openDirectChat(
    @CurrentUser() user: User | null,
    @Body() dto: OpenDirectChatDto,
  ): Promise<{ room_id: string } | null> {
    if (!user) return null;
    return this.directChatService.openDirectChat(user.id, dto.partnerId);
  }
}
