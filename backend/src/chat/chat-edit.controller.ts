import {
  Body,
  Controller,
  Param,
  Patch,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { User } from '@supabase/supabase-js';
import { CurrentUser } from '../auth/current-user.decorator';
import { SupabaseAuthGuard } from '../auth/supabase-auth.guard';
import { ChatService } from './chat.service';
import { EditMessageDto } from './dto/edit-message.dto';
import type { ChatMessage } from './interfaces/chat-message.interface';

/**
 * Mutation boundary for edits to already-sent chat messages.
 *
 * ChatService remains authoritative for ownership, room membership, message
 * type, edit-window enforcement, persistence and realtime publication. Keeping
 * this route in a small controller prevents future additions to the legacy
 * ChatController from accidentally dropping the edit endpoint again.
 */
@Controller('chat/messages')
@UseGuards(SupabaseAuthGuard)
export class ChatEditController {
  constructor(private readonly chatService: ChatService) {}

  @Patch(':messageId')
  @Throttle({ default: { limit: 20, ttl: 60000 } })
  async editMessage(
    @CurrentUser() user: User | null,
    @Param('messageId') messageId: string,
    @Body() dto: EditMessageDto,
  ): Promise<ChatMessage> {
    if (!user) {
      throw new UnauthorizedException('Authentication required');
    }

    return this.chatService.editMessage(user.id, messageId, dto);
  }
}
