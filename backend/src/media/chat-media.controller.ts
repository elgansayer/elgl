import { Body, Controller, Post, Req, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { SupabaseAuthGuard } from '../auth/supabase-auth.guard';
import {
  ChatMediaUploadService,
  ChatMediaUploadTicket,
} from './chat-media-upload.service';
import { ChatMediaUploadDto } from './dto/chat-media-upload.dto';

interface AuthenticatedRequest {
  user: { id: string };
}

@Controller('media/chat')
@UseGuards(SupabaseAuthGuard)
export class ChatMediaController {
  constructor(private readonly chatMediaUploadService: ChatMediaUploadService) {}

  @Post('presigned-url')
  @Throttle({ default: { limit: 30, ttl: 60000 } })
  createPresignedUrl(
    @Req() req: AuthenticatedRequest,
    @Body() dto: ChatMediaUploadDto,
  ): ChatMediaUploadTicket {
    return this.chatMediaUploadService.createUploadTicket(req.user.id, dto);
  }
}
