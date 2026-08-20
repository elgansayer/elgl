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
import { User } from '@supabase/supabase-js';
import { CurrentUser } from '../../auth/current-user.decorator';
import { SupabaseAuthGuard } from '../../auth/supabase-auth.guard';
import {
  AddGroupMembersDto,
  CreateGroupChatDto,
  LeaveGroupChatDto,
  RenameGroupChatDto,
  TransferGroupAdminDto,
  UpdateGroupChatDto,
} from './group-chat.dto';
import { GroupChatService } from './group-chat.service';

@Controller('chat/groups')
@UseGuards(SupabaseAuthGuard)
export class GroupChatController {
  constructor(private readonly groupChatService: GroupChatService) {}

  @Post()
  create(@CurrentUser() user: User, @Body() dto: CreateGroupChatDto) {
    return this.groupChatService.createGroup(user.id, dto);
  }

  @Get(':roomId')
  getGroup(@CurrentUser() user: User, @Param('roomId') roomId: string) {
    return this.groupChatService.getGroup(roomId, user.id);
  }

  @Get(':roomId/members')
  getMembers(
    @CurrentUser() user: User,
    @Param('roomId') roomId: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    const parsedLimit = limit ? Number.parseInt(limit, 10) : undefined;
    const parsedOffset = offset ? Number.parseInt(offset, 10) : undefined;
    return this.groupChatService.getMembers(
      roomId,
      user.id,
      Number.isFinite(parsedLimit) ? parsedLimit : undefined,
      Number.isFinite(parsedOffset) ? parsedOffset : undefined,
    );
  }

  // Compatibility endpoint used by the existing Angular ChatService.
  @Patch(':roomId/rename')
  rename(
    @CurrentUser() user: User,
    @Param('roomId') roomId: string,
    @Body() dto: RenameGroupChatDto,
  ) {
    return this.groupChatService.updateGroup(roomId, user.id, { name: dto.name });
  }

  @Patch(':roomId')
  update(
    @CurrentUser() user: User,
    @Param('roomId') roomId: string,
    @Body() dto: UpdateGroupChatDto,
  ) {
    return this.groupChatService.updateGroup(roomId, user.id, dto);
  }

  @Post(':roomId/members')
  addMembers(
    @CurrentUser() user: User,
    @Param('roomId') roomId: string,
    @Body() dto: AddGroupMembersDto,
  ) {
    return this.groupChatService.addMembers(roomId, user.id, dto);
  }

  @Delete(':roomId/members/:memberId')
  removeMember(
    @CurrentUser() user: User,
    @Param('roomId') roomId: string,
    @Param('memberId') memberId: string,
  ) {
    return this.groupChatService.removeMember(roomId, user.id, memberId);
  }

  @Post(':roomId/admin')
  transferAdmin(
    @CurrentUser() user: User,
    @Param('roomId') roomId: string,
    @Body() dto: TransferGroupAdminDto,
  ) {
    return this.groupChatService.transferAdmin(roomId, user.id, dto);
  }

  @Post(':roomId/leave')
  leave(
    @CurrentUser() user: User,
    @Param('roomId') roomId: string,
    @Body() dto: LeaveGroupChatDto,
  ) {
    return this.groupChatService.leaveGroup(roomId, user.id, dto);
  }
}
