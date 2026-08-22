import { Body, Controller, Param, Put, UseGuards } from '@nestjs/common';
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
