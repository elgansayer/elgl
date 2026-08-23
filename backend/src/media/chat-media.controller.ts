import { Body, Controller, Post, Req, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { SupabaseAuthGuard } from '../auth/supabase-auth.guard';
import { ChatMessage } from '../chat/interfaces/chat-message.interface';
import { ChatMediaMessageService } from './chat-media-message.service';
import {
  ChatMediaUploadService,
  ChatMediaUploadTicket,
} from './chat-media-upload.service';
import { ChatMediaUploadDto } from './dto/chat-media-upload.dto';
import { SendChatMediaMessageDto } from './dto/send-chat-media-message.dto';

interface AuthenticatedRequest {
  user: { id: string };
}

@Controller('media/chat')
@UseGuards(SupabaseAuthGuard)
export class ChatMediaController {
  constructor(
    private readonly chatMediaUploadService: ChatMediaUploadService,
    private readonly chatMediaMessageService: ChatMediaMessageService,
  ) {}

  @Post('presigned-url')
  @Throttle({ default: { limit: 30, ttl: 60000 } })
  createPresignedUrl(
    @Req() req: AuthenticatedRequest,
    @Body() dto: ChatMediaUploadDto,
  ): ChatMediaUploadTicket {
    return this.chatMediaUploadService.createUploadTicket(req.user.id, dto);
  }

  @Post('send')
  @Throttle({ default: { limit: 60, ttl: 60000 } })
  sendUploadedMedia(
    @Req() req: AuthenticatedRequest,
    @Body() dto: SendChatMediaMessageDto,
  ): Promise<ChatMessage> {
    return this.chatMediaMessageService.send(req.user.id, dto);
  }
}
