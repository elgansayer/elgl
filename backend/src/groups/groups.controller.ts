import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  Body,
  Query,
  UseGuards,
  UnauthorizedException,
  HttpCode,
} from '@nestjs/common';
import { SupabaseAuthGuard } from '../auth/supabase-auth.guard';
import type { User } from '@supabase/supabase-js';
import { CurrentUser } from '../auth/current-user.decorator';
import { GroupsService } from './groups.service';
import { AddMemberDto } from './dto/add-member.dto';
import { RemoveMemberDto } from './dto/remove-member.dto';
import { UpdateGroupSettingsDto } from './dto/update-group-settings.dto';
import { CreateGroupDto } from './dto/create-group.dto';
import { SendAnnouncementDto } from './dto/send-announcement.dto';
import { RenameGroupDto } from './dto/rename-group.dto';

@Controller('groups')
export class GroupsController {
  constructor(private readonly groupsService: GroupsService) {}

  @Post()
  @UseGuards(SupabaseAuthGuard)
  async create(@Body() dto: CreateGroupDto, @CurrentUser() user: User) {
    const ownerId = user.id;
    return this.groupsService.createGroup(
      ownerId,
      dto.name,
      dto.community_id,
      dto.interestId,
      dto.maxMembers,
    );
  }

  @Get()
  @UseGuards(SupabaseAuthGuard)
  async getGroups(
    @CurrentUser() user: User,
    @Query('interestId') interestId?: string,
  ) {
    if (interestId) {
      return this.groupsService.getGroupsByInterest(interestId);
    }
    return this.groupsService.getDiscoverableGroups(user.id);
  }

  @Get('discoverable')
  @UseGuards(SupabaseAuthGuard)
  async getDiscoverableGroups(@CurrentUser() user: User) {
    return this.groupsService.getDiscoverableGroups(user.id);
  }

  @Get(':groupId/members')
  @UseGuards(SupabaseAuthGuard)
  async getMembers(@Param('groupId') groupId: string) {
    return this.groupsService.getGroupMembers(groupId);
  }

  @Get(':groupId/settings')
  @UseGuards(SupabaseAuthGuard)
  async getSettings(@Param('groupId') groupId: string) {
    return this.groupsService.getSettings(groupId);
  }

  @Get(':groupId/announcements')
  @UseGuards(SupabaseAuthGuard)
  async getAnnouncements(@Param('groupId') groupId: string) {
    return this.groupsService.getAnnouncements(groupId);
  }

  @Get('mine')
  @UseGuards(SupabaseAuthGuard)
  async getMyAdminGroups(@CurrentUser() user: User | null) {
    if (!user) throw new UnauthorizedException('Not authenticated');
    return this.groupsService.getMyAdminGroups(user.id);
  }

  @Get(':groupId')
  @UseGuards(SupabaseAuthGuard)
  async getGroupInfo(@Param('groupId') groupId: string) {
    return this.groupsService.getGroupInfo(groupId);
  }

  @Post(':groupId/add-member')
  @UseGuards(SupabaseAuthGuard)
  async addMember(
    @Param('groupId') groupId: string,
    @Body() dto: AddMemberDto,
    @CurrentUser() user: User,
  ) {
    const requesterId = user.id;
    const isAdmin = await this.groupsService.isAdmin(requesterId, groupId);
    if (!isAdmin)
      throw new UnauthorizedException('Only the group admin can add members');
    return this.groupsService.addMember(groupId, dto.memberId, requesterId);
  }

  @Post(':groupId/remove-member')
  @UseGuards(SupabaseAuthGuard)
  async removeMember(
    @Param('groupId') groupId: string,
    @Body() dto: RemoveMemberDto,
    @CurrentUser() user: User,
  ) {
    const requesterId = user.id;
    const isAdmin = await this.groupsService.isAdmin(requesterId, groupId);
    if (!isAdmin)
      throw new UnauthorizedException(
        'Only the group admin can remove members',
      );
    return this.groupsService.removeMember(groupId, dto.memberId, requesterId);
  }

