import {
  Body,
  Controller,
  Delete,
  Get,
  HttpException,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { User } from '@supabase/supabase-js';
import { CurrentUser } from '../auth/current-user.decorator';
import { SupabaseAuthGuard } from '../auth/supabase-auth.guard';
import { AddFavouriteDto } from './dto/add-favourite.dto';
import { ConversationStarterDto } from './dto/conversation-starter.dto';
import { ReplyToStatusUpdateDto } from './dto/reply-to-status-update.dto';
import { AiGenerateReplyDto, SendMessageDto } from './dto/send-message.dto';
import { LlmProxyDto } from './dto/llm-proxy.dto';
import { SuggestedRepliesRequestDto } from './dto/suggested-replies-request.dto';
import { AddLabelDto, RemoveLabelDto } from './dto/label.dto';
import { DeleteMessageDto } from './dto/delete-message.dto';
import { FixMessageDto } from './dto/fix-message.dto';
import { SetWallpaperDto } from './dto/set-wallpaper.dto';
import { ShareContactDto } from './dto/share-contact.dto';
import { UpdateMessageStatusDto } from './dto/update-message-status.dto';
import {
  ChatMessage,
  ChatRoomRecord,
  FavouriteRecord,
} from './interfaces/chat-message.interface';
import { ChatService } from './chat.service';
import { CentrifugoService } from './centrifugo.service';
import { ConversationStarterService } from './conversation-starter.service';
import { TranslationService } from './translation.service';
import type { Request, Response } from 'express';

@Controller('chat')
@UseGuards(SupabaseAuthGuard)
export class ChatController {
  constructor(
    private readonly chatService: ChatService,
    private readonly centrifugoService: CentrifugoService,
    private readonly conversationStarterService: ConversationStarterService,
    private readonly translationService: TranslationService,
  ) {}

  // Tighter than the app-wide default (10/60s, app.module.ts) - this mints a
  // signed Centrifugo connection token, the most auth-sensitive operation this
  // backend issues (actual login/signup is delegated entirely to Supabase Auth,
  // which is not part of this codebase and has its own rate limiting).
  // Additionally enforces Redis-backed sliding-window WebSocket connection
  // rate limiting (CENTRIFUGO_CONNECTION_RATE_LIMIT per window).
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @Post('token')
  async getConnectionToken(
    @CurrentUser() user: User | null,
    @Req() request: Request,
    @Res() response: Response,
  ): Promise<{ token: string } | null> {
    if (!user) {
      response.status(HttpStatus.UNAUTHORIZED).json(null);
      return null;
    }

    const rateLimit = await this.centrifugoService.checkConnectionRateLimit(
      user.id,
      request?.ip,
    );
    const allowed =
      typeof rateLimit === 'boolean' ? rateLimit : rateLimit.allowed;
    if (!allowed) {
      const exception = new HttpException(
        'Too many WebSocket connection attempts. Please wait before reconnecting.',
        HttpStatus.TOO_MANY_REQUESTS,
      );
      response.header('Retry-After', '30').status(429).json({
        statusCode: 429,
        message: exception.message,
      });
      return null;
    }

    const token =
      (await this.chatService.generateConnectionToken?.(user.id)) ?? '';
    const result = { token };
    response.json(result);
    return result;
  }

  @Post('messages')
  async sendMessage(
    @CurrentUser() user: User | null,
    @Body() dto: SendMessageDto,
  ): Promise<ChatMessage | null> {
    if (!user) return null;
    return await this.chatService.sendMessage(user.id, dto);
  }

  @Post('contacts/share')
  @Throttle({ default: { limit: 20, ttl: 60000 } })
  async shareContact(
    @CurrentUser() user: User | null,
    @Body() dto: ShareContactDto,
  ): Promise<ChatMessage | null> {
    if (!user) return null;
    return await this.chatService.shareContact(user.id, dto);
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
    if (!user) {
      return await this.chatService.getMessages(roomId, search);
    }
    return await this.chatService.getMessages(roomId, search, user.id);
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

  @Delete('favourites/:id')
  async deleteFavourite(
    @CurrentUser() user: User | null,
    @Param('id') id: string,
  ): Promise<{ success: boolean } | null> {
    if (!user) return null;
    await this.chatService.deleteFavourite(user.id, id);
    return { success: true };
  }

  @Post('llm-proxy')
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  async chatLlmProxy(
    @CurrentUser() user: User | null,
    @Body() dto: LlmProxyDto,
  ): Promise<{ response: string } | null> {
    if (!user) return null;
    return await this.chatService.llmProxy(user.id, dto.messageText);
  }

  @Post('ai-partner')
  @Throttle({ default: { limit: 20, ttl: 60000 } })
  async generateAiPartnerReply(
    @CurrentUser() user: User | null,
    @Body() dto: AiGenerateReplyDto,
  ): Promise<{ response: string } | null> {
    if (!user) return null;
    return await this.chatService.generateAiReply(user.id, dto.text);
  }

  @Post('suggested-replies')
  async getSuggestedReplies(
    @CurrentUser() user: User | null,
    @Body() dto: SuggestedRepliesRequestDto,
  ): Promise<{ suggestions: string[] } | null> {
    if (!user) return null;
    return {
      suggestions: await this.chatService.getSuggestedReplies(user.id, dto),
    };
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

  @Post('translate-voiceroom')
  async translateVoiceroomText(
    @CurrentUser() user: User | null,
    @Body() dto: { text: string; target_language: string },
  ): Promise<{ translated_text: string; detected_language: string } | null> {
    if (!user) return null;
    const detected = await this.translationService.detectLanguage(dto.text);
    const translated = await this.translationService.translate(
      dto.text,
      detected,
      dto.target_language,
    );
    return { translated_text: translated, detected_language: detected };
  }

  @Post('translate-real-time')
  @Throttle({ default: { limit: 20, ttl: 60000 } })
  async translateRealTime(
    @CurrentUser() user: User | null,
    @Body() dto: { text: string; target_language: string },
  ): Promise<{
    translated_text: string;
    original_text: string;
    target_language: string;
    detected_language: string;
  } | null> {
    if (!user) return null;
    const { translatedText, detectedLanguage } =
      await this.translationService.translateWithDetection(
        dto.text,
        dto.target_language,
      );
    return {
      original_text: dto.text,
      translated_text: translatedText,
      target_language: dto.target_language,
      detected_language: detectedLanguage,
    };
  }

  @Post('messages/status-reply')
  async replyToStatusUpdate(
    @CurrentUser() user: User | null,
    @Body() dto: ReplyToStatusUpdateDto,
  ): Promise<ChatMessage | null> {
    if (!user) return null;
    return await this.chatService.replyToStatusUpdate(user.id, dto);
  }

  @Post('messages/:messageId/correct')
  async correctMessage(
    @CurrentUser() user: User | null,
    @Param('messageId') messageId: string,
    @Body() dto: { correctedText: string; explanation?: string },
  ): Promise<ChatMessage | null> {
    if (!user) return null;
    return await this.chatService.correctMessage(
      user.id,
      messageId,
      dto.correctedText,
      dto.explanation,
    );
  }

  @Patch('messages/:messageId/fix')
  async fixMessage(
    @CurrentUser() user: User | null,
    @Param('messageId') messageId: string,
    @Body() dto: FixMessageDto,
  ): Promise<ChatMessage | null> {
    if (!user) return null;
    return await this.chatService.fixMessage(
      user.id,
      messageId,
      dto.correctedText,
      dto.explanation,
    );
  }

  @Patch('messages/:messageId/status')
  async updateMessageStatus(
    @CurrentUser() user: User | null,
    @Param('messageId') messageId: string,
    @Body() dto: UpdateMessageStatusDto,
  ): Promise<{ success: boolean } | null> {
    if (!user) return null;
    await this.chatService.updateMessageStatus(user.id, messageId, dto.status);
    return { success: true };
  }

  @Post('messages/:messageId/view')
  async viewMessageMedia(
    @CurrentUser() user: User | null,
    @Param('messageId') messageId: string,
  ): Promise<{ success: boolean } | null> {
    if (!user) return null;
    await this.chatService.viewMessageMedia(user.id, messageId);
    return { success: true };
  }

  @Delete('messages/:messageId')
  async deleteMessage(
    @CurrentUser() user: User | null,
    @Param('messageId') messageId: string,
    @Body() dto: DeleteMessageDto,
  ): Promise<{ success: boolean } | null> {
    if (!user) return null;
    await this.chatService.deleteMessage(user.id, messageId, dto.scope);
    return { success: true };
  }

  @Get('rooms/:roomId/members')
  async getRoomMembers(
    @Param('roomId') roomId: string,
    @CurrentUser() user: User | null,
  ): Promise<
    { user_id: string; display_name?: string; avatar_url?: string | null }[]
  > {
    if (!user) return [];
    const members = await this.chatService.getGroupMembers(roomId, user.id);
    return members.map(
      (m: {
        user_id: string;
        user?: { display_name?: string; avatar_url?: string | null };
      }) => ({
        user_id: m.user_id,
        display_name: m.user?.display_name,
        avatar_url: m.user?.avatar_url,
      }),
    );
  }

  // Chat Lock endpoints
  @Post('rooms/:roomId/lock')
  async lockChat(
    @CurrentUser() user: User | null,
    @Param('roomId') roomId: string,
  ): Promise<{ success: boolean } | null> {
    if (!user) return null;
    await this.chatService.lockChat(user.id, roomId);
    return { success: true };
  }

  @Post('rooms/:roomId/unlock')
  async unlockChat(
    @CurrentUser() user: User | null,
    @Param('roomId') roomId: string,
  ): Promise<{ success: boolean } | null> {
    if (!user) return null;
    await this.chatService.unlockChat(user.id, roomId);
    return { success: true };
  }

  @Get('locked-rooms')
  async getLockedRooms(@CurrentUser() user: User | null): Promise<string[]> {
    if (!user) return [];
    return this.chatService.getLockedChats(user.id);
  }

  // ── Label management endpoints ──

  @Post('labels')
  async addLabel(
    @CurrentUser() user: User | null,
    @Body() dto: AddLabelDto,
  ): Promise<{ success: boolean } | null> {
    if (!user) return null;
    await this.chatService.addLabel(user.id, dto.room_id, dto.label);
    return { success: true };
  }

  @Delete('labels')
  async removeLabel(
    @CurrentUser() user: User | null,
    @Body() dto: RemoveLabelDto,
  ): Promise<{ success: boolean } | null> {
    if (!user) return null;
    await this.chatService.removeLabel(user.id, dto.room_id, dto.label);
    return { success: true };
  }

  @Get('labels')
  async getUserLabels(@CurrentUser() user: User | null): Promise<string[]> {
    if (!user) return [];
    return this.chatService.getUserLabels(user.id);
  }

  @Get('labels/:label/rooms')
  async getRoomsByLabel(
    @CurrentUser() user: User | null,
    @Param('label') label: string,
  ): Promise<ChatRoomRecord[]> {
    if (!user) return [];
    return this.chatService.getRoomsByLabel(user.id, label);
  }

  @Get('rooms/:roomId/export')
  async exportChatHistory(
    @CurrentUser() user: User | null,
    @Param('roomId') roomId: string,
  ): Promise<ChatMessage[]> {
    if (!user) return [];
    return await this.chatService.exportChatHistory(user.id, roomId);
  }

  @Get('rooms/:roomId/greeting')
  async getRoomGreeting(
    @CurrentUser() user: User | null,
    @Param('roomId') roomId: string,
  ): Promise<{ greetingMessage?: string; awayMessage?: string }> {
    if (!user) return {};
    return await this.chatService.getRoomGreeting(roomId, user.id);
  }

  @Post('rooms/:roomId/wallpaper')
  async setWallpaper(
    @CurrentUser() user: User | null,
    @Param('roomId') roomId: string,
    @Body() dto: SetWallpaperDto,
  ): Promise<{ success: boolean } | null> {
    if (!user) return null;
    await this.chatService.setWallpaper(user.id, roomId, dto);
    return { success: true };
  }

  @Get('rooms/:roomId/wallpaper')
  async getWallpaper(
    @CurrentUser() user: User | null,
    @Param('roomId') roomId: string,
  ): Promise<{ wallpaperUrl: string | null } | null> {
    if (!user) return null;
    const wallpaperUrl = await this.chatService.getWallpaper(roomId);
    return { wallpaperUrl };
  }
}
