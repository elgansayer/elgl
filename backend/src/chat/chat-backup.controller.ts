import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { User } from '@supabase/supabase-js';
import { CurrentUser } from '../auth/current-user.decorator';
import { SupabaseAuthGuard } from '../auth/supabase-auth.guard';
import { ChatBackupService } from './chat-backup.service';
import { ImportMessagesDto } from './dto/chat-backup.dto';
import { ChatMessage } from './interfaces/chat-message.interface';

@Controller('chat-backup')
@UseGuards(SupabaseAuthGuard)
export class ChatBackupController {
  constructor(private readonly chatBackupService: ChatBackupService) {}

  @Get('export/:roomId')
  async exportChat(
    @CurrentUser() user: User | null,
    @Param('roomId') roomId: string,
  ): Promise<ChatMessage[]> {
    if (!user) return [];
    return this.chatBackupService.exportChannel(user.id, roomId);
  }

  @Post('import/:roomId')
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  async importChat(
    @CurrentUser() user: User | null,
    @Param('roomId') roomId: string,
    @Body() dto: ImportMessagesDto,
  ): Promise<{ importedCount: number } | null> {
    if (!user) return null;
    const importedCount = await this.chatBackupService.importChannel(
      user.id,
      roomId,
      dto.messages,
    );
    return { importedCount };
  }
}
