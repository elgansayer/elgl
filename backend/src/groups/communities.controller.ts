import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  Req,
  UseGuards,
  HttpCode,
  UnauthorizedException,
} from '@nestjs/common';
import { SupabaseAuthGuard } from '../auth/supabase-auth.guard';
import { GroupsService } from './groups.service';
import { CreateCommunityDto } from './dto/create-community.dto';
import { UpdateCommunityDto } from './dto/update-community.dto';
import { AddGroupToCommunityDto } from './dto/add-group-to-community.dto';

@Controller('communities')
@UseGuards(SupabaseAuthGuard)
export class CommunitiesController {
  constructor(private readonly groupsService: GroupsService) {}

  @Post()
  async create(@Body() dto: CreateCommunityDto, @Req() req: any) {
    const ownerId = req.user.id;
    return this.groupsService.createCommunity(
      ownerId,
      dto.name,
      dto.description,
    );
  }

  @Get()
  async listMine(@Req() req: any) {
    const userId = req.user.id;
    return this.groupsService.getMyCommunities(userId);
  }

  @Get(':id')
  async get(@Param('id') id: string) {
    return this.groupsService.getCommunity(id);
  }

  @Patch(':id')
  @HttpCode(200)
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateCommunityDto,
    @Req() req: any,
  ) {
    const requesterId = req.user.id;
    const community = await this.groupsService.getCommunity(id);
    if (community.owner_id !== requesterId) {
      throw new UnauthorizedException(
        'Only the owner can update this community',
      );
    }
    await this.groupsService.updateCommunity(id, dto);
    return { success: true };
  }

  @Delete(':id')
  @HttpCode(204)
  async remove(@Param('id') id: string, @Req() req: any): Promise<void> {
    const requesterId = req.user.id;
    const community = await this.groupsService.getCommunity(id);
    if (community.owner_id !== requesterId) {
      throw new UnauthorizedException(
        'Only the owner can delete this community',
      );
    }
    await this.groupsService.deleteCommunity(id);
  }

  @Post(':id/groups')
  async addGroup(
    @Param('id') id: string,
    @Body() dto: AddGroupToCommunityDto,
    @Req() req: any,
  ) {
    const requesterId = req.user.id;
    const community = await this.groupsService.getCommunity(id);
    if (community.owner_id !== requesterId) {
      throw new UnauthorizedException('Only the owner can add groups');
    }
    await this.groupsService.addGroupToCommunity(id, dto.groupId);
    return { success: true };
  }

  @Delete(':id/groups/:groupId')
  @HttpCode(204)
  async removeGroup(
    @Param('id') id: string,
    @Param('groupId') groupId: string,
    @Req() req: any,
  ): Promise<void> {
    const requesterId = req.user.id;
    const community = await this.groupsService.getCommunity(id);
    if (community.owner_id !== requesterId) {
      throw new UnauthorizedException('Only the owner can remove groups');
    }
    await this.groupsService.removeGroupFromCommunity(id, groupId);
  }

  @Get(':id/groups')
  async getGroups(@Param('id') id: string) {
    return this.groupsService.getGroupsByCommunity(id);
  }
}
