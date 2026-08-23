import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Put,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { User } from '@supabase/supabase-js';
import { CurrentUser } from '../auth/current-user.decorator';
import { SupabaseAuthGuard } from '../auth/supabase-auth.guard';
import { ChatPinsService, ChatPinState } from './chat-pins.service';
import { SetChatPinDto } from './dto/set-chat-pin.dto';

@Controller('chat')
@UseGuards(SupabaseAuthGuard)
export class ChatPinsController {
  constructor(private readonly chatPinsService: ChatPinsService) {}

  @Get('pinned-rooms')
  @Throttle({ default: { limit: 30, ttl: 60000 } })
  async getPinnedRoomIds(@CurrentUser() user: User): Promise<string[]> {
    return this.chatPinsService.getPinnedRoomIds(user.id);
  }

  @Put('rooms/:roomId/pin')
  @Throttle({ default: { limit: 30, ttl: 60000 } })
  async setPinned(
    @CurrentUser() user: User,
    @Param('roomId', new ParseUUIDPipe({ version: '4' })) roomId: string,
    @Body() dto: SetChatPinDto,
  ): Promise<ChatPinState> {
    return this.chatPinsService.setPinned(user.id, roomId, dto.is_pinned);
  }
}
