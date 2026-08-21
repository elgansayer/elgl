import { Controller, Get, Post, Body } from '@nestjs/common';
import { QuickRepliesService, QuickReply } from './quick-replies.service';
import { CreateQuickReplyDto } from './dto/create-quick-reply.dto';

@Controller('chat/quick-replies')
export class QuickRepliesController {
  constructor(private readonly quickRepliesService: QuickRepliesService) {}

  @Get()
  getQuickReplies(): QuickReply[] {
    return this.quickRepliesService.getQuickReplies();
  }

  @Post()
  createQuickReply(@Body() dto: CreateQuickReplyDto): QuickReply {
    return this.quickRepliesService.createQuickReply(dto);
  }
}
