import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  Body,
  UseGuards,
  UnauthorizedException,
} from '@nestjs/common';
import { User } from '@supabase/supabase-js';
import { CurrentUser } from '../auth/current-user.decorator';
import { SupabaseAuthGuard } from '../auth/supabase-auth.guard';
import { BlocksService } from './blocks.service';

@Controller('blocks')
export class BlocksController {
  constructor(private readonly blocksService: BlocksService) {}

  @UseGuards(SupabaseAuthGuard)
  @Get()
  async getBlockedUsers(@CurrentUser() user: User | null) {
    if (!user) throw new UnauthorizedException();
    return this.blocksService.getBlockedUsers(user.id);
  }

  @UseGuards(SupabaseAuthGuard)
  @Post()
  async blockUser(
    @CurrentUser() user: User | null,
    @Body() body: { blocked_id: string },
  ) {
    if (!user) throw new UnauthorizedException();
    return this.blocksService.blockUser(user.id, body.blocked_id);
  }

  @UseGuards(SupabaseAuthGuard)
  @Delete(':blockedId')
  async unblockUser(
    @CurrentUser() user: User | null,
    @Param('blockedId') blockedId: string,
  ) {
    if (!user) throw new UnauthorizedException();
    return this.blocksService.unblockUser(user.id, blockedId);
  }
}
