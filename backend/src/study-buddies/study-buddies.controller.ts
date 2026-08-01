import {
  Controller,
  Get,
  Post,
  Delete,
  Query,
  Body,
  Param,
  Request,
  UseGuards,
} from '@nestjs/common';
import { SupabaseAuthGuard } from '../auth/supabase-auth.guard';
import { StudyBuddiesService, BuddyRequest } from './study-buddies.service';
import { StudyBuddyRequestDto } from './dto/study-buddy.dto';
import { UserProfile } from '../users/interfaces/user-profile.interface';

interface AuthenticatedUser {
  sub?: string;
  id?: string;
}

@Controller('study-buddies')
@UseGuards(SupabaseAuthGuard)
export class StudyBuddiesController {
  constructor(private readonly sbService: StudyBuddiesService) {}

  @Post('request')
  requestBuddy(
    @Body() dto: StudyBuddyRequestDto,
    @Request() req: { user?: AuthenticatedUser },
  ): Promise<BuddyRequest> {
    const userId = req.user?.sub ?? req.user?.id ?? '';
    return this.sbService.requestBuddy(dto, userId);
  }

  @Get('requests')
  getIncomingRequests(
    @Request() req: { user?: AuthenticatedUser },
  ): Promise<BuddyRequest[]> {
    const userId = req.user?.sub ?? req.user?.id ?? '';
    return this.sbService.getIncomingRequests(userId);
  }

  @Post('requests/:id/accept')
  acceptRequest(
    @Param('id') id: string,
    @Request() req: { user?: AuthenticatedUser },
  ): Promise<BuddyRequest> {
    const userId = req.user?.sub ?? req.user?.id ?? '';
    return this.sbService.respondToRequest(id, userId, 'accepted');
  }

  @Post('requests/:id/decline')
  declineRequest(
    @Param('id') id: string,
    @Request() req: { user?: AuthenticatedUser },
  ): Promise<BuddyRequest> {
    const userId = req.user?.sub ?? req.user?.id ?? '';
    return this.sbService.respondToRequest(id, userId, 'declined');
  }

  @Get('matches')
  getMatches(
    @Request() req: { user?: AuthenticatedUser },
  ): Promise<UserProfile[]> {
    const userId = req.user?.sub ?? req.user?.id ?? '';
    return this.sbService.getPotentialBuddies(userId);
  }

  @Post('follow')
  async followUser(
    @Body('targetUserId') targetUserId: string,
    @Request() req: { user?: AuthenticatedUser },
  ): Promise<{ message: string }> {
    const userId = req.user?.sub ?? req.user?.id ?? '';
    await this.sbService.followUser(userId, targetUserId);
    return { message: 'Followed' };
  }

  @Delete('unfollow')
  async unfollowUser(
    @Body('targetUserId') targetUserId: string,
    @Request() req: { user?: AuthenticatedUser },
  ): Promise<{ message: string }> {
    const userId = req.user?.sub ?? req.user?.id ?? '';
    await this.sbService.unfollowUser(userId, targetUserId);
    return { message: 'Unfollowed' };
  }

  @Get('channel')
  getChannel(
    @Query('partnerId') partnerId: string,
    @Request() req: { user?: AuthenticatedUser },
  ): { channel: string } {
    const userId = req.user?.sub ?? req.user?.id ?? '';
    return this.sbService.getOrCreateChannel(userId, partnerId);
  }
}
