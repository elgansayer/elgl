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
import type { User } from '@supabase/supabase-js';
import { CurrentUser } from '../auth/current-user.decorator';
import { SupabaseAuthGuard } from '../auth/supabase-auth.guard';
import {
  AddGroupChatMembersDto,
  CreateGroupChatDto,
  TransferGroupChatAdminDto,
  UpdateGroupChatDto,
} from './dto/group-chat.dto';
import {
  GroupChatMember,
  GroupChatRecord,
  GroupChatService,
} from './group-chat.service';

@Controller('chat/groups')
@UseGuards(SupabaseAuthGuard)
export class GroupChatController {
  constructor(private readonly groupChatService: GroupChatService) {}

  @Post()
  create(
    @CurrentUser() user: User,
    @Body() dto: CreateGroupChatDto,
  ): Promise<GroupChatRecord> {
    return this.groupChatService.create(user.id, dto);
  }

  @Get(':roomId')
  get(
    @CurrentUser() user: User,
    @Param('roomId') roomId: string,
  ): Promise<GroupChatRecord> {
    return this.groupChatService.get(user.id, roomId);
  }

  @Get(':roomId/members')
  members(
    @CurrentUser() user: User,
    @Param('roomId') roomId: string,
  ): Promise<GroupChatMember[]> {
    return this.groupChatService.members(user.id, roomId);
  }

  @Patch(':roomId')
  update(
    @CurrentUser() user: User,
    @Param('roomId') roomId: string,
    @Body() dto: UpdateGroupChatDto,
  ): Promise<GroupChatRecord> {
    return this.groupChatService.update(user.id, roomId, dto);
  }

  // Backward-compatible route used by the existing Angular ChatService.
  @Patch(':roomId/rename')
  rename(
    @CurrentUser() user: User,
    @Param('roomId') roomId: string,
    @Body() dto: { name: string },
  ): Promise<GroupChatRecord> {
    return this.groupChatService.update(user.id, roomId, { name: dto.name });
  }

  @Post(':roomId/members')
  addMembers(
    @CurrentUser() user: User,
    @Param('roomId') roomId: string,
    @Body() dto: AddGroupChatMembersDto,
  ): Promise<GroupChatMember[]> {
    return this.groupChatService.addMembers(user.id, roomId, dto);
  }

  @Delete(':roomId/members/:memberId')
  async removeMember(
    @CurrentUser() user: User,
    @Param('roomId') roomId: string,
    @Param('memberId') memberId: string,
  ): Promise<{ success: true }> {
    await this.groupChatService.removeMember(user.id, roomId, memberId);
    return { success: true };
  }

  @Post(':roomId/admin')
  transferAdmin(
    @CurrentUser() user: User,
    @Param('roomId') roomId: string,
    @Body() dto: TransferGroupChatAdminDto,
  ): Promise<GroupChatRecord> {
    return this.groupChatService.transferAdmin(user.id, roomId, dto);
  }

  @Post(':roomId/leave')
  leave(
    @CurrentUser() user: User,
    @Param('roomId') roomId: string,
  ): Promise<{ deleted: boolean }> {
    return this.groupChatService.leave(user.id, roomId);
  }
}
