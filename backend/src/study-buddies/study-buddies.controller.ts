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
import {
  MatchmakingRateLimit,
  StudyBuddiesRateLimiterGuard,
} from './study-buddies-rate-limiter.guard';

interface AuthenticatedUser {
  sub?: string;
  id?: string;
}

@Controller('study-buddies')
@UseGuards(SupabaseAuthGuard, StudyBuddiesRateLimiterGuard)
export class StudyBuddiesController {
  constructor(private readonly sbService: StudyBuddiesService) {}

  @Post('request')
  @MatchmakingRateLimit({ maxRequests: 5, windowSeconds: 60 })
  requestBuddy(
    @Body() dto: StudyBuddyRequestDto,
    @Request() req: { user?: AuthenticatedUser },
  ): Promise<BuddyRequest> {
    const userId = req.user?.sub ?? req.user?.id ?? '';
    return this.sbService.requestBuddy(dto, userId);
  }

  @Get('requests')
  @MatchmakingRateLimit({ maxRequests: 15, windowSeconds: 60 })
  getIncomingRequests(
    @Request() req: { user?: AuthenticatedUser },
  ): Promise<BuddyRequest[]> {
    const userId = req.user?.sub ?? req.user?.id ?? '';
    return this.sbService.getIncomingRequests(userId);
  }

  @Post('requests/:id/accept')
  @MatchmakingRateLimit({ maxRequests: 10, windowSeconds: 60 })
  acceptRequest(
    @Param('id') id: string,
    @Request() req: { user?: AuthenticatedUser },
  ): Promise<BuddyRequest> {
    const userId = req.user?.sub ?? req.user?.id ?? '';
    return this.sbService.respondToRequest(id, userId, 'accepted');
  }

  @Post('requests/:id/decline')
  @MatchmakingRateLimit({ maxRequests: 10, windowSeconds: 60 })
  declineRequest(
    @Param('id') id: string,
    @Request() req: { user?: AuthenticatedUser },
  ): Promise<BuddyRequest> {
    const userId = req.user?.sub ?? req.user?.id ?? '';
    return this.sbService.respondToRequest(id, userId, 'declined');
  }

  @Get('matches')
  @MatchmakingRateLimit({ maxRequests: 10, windowSeconds: 60 })
  getMatches(
    @Request() req: { user?: AuthenticatedUser },
  ): Promise<UserProfile[]> {
    const userId = req.user?.sub ?? req.user?.id ?? '';
    return this.sbService.getPotentialBuddies(userId);
  }

  @Post('follow')
  @MatchmakingRateLimit({ maxRequests: 20, windowSeconds: 60 })
  async followUser(
    @Body('targetUserId') targetUserId: string,
    @Request() req: { user?: AuthenticatedUser },
  ): Promise<{ message: string }> {
    const userId = req.user?.sub ?? req.user?.id ?? '';
    await this.sbService.followUser(userId, targetUserId);
    return { message: 'Followed' };
  }

  @Delete('unfollow')
  @MatchmakingRateLimit({ maxRequests: 20, windowSeconds: 60 })
  async unfollowUser(
    @Body('targetUserId') targetUserId: string,
    @Request() req: { user?: AuthenticatedUser },
  ): Promise<{ message: string }> {
    const userId = req.user?.sub ?? req.user?.id ?? '';
    await this.sbService.unfollowUser(userId, targetUserId);
    return { message: 'Unfollowed' };
  }

  @Get('channel')
  @MatchmakingRateLimit({ maxRequests: 30, windowSeconds: 60 })
  getChannel(
    @Query('partnerId') partnerId: string,
    @Request() req: { user?: AuthenticatedUser },
  ): { channel: string } {
    const userId = req.user?.sub ?? req.user?.id ?? '';
    return this.sbService.getOrCreateChannel(userId, partnerId);
  }
}
