import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { User } from '@supabase/supabase-js';
import { CurrentUser } from '../auth/current-user.decorator';
import { SupabaseAuthGuard } from '../auth/supabase-auth.guard';
import { ChatService } from './chat.service';
import { SearchMessagesQueryDto } from './dto/search-messages-query.dto';
import type { ChatMessage } from './interfaces/chat-message.interface';

@Controller('chat/search')
@UseGuards(SupabaseAuthGuard)
export class ChatSearchController {
  constructor(private readonly chatService: ChatService) {}

  @Get()
  @Throttle({ default: { limit: 30, ttl: 60000 } })
  async searchMessages(
    @CurrentUser() user: User | null,
    @Query() query: SearchMessagesQueryDto,
  ): Promise<ChatMessage[]> {
    if (!user) return [];

    return this.chatService.searchAllMessages(
      user.id,
      query.term,
      query.limit,
      query.roomId,
    );
  }
}
