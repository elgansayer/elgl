import {
  Controller,
  Get,
  Post,
  Delete,
  Query,
  Body,
  Req,
  UseGuards,
} from '@nestjs/common';
import { SupabaseAuthGuard } from '../auth/supabase-auth.guard';
import { StudyBuddiesService } from './study-buddies.service';
import { StudyBuddyRequestDto } from './dto/study-buddy.dto';

@Controller('study-buddies')
@UseGuards(SupabaseAuthGuard)
export class StudyBuddiesController {
  constructor(private readonly sbService: StudyBuddiesService) {}

  @Post('request')
  requestBuddy(@Body() dto: StudyBuddyRequestDto, @Req() req: any) {
    const userId = req.user.id;
    return this.sbService.requestBuddy(dto, userId);
  }

  @Get('matches')
  getMatches(@Req() req: any) {
    const userId = req.user.id;
    return this.sbService.getPotentialBuddies(userId);
  }

  @Post('follow')
  async followUser(
    @Body('targetUserId') targetUserId: string,
    @Req() req: any,
  ) {
    const userId = req.user.id;
    await this.sbService.followUser(userId, targetUserId);
    return { message: 'Followed' };
  }

  @Delete('unfollow')
  async unfollowUser(
    @Body('targetUserId') targetUserId: string,
    @Req() req: any,
  ) {
    const userId = req.user.id;
    await this.sbService.unfollowUser(userId, targetUserId);
    return { message: 'Unfollowed' };
  }

  @Get('channel')
  getChannel(@Query('partnerId') partnerId: string, @Req() req: any) {
    const userId = req.user.id;
    return this.sbService.getOrCreateChannel(userId, partnerId);
  }
}
