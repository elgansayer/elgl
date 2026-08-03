import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  Body,
  Query,
  UseGuards,
  Req,
  UnauthorizedException,
  HttpCode,
} from '@nestjs/common';
import { SupabaseAuthGuard } from '../auth/supabase-auth.guard';
import { User } from '@supabase/supabase-js';
import { CurrentUser } from '../auth/current-user.decorator';
import { GroupsService } from './groups.service';
import { AddMemberDto } from './dto/add-member.dto';
import { RemoveMemberDto } from './dto/remove-member.dto';
import { UpdateGroupSettingsDto } from './dto/update-group-settings.dto';
import { CreateGroupDto } from './dto/create-group.dto';
import { SendAnnouncementDto } from './dto/send-announcement.dto';

@Controller('groups')
export class GroupsController {
  constructor(private readonly groupsService: GroupsService) {}

  @Post()
  @UseGuards(SupabaseAuthGuard)
  async create(@Body() dto: CreateGroupDto, @Req() req: any) {
    const ownerId = req.user.id;
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
  async getGroups(@Req() req: any, @Query('interestId') interestId?: string) {
    if (interestId) {
      return this.groupsService.getGroupsByInterest(interestId);
    }
    return this.groupsService.getDiscoverableGroups(req.user.id);
  }

  @Get('discoverable')
  @UseGuards(SupabaseAuthGuard)
  async getDiscoverableGroups(@Req() req: any) {
    const userId = req.user.id;
    return this.groupsService.getDiscoverableGroups(userId);
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
    @Req() req: any,
  ) {
    const requesterId = req.user.id;
    const isAdmin = await this.groupsService.isAdmin(requesterId, groupId);
    if (!isAdmin)
      throw new UnauthorizedException('Only the group admin can add members');
    return this.groupsService.addMember(groupId, dto.memberId);
  }

  @Post(':groupId/remove-member')
  @UseGuards(SupabaseAuthGuard)
  async removeMember(
    @Param('groupId') groupId: string,
    @Body() dto: RemoveMemberDto,
    @Req() req: any,
  ) {
    const requesterId = req.user.id;
    const isAdmin = await this.groupsService.isAdmin(requesterId, groupId);
    if (!isAdmin)
      throw new UnauthorizedException(
        'Only the group admin can remove members',
      );
    return this.groupsService.removeMember(groupId, dto.memberId);
  }

  @Post(':groupId/settings')
  @UseGuards(SupabaseAuthGuard)
  async updateSettings(
    @Param('groupId') groupId: string,
    @Body() dto: UpdateGroupSettingsDto,
    @Req() req: any,
  ) {
    const requesterId = req.user.id;
    const isAdmin = await this.groupsService.isAdmin(requesterId, groupId);
    if (!isAdmin)
      throw new UnauthorizedException(
        'Only the group admin can update settings',
      );
    return this.groupsService.updateSettings(groupId, dto);
  }

  @Post(':groupId/announcement')
  @UseGuards(SupabaseAuthGuard)
  async sendAnnouncement(
    @Param('groupId') groupId: string,
    @Body() dto: SendAnnouncementDto,
    @Req() req: any,
  ): Promise<{ success: boolean }> {
    const requesterId = req.user.id;
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
  async joinGroup(@Param('groupId') groupId: string, @Req() req: any) {
    const userId = req.user.id;
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
    @Req() req: any,
  ): Promise<void> {
    const requesterId = req.user.id;
    return this.groupsService.deleteGroupResource(
      groupId,
      resourceId,
      requesterId,
    );
  }
}
