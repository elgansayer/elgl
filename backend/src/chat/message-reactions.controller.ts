import { Body, Controller, Get, Param, Put, UseGuards } from '@nestjs/common';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import { User } from '@supabase/supabase-js';
import { CurrentUser } from '../auth/current-user.decorator';
import { SupabaseAuthGuard } from '../auth/supabase-auth.guard';
import { SetMessageReactionDto } from './dto/message-reaction.dto';
import { MessageReactionsService } from './message-reactions.service';

@Controller('chat/messages')
@UseGuards(SupabaseAuthGuard, ThrottlerGuard)
export class MessageReactionsController {
  constructor(private readonly reactionsService: MessageReactionsService) {}

  @Get('room/:roomId/reactions')
  @Throttle({ default: { limit: 60, ttl: 60000 } })
  async getRoomReactions(@CurrentUser() user: User, @Param('roomId') roomId: string) {
    return this.reactionsService.getRoomReactions(user.id, roomId);
  }

  @Put(':messageId/reaction')
  @Throttle({ default: { limit: 30, ttl: 60000 } })
  async setReaction(
    @CurrentUser() user: User,
    @Param('messageId') messageId: string,
    @Body() dto: SetMessageReactionDto,
  ) {
    return this.reactionsService.setReaction(
      user.id,
      messageId,
      dto.emoji,
      dto.active,
    );
  }
}
