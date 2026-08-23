import { Body, Controller, Post, Req, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { SupabaseAuthGuard } from '../auth/supabase-auth.guard';
import { SendChatMediaMessageDto } from '../media/dto/send-chat-media-message.dto';
import { ChatMediaMessageService } from './chat-media-message.service';
import { ChatMessage } from './interfaces/chat-message.interface';

interface AuthenticatedRequest {
  user: { id: string };
}

@Controller('media/chat')
@UseGuards(SupabaseAuthGuard)
export class ChatMediaSendController {
  constructor(private readonly chatMediaMessageService: ChatMediaMessageService) {}

  @Post('send')
  @Throttle({ default: { limit: 60, ttl: 60000 } })
  sendUploadedMedia(
    @Req() req: AuthenticatedRequest,
    @Body() dto: SendChatMediaMessageDto,
  ): Promise<ChatMessage> {
    return this.chatMediaMessageService.send(req.user.id, dto);
  }
}
