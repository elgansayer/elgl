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
import { User } from '@supabase/supabase-js';
import { CurrentUser } from '../auth/current-user.decorator';
import { SupabaseAuthGuard } from '../auth/supabase-auth.guard';
import { CreateGroupDto } from './dto/create-group.dto';
import { AddMemberDto } from './dto/add-member.dto';
import { GroupsService } from './groups.service';
import { ChatRoomRecord } from './interfaces/chat-message.interface';

@UseGuards(SupabaseAuthGuard)
@Controller('groups')
export class GroupsController {
  constructor(private readonly groupsService: GroupsService) {}

  @Post()
  async createGroup(
    @CurrentUser() user: User | null,
    @Body() dto: CreateGroupDto,
  ): Promise<ChatRoomRecord | null> {
    if (!user) return null;
    return await this.groupsService.createGroup(
      user.id,
      dto.name,
      dto.memberIds,
    );
  }

  @Patch(':roomId/rename')
  async renameGroup(
    @CurrentUser() user: User | null,
    @Param('roomId') roomId: string,
    @Body() dto: { name: string },
  ): Promise<{ success: boolean } | null> {
    if (!user) return null;
    await this.groupsService.renameGroup(user.id, roomId, dto.name);
    return { success: true };
  }

  @Post(':roomId/members')
  async addGroupMembers(
    @CurrentUser() user: User | null,
    @Param('roomId') roomId: string,
    @Body() dto: AddMemberDto,
  ): Promise<{ success: boolean } | null> {
    if (!user) return null;
    await this.groupsService.addGroupMembers(user.id, roomId, dto.memberIds);
    return { success: true };
  }

  @Delete(':roomId/members/:memberId')
  async removeGroupMember(
    @CurrentUser() user: User | null,
    @Param('roomId') roomId: string,
    @Param('memberId') memberId: string,
  ): Promise<{ success: boolean } | null> {
    if (!user) return null;
    await this.groupsService.removeGroupMember(user.id, roomId, memberId);
    return { success: true };
  }

  @Get(':roomId/members')
  async getGroupMembers(
    @CurrentUser() user: User | null,
    @Param('roomId') roomId: string,
  ): Promise<any[]> {
    if (!user) return [];
    return await this.groupsService.getGroupMembers(roomId);
  }

  @Post(':roomId/invite-code')
  async generateInviteCode(
    @CurrentUser() user: User | null,
    @Param('roomId') roomId: string,
  ): Promise<{ code: string } | null> {
    if (!user) return null;
    const code = await this.groupsService.generateInviteCode(user.id, roomId);
    return { code };
  }

  @Get(':roomId/invite-link')
  async generateInviteLink(
    @CurrentUser() user: User | null,
    @Param('roomId') roomId: string,
  ): Promise<{ code: string; url: string } | null> {
    if (!user) return null;
    return await this.groupsService.generateInviteLink(user.id, roomId);
  }

  @Get('invite-info/:code')
  async getInviteInfo(
    @CurrentUser() user: User | null,
    @Param('code') code: string,
  ): Promise<{ roomId: string; title: string } | null> {
    if (!user) return null;
    return await this.groupsService.getInviteInfo(code);
  }

  @Post('join-by-code')
  async joinByInviteCode(
    @CurrentUser() user: User | null,
    @Body() body: { code: string },
  ): Promise<{ success: boolean } | null> {
    if (!user) return null;
    await this.groupsService.joinByInviteCode(user.id, body.code);
    return { success: true };
  }
}
