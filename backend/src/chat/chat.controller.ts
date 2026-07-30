import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { User } from '@supabase/supabase-js';
import { CurrentUser } from '../auth/current-user.decorator';
import { SupabaseAuthGuard } from '../auth/supabase-auth.guard';
import { AddFavouriteDto } from './dto/add-favourite.dto';
import { ConversationStarterDto } from './dto/conversation-starter.dto';
import { SendMessageDto } from './dto/send-message.dto';
import { SuggestedRepliesRequestDto } from './dto/suggested-replies-request.dto';
import {
  ChatMessage,
  ChatRoomRecord,
  FavouriteRecord,
} from './interfaces/chat-message.interface';
import { ChatService } from './chat.service';
import { ConversationStarterService } from './conversation-starter.service';

@Controller('chat')
@UseGuards(SupabaseAuthGuard)
export class ChatController {
  constructor(
    private readonly chatService: ChatService,
    private readonly conversationStarterService: ConversationStarterService,
  ) {}

  // Tighter than the app-wide default (10/60s, app.module.ts) - this mints a
  // signed Centrifugo connection token, the most auth-sensitive operation this
  // backend issues (actual login/signup is delegated entirely to Supabase Auth,
  // which is not part of this codebase and has its own rate limiting).
  @Throttle({ default: { limit: 5, ttl: 60000 } })
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

  @Post('llm-proxy')
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  async chatLlmProxy(
    @CurrentUser() user: User | null,
    @Body() dto: { messageText: string },
  ): Promise<{ response: string } | null> {
    if (!user) return null;
    return await this.chatService.llmProxy(user.id, dto.messageText);
  }

  @Post('groups')
  async createGroup(
    @CurrentUser() user: User | null,
    @Body() dto: { name: string; memberIds: string[] },
  ): Promise<ChatRoomRecord | null> {
    if (!user) return null;
    return await this.chatService.createGroup(user.id, dto.name, dto.memberIds);
  }

  @Patch('groups/:roomId/rename')
  async renameGroup(
    @CurrentUser() user: User | null,
    @Param('roomId') roomId: string,
    @Body() dto: { name: string },
  ): Promise<{ success: boolean } | null> {
    if (!user) return null;
    await this.chatService.renameGroup(user.id, roomId, dto.name);
    return { success: true };
  }

  @Post('groups/:roomId/members')
  async addGroupMembers(
    @CurrentUser() user: User | null,
    @Param('roomId') roomId: string,
    @Body() dto: { memberIds: string[] },
  ): Promise<{ success: boolean } | null> {
    if (!user) return null;
    await this.chatService.addGroupMembers(user.id, roomId, dto.memberIds);
    return { success: true };
  }

  @Delete('groups/:roomId/members/:memberId')
  async removeGroupMember(
    @CurrentUser() user: User | null,
    @Param('roomId') roomId: string,
    @Param('memberId') memberId: string,
  ): Promise<{ success: boolean } | null> {
    if (!user) return null;
    await this.chatService.removeGroupMember(user.id, roomId, memberId);
    return { success: true };
  }

  @Get('groups/:roomId/members')
  async getGroupMembers(
    @CurrentUser() user: User | null,
    @Param('roomId') roomId: string,
  ): Promise<any[]> {
    if (!user) return [];
    return await this.chatService.getGroupMembers(roomId);
  }

  @Post('suggested-replies')
  async getSuggestedReplies(
    @CurrentUser() user: User | null,
    @Body() dto: SuggestedRepliesRequestDto,
  ): Promise<{ suggestions: string[] } | null> {
    if (!user) return null;
    return await this.chatService.getSuggestedReplies(user.id, dto);
  }

  @Post('conversation-starters')
  async getConversationStarters(
    @CurrentUser() user: User | null,
    @Body() dto: ConversationStarterDto,
  ): Promise<{ suggestions: string[] } | null> {
    if (!user) return null;
    const suggestions = await this.conversationStarterService.getSuggestions(
      user.id,
      dto.partnerId,
    );
    return { suggestions };
  }
}
