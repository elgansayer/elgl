import {
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { User } from '@supabase/supabase-js';
import { CurrentUser } from '../auth/current-user.decorator';
import { SupabaseAuthGuard } from '../auth/supabase-auth.guard';
import { ChatArchiveService } from './chat-archive.service';

@Controller('chat')
@UseGuards(SupabaseAuthGuard)
export class ChatArchiveController {
  constructor(private readonly chatArchiveService: ChatArchiveService) {}

  @Get('archived-rooms')
  async getArchivedRoomIds(
    @CurrentUser() user: User | null,
  ): Promise<string[]> {
    if (!user) {
      throw new UnauthorizedException();
    }
    return this.chatArchiveService.getArchivedRoomIds(user.id);
  }

  @Post('rooms/:roomId/archive')
  @Throttle({ default: { limit: 20, ttl: 60000 } })
  async archiveRoom(
    @CurrentUser() user: User | null,
    @Param('roomId', new ParseUUIDPipe({ version: '4' })) roomId: string,
  ): Promise<{ success: true }> {
    if (!user) {
      throw new UnauthorizedException();
    }
    await this.chatArchiveService.archiveRoom(user.id, roomId);
    return { success: true };
  }

  @Post('rooms/:roomId/unarchive')
  @Throttle({ default: { limit: 20, ttl: 60000 } })
  async unarchiveRoom(
    @CurrentUser() user: User | null,
    @Param('roomId', new ParseUUIDPipe({ version: '4' })) roomId: string,
  ): Promise<{ success: true }> {
    if (!user) {
      throw new UnauthorizedException();
    }
    await this.chatArchiveService.unarchiveRoom(user.id, roomId);
    return { success: true };
  }
}
