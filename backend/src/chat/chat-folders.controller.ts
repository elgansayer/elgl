import {
  Controller,
  Delete,
  Get,
  Header,
  Param,
  ParseUUIDPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { User } from '@supabase/supabase-js';
import { CurrentUser } from '../auth/current-user.decorator';
import { SupabaseAuthGuard } from '../auth/supabase-auth.guard';
import { ChatRoomRecord } from './interfaces/chat-message.interface';
import { ChatFoldersService } from './chat-folders.service';

@Controller('chat/folders')
@UseGuards(SupabaseAuthGuard)
@Header('Cache-Control', 'no-store')
export class ChatFoldersController {
  constructor(private readonly chatFoldersService: ChatFoldersService) {}

  @Get('archived')
  async getArchivedRooms(
    @CurrentUser() user: User | null,
  ): Promise<ChatRoomRecord[]> {
    if (!user) return [];
    return this.chatFoldersService.getArchivedRooms(user.id);
  }

  @Post('archived/:roomId')
  @Throttle({ default: { limit: 60, ttl: 60000 } })
  async archiveRoom(
    @CurrentUser() user: User | null,
    @Param('roomId', new ParseUUIDPipe()) roomId: string,
  ): Promise<{ success: boolean } | null> {
    if (!user) return null;
    await this.chatFoldersService.archiveRoom(user.id, roomId);
    return { success: true };
  }

  @Delete('archived/:roomId')
  @Throttle({ default: { limit: 60, ttl: 60000 } })
  async unarchiveRoom(
    @CurrentUser() user: User | null,
    @Param('roomId', new ParseUUIDPipe()) roomId: string,
  ): Promise<{ success: boolean } | null> {
    if (!user) return null;
    await this.chatFoldersService.unarchiveRoom(user.id, roomId);
    return { success: true };
  }

  /**
   * Locked chats are the product's hidden-chat folder. The client only calls
   * this endpoint after its app-unlock flow succeeds. Server-side membership
   * remains authoritative, so callers cannot request arbitrary room IDs.
   */
  @Get('hidden')
  async getHiddenRooms(
    @CurrentUser() user: User | null,
  ): Promise<ChatRoomRecord[]> {
    if (!user) return [];
    return this.chatFoldersService.getHiddenRooms(user.id);
  }
}
