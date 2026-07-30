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
import { AuthGuard } from '@nestjs/passport';
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
  @UseGuards(AuthGuard('jwt'))
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
  @UseGuards(AuthGuard('jwt'))
  async getGroups(@Req() req: any, @Query('interestId') interestId?: string) {
    if (interestId) {
      return this.groupsService.getGroupsByInterest(interestId);
    }
    return this.groupsService.getAllGroups();
  }

  @Get(':groupId/members')
  @UseGuards(AuthGuard('jwt'))
  async getMembers(@Param('groupId') groupId: string) {
    return this.groupsService.getGroupMembers(groupId);
  }

  @Get(':groupId/settings')
  @UseGuards(AuthGuard('jwt'))
  async getSettings(@Param('groupId') groupId: string) {
    return this.groupsService.getSettings(groupId);
  }

  @Get(':groupId/announcements')
  @UseGuards(AuthGuard('jwt'))
  async getAnnouncements(@Param('groupId') groupId: string) {
    return this.groupsService.getAnnouncements(groupId);
  }

  @Get(':groupId')
  @UseGuards(AuthGuard('jwt'))
  async getGroupInfo(@Param('groupId') groupId: string) {
    return this.groupsService.getGroupInfo(groupId);
  }

  @Post(':groupId/add-member')
  @UseGuards(AuthGuard('jwt'))
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
  @UseGuards(AuthGuard('jwt'))
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
  @UseGuards(AuthGuard('jwt'))
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
  @UseGuards(AuthGuard('jwt'))
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

  @Get('discoverable')
  @UseGuards(AuthGuard('jwt'))
  async getDiscoverableGroups(@Req() req: any) {
    const userId = req.user.id;
    return this.groupsService.getDiscoverableGroups(userId);
  }

  @Post(':groupId/join')
  @UseGuards(AuthGuard('jwt'))
  async joinGroup(@Param('groupId') groupId: string, @Req() req: any) {
    const userId = req.user.id;
    return this.groupsService.joinGroup(groupId, userId);
  }

  @Get(':groupId/resources')
  @UseGuards(AuthGuard('jwt'))
  async getGroupResources(@Param('groupId') groupId: string) {
    return this.groupsService.getGroupResources(groupId);
  }

  @Delete(':groupId/resources/:resourceId')
  @UseGuards(AuthGuard('jwt'))
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
