import {
  Controller,
  Post,
  Get,
  Delete,
  Patch,
  Param,
  Body,
  UseGuards,
  Req,
  HttpCode,
} from '@nestjs/common';
import { SupabaseAuthGuard } from '../auth/supabase-auth.guard';
import { CommunitiesService } from './communities.service';
import { CreateCommunityDto } from '../groups/dto/create-community.dto';
import { AddGroupDto } from './dto/add-group.dto';
import { UpdateCommunityDto } from '../groups/dto/update-community.dto';

@Controller('communities')
export class CommunitiesController {
  constructor(private readonly communitiesService: CommunitiesService) {}

  @Post()
  @UseGuards(SupabaseAuthGuard)
  async create(
    @Body() dto: CreateCommunityDto,
    @Req() req: { user: { id: string } },
  ) {
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
  async listMine(@Req() req: { user: { id: string } }) {
    const ownerId = req.user.id;
    return this.communitiesService.listByOwner(ownerId);
  }

  @Patch(':communityId')
  @UseGuards(SupabaseAuthGuard)
  async update(
    @Param('communityId') communityId: string,
    @Body() dto: UpdateCommunityDto,
    @Req() req: { user: { id: string } },
  ) {
    const userId = req.user.id;
    await this.communitiesService.update(communityId, dto, userId);
    return { success: true };
  }

  @Delete(':communityId')
  @HttpCode(204)
  @UseGuards(SupabaseAuthGuard)
  async remove(
    @Param('communityId') communityId: string,
    @Req() req: { user: { id: string } },
  ) {
    const userId = req.user.id;
    await this.communitiesService.delete(communityId, userId);
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
  async removeGroup(@Param('groupId') groupId: string) {
    return this.communitiesService.removeGroup(groupId);
  }

  @Get(':communityId/groups')
  @UseGuards(SupabaseAuthGuard)
  async getGroups(@Param('communityId') communityId: string) {
    return this.communitiesService.getGroups(communityId);
  }
}
