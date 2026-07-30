import {
  Controller,
  Post,
  Get,
  Delete,
  Param,
  Body,
  UseGuards,
  Req,
} from '@nestjs/common';
import { SupabaseAuthGuard } from '../auth/supabase-auth.guard';
import { CommunitiesService } from './communities.service';
import { CreateCommunityDto } from './dto/create-community.dto';
import { AddGroupDto } from './dto/add-group.dto';

@Controller('communities')
export class CommunitiesController {
  constructor(private readonly communitiesService: CommunitiesService) {}

  @Post()
  @UseGuards(SupabaseAuthGuard)
  async create(@Body() dto: CreateCommunityDto, @Req() req: any) {
    const ownerId = req.user.id;
    return this.communitiesService.create(ownerId, dto);
  }

  @Get(':communityId')
  @UseGuards(SupabaseAuthGuard)
  async find(@Param('communityId') communityId: string) {
    return this.communitiesService.findById(communityId);
  }

  @Get()
  @UseGuards(SupabaseAuthGuard)
  async listMine(@Req() req: any) {
    const ownerId = req.user.id;
    return this.communitiesService.listByOwner(ownerId);
  }

  @Post(':communityId/groups')
  @UseGuards(SupabaseAuthGuard)
  async addGroup(
    @Param('communityId') communityId: string,
    @Body() dto: AddGroupDto,
  ) {
    return this.communitiesService.addGroup(communityId, dto.groupId);
  }

  @Delete(':communityId/groups/:groupId')
  @UseGuards(SupabaseAuthGuard)
  async removeGroup(
    @Param('communityId') communityId: string,
    @Param('groupId') groupId: string,
  ) {
    return this.communitiesService.removeGroup(groupId);
  }

  @Get(':communityId/groups')
  @UseGuards(SupabaseAuthGuard)
  async getGroups(@Param('communityId') communityId: string) {
    return this.communitiesService.getGroups(communityId);
  }
}
