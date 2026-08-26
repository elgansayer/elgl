import { Body, Controller, Post, UnauthorizedException, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { User } from '@supabase/supabase-js';
import { CurrentUser } from '../auth/current-user.decorator';
import { SupabaseAuthGuard } from '../auth/supabase-auth.guard';
import { ChatTypingService } from './chat-typing.service';
import { SendTypingDto } from './dto/send-typing.dto';

@Controller('chat')
@UseGuards(SupabaseAuthGuard)
export class ChatTypingController {
  constructor(private readonly chatTypingService: ChatTypingService) {}

  @Post('typing')
  @Throttle({ default: { limit: 40, ttl: 60000 } })
  async publishTyping(
    @CurrentUser() user: User | null,
    @Body() dto: SendTypingDto,
  ): Promise<{ success: true }> {
    if (!user) {
      throw new UnauthorizedException();
    }

    await this.chatTypingService.publish(user.id, dto);
    return { success: true };
  }
}