  @Post(':groupId/settings')
  @UseGuards(SupabaseAuthGuard)
  async updateSettings(
    @Param('groupId') groupId: string,
    @Body() dto: UpdateGroupSettingsDto,
    @CurrentUser() user: User,
  ) {
    const requesterId = user.id;
    const isAdmin = await this.groupsService.isAdmin(requesterId, groupId);
    if (!isAdmin)
      throw new UnauthorizedException(
        'Only the group admin can update settings',
      );
    return this.groupsService.updateSettings(groupId, dto);
  }

  @Post(':groupId/restrict-send-messages')
  @UseGuards(SupabaseAuthGuard)
  async restrictSendMessages(
    @Param('groupId') groupId: string,
    @Body() dto: { canSendMessages: boolean },
    @CurrentUser() user: User,
  ) {
    const requesterId = user.id;
    const isAdmin = await this.groupsService.isAdmin(requesterId, groupId);
    if (!isAdmin)
      throw new UnauthorizedException(
        'Only the group admin can restrict sending messages',
      );
    return this.groupsService.updateSettings(groupId, {
      can_send_messages: dto.canSendMessages,
    });
  }

  @Post(':groupId/restrict-edit-info')
  @UseGuards(SupabaseAuthGuard)
  async restrictEditInfo(
    @Param('groupId') groupId: string,
    @Body() dto: { canEditInfo: boolean },
    @CurrentUser() user: User,
  ) {
    const requesterId = user.id;
    const isAdmin = await this.groupsService.isAdmin(requesterId, groupId);
    if (!isAdmin)
      throw new UnauthorizedException(
        'Only the group admin can restrict editing group info',
      );
    return this.groupsService.updateSettings(groupId, {
      can_edit_info: dto.canEditInfo,
    });
  }

  @Post(':groupId/rename')
  @UseGuards(SupabaseAuthGuard)
  async renameGroup(
    @Param('groupId') groupId: string,
    @Body() dto: RenameGroupDto,
    @CurrentUser() user: User,
  ) {
    const requesterId = user.id;
    const isAdmin = await this.groupsService.isAdmin(requesterId, groupId);
    if (!isAdmin)
      throw new UnauthorizedException(
        'Only the group admin can rename the group',
      );
    return this.groupsService.renameGroup(groupId, dto.newName, requesterId);
  }

  @Post(':groupId/announcement')
  @UseGuards(SupabaseAuthGuard)
  async sendAnnouncement(
    @Param('groupId') groupId: string,
    @Body() dto: SendAnnouncementDto,
    @CurrentUser() user: User,
  ): Promise<{ success: boolean }> {
    const requesterId = user.id;
    const isAdmin = await this.groupsService.isAdmin(requesterId, groupId);
    if (!isAdmin)
      throw new UnauthorizedException(
        'Only group admins can send announcements',
      );
    return this.groupsService.sendAnnouncement(
      groupId,
      dto.message,
      requesterId,
    );
  }

  @Post(':groupId/join')
  @UseGuards(SupabaseAuthGuard)
  async joinGroup(
    @Param('groupId') groupId: string,
    @CurrentUser() user: User,
  ) {
    const userId = user.id;
    return this.groupsService.joinGroup(groupId, userId);
  }

  @Get(':groupId/resources')
  @UseGuards(SupabaseAuthGuard)
  async getGroupResources(@Param('groupId') groupId: string) {
    return this.groupsService.getGroupResources(groupId);
  }

  @Delete(':groupId/resources/:resourceId')
  @UseGuards(SupabaseAuthGuard)
  @HttpCode(204)
  async deleteGroupResource(
    @Param('groupId') groupId: string,
    @Param('resourceId') resourceId: string,
    @CurrentUser() user: User,
  ): Promise<void> {
    const requesterId = user.id;
    return this.groupsService.deleteGroupResource(
      groupId,
      resourceId,
      requesterId,
    );
  }
}
