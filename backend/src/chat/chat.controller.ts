import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { User } from '@supabase/supabase-js';
import { CurrentUser } from '../auth/current-user.decorator';
import { SupabaseAuthGuard } from '../auth/supabase-auth.guard';
import { AddFavouriteDto } from './dto/add-favourite.dto';
import { SendMessageDto } from './dto/send-message.dto';
import {
  ChatMessage,
  ChatRoomRecord,
  FavouriteRecord,
} from './interfaces/chat-message.interface';
import { ChatService } from './chat.service';

@Controller('chat')
@UseGuards(SupabaseAuthGuard)
export class ChatController {
  constructor(private readonly chatService: ChatService) {}

  @Post('token')
  getConnectionToken(
    @CurrentUser() user: User | null,
  ): { token: string } | null {
    if (!user) return null;
    return this.chatService.generateConnectionToken(user.id);
  }

  @Post('messages')
  async sendMessage(
    @CurrentUser() user: User | null,
    @Body() dto: SendMessageDto,
  ): Promise<ChatMessage | null> {
    if (!user) return null;
    return await this.chatService.sendMessage(user.id, dto);
  }

  @Get('rooms')
  async getRooms(@CurrentUser() user: User | null): Promise<ChatRoomRecord[]> {
    if (!user) return [];
    return await this.chatService.getRooms(user.id);
  }

  @Get('messages/:roomId')
  async getMessages(
    @Param('roomId') roomId: string,
    @Query('search') search?: string,
    @CurrentUser() user?: User | null,
  ): Promise<ChatMessage[]> {
    if (user) {
      return await this.chatService.getMessages(roomId, search, user.id);
    }
    return await this.chatService.getMessages(roomId, search);
  }

  @Post('favourites')
  async addFavourite(
    @CurrentUser() user: User | null,
    @Body() dto: AddFavouriteDto,
  ): Promise<{ success: boolean } | null> {
    if (!user) return null;
    await this.chatService.addFavourite(user.id, dto);
    return { success: true };
  }

  @Get('favourites')
  async getFavourites(
    @CurrentUser() user: User | null,
  ): Promise<FavouriteRecord[]> {
    if (!user) return [];
    return await this.chatService.getFavourites(user.id);
  }

  @Post('groups')
  async createGroup(
    @CurrentUser() user: User | null,
    @Body() dto: { name: string; memberIds: string[] },
  ): Promise<ChatRoomRecord | null> {
    if (!user) return null;
    return await this.chatService.createGroup(user.id, dto.name, dto.memberIds);
  }
}
