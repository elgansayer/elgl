import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { User } from '@supabase/supabase-js';
import { CurrentUser } from '../auth/current-user.decorator';
import { SupabaseAuthGuard } from '../auth/supabase-auth.guard';
import { AddMemberDto } from './dto/add-member.dto';
import { CreateGroupDto, RenameGroupDto } from './dto/group.dto';
import { ChatService, GroupMember } from './chat.service';
import { ChatRoomRecord } from './interfaces/chat-message.interface';

/**
 * Group conversation participants and administration for a chat room.
 *
 * These are the routes the Angular ChatRoomComponent calls for its participant
 * drawer, @mentions and admin panel. Admin-only actions are authorised in
 * ChatService against chat_rooms.admin_id.
 */
@Controller('chat/groups')
@UseGuards(SupabaseAuthGuard)
export class ChatGroupsController {
  constructor(private readonly chatService: ChatService) {}

  @Post()
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  async createGroup(
    @CurrentUser() user: User | null,
    @Body() dto: CreateGroupDto,
  ): Promise<ChatRoomRecord | null> {
    if (!user) return null;
    return await this.chatService.createGroup(user.id, dto.name, dto.memberIds);
  }

  /**
   * Participants of a room, with the profile fields the chat room needs for
   * mentions, the participant drawer and language-aware tools. Members only.
   */
  @Get(':roomId/members')
  async getMembers(
    @Param('roomId') roomId: string,
    @CurrentUser() user: User | null,
  ): Promise<GroupMember[]> {
    if (!user) return [];
    return await this.chatService.getGroupMembers(roomId, user.id);
  }

  @Patch(':roomId/rename')
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  async renameGroup(
    @CurrentUser() user: User | null,
    @Param('roomId') roomId: string,
    @Body() dto: RenameGroupDto,
  ): Promise<{ success: boolean } | null> {
    if (!user) return null;
    await this.chatService.renameGroup(user.id, roomId, dto.name);
    return { success: true };
  }

  @Post(':roomId/members')
  @Throttle({ default: { limit: 20, ttl: 60000 } })
  async addMembers(
    @CurrentUser() user: User | null,
    @Param('roomId') roomId: string,
    @Body() dto: AddMemberDto,
  ): Promise<{ success: boolean } | null> {
    if (!user) return null;
    await this.chatService.addGroupMembers(user.id, roomId, dto.memberIds);
    return { success: true };
  }

  @Delete(':roomId/members/:memberId')
  @Throttle({ default: { limit: 20, ttl: 60000 } })
  async removeMember(
    @CurrentUser() user: User | null,
    @Param('roomId') roomId: string,
    @Param('memberId') memberId: string,
  ): Promise<{ success: boolean } | null> {
    if (!user) return null;
    await this.chatService.removeGroupMember(user.id, roomId, memberId);
    return { success: true };
  }
}
