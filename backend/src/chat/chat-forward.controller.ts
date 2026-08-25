import {
  Body,
  Controller,
  Param,
  ParseUUIDPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { User } from '@supabase/supabase-js';
import { CurrentUser } from '../auth/current-user.decorator';
import { SupabaseAuthGuard } from '../auth/supabase-auth.guard';
import { ChatService } from './chat.service';
import { ForwardMessageDto } from './dto/forward-message.dto';
import type { ChatMessage } from './interfaces/chat-message.interface';

/**
 * Keeps the forwarding API isolated from the already-large general chat
 * controller. ChatService remains authoritative for source-room access,
 * destination membership, block policy, persistence and realtime delivery.
 */
@Controller('chat')
@UseGuards(SupabaseAuthGuard)
export class ChatForwardController {
  constructor(private readonly chatService: ChatService) {}

  @Post('messages/:messageId/forward')
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  async forwardMessage(
    @CurrentUser() user: User | null,
    @Param('messageId', new ParseUUIDPipe({ version: '4' })) messageId: string,
    @Body() dto: ForwardMessageDto,
  ): Promise<ChatMessage[] | null> {
    if (!user) return null;

    return await this.chatService.forwardMessage(user.id, messageId, dto.room_ids);
  }
}
