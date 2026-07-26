import {
  Controller,
  Post,
  Put,
  Delete,
  Body,
  Param,
  UseGuards,
  Request,
} from '@nestjs/common';
import { GroupsService } from './groups.service';
import {
  CreateGroupDto,
  RenameGroupDto,
  GroupMemberDto,
} from './dto/group.dto';
import { SupabaseAuthGuard } from '../auth/guards/supabase-auth.guard';

@UseGuards(SupabaseAuthGuard)
@Controller('groups')
export class GroupsController {
  constructor(private readonly groupsService: GroupsService) {}

  @Post()
  createGroup(@Request() req: any, @Body() dto: CreateGroupDto) {
    return this.groupsService.createGroup(req.user.id, dto.name);
  }

  @Put(':id/rename')
  renameGroup(
    @Request() req: any,
    @Param('id') id: string,
    @Body() dto: RenameGroupDto,
  ) {
    return this.groupsService.renameGroup(req.user.id, id, dto.name);
  }

  @Post(':id/members')
  addMember(
    @Request() req: any,
    @Param('id') id: string,
    @Body() dto: GroupMemberDto,
  ) {
    return this.groupsService.addMember(req.user.id, id, dto.user_id);
  }

  @Delete(':id/members/:userId')
  removeMember(
    @Request() req: any,
    @Param('id') id: string,
    @Param('userId') userId: string,
  ) {
    return this.groupsService.removeMember(req.user.id, id, userId);
  }
}
