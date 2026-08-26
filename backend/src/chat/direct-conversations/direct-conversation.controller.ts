import {
  Body,
  Controller,
  Post,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { User } from '@supabase/supabase-js';
import { CurrentUser } from '../../auth/current-user.decorator';
import { SupabaseAuthGuard } from '../../auth/supabase-auth.guard';
import { OpenDirectConversationDto } from './open-direct-conversation.dto';
import { DirectConversationService } from './direct-conversation.service';

@Controller('chat/direct-conversations')
@UseGuards(SupabaseAuthGuard)
export class DirectConversationController {
  constructor(
    private readonly directConversationService: DirectConversationService,
  ) {}

  @Post()
  @Throttle({ default: { limit: 20, ttl: 60000 } })
  async openOrCreate(
    @CurrentUser() user: User | null,
    @Body() dto: OpenDirectConversationDto,
  ): Promise<{ roomId: string }> {
    if (!user) throw new UnauthorizedException();
    const roomId = await this.directConversationService.openOrCreate(
      user.id,
      dto.targetUserId,
    );
    return { roomId };
  }
}
